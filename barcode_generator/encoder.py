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
    ("DAJ", "county"),
    ("DAK", "zip"),
    ("DCF", "document_discriminator"),
    ("DCG", "country"),
    ("DCA", "vehicle_class"),
    ("DCB", "restrictions"),
    ("DCD", "endorsements"),
    ("DBD", "issue_date"),
    ("DAZ", "hair_color"),
    ("DAW", "weight"),
)

REQUIRED_FIELDS = ("license_number", "last_name", "first_name", "dob")

def format_date_to_yyyymmdd(date_str):
    if not date_str or str(date_str).strip().upper() == "NONE":
         return "NONE"
    
    cleaned = re.sub(r'[\/-]', '', str(date_str)).strip()
    if re.match(r'^\d{8}$', cleaned):
         return cleaned
    
    parts = re.split(r'[\/-]', str(date_str).strip())
    if len(parts) == 3:
         if len(parts[0]) == 4:
              return f"{parts[0]}{parts[1].zfill(2)}{parts[2].zfill(2)}"
         elif len(parts[2]) == 4:
              return f"{parts[2]}{parts[0].zfill(2)}{parts[1].zfill(2)}"
    return cleaned.upper()

def format_date_to_yymmdd(date_str):
    yyyymmdd = format_date_to_yyyymmdd(date_str)
    if yyyymmdd and yyyymmdd != "NONE" and len(yyyymmdd) == 8:
         return yyyymmdd[2:]
    return yyyymmdd

def format_date_aamva(date_str: str) -> str:
    if not date_str:
        return ""
    date_str = str(date_str).strip()
    if date_str.upper() in ("NONE", ""):
        return ""
    
    # Handle YYYY-MM-DD input from HTML date picker
    if "-" in date_str:
        parts = date_str.split("-")
        if len(parts) == 3:
            year, month, day = parts
            return f"{month.zfill(2)}{day.zfill(2)}{year}"
    
    # Handle MM/DD/YYYY input
    if "/" in date_str:
        parts = date_str.split("/")
        if len(parts) == 3:
            month, day, year = parts
            return f"{month.zfill(2)}{day.zfill(2)}{year}"
            
    # Remove separators to check digits
    cleaned = re.sub(r'[\/-]', '', date_str)
    if len(cleaned) == 8:
        # Check if first 4 is year (e.g. 19950314 -> YYYYMMDD)
        if int(cleaned[:4]) > 1300:
            year = cleaned[:4]
            month = cleaned[4:6]
            day = cleaned[6:]
            return f"{month}{day}{year}"
        else:
            return cleaned
    return cleaned

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
    # Handle 5'11" or 5'11 format
    match = re.match(r"(\d+)'(\d+)", height_str)
    if match:
        feet = int(match.group(1))
        inches = int(match.group(2))
        total_inches = (feet * 12) + inches
        return f"{total_inches:03d} in"
    # Already in correct format e.g. 071 in
    if "in" in height_str:
        return height_str
    return height_str

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
    if c == "KENYA":
         return "990001"
    if c == "CANADA":
         return "300022"
    return "636014"

def build_encoded_text(data):
    iin = str(data.get("iin", "636055")).strip()
    if not iin:
        iin = "636055"
    
    elements = []
    
    # 1. DAQ - license_number
    lic = clean_license_number(data.get("license_number", ""))
    elements.append(f"DAQ {lic}")
    
    # 2. DCS - last_name
    last = str(data.get("last_name", "")).strip().upper()
    elements.append(f"DCS {last}")
    
    # 3. DAC - first_name
    first = str(data.get("first_name", "")).strip().upper()
    elements.append(f"DAC {first}")
    
    # 4. DAD - middle_name
    mid = str(data.get("middle_name", "")).strip().upper()
    if mid and mid != "NONE":
        elements.append(f"DAD {mid}")
    
    # 5. DBB - dob
    dob = format_date_aamva(data.get("dob", ""))
    elements.append(f"DBB {dob}")
    
    # 6. DBA - expiry_date
    exp = format_date_aamva(data.get("expiry_date", ""))
    elements.append(f"DBA {exp}")
    
    # 7. DBC - sex
    raw_sex = str(data.get("sex", "M")).strip().upper()
    if raw_sex in ("M", "1"):
        sex_val = "1"
    elif raw_sex in ("F", "2"):
        sex_val = "2"
    else:
        sex_val = "9"
    elements.append(f"DBC {sex_val}")
    
    # 8. DAY - eye_color
    eye = str(data.get("eye_color", "BRN")).strip().upper()
    elements.append(f"DAY {eye}")
    
    # 9. DAU - height
    height = convert_height(str(data.get("height", "5'11")))
    elements.append(f"DAU {height}")
    
    # 10. DAG - address
    addr = str(data.get("address", "")).strip().upper()
    elements.append(f"DAG {addr}")
    
    # 11. DAI - city
    city = str(data.get("city", "")).strip().upper()
    elements.append(f"DAI {city}")
    
    # 12. DAJ - county
    county = str(data.get("county", "")).strip().upper()
    elements.append(f"DAJ {county}")
    
    # 13. DAK - zip
    zip_code = str(data.get("zip", "")).strip().upper()
    elements.append(f"DAK {zip_code}")
    
    # 14. DCF - document_discriminator
    dcf = str(data.get("document_discriminator", "")).strip().upper()
    if not dcf:
        import random
        dcf = str(random.randint(1000000000, 9999999999))
    elements.append(f"DCF {dcf}")
    
    # 15. DCG - country
    country = str(data.get("country", "USA")).strip().upper()
    elements.append(f"DCG {country}")
    
    # 16. DCA - vehicle_class
    v_class = extract_code(data.get("vehicle_class", data.get("category", "C")))
    if not v_class or v_class == "NONE":
        v_class = "C"
    elements.append(f"DCA {v_class}")
    
    # 17. DCB - restrictions
    restr = extract_code(data.get("restrictions", "NONE"))
    elements.append(f"DCB {restr}")
    
    # 18. DCD - endorsements
    ends = extract_code(data.get("endorsements", "NONE"))
    elements.append(f"DCD {ends}")
    
    # 19. DBD - issue_date
    iss = format_date_aamva(data.get("issue_date", ""))
    elements.append(f"DBD {iss}")
    
    # 20. DAZ - hair_color
    hair = str(data.get("hair_color", "BLK")).strip().upper()
    elements.append(f"DAZ {hair}")
    
    # 21. DAW - weight
    weight = str(data.get("weight", "160")).strip().upper()
    elements.append(f"DAW {weight}")
    
    subfile_type = "DL"
    subfile_data = f"{subfile_type}\n{'\n'.join(elements)}\n"
    
    # Calculate offset and length
    offset_str = "0031"
    length_str = f"{len(subfile_data):04d}"
    
    # Header: Compliance Indicator (@) + Separator (\n) + Record Separator (\u001e) + Segment Terminator (\r) + File Type (ANSI ) + ...
    header = f"@\n\x1e\rANSI {iin}010101DL0031{length_str}"
    
    return f"{header}{subfile_data}"
