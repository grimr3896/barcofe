import os
import io
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from pdf417 import encode, render_image
from barcode import Code128
from barcode.writer import ImageWriter

def generate_barcode_image(text, filepath="output/barcode.png"):
    codes = encode(text, columns=16, security_level=5)
    image = render_image(codes, scale=5, padding=15)
    directory = os.path.dirname(filepath)
    if directory and not os.path.exists(directory):
        os.makedirs(directory)
    image.save(filepath)
    return image

def get_text_width(draw, text, font):
    try:
        return draw.textlength(text, font=font)
    except AttributeError:
        try:
            bbox = draw.textbbox((0, 0), text, font=font)
            return bbox[2] - bbox[0]
        except AttributeError:
            w, h = draw.textsize(text, font=font)
            return w

def load_custom_font(font_size, is_bold=True):
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf" if is_bold else "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf" if is_bold else "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeMonoBold.ttf" if is_bold else "/usr/share/fonts/truetype/freefont/FreeMono.ttf",
        "/usr/share/fonts/truetype/noto/NotoMono-Regular.ttf",
        "C:\\Windows\\Fonts\\consolab.ttf" if is_bold else "C:\\Windows\\Fonts\\consola.ttf",
        "/System/Library/Fonts/Supplemental/Courier New Bold.ttf" if is_bold else "/System/Library/Fonts/Supplemental/Courier New.ttf",
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, font_size)
            except Exception:
                pass
    for name in ["DejaVuSansMono-Bold" if is_bold else "DejaVuSansMono", "LiberationMono-Bold" if is_bold else "LiberationMono", "Courier New Bold" if is_bold else "Courier", "mono"]:
        try:
            return ImageFont.truetype(name, font_size)
        except Exception:
            pass
    return ImageFont.load_default()

def generate_code128_image(
    license_number: str,
    output_path: str | Path,
) -> Image.Image:
    buffer = io.BytesIO()
    code = Code128(license_number, writer=ImageWriter())
    code.write(buffer, options={
        "module_width": 0.4,
        "module_height": 8.0,
        "font_size": 7,
        "text_distance": 3.0,
        "quiet_zone": 4.0,
        "dpi": 300,
        "write_text": True,
    })
    buffer.seek(0)
    image = Image.open(buffer).convert("RGB")
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, dpi=(300, 300))
    return image

def get_class_desc(code):
    m = {
        "A": "A - Commercial Vehicle >26000 lbs",
        "B": "B - Commercial Vehicle >26000 lbs single",
        "C": "C - Vehicle w/GVWR \u226426000 No M/C (default)",
        "M": "M - Motorcycle only",
        "A/M": "A/M - Commercial + Motorcycle",
        "C/M": "C/M - Class C + Motorcycle"
    }
    clean_code = str(code).strip().upper()
    if " - " in clean_code:
        return clean_code
    return m.get(clean_code, "C - Vehicle w/GVWR \u226426000 No M/C (default)")

def get_endorsements_desc(code):
    m = {
        "NONE": "None",
        "H": "H - Hazardous Materials",
        "M": "M - Motorcycle",
        "N": "N - Tank Vehicle",
        "P": "P - Passenger",
        "S": "S - School Bus",
        "T": "T - Double/Triple Trailers",
        "X": "X - Tanker + Hazmat"
    }
    clean_code = str(code).strip().upper()
    if " - " in clean_code:
        return clean_code
    return m.get(clean_code, "None")

def get_restrictions_desc(code):
    m = {
        "NONE": "None",
        "A": "A - Military only",
        "B": "B - Corrective lenses",
        "C": "C - Mechanical aid",
        "D": "D - Prosthetic aid",
        "E": "E - No manual transmission",
        "F": "F - Outside mirror required",
        "G": "G - Daylight driving only"
    }
    clean_code = str(code).strip().upper()
    if " - " in clean_code:
        return clean_code
    return m.get(clean_code, "None")

def generate_barcode_layout_image(text, data, filepath="output/barcode_layout.png"):
    # 1200 x 600px layout
    layout_img = Image.new("RGB", (1200, 600), "white")
    draw = ImageDraw.Draw(layout_img)
    
    # Get Track 1 and Track 2
    t1 = data.get("magnetic_track_1", "")
    t2 = data.get("magnetic_track_2", "")
    
    # Fallback to generate if not present
    if not t1 or not t2:
        from encoder import format_track_expiry, format_track_dob
        st_code = str(data.get("county", "CA")).strip().upper()[:2]
        lic = str(data.get("license_number", "")).strip().upper()
        last = str(data.get("last_name", "")).strip().upper()
        first = str(data.get("first_name", "")).strip().upper()
        exp_yymm = format_track_expiry(data.get("expiry_date", ""))
        dob_yymmdd = format_track_dob(data.get("dob", ""))
        t1 = f"%{st_code}{lic}^{last}/{first}^{exp_yymm}?"
        t2 = f";{lic}={exp_yymm}{dob_yymmdd}?"

    # 0. Printed track above magnetic stripe (Update 1)
    printed_track = f"{t1}{t2}"
    font_printed = load_custom_font(18, is_bold=True)
    track_w = get_text_width(draw, printed_track, font_printed)
    box_x1 = 40
    box_y1 = 12
    box_x2 = 40 + int(track_w) + 20
    box_y2 = 12 + 32
    try:
        draw.rounded_rectangle([(box_x1, box_y1), (box_x2, box_y2)], radius=5, outline="#cccccc", width=2)
    except AttributeError:
        draw.rectangle([(box_x1, box_y1), (box_x2, box_y2)], outline="#cccccc", width=2)
    
    draw.text((50, 17), printed_track, fill="black", font=font_printed)

    # 1. Black magnetic stripe bar (height 40px, shifted to y=55 to y=95)
    draw.rectangle([(0, 55), (1200, 95)], fill="black")
    
    # Track data text below stripe in small mono font (30px) -> y = 100 to 125
    track_text = f"T1: {t1}   T2: {t2}"
    font_track = load_custom_font(13, is_bold=False)
    draw.text((40, 102), track_text, fill="#444444", font=font_track)
    
    # 2. Class/Endorsements/Restrictions text block -> y = 125 to 205
    font_block = load_custom_font(18, is_bold=True)
    
    class_val = get_class_desc(data.get("category", data.get("vehicle_class", "C")))
    end_val = get_endorsements_desc(data.get("endorsements", "NONE"))
    restr_val = get_restrictions_desc(data.get("restrictions", "NONE"))
    
    draw.text((40, 130), f"CLASS: {class_val}", fill="#1a1a1a", font=font_block)
    draw.text((40, 152), f"ENDORSEMENTS: {end_val}", fill="#1a1a1a", font=font_block)
    draw.text((40, 174), f"RESTRICTIONS: {restr_val}", fill="#1a1a1a", font=font_block)
    
    # 3. PDF417 barcode (200px) -> y = 205 to 405
    codes = encode(text, columns=16, security_level=5)
    barcode_img = render_image(codes, scale=5, padding=0)
    
    try:
        resample_filter = Image.Resampling.NEAREST
    except AttributeError:
        resample_filter = Image.NEAREST
        
    barcode_resized = barcode_img.resize((840, 200), resample_filter)
    layout_img.paste(barcode_resized, (40, 205))
    
    # ID/Name text under barcode -> y = 415
    font_middle = load_custom_font(24, is_bold=True)
    license_number = data.get("license_number", "").strip().upper()
    first_name = data.get("first_name", "").strip().upper()
    last_name = data.get("last_name", "").strip().upper()
    text_middle = f"ID: {license_number}    NAME: {first_name} {last_name}"
    draw.text((40, 415), text_middle, fill="#1a1a1a", font=font_middle)
    
    # Sequence number vertical on right edge (rotated 90) -> center y=305
    try:
        seq_text = str(data.get("sequence_number", "121586")).strip()
        font_seq = load_custom_font(24, is_bold=True)
        txt_img = Image.new("RGBA", (200, 40), (255, 255, 255, 0))
        txt_draw = ImageDraw.Draw(txt_img)
        txt_draw.text((0, 0), seq_text, fill="#1a1a1a", font=font_seq)
        txt_rotated = txt_img.rotate(90, expand=True)
        layout_img.paste(txt_rotated, (1100, 230), txt_rotated)
    except Exception as e:
        print(f"Failed to draw rotated sequence number: {e}")
        
    # 4. Divider line -> y = 455
    draw.line([(40, 455), (1160, 455)], fill="#cccccc", width=2)
    
    # 5. Code 128 barcode (100px) with revision date bottom right -> y = 465 to 600
    font_label = load_custom_font(16, is_bold=True)
    label_text = "LICENCE NUMBER"
    label_w = get_text_width(draw, label_text, font_label)
    draw.text(((1200 - label_w) // 2, 465), label_text, fill="#1a1a1a", font=font_label)
    
    try:
        code128_path = os.path.join("output", "code128.png")
        code128_img = generate_code128_image(license_number, code128_path)
        try:
            resample_lanczos = Image.Resampling.LANCZOS
        except AttributeError:
            resample_lanczos = Image.ANTIALIAS
            
        code128_resized = code128_img.resize((400, 80), resample_lanczos)
        layout_img.paste(code128_resized, (400, 490))
    except Exception as e:
        print(f"Failed to generate or paste Code128: {e}")
        
    # Revision Date bottom right
    rev_text = f"Rev {data.get('revision_date', '06/20/2026')}"
    font_rev = load_custom_font(18, is_bold=False)
    rev_w = get_text_width(draw, rev_text, font_rev)
    draw.text((1160 - rev_w, 555), rev_text, fill="#666666", font=font_rev)
    
    # Save the layout
    directory = os.path.dirname(filepath)
    if directory and not os.path.exists(directory):
        os.makedirs(directory)
    layout_img.save(filepath, dpi=(300, 300))
    return layout_img
