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
    ("DCA", "category"),
    ("DCB", "restrictions"),
    ("DCD", "endorsements"),
    ("DCG", "country"),
)

REQUIRED_FIELDS = ("license_number", "last_name", "first_name", "dob")

def build_encoded_text(data):
    lines = []
    for prefix, key in FIELD_ORDER:
        val = data.get(key, "") or ""
        lines.append(f"{prefix}: {val}")
    return "\n".join(lines)
