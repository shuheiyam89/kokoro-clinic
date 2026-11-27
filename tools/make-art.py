# ChatGPTで作った絵（画像/work/*.png）を、ゲーム用に整える: python tools/make-art.py
# ・ゲームの座標は 320x240。絵はその S 倍（なめらかな高画質）で書き出し、ゲーム側で縮めて描く
# ・表情シートは1つずつ切り分け、同じ倍率で縮めて下端・中央をそろえる
# ・体から離れた「！」や怒りマークは消す（ゲーム側の演出と重なるため）
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '画像', 'work')
OUT = os.path.join(ROOT, 'img')
os.makedirs(OUT, exist_ok=True)
S = 3                     # 画質の倍率（js/pixel.js の S と同じにする）
W, H = 320 * S, 240 * S
FACES = ['normal', 'happy', 'sad', 'surprise', 'angry', 'cry']


def save(im, name):
    # スマホで軽く読めるよう WebP で書き出す（なめらかなまま、ファイルは小さく）
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=88, method=6)


def load(name):
    return Image.open(os.path.join(SRC, name + '.png'))


def shrink(im, size):
    # 透明部分の色がにじまないよう、乗算済みアルファで、なめらかに縮める
    return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


def clean(im):
    # ほとんど見えない半透明のもやを消す（ふちのなめらかさは残す）
    a = im.getchannel('A').point(lambda v: 0 if v < 24 else v)
    im.putalpha(a)
    return im


def bands(profile, min_gap):
    # 投影で中身のある区間を探す（すき間が min_gap 以上なら区切る）
    out, start, gap = [], None, 0
    for i, v in enumerate(profile):
        if v:
            if start is None:
                start = i
            gap = 0
            end = i
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                out.append((start, end + 1)); start = None
    if start is not None:
        out.append((start, end + 1))
    return out


def components(mask_px, w, h, step):
    # mask_px[x, y] が真の点を、つながった塊ごとに集める（step 画素ごとに見る）
    lab = {}; comps = []
    for y in range(0, h, step):
        for x in range(0, w, step):
            if (x, y) in lab or not mask_px(x, y): continue
            idn = len(comps); stack = [(x, y)]; lab[(x, y)] = idn; pts = []
            while stack:
                cx, cy = stack.pop(); pts.append((cx, cy))
                for nx, ny in ((cx + step, cy), (cx - step, cy), (cx, cy + step), (cx, cy - step)):
                    if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in lab and mask_px(nx, ny):
                        lab[(nx, ny)] = idn; stack.append((nx, ny))
            comps.append(pts)
    return comps


def drop_marks(c, step=3):
    # 体から離れた小さな飾り（「！」や怒りマークなど）を消す。顔の上の涙など、体の範囲内の水色は残す
    px = c.load(); w, h = c.size
    comps = components(lambda x, y: px[x, y][3] >= 110, w, h, step)
    if len(comps) < 2: return c
    main = max(comps, key=len)
    mx0 = min(p[0] for p in main); mx1 = max(p[0] for p in main); my0 = min(p[1] for p in main); my1 = max(p[1] for p in main)
    c = c.copy(); px = c.load()
    for pts in comps:
        if pts is main: continue
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
        inside = mx0 <= cx <= mx1 and my0 <= cy <= my1
        r = sum(px[p][0] for p in pts) / len(pts); g = sum(px[p][1] for p in pts) / len(pts); b = sum(px[p][2] for p in pts) / len(pts)
        mark = len(pts) < len(main) * 0.03 and ((r > 130 and g > 100 and b < 90 and r - b > 70) or (r > 110 and g < 85 and b < 85 and r - g > 45))
        tear = b > r + 15
        if tear or (not mark and (inside or len(pts) > len(main) * 0.15)): continue
        for (sx, sy) in pts:
            for yy in range(sy - step - 2, sy + step + 3):
                for xx in range(sx - step - 2, sx + step + 3):
                    if 0 <= xx < w and 0 <= yy < h: px[xx, yy] = (0, 0, 0, 0)
    return c


def cells(im, cols, rows):
    a = im.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
    w, h = im.size
    px = a.load()
    res = []
    # まず行ごとに分け、その中で列ごとに分ける（最も大きい塊を cols 個とる）
    rowp = [sum(1 for x in range(0, w, 2) if px[x, y]) > 2 for y in range(h)]
    rb = sorted(bands(rowp, 6), key=lambda b: b[1] - b[0], reverse=True)[:rows]
    rb.sort()
    for (y0, y1) in rb:
        colp = [sum(1 for y in range(y0, y1, 2) if px[x, y]) > 1 for x in range(w)]
        cb = sorted(bands(colp, 6), key=lambda b: b[1] - b[0], reverse=True)[:cols]
        cb.sort()
        for (x0, x1) in cb:
            c = drop_marks(im.crop((x0, y0, x1, y1)))
            bb = c.getchannel('A').point(lambda v: 255 if v >= 128 else 0).getbbox()
            res.append(c.crop(bb))
    return res


def sheet(name, cols, rows, height, prefix, labels):
    # height はゲーム座標（320x240）での高さ。書き出しは S 倍
    cs = cells(load(name), cols, rows)
    assert len(cs) == cols * rows, (name, len(cs))
    k = height * S / max(c.height for c in cs)  # 全部同じ倍率
    for c, lab in zip(cs, labels):
        s = clean(shrink(c, (max(1, round(c.width * k)), max(1, round(c.height * k)))))
        save(s, '%s_%s' % (prefix, lab))
    print(name, [c.size for c in cs], '->', round(k, 3))


def remove_checker(im):
    # ロゴに焼きこまれた灰色の市松模様を、外側からたどって消す
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()

    def bgish(p):
        r, g, b, _ = p
        return max(r, g, b) - min(r, g, b) < 16 and min(r, g, b) > 100

    seen = bytearray(w * h)
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if not bgish(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        if x > 0: stack.append((x - 1, y))
        if x < w - 1: stack.append((x + 1, y))
        if y > 0: stack.append((x, y - 1))
        if y < h - 1: stack.append((x, y + 1))
    # 文字のすき間に閉じこめられた市松模様も消す（色みのない灰色だけ）
    for y in range(h):
        for x in range(w):
            r, g, b, al = px[x, y]
            if al and max(r, g, b) - min(r, g, b) < 12 and 100 < min(r, g, b) < 215:
                px[x, y] = (0, 0, 0, 0)
    return im.crop(im.getchannel('A').getbbox())


def bg(name):
    return load(name).convert('RGB').resize((W, H), Image.LANCZOS)


# 背景
for n in ['room', 'room_night', 'space']:
    save(bg(n), n)
# オープニングの星空だけの帯（ステーションのまわりを埋める）
save(bg('space').crop((0, 0, W, 40 * S)), 'space_tile')
# ソファの座面より手前（胸から上の絵のキャラを座らせるために、上に重ねる）
for n in ['room', 'room_night']:
    b = bg(n).convert('RGBA')
    sx0, sy0, sx1, sy1 = 64 * S, 157 * S, 258 * S, 187 * S  # 座面の前〜ソファの下まで
    front = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    front.paste(b.crop((sx0, sy0, sx1, sy1)), (sx0, sy0))
    save(front, n + '_front')

# キャラ（高さはゲーム内の 320x240 での大きさ）
sheet('pururu', 3, 2, 104, 'pururu', FACES)
sheet('gald', 3, 2, 128, 'gald', FACES)
sheet('lumie', 3, 2, 126, 'lumie', FACES)

# 看護師ミケの顔アイコン（会話の吹き出し用、正方形）
for c, lab in zip(cells(load('nurse'), 3, 1), ['normal', 'happy', 'worry']):
    sq = c.crop((0, 0, c.width, c.width))
    save(clean(shrink(sq, (56 * S, 56 * S))), 'nurse_icon_%s' % lab)

# ロゴ
logo = remove_checker(load('logo'))
k = 320 * S / logo.width
clean(shrink(logo, (320 * S, round(logo.height * k)))).save(os.path.join(OUT, 'logo.png'), optimize=True)
print('done ->', OUT)

# ---- 追加キャラ・品物・結末の絵 ----
def have(n):
    return os.path.exists(os.path.join(SRC, n + '.png'))


if have('moti'):
    sheet('moti', 3, 1, 84, 'moti', ['pout', 'happy', 'weak'])
if have('thomas'):
    sheet('thomas', 3, 1, 122, 'thomas', ['smile', 'shy', 'surprise'])
if have('rino'):
    sheet('rino', 3, 1, 74, 'rino', ['happy', 'surprise', 'sad'])
if have('items'):
    sheet('items', 4, 1, 64, 'item', ['bread', 'comm', 'flower', 'drawing'])
for n, h in [('konoha', 120), ('mii', 104), ('noa', 116)]:
    if have(n):
        sheet(n, 3, 2, h, n, FACES)
if have('cast2'):
    sheet('cast2', 3, 1, 118, 'cast2', ['mother_smile', 'pipi_smile', 'harumo_smile'])
    for a in ['mother', 'pipi', 'harumo']:
        os.replace(os.path.join(OUT, 'cast2_%s_smile.webp' % a), os.path.join(OUT, '%s_smile.webp' % a))
if have('items2'):
    sheet('items2', 3, 2, 64, 'item', ['photo', 'inari', 'misanga', 'letter', 'spanner', 'musicbox'])
for n in ['end_pururu', 'end_lumie', 'end_gald', 'end_konoha', 'end_mii', 'end_noa']:
    if have(n):
        save(bg(n), n)
print('extra done')

# まばたき用の閉じ目画像（目のまわりの肌の色で目をぬりつぶし、閉じた目の線をひく）
EYES = {  # 目の範囲 (x0, y0, x1, y1)。ゲーム座標（320x240）での値。書き出しでは S 倍する
    'pururu': [(14, 43, 33, 63), (47, 43, 65, 63)],
    'lumie': [(35, 51, 51, 68), (66, 51, 82, 68)],
    'gald': [(25, 46, 39, 59), (55, 45, 70, 59)],
    'konoha': [(27, 49, 43, 66), (54, 49, 69, 66)],
    'mii': [(24, 40, 38, 56), (47, 40, 59, 56)],
}
LINE = (58, 36, 40, 255)


def blink_frame(name, face):
    im = Image.open(os.path.join(OUT, '%s_%s.webp' % (name, face))).convert('RGBA')
    px = im.load()
    for (ex0, ey0, ex1, ey1) in EYES[name]:
        x0, y0, x1, y1 = ex0 * S, ey0 * S, ex1 * S, ey1 * S
        left = ex0 < im.width / S / 2 - 10
        inner = x1 + S if left else x0 - 2 * S  # 鼻がわ（肌の色が安定している方）
        if name == 'gald':
            inner = x1 if left else x0 - 1
        for y in range(y0, y1):
            col = px[inner, y]
            for x in range(x0, x1):
                if px[x, y][3]:
                    px[x, y] = col[:3] + (255,)
        # 閉じた目（下向きのゆるい弧）。太さは S
        ly = y0 + round((y1 - y0) * 0.62)
        w = x1 - x0
        for x in range(x0 + S, x1 - S):
            u = (x - x0) / (w - 1) * 2 - 1
            yy = ly + round((1 - u * u) * 1.5 * S)
            for t in range(S):
                px[x, yy + t] = LINE
    save(im, '%s_%s_blink' % (name, face))


for n in EYES:
    if not os.path.exists(os.path.join(OUT, n + '_normal.webp')): continue
    for f in ['normal', 'sad', 'surprise']:  # 怒り顔は眉が目にかかるので、まばたきなし
        blink_frame(n, f)
print('blink frames done')
