# 水彩リスタイルの絵（restyle-incoming/*.png）を、ゲーム用に整える: python tools/make-art-restyle.py
# ・ChatGPT の「透過」画像は白〜薄い灰色の市松模様が焼きこまれているので、外側からつながった市松模様だけを消す
#   （市松の2色に近い「色みのない明るい点」だけをたどるので、内側の白いローブ・白い毛・クリーム色の体は残る）
# ・ふちは水彩のにじみを残すため、境目の数画素だけ明るさに応じて半透明にする
# ・表情シートは塊ごとに切り分け、シートごとに同じ倍率で縮める（下端・中央そろえはゲーム側）
# ・まばたきは *_blink.png から目のまわりだけを取り出し、元の表情の絵に重ねる（体がずれてチラつかないように）
# ・背景・1枚絵は 3:2 の中央 4:3 を 960x720 に
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'restyle-incoming')
OUT = os.path.join(ROOT, 'img')
S = 3
W, H = 320 * S, 240 * S
FACES = ['normal', 'happy', 'sad', 'surprise', 'angry', 'cry']
REPORT = []


def save(im, name):
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=88, method=6)


def load(name):
    return Image.open(os.path.join(SRC, name + '.png')).convert('RGB')


def remove_checker(rgb):
    """市松模様を消して RGBA を返す"""
    a = np.asarray(rgb).astype(int)
    mx = a.max(axis=2); mn = a.min(axis=2)
    border = np.concatenate([mn[:6].ravel(), mn[-6:].ravel(), mn[:, :6].ravel(), mn[:, -6:].ravel()])
    lo = np.percentile(border, 3) - 5          # 市松の暗いほうの色より少し下まで
    cand = (mx - mn <= 10) & (mn >= lo)
    lab, _ = ndimage.label(cand)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])
    # 閉じこめられた市松（腕と体のすき間など）：ある程度の広さがあり、2色の模様になっている所だけ消す
    inner, n = ndimage.label(cand & ~bg)
    if n:
        sizes = ndimage.sum(np.ones_like(mn), inner, index=np.arange(1, n + 1))
        for i, sz in enumerate(sizes, 1):
            if sz < 400: continue
            v = mn[inner == i]
            if (v < 249).mean() > 0.3 and (v >= 249).mean() > 0.3:   # 明暗2色がまざる＝市松
                bg |= inner == i
    alpha = np.where(bg, 0.0, 1.0)
    # 境目の数画素：明るく色みのない点ほど透明に（水彩のにじみを残しつつ白いふちを消す）
    dist = ndimage.distance_transform_edt(~bg)
    band = (dist > 0) & (dist <= 3)
    soft = np.clip((252 - mn) / 30.0 + (mx - mn) / 25.0, 0, 1)
    alpha = np.where(band, np.minimum(alpha, soft), alpha)
    out = np.dstack([a.astype(np.uint8), (alpha * 255).astype(np.uint8)])
    return Image.fromarray(out, 'RGBA')


def shrink(im, size):
    return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


def clean(im):
    a = im.getchannel('A').point(lambda v: 0 if v < 8 else v)
    im.putalpha(a)
    return im


def cells(im, cols, rows, join=18):
    """塊ごとに切り分け（触角やキラキラは join 画素まで近ければ同じキャラ）。左上から順に返す"""
    al = np.asarray(im.getchannel('A'))
    solid = al >= 96
    for j in (join, 12, 8, 5, 3, 1):   # となりどうしがくっつくなら、つなぐ距離を短く
        grown = ndimage.binary_dilation(solid, iterations=j)
        lab, n = ndimage.label(grown)
        sizes = ndimage.sum(solid, lab, index=np.arange(1, n + 1))
        big = (sizes >= sizes.max() * 0.3).sum()
        if big >= cols * rows:
            break
    keep = list(np.argsort(sizes)[::-1][:cols * rows] + 1)
    boxes = []
    for i in keep:
        ys, xs = np.nonzero((lab == i) & (al >= 8))
        boxes.append((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, i))
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    res = []
    for r in range(rows):
        row = sorted(boxes[r * cols:(r + 1) * cols], key=lambda b: b[0])
        for x0, y0, x1, y1, i in row:
            c = np.asarray(im).copy()
            c[lab != i] = 0          # となりのキャラやはぐれた点は入れない
            res.append(Image.fromarray(c, 'RGBA').crop((x0, y0, x1, y1)))
    return res


def sheet(name, cols, rows, height, prefix, labels):
    cs = cells(remove_checker(load(name)), cols, rows)
    assert len(cs) == cols * rows, (name, len(cs))
    k = height * S / max(c.height for c in cs)
    outs = {}
    for c, lab in zip(cs, labels):
        s = clean(shrink(c, (max(1, round(c.width * k)), max(1, round(c.height * k)))))
        save(s, '%s_%s' % (prefix, lab))
        outs[lab] = s
    hs = [c.height for c in cs]
    if max(hs) > min(hs) * 1.08:
        REPORT.append('%s: 表情ごとの高さの差が大きい %s' % (name, hs))
    print(name, [c.size for c in cs], '->', round(k, 3))
    return outs


# 元の絵がちがう表情で描かれていたシート：{キャラ: {表情: 代わりに使う閉じ目のコマ番号}}
BLINK_SRC = {'mii': {'surprise': 0}}   # ミィの3コマ目は「泣き」で描かれていたので、ふつうの閉じ目を使う
# 目と口が大きく重なり、目だけをきれいに取り出せない表情はまばたきなし（js/pixel.js の noBlink と合わせる）
SKIP_BLINK = {('gald', 'surprise')}


def blink(name, base):
    """目を閉じた版：シートから切り出して元の絵に大きさ・位置を合わせ、両目のまわりだけ重ねる"""
    cs = cells(remove_checker(load(name + '_blink')), 3, 1)
    for k, face in enumerate(['normal', 'sad', 'surprise']):
        if (name, face) in SKIP_BLINK:
            REPORT.append('%s_%s_blink: 目と口の差分が重なり目だけを取り出せないため、まばたきなし' % (name, face))
            p = os.path.join(OUT, '%s_%s_blink.webp' % (name, face))
            if os.path.exists(p): os.remove(p)
            continue
        src = BLINK_SRC.get(name, {}).get(face, k)
        if src != k:
            REPORT.append('%s_blink の%dコマ目は別の表情で描かれていたため、%dコマ目の閉じ目で代用' % (name, k + 1, src + 1))
        b = base[face]
        s = clean(shrink(cs[src], b.size))
        A = np.asarray(b).astype(float); B = np.asarray(s).astype(float)
        # ずれを ±8 画素で探す（形の重なりが一番よい所）
        best = None
        for dy in range(-8, 9, 2):
            for dx in range(-8, 9, 2):
                Bs = np.roll(np.roll(B, dy, 0), dx, 1)
                d = np.abs(A[..., 3] - Bs[..., 3]).mean()
                if best is None or d < best[0]: best = (d, dx, dy)
        _, dx, dy = best
        B = np.roll(np.roll(B, dy, 0), dx, 1)
        h, w = A.shape[:2]
        solid = np.minimum(A[..., 3], B[..., 3]) > 200
        diff = np.abs(A[..., :3] - B[..., :3]).sum(2) * solid
        diff[int(h * 0.62):] = 0
        m = ndimage.binary_opening(diff > 90, iterations=2)
        lab, n = ndimage.label(ndimage.binary_dilation(m, iterations=6))
        # 両目＝同じ高さで、左右に離れて並ぶ2つの塊の組（口や涙は選ばない。顔が中央にないキャラもいる）
        comps = []
        for i in range(1, n + 1):
            ys, xs = np.nonzero((lab == i) & m)
            if len(xs) < 20: continue
            comps.append((len(xs), xs.mean(), ys.mean(), i))
        pair = None
        for a in comps:
            for c in comps:
                if w * 0.12 < c[1] - a[1] < w * 0.6 and abs(a[2] - c[2]) < h * 0.07 and min(a[0], c[0]) > max(a[0], c[0]) * 0.25:
                    if pair is None or a[0] + c[0] > pair[0]:
                        pair = (a[0] + c[0], a[3], c[3])
        if pair is None:
            REPORT.append('%s_%s_blink: 目の位置が見つからない' % (name, face)); continue
        eyes = np.isin(lab, [pair[1], pair[2]])
        eyes = ndimage.binary_dilation(eyes, iterations=6)
        mask = np.asarray(Image.fromarray((eyes * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))) / 255.0
        mask = mask * (B[..., 3] / 255.0) * (A[..., 3] > 0)   # 透明な所の色（黒）は混ぜない
        out = A.copy()
        out[..., :3] = A[..., :3] * (1 - mask[..., None]) + B[..., :3] * mask[..., None]
        save(Image.fromarray(out.astype(np.uint8), 'RGBA'), '%s_%s_blink' % (name, face))
        ys, xs = np.nonzero(eyes)
        print('  blink', name, face, 'src', src, 'shift', dx, dy, 'eyes', (xs.min(), ys.min(), xs.max(), ys.max()), 'size', b.size)


def bg(name):
    im = load(name)
    w, h = im.size
    cw = round(h * 4 / 3)
    x = (w - cw) // 2
    return im.crop((x, 0, x + cw, h)).resize((W, H), Image.LANCZOS)


if __name__ == '__main__':
    import sys
    only = set(sys.argv[1:])
    want = lambda n: not only or n in only
    if want('bg'):
        for n in ['room', 'room_night', 'space']:
            save(bg(n), n)
        for n in ['end_pururu', 'end_lumie', 'end_gald', 'end_konoha', 'end_mii', 'end_noa']:
            save(bg(n), n)
        p = load('paper')
        p.resize((720, 1080), Image.LANCZOS).save(os.path.join(OUT, 'paper.webp'), 'WEBP', quality=82, method=6)
    if want('chars'):
        for n, h in [('pururu', 128), ('lumie', 152), ('gald', 150), ('konoha', 146), ('mii', 134), ('noa', 140)]:
            base = sheet(n, 3, 2, h, n, FACES)
            if n != 'noa':
                blink(n, base)
        sheet('moti', 3, 1, 100, 'moti', ['pout', 'happy', 'weak'])
        sheet('thomas', 3, 1, 146, 'thomas', ['smile', 'shy', 'surprise'])
        sheet('rino', 3, 1, 90, 'rino', ['happy', 'surprise', 'sad'])
        sheet('cast2', 3, 1, 142, 'cast2', ['mother_smile', 'pipi_smile', 'harumo_smile'])
        for a in ['mother', 'pipi', 'harumo']:
            os.replace(os.path.join(OUT, 'cast2_%s_smile.webp' % a), os.path.join(OUT, '%s_smile.webp' % a))
    if want('items'):
        sheet('items', 4, 1, 64, 'item', ['bread', 'comm', 'flower', 'drawing'])
        sheet('items2', 3, 2, 64, 'item', ['photo', 'inari', 'misanga', 'letter', 'spanner', 'musicbox'])
        sheet('fx', 3, 2, 30, 'fx', ['heart', 'sparkle', 'anger', 'sweat', 'tear', 'bang'])
    if want('nurse'):
        for c, lab in zip(cells(remove_checker(load('nurse')), 3, 1), ['normal', 'happy', 'worry']):
            side = min(c.width, c.height)
            sq = c.crop(((c.width - side) // 2, 0, (c.width - side) // 2 + side, side))
            save(clean(shrink(sq, (56 * S, 56 * S))), 'nurse_icon_%s' % lab)
    if want('logo'):
        logo = remove_checker(load('logo'))
        logo = logo.crop(logo.getchannel('A').point(lambda v: 255 if v >= 8 else 0).getbbox())
        k = 320 * S / logo.width
        clean(shrink(logo, (320 * S, round(logo.height * k)))).save(os.path.join(OUT, 'logo.png'), optimize=True)
    print('done')
    for r in REPORT:
        print('REPORT', r)
