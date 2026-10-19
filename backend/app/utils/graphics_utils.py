import math

from PIL import Image, ImageDraw

# Supersampling is done on a tile around the ellipse, not on a copy of the whole
# map. A 40 px circle used to cost a 4800x2600 overlay, a LANCZOS pass over all
# 12.5 M pixels of it and a full-frame composite — about 50 MB of allocation per
# circle, which is what made a map with a handful of streams take most of a
# second. A tile is a few hundred pixels and the cost no longer depends on how
# big the map is.
#
# The margin is wider than the LANCZOS kernel reaches (3 output pixels), so the
# downsample sees the same neighbourhood it saw on the full canvas and the
# result is pixel-identical to the old one.
_PAD = 4


def draw_smooth_ellipse(base_img, bbox, fill=None, outline=None, width=1, scale=4):
    """Draw an anti-aliased ellipse on top of `base_img`

    The ellipse is drawn into a transparent tile at `scale` times its own size,
    downsampled with LANCZOS and composited over the matching region of the base
    image. This produces much smoother edges than drawing it directly.

    Args:
        base_img (PIL.Image): RGBA image to draw onto; drawn on in place.
        bbox (sequence): [x0, y0, x1, y1] bounding box in base image coordinates.
        fill (tuple|str): Fill color (RGBA tuple or PIL color).
        outline (tuple|str): Outline color.
        width (int): Outline width in base-image pixels.
        scale (int): Supersampling factor. 3-6 is usually good. Default 4.

    Returns:
        PIL.Image: The RGBA image with the ellipse composited.
    """
    if base_img.mode != 'RGBA':
        base_img = base_img.convert('RGBA')

    x0, y0, x1, y1 = bbox
    if x1 <= x0 or y1 <= y0:
        return base_img

    tx0, ty0 = math.floor(x0) - _PAD, math.floor(y0) - _PAD
    tile_w = math.ceil(x1) + _PAD - tx0
    tile_h = math.ceil(y1) + _PAD - ty0
    overlay = Image.new('RGBA', (tile_w * scale, tile_h * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    # The same coordinates the ellipse had on the supersampled full canvas,
    # shifted into the tile — the tile's origin is a whole pixel, so the
    # downsampling grid lines up exactly as it did before.
    ellipse = [
        int(x0 * scale) - tx0 * scale,
        int(y0 * scale) - ty0 * scale,
        int(x1 * scale) - tx0 * scale,
        int(y1 * scale) - ty0 * scale,
    ]

    if fill:
        draw.ellipse(ellipse, fill=fill)

    if outline and width and width > 0:
        draw.ellipse(ellipse, outline=outline, width=max(1, int(width * scale)))

    tile = overlay.resize((tile_w, tile_h), Image.Resampling.LANCZOS)

    # Clip to the image: a circle near the edge would otherwise paste the
    # transparent padding PIL invents for an out-of-bounds crop back over it.
    cx0, cy0 = max(0, tx0), max(0, ty0)
    cx1, cy1 = min(base_img.width, tx0 + tile_w), min(base_img.height, ty0 + tile_h)
    if cx0 >= cx1 or cy0 >= cy1:
        return base_img
    tile = tile.crop((cx0 - tx0, cy0 - ty0, cx1 - tx0, cy1 - ty0))

    region = base_img.crop((cx0, cy0, cx1, cy1))
    base_img.paste(Image.alpha_composite(region, tile), (cx0, cy0))
    return base_img
