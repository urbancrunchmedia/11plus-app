import sys, json
from PIL import Image
import numpy as np
from scipy import ndimage
import potrace

src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
H, W, _ = im.shape
names = ["white", "ink", "lime", "blue"]
cent = np.array([(255, 255, 255), (14, 17, 22), (212, 245, 32), (18, 165, 255)], np.float32)

def nearest(cent):
    lab = np.empty((H, W), np.int8)
    for y in range(0, H, 128):
        blk = im[y:y + 128]
        lab[y:y + 128] = ((blk[:, :, None, :] - cent[None, None]) ** 2).sum(-1).argmin(-1)
    return lab

lab = nearest(cent)
for i in range(len(names)):
    cent[i] = im[lab == i].mean(0)
lab = nearest(cent)
measured = {n: [int(round(v)) for v in cent[i]] for i, n in enumerate(names)}
print("measured", measured)

ink = lab == 1
comp, n = ndimage.label(ink.astype(np.uint8))
sizes = ndimage.sum(ink, comp, range(1, n + 1))
tile = ndimage.binary_fill_holes(comp == 1 + int(np.argmax(sizes)))
ys, xs = np.where(tile)
tb = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
word = ink & ~tile
word[:, : tb[2] + 5] = False
wy, wx = np.where(word)
wb = [int(wx.min()), int(wy.min()), int(wx.max()) + 1, int(wy.max()) + 1]
print("tile box", tb, "word box", wb)

lime = tile & (lab == 2)
lc, ln = ndimage.label(lime.astype(np.uint8))
lsz = ndimage.sum(lime, lc, range(1, ln + 1))
big_ids = [1 + i for i in np.argsort(-lsz)[:2]]  # the two 1s
ones = np.isin(lc, big_ids)
print("lime parts", ln, "largest", sorted(lsz)[-3:])
layers = {
    "tile": (tile, tb), "lime": (lime, tb), "ones": (ones, tb), "sparkle": (lime & ~ones, tb), "blue": (tile & (lab == 3), tb),
    "dots": (tile & (lab == 0), tb), "word": (word, wb),
}
UP = 3
def to_d(mask, box):
    x0, y0, x1, y1 = box
    P = 6
    crop = np.pad(mask[y0:y1, x0:x1], P).astype(np.float32)
    big = ndimage.zoom(crop, UP, order=1)
    big = ndimage.gaussian_filter(big, sigma=1.4) > 0.5
    big = ndimage.binary_opening(big, iterations=2)
    path = potrace.Bitmap(~big).trace(turdsize=40, alphamax=1.0, opticurve=True, opttolerance=0.3)
    f = lambda p: f"{(p.x / UP - P):.1f},{(p.y / UP - P):.1f}"
    parts = []
    for c in path:
        parts.append("M" + f(c.start_point))
        for s in c:
            if s.is_corner:
                parts.append("L" + f(s.c) + "L" + f(s.end_point))
            else:
                parts.append("C" + f(s.c1) + " " + f(s.c2) + " " + f(s.end_point))
        parts.append("Z")
    return "".join(parts), len(path)

res = {"colors": measured, "tile_box": tb, "word_box": wb, "layers": {}}
for k, (m, box) in layers.items():
    d, n = to_d(m, box)
    res["layers"][k] = d
    print(k, "shapes", n, "chars", len(d), flush=True)
json.dump(res, open(out, "w"))
