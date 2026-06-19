import os
from PIL import Image, ImageDraw, ImageFont
from pdf417 import encode, render_image

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

def generate_barcode_layout_image(text, data, filepath="output/barcode_layout.png"):
    # Fixed dimension background: 1200 x 400 pixels
    layout_img = Image.new("RGB", (1200, 400), "white")
    
    # 1. Barcode section
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
    
    # 3. Bottom strip
    # Draw separating line (2px, #cccccc)
    draw.line([(40, 355), (1160, 355)], fill="#cccccc", width=2)
    
    # Below line text (font size 22px, color #666666) at y = 365
    font_bottom = load_custom_font(22, is_bold=False)
    
    # Left: country/organisation name
    org_name = data.get("country", "KENYA").strip().upper() or "KENYA"
    draw.text((40, 365), org_name, fill="#666666", font=font_bottom)
    
    # Right: expiry date
    expiry_date = data.get("expiry_date", "").strip().upper()
    expiry_text = f"EXPIRY: {expiry_date}" if expiry_date else "EXPIRY: N/A"
    exp_w = get_text_width(draw, expiry_text, font_bottom)
    draw.text((1160 - exp_w, 365), expiry_text, fill="#666666", font=font_bottom)
    
    # Ensure folder path exists
    directory = os.path.dirname(filepath)
    if directory and not os.path.exists(directory):
        os.makedirs(directory)
        
    # Save the layout file at 300 DPI
    layout_img.save(filepath, dpi=(300, 300))
    return layout_img
