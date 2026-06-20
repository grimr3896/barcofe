import re

FIELD_ORDER = (
    ("DAQ", "license_number"),
    ("DCS", "last_name"),
    ("DAC", "first_name"),
    ("DAD", "middle_name"),
    ("DBB", "dob"),
    ("DBD", "issue_date"),
    ("DBA", "expiry_date"),
    ("DAG", "address"),
    ("DAI", "city"),
    ("DAJ", "county"),
    ("DAK", "zip"),
    ("DBC", "sex"),
    ("DAU", "height"),
    ("DAY", "eye_color"),
    ("DAZ", "hair_color"),
    ("DCA", "vehicle_class"),      # DCA vehicle_class
    ("DCB", "restrictions"),       # DCB restrictions
    ("DCD", "endorsements"),       # DCD endorsements
    ("DCT", "magnetic_track_1"),   # DCT track 1 string
    ("DCU", "magnetic_track_2"),   # DCU track 2 string
    ("DCM", "sequence_number"),    # DCM inventory number
    ("DCN", "revision_date"),      # DCN card revision date
    ("DCG", "country"),            # DCG country
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
    if not date_str or date_str == "NONE":
        return "NONE"
    # Handle YYYY-MM-DD input from HTML date picker
    if "-" in date_str:
        parts = date_str.split("-")
        if len(parts) == 3:
            year, month, day = parts
            return f"{month}{day}{year}"
    # Handle MM/DD/YYYY input
    if "/" in date_str:
        parts = date_str.split("/")
        if len(parts) == 3:
            month, day, year = parts
            return f"{month}{day}{year}"
    # Already in MMDDYYYY format — return as is
    return date_str

def format_track_expiry(date_str: str) -> str:
    # Input: YYYY-MM-DD
    # Output: YYMM
    if "-" in date_str:
        parts = date_str.split("-")
        year, month = parts[0][2:], parts[1]
        return f"{year}{month}"
    return date_str

def format_track_dob(date_str: str) -> str:
    # Input: YYYY-MM-DD
    # Output: YYMMDD
    if "-" in date_str:
        parts = date_str.split("-")
        year, month, day = parts[0][2:], parts[1], parts[2]
        return f"{year}{month}{day}"
    return date_str

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
    country = str(data.get("country", "KENYA")).upper()
    state = str(data.get("county", "NONE")).upper()
    iin = get_iin(country, state)
    
    version = "11"
    jversion = "00"
    num_subfiles = "01"
    subfile_type = "DL"
    
    elements = []
    
    def get_f(val):
         if val is None:
              return "NONE"
         val_str = str(val).strip().upper()
         return val_str if val_str else "NONE"
         
    # 1. License Number
    lic = clean_license_number(data.get("license_number", ""))
    if len(lic) < 8:
         lic = lic.ljust(8, "0")
    if len(lic) > 18:
         lic = lic[:18]
    elements.append(f"DAQ{lic}")
    
    # 2. Name (Last, First, Middle) -> Rule 3
    last = get_f(data.get("last_name", ""))
    first = get_f(data.get("first_name", ""))
    mid_raw = str(data.get("middle_name", "")).strip().upper()
    mid = mid_raw if (mid_raw and mid_raw != "NONE") else ""
    name_val = f"{last},{first},{mid}"
    elements.append(f"DAA{name_val}")
    
    # 3. Date of Birth
    elements.append(f"DBB{format_date_aamva(data.get('dob', ''))}")
    
    # 4. Issue Date
    elements.append(f"DBD{format_date_aamva(data.get('issue_date', ''))}")
    
    # 5. Expiry Date
    elements.append(f"DBA{format_date_aamva(data.get('expiry_date', ''))}")
    
    # 6. Address
    street = get_f(data.get("address", ""))
    city = get_f(data.get("city", ""))
    state_val = get_f(data.get("county", ""))
    zip_val = get_f(data.get("zip", ""))
    address_val = f"{street},{city},{state_val},{zip_val}"
    elements.append(f"DAG{address_val}")
    
    # 7. City
    elements.append(f"DAI{city}")
    
    # 8. State/Province
    elements.append(f"DAJ{state_val}")
    
    # 9. ZIP/Postal Code
    elements.append(f"DAK{zip_val}")
    
    # 10. Sex (M/F)
    sex_val = get_f(data.get("sex", "M"))
    if sex_val not in ("M", "F"):
         sex_val = "M"
    elements.append(f"DBC{sex_val}")
    
    # 11. Height
    elements.append(f"DAU{get_f(data.get('height', ''))}")
    
    # 12. Eye Color
    elements.append(f"DAY{get_f(data.get('eye_color', ''))}")
    
    # 13. Hair Color
    elements.append(f"DAZ{get_f(data.get('hair_color', ''))}")
    
    # 14. Class -> Rule 7
    class_code = extract_code(data.get("vehicle_class", data.get("category", "C")))
    if class_code == "NONE":
         class_code = "C"
    elements.append(f"DCA{class_code}")
    
    # 15. Restrictions -> Rule 8
    restr_code = extract_code(data.get("restrictions", "NONE"))
    elements.append(f"DCB{restr_code}")
    
    # 16. Endorsements -> Rule 8
    end_code = extract_code(data.get("endorsements", "NONE"))
    elements.append(f"DCD{end_code}")
    
    # 17. Magnetic Track 1 (New)
    track1 = data.get("magnetic_track_1")
    if not track1:
         st_code = str(data.get("county", "CA")).strip().upper()
         if len(st_code) > 2:
              st_code = st_code[:2]
         elif not st_code or st_code == "NONE":
              st_code = "CA"
         t1_lic = clean_license_number(data.get("license_number", ""))
         t1_last = str(data.get("last_name", "")).strip().upper()
         t1_first = str(data.get("first_name", "")).strip().upper()
         t1_exp = format_track_expiry(data.get("expiry_date", ""))
         track1 = f"%{st_code}{t1_lic}^{t1_last}/{t1_first}^{t1_exp}?"
    elements.append(f"DCT{track1}")
    
    # 18. Magnetic Track 2 (New)
    track2 = data.get("magnetic_track_2")
    if not track2:
         t2_lic = clean_license_number(data.get("license_number", ""))
         t2_exp = format_track_expiry(data.get("expiry_date", ""))
         t2_dob = format_track_dob(data.get("dob", ""))
         track2 = f";{t2_lic}={t2_exp}{t2_dob}?"
    elements.append(f"DCU{track2}")
    
    # 19. Inventory Number (New)
    seq_num = str(data.get("sequence_number", "121586")).strip().upper()
    elements.append(f"DCM{seq_num}")
    
    # 20. Card Revision Date (New)
    rev_date = str(data.get("revision_date", "06/20/2026")).strip().upper()
    elements.append(f"DCN{rev_date}")
    
    # Join subfile parts
    subfile_data = f"{subfile_type}\r{'\n'.join(elements)}\n"
    
    # Calculate offset and length
    offset_str = "0031"
    length_str = str(len(subfile_data)).zfill(4)
    
    # Compliance Indicator (@) + Separator (\n) + Record Separator (\u001e) + Segment Terminator (\r) + File Type (ANSI )
    header = f"@\n\x1e\rANSI {iin}{version}{jversion}{num_subfiles}{subfile_type}{offset_str}{length_str}"
    
    return f"{header}{subfile_data}"
