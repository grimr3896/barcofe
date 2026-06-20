import re

FIELD_ORDER = (
    ("DAQ", "license_number"),
    ("DCS", "last_name"),
    ("DAC", "first_name"),
    ("DAD", "middle_name"),
    ("DBB", "dob"),
    ("DBA", "expiry_date"),
    ("DBC", "sex"),
    ("DAY", "eye_color"),
    ("DAU", "height"),
    ("DAG", "address"),
    ("DAI", "city"),
    ("DAJ", "state_code"),
    ("DAK", "zip"),
    ("DCF", "document_discriminator"),
    ("DCG", "country"),
    ("DCA", "vehicle_class"),
    ("DCB", "restrictions"),
    ("DCD", "endorsements"),
    ("DBD", "issue_date"),
    ("DAZ", "hair_color"),
    ("DAW", "weight"),
    ("DDA", "compliance_type"),
)

REQUIRED_FIELDS = ("license_number", "last_name", "first_name", "dob")

def format_date_aamva(date_str: str) -> str:
    if not date_str or date_str.upper() == "NONE":
        return "NONE"
    clean = date_str.replace("-", "").replace("/", "")
    if len(clean) == 8:
        if clean[:2] in ("19", "20"):
            year = clean[:4]
            month = clean[4:6]
            day = clean[6:8]
            return f"{month}{day}{year}"
        return clean
    if "-" in date_str:
        parts = date_str.split("-")
        if len(parts) == 3:
            year, month, day = parts
            return f"{month}{day}{year}"
    return date_str

def format_track_expiry(date_str: str) -> str:
    if not date_str:
        return ""
    date_str = str(date_str).strip()
    if date_str.upper() in ("NONE", ""):
        return ""
    # Handle YYYY-MM-DD
    if "-" in date_str:
        parts = date_str.split("-")
        if len(parts) == 3:
            return f"{parts[0][2:]}{parts[1]}"
    # Handle MM/DD/YYYY
    if "/" in date_str:
        parts = date_str.split("/")
        if len(parts) == 3:
            return f"{parts[2][2:]}{parts[0]}"
    # Handle MMDDYYYY
    if len(date_str) == 8:
        return f"{date_str[6:]}{date_str[:2]}"
    return date_str

def format_track_dob(date_str: str) -> str:
    if not date_str:
        return ""
    date_str = str(date_str).strip()
    if date_str.upper() in ("NONE", ""):
        return ""
    # Handle YYYY-MM-DD
    if "-" in date_str:
        parts = date_str.split("-")
        if len(parts) == 3:
            return f"{parts[0][2:]}{parts[1]}{parts[2]}"
    # Handle MM/DD/YYYY
    if "/" in date_str:
        parts = date_str.split("/")
        if len(parts) == 3:
            return f"{parts[2][2:]}{parts[0].zfill(2)}{parts[1].zfill(2)}"
    # Handle MMDDYYYY
    if len(date_str) == 8:
        return f"{date_str[6:]}{date_str[:2]}{date_str[2:4]}"
    return date_str

def convert_height(height_str: str) -> str:
    import re
    match = re.match(r"(\d+)['\s](\d+)", str(height_str))
    if match:
        feet = int(match.group(1))
        inches = int(match.group(2))
        total = (feet * 12) + inches
        return f"{total:03d} IN"
    if "IN" in str(height_str).upper():
        return height_str.upper()
    return height_str

def convert_height_to_aamva(height_str: str) -> str:
    return convert_height(height_str)

def extract_code(val):
    if not val or str(val).strip().upper() in ("NONE", ""):
         return "NONE"
    val = str(val).strip()
    if " - " in val:
         return val.split(" - ")[0].strip().upper()
    return val.upper()

def clean_license_number(license):
    return re.sub(r'[^A-Z0-9]', '', str(license).upper())

def get_iin(country, state):
    c = str(country).upper().strip()
    if c == "USA":
         return "636014"
    return "636055"

def normalize_person(person):
    p = {k: v for k, v in person.items()}
    
    # 1. license_number - from license_number primary, fallback to licence_number
    lic = p.get("license_number", p.get("licence_number", ""))
    p["license_number"] = clean_license_number(lic)
    
    # 2. sex handling
    sex = str(p.get("sex", "M")).strip().upper()
    if sex in ("M", "1"):
        p["sex"] = "1"
    elif sex in ("F", "2"):
        p["sex"] = "2"
    else:
        p["sex"] = "9"
        
    # 3. state_code - mapping
    state = str(p.get("state_code", p.get("county", p.get("state", "CA")))).strip().upper()
    if len(state) > 2:
        state = state[:2]
    p["state_code"] = state
    
    # 4. vehicle_class - from vehicle_class or category or C
    v_class = extract_code(p.get("vehicle_class", p.get("category", "C")))
    if not v_class or v_class == "NONE":
        v_class = "C"
    p["vehicle_class"] = v_class
    
    # 5. restrictions
    p["restrictions"] = extract_code(p.get("restrictions", "NONE"))
    
    # 6. endorsements
    p["endorsements"] = extract_code(p.get("endorsements", "NONE"))
    
    # 7. iin - default to 636055 but check country
    country = str(p.get("country", "")).strip().upper()
    if not country:
        country = "USA"
    p["country"] = country
    
    if "iin" not in p or not p["iin"]:
        p["iin"] = "636014" if country == "USA" else "636055"
        
    # 8. compliance_type
    if "compliance_type" not in p or not p["compliance_type"]:
        p["compliance_type"] = "F"
        
    # 9. address - street name only
    addr = str(p.get("address", "")).strip().upper()
    if "," in addr:
        addr = addr.split(",")[0].strip()
    p["address"] = addr
    
    return p

def build_encoded_text(person):
    normalized = normalize_person(person)
    iin = normalized.get("iin", "636055")
    header = f"@\n\x1e\rANSI {iin}0101DL00310322DL\n"
    lines = []
    for code, field in FIELD_ORDER:
        value = normalized.get(field, "NONE")
        if code in ("DBB", "DBA", "DBD"):
            value = format_date_aamva(value)
        if code == "DAU":
            value = convert_height(value)
        if not value:
            value = "NONE"
        lines.append(f"{code} {value}")
    return header + "\n".join(lines)
