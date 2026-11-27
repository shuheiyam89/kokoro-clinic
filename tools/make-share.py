# SNSやLINEでリンクを貼ったときに出る画像（1200x630）を作る: python tools/make-share.py
import os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'img')
K = 4                       # 300x158（ゲーム座標）で組んで4倍
S = 3
def L(name):
    # 高画質の絵（WebP, S倍）をゲーム座標の大きさにして読む
    im = Image.open(os.path.join(IMG, name + '.webp')).convert('RGBA')
    return im.resize((round(im.width / S), round(im.height / S)), Image.LANCZOS)
room = L('room')
base = room.crop((10, 52, 310, 210))
def put(name, x, bottom, scale):
    s = L(name)
    s = s.convert('RGBa').resize((round(s.width * scale), round(s.height * scale)), Image.BOX).convert('RGBA')
    a = s.getchannel('A').point(lambda v: 255 if v >= 110 else 0); s.putalpha(a)
    base.alpha_composite(s, (x - s.width // 2, bottom - s.height))
put('pururu_happy', 78, 140, 0.72)
put('lumie_happy', 150, 128, 0.72)
put('gald_happy', 224, 142, 0.72)
big = base.resize((300 * K, 158 * K), Image.NEAREST).crop((0, 1, 1200, 631))
logo = Image.open(os.path.join(IMG, 'logo.png')).convert('RGBA')
logo = logo.resize((620, round(logo.height * 620 / logo.width)), Image.LANCZOS)
glow = Image.new('RGBA', big.size, (0, 0, 0, 0))
from PIL import ImageDraw, ImageFilter
d = ImageDraw.Draw(glow); d.ellipse((240, -40, 960, logo.height + 40), fill=(255, 250, 240, 150))
glow = glow.filter(ImageFilter.GaussianBlur(30))
big.alpha_composite(glow)
big.alpha_composite(logo, ((1200 - logo.width) // 2, 14))
big.convert('RGB').save(os.path.join(IMG, 'share.png'), optimize=True)
print('share.png', big.size)
