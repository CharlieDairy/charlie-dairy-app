"""
Builds the Cow master list by merging:
  - Cow master.xlsx :: 'Cow Register'   -> authoritative list of tags + Dormant/Active flag
  - Charlie Dairy 2026 - Cleaned.xlsx :: 'Animal Summary' -> gender/status/condition/calving dates

Animal Summary's Gender/Status columns are free text with typos and mixed
categories (lifecycle stage mixed with gender). This script normalizes them
with a best-effort heuristic and logs anything ambiguous for manual review.
"""
import json
import os
import openpyxl
from common import SOURCE_DIR, OUTPUT_DIR, to_iso, clean_str, ReconLog


def normalize_gender(gender_raw, status_raw):
    g = (gender_raw or "").strip().lower()
    s = (status_raw or "").strip().lower()
    if "male" in g and "female" not in g and "femail" not in g:
        return "MALE"
    if "male" in s and "female" not in s:
        return "MALE"
    if "femail" in g or "female" in g:
        return "FEMALE"
    if any(k in g for k in ("milking", "heifer", "calv")):
        return "FEMALE"
    if any(k in s for k in ("miking", "milking", "dry", "heifer", "calv")):
        return "FEMALE"
    return "UNKNOWN"


def normalize_status(status_raw, register_flag):
    s = (status_raw or "").strip().lower()
    if "dead" in s:
        return "DEAD"
    if "sold" in s:
        return "SOLD"
    if "dry" in s:
        return "DRY"
    if "miking" in s or "milking" in s:
        return "MILKING"
    if "heifer" in s:
        return "HEIFER"
    if "calv" in s:
        return "CALF"
    if register_flag == "Active":
        return "MILKING"
    return "DORMANT"


def run(recon: ReconLog):
    reg_path = os.path.join(SOURCE_DIR, "Cow master.xlsx")
    wb = openpyxl.load_workbook(reg_path, read_only=True, data_only=True)
    ws = wb["Cow Register"]
    register = {}
    for row in ws.iter_rows(min_row=5, max_row=ws.max_row, values_only=True):
        tag = clean_str(row[0])
        if not tag or any(k in tag.upper() for k in ("TOTAL", "HERD", "AVG")):
            continue
        register[tag] = {
            "tag": tag,
            "registerFlag": clean_str(row[1]),
            "notes": clean_str(row[7]) if len(row) > 7 else None,
        }
    wb.close()

    summary_path = os.path.join(SOURCE_DIR, "Charlie Dairy 2026 - Cleaned.xlsx")
    wb2 = openpyxl.load_workbook(summary_path, read_only=True, data_only=True)
    ws2 = wb2["Animal Summary"]
    summary = {}
    for row in ws2.iter_rows(min_row=5, max_row=ws2.max_row, values_only=True):
        tag = clean_str(row[0])
        if not tag or any(k in tag.upper() for k in ("TOTAL", "HERD", "AVG")):
            continue
        summary[tag] = {
            "gender_raw": clean_str(row[1]),
            "status_raw": clean_str(row[2]),
            "condition": clean_str(row[3]),
            "lastCalvingDate": to_iso(row[4]),
            "expectedCalving": to_iso(row[5]),
            "targetSellDate": to_iso(row[6]),
        }
    wb2.close()

    all_tags = sorted(set(register) | set(summary), key=lambda t: (len(t), t))
    cows = []
    ambiguous = 0
    for tag in all_tags:
        reg = register.get(tag, {})
        summ = summary.get(tag, {})
        gender = normalize_gender(summ.get("gender_raw"), summ.get("status_raw"))
        status = normalize_status(summ.get("status_raw"), reg.get("registerFlag"))
        if gender == "UNKNOWN" and status in ("MILKING", "DRY", "HEIFER", "CALF"):
            ambiguous += 1
        cows.append({
            "tag": tag,
            "gender": gender,
            "status": status,
            "condition": summ.get("condition"),
            "lastCalvingDate": summ.get("lastCalvingDate"),
            "expectedCalving": summ.get("expectedCalving"),
            "targetSellDate": summ.get("targetSellDate"),
            "notes": reg.get("notes"),
        })

    with open(os.path.join(OUTPUT_DIR, "cows.json"), "w", encoding="utf-8") as f:
        json.dump(cows, f, indent=2)

    recon.note(f"[cows] Cow Register tags: {len(register)}; Animal Summary tags: {len(summary)}; merged total: {len(cows)}")
    recon.note(f"[cows] Tags in Cow Register but not in Animal Summary (no gender/calving data): {len(set(register) - set(summary))}")
    recon.note(f"[cows] Ambiguous gender for an active lifecycle status (needs manual review): {ambiguous}")
    return cows


if __name__ == "__main__":
    log = ReconLog()
    run(log)
    log.write(os.path.join(OUTPUT_DIR, "reconciliation_report.md"))
