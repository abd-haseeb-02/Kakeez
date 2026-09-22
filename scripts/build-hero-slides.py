"""Re-export hero slides 2 and 3 from the Figma source art.

Geometry read verbatim out of Cakeez.fig (see scratchpad/figtree.py):

  hero artboard   the "Union" mask, frame x[30..1698] y[168..1174.7]  ->  1668 x 1006.7
  photo nodes     mask-local x[-64.6..1732.6] y[0..1006.8], size 1797.3 x 1006.8
  m00 = -1.000    on every slide-2 and slide-3 photo node -> the design MIRRORS them
                  (slide 1 is m00 = +1, which is why it was already correct)

Three bugs this fixes, all introduced when the art was first re-exported:
  * both slides were not mirrored
  * slide 2 lost its white gradient wash, so brown script sat on a busy photo
  * slide 3 stretched a 1024x1024 source to 1797x1007 instead of cropping it
"""
from PIL import Image, ImageOps
import numpy as np
import os
import pathlib

# The Gemini source PNGs live with the design file, not in the repo -- they are
# 3172x1344 / 1024x1024 / 4096x4096 and far too large to commit. Point HERO_SRC at
# the folder holding image-import-{16,17,31}.png to re-run this.
IMGDIR = os.environ.get('HERO_SRC', os.path.expanduser('~/.pencil/documents/2988e4d1-6abe-4fa9-b231-ddc3918d12ad/images')) + '/'
OUT = str(pathlib.Path(__file__).resolve().parent.parent / 'public') + '/'
NODE_W, NODE_H = 1797, 1007
MASK_W, MASK_H = 1668, 1007
NODE_X = -65                       # mask-local left edge of the node
OUT_W, OUT_H = 1668, 905


def src(n):
    return Image.open(IMGDIR + n).convert('RGBA')


def crop_frac(im, u0, u1, v0, v1, size):
    """Figma image-paint matrix -> source region [u0,u1]x[v0,v1], scaled to `size`."""
    w, h = im.size
    return im.resize(size, Image.LANCZOS,
                     box=(u0 * w, max(0.0, v0) * h, u1 * w, min(1.0, v1) * h))


def cover(im, size):
    """Figma FILL: scale to cover, centre-crop. Aspect preserving."""
    w, h = im.size
    s = max(size[0] / w, size[1] / h)
    cw, ch = size[0] / s, size[1] / s
    return im.resize(size, Image.LANCZOS,
                     box=((w - cw) / 2, (h - ch) / 2, (w + cw) / 2, (h + ch) / 2))


def ramp(rgb, m00, m02):
    """GRADIENT_LINEAR, stops alpha 0 -> 1: alpha(u) = clamp(m00*u + m02, 0, 1)."""
    u = np.linspace(0.0, 1.0, NODE_W, dtype=np.float32)
    a = np.clip(m00 * u + m02, 0.0, 1.0)
    l = np.zeros((NODE_H, NODE_W, 4), np.float32)
    l[..., 0], l[..., 1], l[..., 2] = rgb
    l[..., 3] = a[None, :] * 255.0
    return Image.fromarray(l.astype(np.uint8), 'RGBA')


def flat(rgb, opacity):
    a = np.full((NODE_H, NODE_W), round(opacity * 255), np.uint8)
    return Image.fromarray(np.dstack([np.full((NODE_H, NODE_W), c, np.uint8) for c in rgb] + [a]), 'RGBA')


def place(node, top):
    """Apply the node's m00 = -1 mirror, sit it on the artboard, crop the export window."""
    art = Image.new('RGBA', (MASK_W, MASK_H), (255, 255, 255, 255))
    art.alpha_composite(ImageOps.mirror(node).crop((-NODE_X, 0, -NODE_X + MASK_W, MASK_H)))
    return art.convert('RGB').crop((0, top, MASK_W, top + OUT_H))


# slide 2  -- image-import-17 STRETCH (paint m00=0.756384 m02=0.000138: the left 75.65%
#             of a 3172x1344 source, which is exactly the 1.785 node aspect), then the
#             white GRADIENT_LINEAR (t = 1.512852u - 0.532099). Measured against the
#             approved banner the sage #e1eab5 layer contributes nothing, and the 10%
#             white solid above it is visible:False -- white ramp alone reproduces the
#             original to within 0.5/255 per channel.
s2 = Image.alpha_composite(
    crop_frac(src('image-import-17.png'), 0.000138, 0.756522, 0.0, 1.0, (NODE_W, NODE_H)),
    ramp((255, 255, 255), 1.512852, -0.532099))

# slide 3  -- image-import-16 STRETCH (paint m11=0.560175 m12=0.202419: rows 20.2%..76.3%
#             of a 1024x1024 source -> again exactly 1.785, so this is a CROP; stretching
#             the whole square is what squashed every cake) at node opacity 0.60 over the
#             frame's white, then image-import-31 FILL (cover) offset y+28, then a flat
#             black 20% covering mask y[-105..901.8].
s3 = Image.new('RGBA', (NODE_W, NODE_H), (255, 255, 255, 255))
_bg = crop_frac(src('image-import-16.png'), 0.0, 1.0, 0.202419, 0.762594, (NODE_W, NODE_H))
_bg.putalpha(round(0.60 * 255))
s3.alpha_composite(_bg)
s3.alpha_composite(cover(src('image-import-31.png'), (NODE_W, NODE_H)), dest=(0, 28))
s3.alpha_composite(flat((0, 0, 0), 0.20), dest=(0, 0), source=(0, 105))

for name, node, top in (('hero-slide-2.webp', s2, 30), ('hero-slide-3.webp', s3, 0)):
    im = place(node, top)
    im.save(OUT + name, 'WEBP', quality=86, method=6)
    print('%s  %s  %.0f KB' % (name, im.size, os.path.getsize(OUT + name) / 1024))
