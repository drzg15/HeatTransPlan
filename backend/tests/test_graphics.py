"""The ellipse is supersampled on a tile, not on a copy of the whole image.

The tile has to produce what the full-canvas overlay produced, so the reference
implementation is kept here and compared against pixel for pixel.
"""

import time

from PIL import Image, ImageChops, ImageDraw

from app.utils.graphics_utils import draw_smooth_ellipse

RED, OUTLINE = (255, 0, 0, 200), (200, 0, 0, 255)


def _canvas(size=(1200, 650)):
    return Image.new('RGBA', size, (255, 255, 255, 255))


def _full_canvas_reference(base_img, bbox, fill=None, outline=None, width=1, scale=4):
    """How it used to be drawn: one overlay the size of the whole map, per circle."""
    w, h = base_img.size
    overlay = Image.new('RGBA', (w * scale, h * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    big = [int(v * scale) for v in bbox]
    if fill:
        draw.ellipse(big, fill=fill)
    if outline and width:
        draw.ellipse(big, outline=outline, width=max(1, int(width * scale)))
    return Image.alpha_composite(base_img, overlay.resize((w, h), Image.Resampling.LANCZOS))


def _max_diff(a, b):
    return max(m for _, m in ImageChops.difference(a.convert('RGB'), b.convert('RGB')).getextrema())


def test_matches_the_full_canvas_overlay():
    # Whole and fractional coordinates, small and large circles.
    for bbox in ([100, 100, 140, 140], [300.5, 200.25, 316.5, 216.25], [700, 300, 716, 316]):
        want = _full_canvas_reference(_canvas(), bbox, fill=RED, outline=OUTLINE, width=2)
        got = draw_smooth_ellipse(_canvas(), bbox, fill=RED, outline=OUTLINE, width=2)
        assert _max_diff(want, got) == 0, bbox


def test_clips_a_circle_at_the_edge_without_punching_a_hole():
    img = draw_smooth_ellipse(_canvas((200, 200)), [-10, -10, 20, 20], fill=(0, 0, 255, 200))
    # An out-of-bounds crop comes back transparent-padded; pasting that back
    # would leave a see-through corner on the map.
    assert img.getpixel((0, 0))[3] == 255
    assert img.getpixel((199, 199))[:3] == (255, 255, 255)
    # A circle running off the edge still differs from the reference only in
    # how LANCZOS treats the border, which is a couple of levels out of 255.
    want = _full_canvas_reference(_canvas((200, 200)), [-10, -10, 20, 20], fill=(0, 0, 255, 200))
    assert _max_diff(want, img) <= 16


def test_cost_does_not_scale_with_the_map():
    def draw_on(size):
        img = _canvas(size)
        start = time.perf_counter()
        for _ in range(10):
            draw_smooth_ellipse(img, [50, 50, 90, 90], fill=RED)
        return time.perf_counter() - start

    small, big = draw_on((300, 200)), draw_on((2400, 1300))
    assert big < small * 4 + 0.05, f"small={small:.3f}s big={big:.3f}s"
