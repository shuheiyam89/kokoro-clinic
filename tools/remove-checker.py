# 画像に焼きこまれた「透明のふりをした市松模様」を消して、本当の透明にする
# python tools/remove-checker.py 入力.png 出力.png
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA'); w, h = im.size; px = im.load()

def tone(p):
    r, g, b, a = p
    if max(r, g, b) - min(r, g, b) > 14: return 0
    v = (r + g + b) / 3
    if v >= 236: return 1        # 市松の白
    if 196 <= v < 236: return 2  # 市松の灰色（境目の中間色も）
    return 0

seen = bytearray(w * h); removed = 0
for sy in range(h):
    for sx in range(w):
        i = sy * w + sx
        if seen[i] or not tone(px[sx, sy]): continue
        # つながった「市松っぽい色」の塊を集める
        stack = [(sx, sy)]; region = []; edge = False; cnt = [0, 0, 0]
        seen[i] = 1
        while stack:
            x, y = stack.pop(); region.append((x, y)); cnt[tone(px[x, y])] += 1
            if x == 0 or y == 0 or x == w - 1 or y == h - 1: edge = True
            for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
                if 0 <= nx < w and 0 <= ny < h:
                    j = ny * w + nx
                    if not seen[j] and tone(px[nx, ny]):
                        seen[j] = 1; stack.append((nx, ny))
        n = len(region)
        # 外側につながる塊、または白と灰色が両方しっかりある大きめの塊（輪の内側など）を消す
        both = cnt[1] > n * 0.2 and cnt[2] > n * 0.2
        if edge or (n > 400 and both):
            for x, y in region: px[x, y] = (0, 0, 0, 0)
            removed += n
im.save(dst)
print('removed', removed, 'of', w * h)
