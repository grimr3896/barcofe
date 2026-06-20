import os
import io
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from pdf417 import encode, render_image
from barcode import Code128
from barcode.writer import ImageWriter

def generate_barcode_image(text, filepath="output/barcode.png"):
    # Change ONLY these parameters in generate_barcode_image():
    # columns: 16 # was 10 — more columns makes it wider and shorter
    # scale: 5 # was 4 — larger scale makes bars thicker and bolder
    # padding: 15 # was 20 — tighter padding keeps it compact
    # security_level: 5 # keep as is
    codes = encode(text, columns=16, security_level=5)
    
    image = render_image(codes, scale=5, padding=15)
    
    # Ensure directory exists before saving
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
    # Standalone names
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

def generate_barcode_layout_image(text, data, filepath="output/barcode_layout.png"):
    # Fixed dimension background: 1200 x 500 pixels
    layout_img = Image.new("RGB", (1200, 500), "white")
    
    # 1. Barcode section (PDF417)
    # Generate the barcode at Columns: 16, Scale: 5, ECL: 5, Padding: 0
    codes = encode(text, columns=16, security_level=5)
    barcode_img = render_image(codes, scale=5, padding=0)
    
    # Resize barcode to stretch over 1120px x 260px (full width minus 40px left & right padding)
    try:
        resample_filter = Image.Resampling.NEAREST
    except AttributeError:
        resample_filter = Image.NEAREST
    
    barcode_resized = barcode_img.resize((1120, 260), resample_filter)
    
    # Paste barcode centered horizontally (top margin: 30px)
    # Positioning: x = 40 (left padding), y = 30
    layout_img.paste(barcode_resized, (40, 30))
    
    draw = ImageDraw.Draw(layout_img)
    
    # 2. Text section below barcode (Font size 28px, Color #1a1a1a, Top margin from barcode: 20px)
    # y = 30 + 260 + 20 = 310
    font_middle = load_custom_font(28, is_bold=True)
    
    license_number = data.get("license_number", "").strip().upper()
    first_name = data.get("first_name", "").strip().upper()
    last_name = data.get("last_name", "").strip().upper()
    text_middle = f"ID: {license_number}     NAME: {first_name} {last_name}"
    
    text_w = get_text_width(draw, text_middle, font_middle)
    x_middle = max(0, (1200 - text_w) // 2)
    draw.text((x_middle, 310), text_middle, fill="#1a1a1a", font=font_middle)
    
    # 3. Divider line between sections (2px, #cccccc)
    draw.line([(40, 340), (1160, 340)], fill="#cccccc", width=2)
    
    # Below line text (font size 22px, color #666666) at y = 350
    font_bottom = load_custom_font(22, is_bold=False)
    
    # Left: country/organisation name
    org_name = data.get("country", "KENYA").strip().upper() or "KENYA"
    draw.text((40, 350), org_name, fill="#666666", font=font_bottom)
    
    # Right: expiry date
    expiry_date = data.get("expiry_date", "").strip().upper()
    expiry_text = f"EXPIRY: {expiry_date}" if expiry_date else "EXPIRY: N/A"
    exp_w = get_text_width(draw, expiry_text, font_bottom)
    draw.text((1160 - exp_w, 350), expiry_text, fill="#666666", font=font_bottom)
    
    # 4. Code 128 section (bottom 160px, centered horizontally)
    # Label above Code 128: "LICENCE NUMBER" in small caps
    font_label = load_custom_font(18, is_bold=True)
    label_text = "LICENCE NUMBER"
    label_w = get_text_width(draw, label_text, font_label)
    draw.text((max(0, (1200 - label_w) // 2), 380), label_text, fill="#1a1a1a", font=font_label)
    
    # Centered Code 128 barcode (width: 400px max, height: 80px)
    try:
        code128_path = os.path.join("output", "code128.png")
        code128_img = generate_code128_image(license_number, code128_path)
        
        try:
            resample_lanczos = Image.Resampling.LANCZOS
        except AttributeError:
            resample_lanczos = Image.ANTIALIAS
            
        code128_resized = code128_img.resize((400, 80), resample_lanczos)
        layout_img.paste(code128_resized, (400, 405))
    except Exception as e:
        print(f"Failed to generate or paste Code128: {e}")
    
    # Ensure folder path exists
    directory = os.path.dirname(filepath)
    if directory and not os.path.exists(directory):
        os.makedirs(directory)
        
    # Save the layout file at 300 DPI
    layout_img.save(filepath, dpi=(300, 300))
    return layout_img
