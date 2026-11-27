# SNSやLINEでリンクを貼ったときに出る画像（1200x630）を作る: python tools/make-share.py
# 水彩の高画質の絵（img/*.webp・ゲーム座標の3倍）のまま組み、最後に 1200x630 へなめらかに縮める
import os
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'img')
S = 3


def L(name):
    return Image.open(os.path.join(IMG, name + '.webp')).convert('RGBA')


room = L('room')                                   # 960x720
OX, OY = 0, 140
base = room.crop((OX, OY, 960, OY + 504))          # 1200:630 と同じ比率（960x504）


def put(name, x, bottom, scale=1.0):
    s = L(name)
    if scale != 1.0:
        s = s.convert('RGBa').resize((round(s.width * scale), round(s.height * scale)), Image.LANCZOS).convert('RGBA')
    base.alpha_composite(s, (round(x - OX - s.width / 2), round(bottom - OY - s.height)))


# ソファに3人（ゲームと同じ座る高さ。ゲーム座標×S）
put('pururu_happy', 98 * S, 198 * S, 0.58)
put('lumie_happy', 160 * S, 200 * S, 0.58)
put('gald_happy', 224 * S, 199 * S, 0.58)
big = base.resize((1200, 630), Image.LANCZOS)
logo = Image.open(os.path.join(IMG, 'logo.png')).convert('RGBA')
logo = logo.resize((520, round(logo.height * 520 / logo.width)), Image.LANCZOS)
glow = Image.new('RGBA', big.size, (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse((300, -50, 900, logo.height + 20), fill=(255, 249, 238, 190))
big.alpha_composite(glow.filter(ImageFilter.GaussianBlur(34)))
big.alpha_composite(logo, ((1200 - logo.width) // 2, 6))
big.convert('RGB').save(os.path.join(IMG, 'share.png'), optimize=True)
print('share.png', big.size)
