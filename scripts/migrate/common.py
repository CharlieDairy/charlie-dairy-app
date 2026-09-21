import datetime
import os

SOURCE_DIR = r"C:\Users\Admin\OneDrive\Desktop\Charlie"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def to_iso(value):
    if value is None:
        return None
    if isinstance(value, datetime.datetime):
        return value.date().isoformat()
    if isinstance(value, datetime.date):
        return value.isoformat()
    if isinstance(value, str):
        s = value.strip()
        if not s or s in ("-", "??"):
            return None
        for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
            try:
                return datetime.datetime.strptime(s, fmt).date().isoformat()
            except ValueError:
                continue
        return None
    return None


def to_float(value, default=0.0):
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        s = value.strip().replace(",", "")
        if not s or s in ("-", "n/a", "N/A"):
            return default
        try:
            return float(s)
        except ValueError:
            return default
    return default


def clean_str(value):
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


class ReconLog:
    def __init__(self):
        self.lines = []

    def note(self, msg):
        print(msg)
        self.lines.append(msg)

    def write(self, path):
        with open(path, "a", encoding="utf-8") as f:
            f.write("\n".join(self.lines) + "\n\n")
