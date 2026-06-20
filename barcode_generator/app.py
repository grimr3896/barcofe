import os
from pathlib import Path
from flask import Flask, render_template, request, send_file, current_app
from encoder import build_encoded_text
from barcode_gen import generate_barcode_image, generate_barcode_layout_image, generate_code128_image

app = Flask(__name__)
OUTPUT_DIR = Path("output")

# Ensure output directory exists
os.makedirs("output", exist_ok=True)

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")

@app.route("/generate", methods=["POST"])
def generate():
    # Read all 19 form fields
    data = {
        "license_number": request.form.get("license_number", ""),
        "last_name": request.form.get("last_name", ""),
        "first_name": request.form.get("first_name", ""),
        "middle_name": request.form.get("middle_name", ""),
        "dob": request.form.get("dob", ""),
        "issue_date": request.form.get("issue_date", ""),
        "expiry_date": request.form.get("expiry_date", ""),
        "address": request.form.get("address", ""),
        "city": request.form.get("city", ""),
        "county": request.form.get("county", ""),
        "zip": request.form.get("zip", ""),
        "sex": request.form.get("sex", "M"),
        "height": request.form.get("height", "5'11\""),
        "eye_color": request.form.get("eye_color", "BRN"),
        "hair_color": request.form.get("hair_color", "BLK"),
        "category": request.form.get("category", "STUDENT"),
        "restrictions": request.form.get("restrictions", "NONE"),
        "endorsements": request.form.get("endorsements", "NONE"),
        "country": request.form.get("country", "KENYA"),
    }
    
    encoded_text = build_encoded_text(data)
    
    # Save to output/barcode.png
    output_path = os.path.join("output", "barcode.png")
    generate_barcode_image(encoded_text, output_path)

    # Save to output/code128.png
    code128_path = os.path.join("output", "code128.png")
    generate_code128_image(data.get("license_number", ""), code128_path)
    
    # Save to output/barcode_layout.png
    layout_path = os.path.join("output", "barcode_layout.png")
    generate_barcode_layout_image(encoded_text, data, layout_path)
    
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

@app.route("/download/both")
def download_both():
    path = OUTPUT_DIR / "barcode_layout.png"
    if not path.exists():
        return "No layout generated yet.", 404
    return send_file(path, as_attachment=True, download_name="barcode_layout_both.png")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000, debug=True)
