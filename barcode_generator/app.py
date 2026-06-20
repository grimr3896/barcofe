import os
from pathlib import Path
from flask import Flask, render_template, request, send_file, current_app
from encoder import build_encoded_text
from barcode_gen import generate_barcode_image, generate_barcode_layout_image, generate_code128_image

app = Flask(__name__)
OUTPUT_DIR = Path("output")

def format_date_display(date_str: str) -> str:
    # Input: YYYY-MM-DD
    # Output: MM/DD/YYYY
    if not date_str or date_str == "NONE":
        return "NONE"
    if "-" in date_str:
        parts = date_str.split("-")
        if len(parts) == 3:
            year, month, day = parts
            return f"{month}/{day}/{year}"
    return date_str

app.jinja_env.filters['format_date_display'] = format_date_display

from barcode_gen import get_class_desc, get_endorsements_desc, get_restrictions_desc

def class_desc_filter(val):
    desc = get_class_desc(val)
    if desc.endswith(" (default)"):
        desc = desc[:-10]
    return desc

app.jinja_env.filters['class_desc'] = class_desc_filter
app.jinja_env.filters['endorsements_desc'] = get_endorsements_desc
app.jinja_env.filters['restrictions_desc'] = get_restrictions_desc

# Ensure output directory exists
os.makedirs("output", exist_ok=True)

def generate_info_block_image(data, filepath):
    from PIL import Image, ImageDraw
    from barcode_gen import load_custom_font, get_class_desc, get_endorsements_desc, get_restrictions_desc
    
    # 800x180 canvas
    img = Image.new("RGB", (800, 180), "white")
    draw = ImageDraw.Draw(img)
    
    font_block = load_custom_font(18, is_bold=True)
    class_val = get_class_desc(data.get("category", data.get("vehicle_class", "C")))
    end_val = get_endorsements_desc(data.get("endorsements", "NONE"))
    restr_val = get_restrictions_desc(data.get("restrictions", "NONE"))
    
    draw.text((20, 25), f"CLASS: {class_val}", fill="#1a1a1a", font=font_block)
    draw.text((20, 75), f"ENDORSEMENTS: {end_val}", fill="#1a1a1a", font=font_block)
    draw.text((20, 125), f"RESTRICTIONS: {restr_val}", fill="#1a1a1a", font=font_block)
    
    img.save(filepath, dpi=(300, 300))

def save_outputs_helper(data):
    encoded_text = build_encoded_text(data)
    
    # Create output dir if needed
    os.makedirs("output", exist_ok=True)
    
    # Save PDF417 to output/barcode.png
    barcode_path = os.path.join("output", "barcode.png")
    generate_barcode_image(encoded_text, barcode_path)
    
    # Save Code128 to output/code128.png
    code128_path = os.path.join("output", "code128.png")
    generate_code128_image(data.get("license_number", ""), code128_path)
    
    # Save Layout to output/barcode_layout.png
    layout_path = os.path.join("output", "barcode_layout.png")
    generate_barcode_layout_image(encoded_text, data, layout_path)
    
    # Save Info Block to output/info_block.png
    info_block_path = os.path.join("output", "info_block.png")
    generate_info_block_image(data, info_block_path)
    
    # Save Track Data to output/track_data.txt
    t1 = data.get("magnetic_track_1", "")
    t2 = data.get("magnetic_track_2", "")
    printed_track = f"{t1}{t2}"
    with open(os.path.join("output", "track_data.txt"), "w") as f:
        f.write(f"Track 1: {t1}\nTrack 2: {t2}\nPrinted track: {printed_track}\n")
        
    # Save Sequence to output/sequence.txt
    with open(os.path.join("output", "sequence.txt"), "w") as f:
        f.write(str(data.get("sequence_number", "")))
        
    # Save Revision to output/revision.txt
    with open(os.path.join("output", "revision.txt"), "w") as f:
        f.write(f"Rev {data.get('revision_date', '')}")

@app.route("/", methods=["GET"])
def index():
    import random
    from datetime import date
    from encoder import format_track_expiry, format_track_dob, clean_license_number
    
    seq_num = str(random.randint(100000, 999999))
    rev_date = date.today().strftime("%m/%d/%Y")
    
    # Defaults
    data = {
        "license_number": "T16700285",
        "last_name": "MAURY",
        "first_name": "JUSTIN",
        "middle_name": "WILLIAM",
        "dob": "1958-07-15",
        "issue_date": "2009-08-14",
        "expiry_date": "2017-08-14",
        "address": "17 FIRST STREET",
        "city": "STAUNTON",
        "state_code": "VA",
        "zip": "24401",
        "sex": "M",
        "height_feet": "5",
        "height_inches": "11",
        "height": "5'11",
        "eye_color": "BRN",
        "hair_color": "BLK",
        "category": "C",
        "restrictions": "NONE",
        "endorsements": "NONE",
        "country": "USA",
        "sequence_number": seq_num,
        "revision_date": rev_date,
        "iin": "636014",
        "weight": "160",
        "document_discriminator": "1827364590",
        "compliance_type": "F",
    }
    
    # Add magnetic tracks initial values
    iin = "636014"
    lic = clean_license_number("T16700285")
    last = "MAURY"
    first = "JUSTIN"
    exp_yy = format_track_expiry("2017-08-14")
    dob_yy = format_track_dob("1958-07-15")
    
    data["magnetic_track_1"] = f"%{iin}{lic}^{last}/{first}^{exp_yy}?"
    data["magnetic_track_2"] = f";{lic}={exp_yy}{dob_yy}?"
    data["magnetic_track"] = f"Track 1: {data['magnetic_track_1']}\nTrack 2: {data['magnetic_track_2']}"
    
    save_outputs_helper(data)
    
    return render_template("index.html", data=data)

@app.route("/generate", methods=["POST"])
def generate():
    import random
    from datetime import date
    from encoder import format_track_expiry, format_track_dob, clean_license_number
    
    person = {}
    
    # 1. Auto-generate document_discriminator:
    person["document_discriminator"] = str(
        random.randint(1000000000, 9999999999)
    )
    
    # 2. Set compliance_type default:
    person["compliance_type"] = "F"
    
    # 3. Set country default:
    person["country"] = request.form.get("country", "USA").strip() or "USA"
    
    # 4. Strip address to street only:
    address = request.form.get("address", "").strip().upper()
    if "," in address:
        address = address.split(",")[0].strip()
    person["address"] = address
    
    # 5. Map state_code from form field named "state_code"
    person["state_code"] = request.form.get(
        "state_code", "CA"
    ).strip().upper()
    
    # 6. Map sex to numeric:
    sex = request.form.get("sex", "M").strip().upper()
    person["sex"] = "1" if sex == "M" else "2" if sex == "F" else "9"
    
    # Retrieve and clean other fields
    lic = str(request.form.get("license_number", "")).strip().upper()
    lic_clean = clean_license_number(lic)
    person["license_number"] = lic
    
    person["last_name"] = str(request.form.get("last_name", "")).strip().upper()
    person["first_name"] = str(request.form.get("first_name", "")).strip().upper()
    person["middle_name"] = str(request.form.get("middle_name", "")).strip().upper() or "NONE"
    
    person["dob"] = request.form.get("dob", "")
    person["issue_date"] = request.form.get("issue_date", "")
    person["expiry_date"] = request.form.get("expiry_date", "")
    person["city"] = str(request.form.get("city", "")).strip().upper()
    person["zip"] = str(request.form.get("zip", "")).strip().upper()
    
    h_feet = request.form.get("height_feet", "5")
    h_inches = request.form.get("height_inches", "11")
    person["height_feet"] = h_feet
    person["height_inches"] = h_inches
    person["height"] = f"{h_feet}'{h_inches}"
    
    person["eye_color"] = request.form.get("eye_color", "BRN").strip().upper()
    person["hair_color"] = request.form.get("hair_color", "BLK").strip().upper()
    person["category"] = request.form.get("category", "C").strip().upper()
    person["restrictions"] = request.form.get("restrictions", "NONE").strip().upper()
    person["endorsements"] = request.form.get("endorsements", "NONE").strip().upper()
    
    # Read/generate sequence_number and revision_date
    seq_num = request.form.get("sequence_number")
    if not seq_num:
        seq_num = str(random.randint(100000, 999999))
    person["sequence_number"] = seq_num
    
    rev_date = request.form.get("revision_date")
    if not rev_date:
        rev_date = date.today().strftime("%m/%d/%Y")
    person["revision_date"] = rev_date
    
    iin = request.form.get("iin", "").strip()
    if not iin:
        iin = "636014" if person["country"] == "USA" else "636055"
    person["iin"] = iin
    
    person["weight"] = request.form.get("weight", "160").strip()
    
    # Calculate magnetic tracks
    exp_yy = format_track_expiry(person["expiry_date"])
    dob_yy = format_track_dob(person["dob"])
    
    mag_track_1 = f"%{iin}{lic_clean}^{person['last_name']}/{person['first_name']}^{exp_yy}?"
    mag_track_2 = f";{lic_clean}={exp_yy}{dob_yy}?"
    
    person["magnetic_track_1"] = mag_track_1
    person["magnetic_track_2"] = mag_track_2
    person["magnetic_track"] = f"Track 1: {mag_track_1}\nTrack 2: {mag_track_2}"
    
    # Save outputs and render
    data = person
    save_outputs_helper(data)
    
    return render_template("index.html", data=data, generated=True)

@app.route("/barcode.png")
def serve_barcode():
    path = os.path.join("output", "barcode.png")
    if os.path.exists(path):
        return send_file(path, mimetype="image/png")
    return "Not Found", 404

@app.route("/code128.png")
def serve_code128():
    path = os.path.join("output", "code128.png")
    if os.path.exists(path):
        return send_file(path, mimetype="image/png")
    return "Not Found", 404

@app.route("/barcode_layout.png")
def serve_barcode_layout():
    path = os.path.join("output", "barcode_layout.png")
    if os.path.exists(path):
        return send_file(path, mimetype="image/png")
    return "Not Found", 404

@app.route("/info_block.png")
def serve_info_block():
    path = os.path.join("output", "info_block.png")
    if os.path.exists(path):
        return send_file(path, mimetype="image/png")
    return "Not Found", 404

@app.route("/download/track")
def download_track():
    path = OUTPUT_DIR / "track_data.txt"
    if not path.exists():
        return "No track data generated yet.", 404
    return send_file(path, as_attachment=True, download_name="track_data.txt")

@app.route("/download/infoblock")
def download_infoblock():
    path = OUTPUT_DIR / "info_block.png"
    if not path.exists():
        return "No vehicle info block generated yet.", 404
    return send_file(path, as_attachment=True, download_name="info_block.png")

@app.route("/download/pdf417")
def download_pdf417():
    path = OUTPUT_DIR / "barcode.png"
    if not path.exists():
        return "No PDF417 barcode generated yet.", 404
    return send_file(path, as_attachment=True, download_name="pdf417_barcode.png")

@app.route("/download/code128")
def download_code128():
    path = OUTPUT_DIR / "code128.png"
    if not path.exists():
        return "No Code 128 barcode generated yet.", 404
    return send_file(path, as_attachment=True, download_name="code128_barcode.png")

@app.route("/download/sequence")
def download_sequence():
    path = OUTPUT_DIR / "sequence.txt"
    if not path.exists():
        return "No sequence generated yet.", 404
    return send_file(path, as_attachment=True, download_name="sequence.txt")

@app.route("/download/revision")
def download_revision():
    path = OUTPUT_DIR / "revision.txt"
    if not path.exists():
        return "No revision generated yet.", 404
    return send_file(path, as_attachment=True, download_name="revision.txt")

@app.route("/download/layout")
def download_layout():
    path = OUTPUT_DIR / "barcode_layout.png"
    if not path.exists():
        return "No layout generated yet.", 404
    return send_file(path, as_attachment=True, download_name="barcode_layout.png")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000, debug=True)
