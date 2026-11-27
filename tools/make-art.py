# ChatGPTで作った絵（画像/work/*.png）を、ゲーム用のドット絵に整える: python tools/make-art.py
# ・背景は 320x240 に縮める（ゲームの基本解像度）
# ・表情シートは1つずつ切り分け、同じ倍率で縮めて下端・中央をそろえる
# ・半透明のふちは消して、くっきりしたドットにする
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '画像', 'work')
OUT = os.path.join(ROOT, 'img')
os.makedirs(OUT, exist_ok=True)
W, H = 320, 240
FACES = ['normal', 'happy', 'sad', 'surprise', 'angry', 'cry']


def load(name):
    return Image.open(os.path.join(SRC, name + '.png'))


def shrink(im, size):
    # 透明部分の色がにじまないよう、乗算済みアルファで縮める
    return im.convert('RGBa').resize(size, Image.BOX).convert('RGBA')


def crisp(im, cut=110):
    a = im.getchannel('A').point(lambda v: 255 if v >= cut else 0)
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
            c = im.crop((x0, y0, x1, y1))
            bb = c.getchannel('A').point(lambda v: 255 if v >= 128 else 0).getbbox()
            res.append(c.crop(bb))
    return res


def sheet(name, cols, rows, height, prefix, labels):
    cs = cells(load(name), cols, rows)
    assert len(cs) == cols * rows, (name, len(cs))
    k = height / max(c.height for c in cs)  # 全部同じ倍率
    for c, lab in zip(cs, labels):
        s = crisp(shrink(c, (max(1, round(c.width * k)), max(1, round(c.height * k)))))
        s.save(os.path.join(OUT, '%s_%s.png' % (prefix, lab)))
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


# 背景
for n in ['room', 'room_night', 'space']:
    load(n).convert('RGB').resize((W, H), Image.BOX).save(os.path.join(OUT, n + '.png'))
# オープニングの星空だけの帯（ステーションのまわりを埋める）
Image.open(os.path.join(OUT, 'space.png')).crop((0, 0, 320, 40)).save(os.path.join(OUT, 'space_tile.png'))
# ソファの座面より手前（胸から上の絵のキャラを座らせるために、上に重ねる）
for n in ['room', 'room_night']:
    bg = load(n).convert('RGBA').resize((W, H), Image.BOX)
    sx0, sy0, sx1, sy1 = 64, 157, 258, 187  # 座面の前〜ソファの下まで
    front = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    front.paste(bg.crop((sx0, sy0, sx1, sy1)), (sx0, sy0))
    front.save(os.path.join(OUT, n + '_front.png'))

# キャラ（高さはゲーム内の 320x240 での大きさ）
sheet('pururu', 3, 2, 104, 'pururu', FACES)
sheet('gald', 3, 2, 128, 'gald', FACES)
sheet('lumie', 3, 2, 126, 'lumie', FACES)
sheet('nurse', 3, 1, 96, 'nurse', ['normal', 'happy', 'worry'])

# 看護師ミケの顔アイコン（会話の吹き出し用、正方形）
for c, lab in zip(cells(load('nurse'), 3, 1), ['normal', 'happy', 'worry']):
    sq = c.crop((0, 0, c.width, c.width))
    crisp(shrink(sq, (56, 56))).save(os.path.join(OUT, 'nurse_icon_%s.png' % lab))

# ロゴ
logo = remove_checker(load('logo'))
k = 320 / logo.width
crisp(shrink(logo, (320, round(logo.height * k)))).save(os.path.join(OUT, 'logo.png'))
print('done ->', OUT)

# まばたき用の閉じ目画像（目のまわりの色で目をぬりつぶし、閉じた目の線をひく）
EYES = {  # 目の範囲 (x0, y0, x1, y1)。320x240用に縮めたあとの座標
    'pururu': [(14, 43, 33, 63), (47, 43, 65, 63)],
    'lumie': [(35, 51, 51, 68), (66, 51, 82, 68)],
    'gald': [(25, 46, 39, 59), (55, 45, 70, 59)],
}
LINE = (58, 36, 40, 255)


def blink_frame(name, face):
    im = Image.open(os.path.join(OUT, '%s_%s.png' % (name, face))).convert('RGBA')
    px = im.load()
    for (x0, y0, x1, y1) in EYES[name]:
        inner = x1 if x0 < im.width / 2 - 10 else x0 - 1  # 鼻がわ（肌の色が安定している方）
        if name == 'lumie' or name == 'pururu':
            inner = x1 + 1 if inner == x1 else x0 - 2
        for y in range(y0, y1):
            col = px[inner, y]
            for x in range(x0, x1):
                if px[x, y][3]:
                    px[x, y] = col[:3] + (255,)
        # 閉じた目（下向きのゆるい弧）
        ly = y0 + round((y1 - y0) * 0.62)
        w = x1 - x0
        for x in range(x0 + 1, x1 - 1):
            u = (x - x0) / (w - 1) * 2 - 1
            yy = ly + round((1 - u * u) * 1.5)
            px[x, yy] = LINE
            px[x, yy - 1 if abs(u) > 0.6 else yy] = LINE
    im.save(os.path.join(OUT, '%s_%s_blink.png' % (name, face)))


for n in EYES:
    for f in ['normal', 'sad', 'surprise']:  # 怒り顔は眉が目にかかるので、まばたきなし
        blink_frame(n, f)
print('blink frames done')

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
    for a, b in [('mother', 'mother'), ('pipi', 'pipi'), ('harumo', 'harumo')]:
        os.replace(os.path.join(OUT, 'cast2_%s_smile.png' % a), os.path.join(OUT, '%s_smile.png' % b))
if have('items2'):
    sheet('items2', 3, 2, 64, 'item', ['photo', 'inari', 'misanga', 'letter', 'spanner', 'musicbox'])
for n in ['end_pururu', 'end_lumie', 'end_gald', 'end_konoha', 'end_mii', 'end_noa']:
    if have(n):
        load(n).convert('RGB').resize((W, H), Image.BOX).save(os.path.join(OUT, n + '.png'))
print('extra done')
