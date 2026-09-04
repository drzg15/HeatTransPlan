"""
Map rendering service.
Generates images with process boxes and stream circles overlaid on map snapshots.
"""

import base64
from io import BytesIO
from typing import Dict, Any

from PIL import Image, ImageDraw, ImageFont

from app.models.report import ReportRequest
from app.utils.geo_utils import snapshot_lonlat_to_pixel
from app.utils.graphics_utils import draw_smooth_ellipse


def generate_process_map_b64(req: ReportRequest) -> str:
    """
    Generate a base64 encoded PNG image of the map with processes and streams overlaid.
    Mimics the original generate_process_level_map functionality.
    """
    snapshots_dict = req.map_snapshots_encoded or {}
    active_base = req.current_base or "OpenStreetMap"

    if active_base == 'Blank':
        base_img = Image.new('RGBA', (800, 600), (242, 242, 243, 255))
    else:
        chosen_b64 = snapshots_dict.get(active_base)
        if not chosen_b64:
            return ""
        try:
            chosen_bytes = base64.b64decode(chosen_b64)
            base_img = Image.open(BytesIO(chosen_bytes)).convert("RGBA")
        except Exception:
            return ""

    w, h = base_img.size
    draw = ImageDraw.Draw(base_img)

    # Load font
    BOX_FONT_SIZE = 20
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", BOX_FONT_SIZE)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", BOX_FONT_SIZE)
        except (OSError, IOError):
            try:
                font = ImageFont.truetype("DejaVuSans.ttf", BOX_FONT_SIZE)
            except (OSError, IOError):
                font = ImageFont.load_default()

    # Determine global max Q for scaling circles
    all_qs = [s.Q for s in req.selected_streams if s.Q is not None and s.Q > 0]
    q_min = min(all_qs) if all_qs else 0
    q_max = max(all_qs) if all_qs else 1
    q_range = q_max - q_min if q_max != q_min else 1
    r_min, r_max = 8, 20

    # Draw process-level boxes (green)
    drawn_boxes = []

    for group_idx, coords_data in req.proc_group_coordinates.items():
        try:
            g_idx = int(group_idx)
        except ValueError:
            continue
            
        if g_idx >= len(req.proc_group_names):
            continue

        lat = coords_data.get('lat')
        lon = coords_data.get('lon')
        if lat is None or lon is None:
            continue

        try:
            lat_f = float(lat)
            lon_f = float(lon)
            group_px, group_py = snapshot_lonlat_to_pixel(
                lon_f, lat_f,
                (req.map_center[1], req.map_center[0]) if len(req.map_center) >= 2 else (0, 0),
                req.map_zoom, w, h
            )
            
            # Simple bounds check
            if group_px < -50 or group_py < -20 or group_px > w + 50 or group_py > h + 20:
                continue
            
            group_label = req.proc_group_names[g_idx]
            scale = float(coords_data.get('box_scale', 1.5) or 1.5)
            padding = int(8 * scale)
            
            # Text bounding box
            if hasattr(draw, 'textbbox'):
                text_bbox = draw.textbbox((0, 0), group_label, font=font)
                tw = text_bbox[2] - text_bbox[0]
                th = text_bbox[3] - text_bbox[1]
            else:
                tw, th = draw.textsize(group_label, font=font)

            box_w = int(tw * scale + padding * 2)
            box_h = int(th * scale + padding * 2)
            x0 = int(group_px - box_w / 2)
            y0 = int(group_py - box_h / 2)
            x1 = x0 + box_w
            y1 = y0 + box_h
            
            # Draw box
            fill_color = (200, 255, 200, 245)
            border_color = (34, 139, 34, 255)
            text_color = (0, 100, 0, 255)
            draw.rectangle([x0, y0, x1, y1], fill=fill_color, outline=border_color, width=3)
            
            # Draw label
            text_x = x0 + (box_w - tw) // 2
            text_y = y0 + (box_h - th) // 2
            draw.text((text_x, text_y), group_label, font=font, fill=text_color)
            
            drawn_boxes.append({
                'idx': g_idx,
                'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1,
                'cx': group_px, 'cy': group_py,
                'h': box_h
            })
        except (ValueError, TypeError):
            continue

    # Draw streams as circles surrounding the group box
    for box in drawn_boxes:
        g_idx = box['idx']
        
        # Get all streams associated with this group
        # req.proc_groups[g_idx] is a list of subprocess indices for this group
        group_streams = []
        if g_idx < len(req.proc_groups):
            for sp_idx in req.proc_groups[g_idx]:
                if sp_idx < len(req.processes):
                    sp = req.processes[sp_idx]
                    sp_name = sp.name or f"Subprocess {sp_idx + 1}"
                    for s_i, stream_dict in enumerate(sp.streams):
                        # Find corresponding stream in selected_streams
                        s_name = stream_dict.get('name') or f'Stream {s_i + 1}'
                        match_name = f"{sp_name} - {s_name}"
                        # Look for selection
                        matched = next((s for s in req.selected_streams if s.name == match_name), None)
                        if matched and matched.Q is not None and matched.Q > 0:
                            group_streams.append(matched)
        
        # Draw circles
        if not group_streams:
            continue
            
        spacing = 10
        total_width = -spacing
        circle_radii = []
        for s in group_streams:
            if s.Q > 0:
                normalized = (s.Q - q_min) / q_range if q_range > 0 else 0.5
                r = r_min + normalized * (r_max - r_min)
                circle_radii.append(r)
                total_width += (r * 2) + spacing
            else:
                circle_radii.append(0)
                
        start_x = box['cx'] - total_width / 2
        current_x = start_x
        y_pos = box['y1'] + max(r_max, 10) + 5
        
        for s, r in zip(group_streams, circle_radii):
            if r <= 0:
                continue
            color = (255, 0, 0, 200) if s.Tin > s.Tout else (0, 0, 255, 200)
            outline_color = (200, 0, 0, 255) if s.Tin > s.Tout else (0, 0, 200, 255)
            
            bbox = [current_x - r, y_pos - r, current_x + r, y_pos + r]
            base_img = draw_smooth_ellipse(base_img, bbox, fill=color, outline=outline_color, width=2)
            current_x += (r * 2) + spacing

    # Convert back to base64
    img_buffer = BytesIO()
    base_img.save(img_buffer, format='PNG')
    img_buffer.seek(0)
    return base64.b64encode(img_buffer.getvalue()).decode('utf-8')
