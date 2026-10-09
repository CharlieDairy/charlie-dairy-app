"""
Stage the 12-month history (Oct 2025 - Aug 2026) from the master workbooks into history.json.
Read-only: nothing is written to the app here. Sources:
  ALL/Charlie Dairy 2025.xlsx  -> Oct-Dec 2025
  ALL/Charlie Dairy 2026.xlsx  -> Jan-Aug 2026 (Sep 2026 only used for feed rates)
"""
import datetime, json, os, re, warnings, collections
import openpyxl

warnings.filterwarnings("ignore")
ROOT = r"C:\Users\Admin\OneDrive\Desktop\Charlie\ALL"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "history.json")  # git-ignored staging file
KG_PER_L = 1.035
MARK = "History load (Excel)"


def num(v):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def iso(d):
    return d.strftime("%Y-%m-%d")


def clean(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


wb25 = openpyxl.load_workbook(os.path.join(ROOT, "Charlie Dairy 2025.xlsx"), read_only=True, data_only=True)
wb26 = openpyxl.load_workbook(os.path.join(ROOT, "Charlie Dairy 2026.xlsx"), read_only=True, data_only=True)

report = {}

# ------------------------------------------------------------------ FEED
BLOCKS = {"Silage": 2, "Wenda": 8, "Turi": 14, "Fodder": 20}


def feed_rows(wb, first_block_only, fix_year=None):
    ws = wb["Feed Cost"]
    rows = list(ws.iter_rows(min_row=1, max_row=1200, values_only=True))
    out, openings = [], {}
    prev = None
    for i, r in enumerate(rows):
        d = r[1]
        if isinstance(d, str) and d.strip() == "Opening":
            continue
        if not hasattr(d, "strftime"):
            continue
        if first_block_only and prev is not None and d.year == 2025 and prev.year == 2026 and d.month == 10 and d.day == 1:
            break  # copied Oct-Dec 2025 template block at the end of the 2026 sheet
        if fix_year:
            d = d.replace(year=fix_year)
        prev = d
        out.append((i, d, r))
    return rows, out


def parse_feed(rows_dates, lo, hi):
    tx = []
    for i, d, r in rows_dates:
        if d < lo or d > hi:
            continue
        for feed, s in BLOCKS.items():
            inward, outward = num(r[s]), num(r[s + 1])
            rate, cost = num(r[s + 3]), num(r[s + 4])
            if inward:
                tx.append(dict(date=iso(d), feedType=feed, direction="IN", quantity=inward, rate=None, cost=None, notes=MARK))
            if outward:
                # Cost exactly as the workbook records it. Where the sheet shows a rate but zero cost
                # (stock already used up), the quantity is real but uncosted -- reported, not invented.
                tx.append(dict(date=iso(d), feedType=feed, direction="OUT", quantity=outward, rate=rate, cost=(cost if cost else None), notes=MARK))
    return tx


rows25, rd25 = feed_rows(wb25, False)
oct1 = next(i for i, d, r in rd25 if d == datetime.datetime(2025, 10, 1))
open_row = rows25[oct1 - 1]  # the "Opening" row just above 1 Oct 2025
assert str(open_row[1]).strip() == "Opening", open_row[:3]
feed = []
for feedname, s in BLOCKS.items():
    q = num(open_row[s])
    if q:
        feed.append(dict(date="2025-10-01", feedType=feedname, direction="IN", quantity=q, rate=None, cost=None, notes="Opening stock (History load, Excel)"))
feed += parse_feed(rd25, datetime.datetime(2025, 10, 1), datetime.datetime(2025, 12, 31))

rows26, rd26 = feed_rows(wb26, True)
# March 2026 rows are typed with the year 2025 in the sheet: fix by position (rows before the copied block).
fixed = []
for i, d, r in rd26:
    if d.year == 2025:
        d = d.replace(year=2026)
    fixed.append((i, d, r))
feed += parse_feed(fixed, datetime.datetime(2026, 1, 1), datetime.datetime(2026, 8, 31))

# Sep 2026 rates (the app keeps its own Sep quantities; only cost is added)
last_rate = {}
for i, d, r in fixed:
    for feedname, s in BLOCKS.items():
        rt = num(r[s + 3])
        if rt and d <= datetime.datetime(2026, 9, 30):
            last_rate[feedname] = rt
report["feed_sep_rates"] = last_rate

feed_month = collections.defaultdict(lambda: [0, 0.0])
for t in feed:
    if t["direction"] == "OUT":
        k = (t["date"][:7], t["feedType"])
        feed_month[k][0] += t["quantity"]
        feed_month[k][1] += t["cost"] or 0
report["feed_rows"] = len(feed)
unc = collections.defaultdict(float)
for t in feed:
    if t["direction"] == "OUT" and not t["cost"]:
        unc[t["feedType"]] += t["quantity"]
report["feed_uncosted_qty"] = {k: round(v, 1) for k, v in unc.items()}
report["feed_cost_by_month"] = {f"{k[0]} {k[1]}": [round(v[0], 1), round(v[1])] for k, v in sorted(feed_month.items())}

# ------------------------------------------------------------------ CASH Q4 2025
ws = wb25["Consolidated Petty Cash"]
cash = []
rows = list(ws.iter_rows(min_row=1, values_only=True))
hi = next(i for i, r in enumerate(rows) if r and "Account" in [str(c) for c in r])
for r in rows[hi + 1:]:
    d = r[2]
    if not hasattr(d, "strftime") or not (datetime.datetime(2025, 10, 1) <= d <= datetime.datetime(2025, 12, 31, 23, 59)):
        continue
    ain, aout = num(r[11]) or 0.0, num(r[12]) or 0.0
    if ain == 0 and aout == 0:
        continue
    remark, heads = clean(r[5]), clean(r[6])
    mode_raw = (clean(r[9]) or "cash").lower()
    t = r[4]
    cash.append(dict(
        date=iso(d), time=(t.strftime("%H:%M:%S") if hasattr(t, "strftime") else clean(t)),
        account=clean(r[1]), party=clean(r[7]), category=clean(r[8]) or "Uncategorized",
        mode="BANK" if "bank" in mode_raw else "CASH", amountIn=ain, amountOut=aout,
        enteredBy=clean(r[10]), projectLand=clean(r[14]),
        remark=(f"[{heads}] {remark}" if heads and remark else (remark or heads)),
    ))
report["cash_rows"] = len(cash)
cm = collections.defaultdict(lambda: [0, 0.0, 0.0])
for c in cash:
    m = cm[c["date"][:7]]
    m[0] += 1; m[1] += c["amountIn"]; m[2] += c["amountOut"]
report["cash_by_month"] = {k: [v[0], round(v[1]), round(v[2])] for k, v in sorted(cm.items())}

# ------------------------------------------------------------------ MILKING
MONTHS = [("2025", wb25, 10, "Milking Oct 25"), ("2025", wb25, 11, "Milking Nov 25"), ("2025", wb25, 12, "Milking Dec 25")] + [
    ("2026", wb26, m, f"Milking {n} 26") for m, n in [(1, "Jan"), (2, "Feb"), (3, "Mar"), (4, "Apr"), (5, "May"), (6, "Jun"), (7, "Jul"), (8, "Aug")]]
SHIFT = {"morning": "MORNING", "afternoon": "AFTERNOON", "evening": "EVENING"}
milking = []
mon_litres = collections.Counter()
for year, wb, month, sheet in MONTHS:
    rows = list(wb[sheet].iter_rows(min_row=1, max_row=400, values_only=True))
    hdr = next(r for r in rows[:6] if r and r[0] == "Cow Tag")
    dcols = [(i, hdr[i].day) for i, v in enumerate(hdr) if i >= 6 and hasattr(v, "strftime") and v.month == month]
    tag = None
    for r in rows:
        if r[0] not in (None, "", "Cow Tag"):
            tag = str(r[0]).strip()
            if tag.endswith(".0"):
                tag = tag[:-2]
        k = (str(r[2]).strip().lower() if r[2] else "")
        if k in SHIFT and tag:
            for i, day in dcols:
                v = num(r[i]) if i < len(r) else None
                if v and v > 0:
                    milking.append(dict(tag=tag, date=f"{year}-{month:02d}-{day:02d}", shift=SHIFT[k], litres=v))
                    mon_litres[f"{year}-{month:02d}"] += v
report["milking_rows"] = len(milking)
report["milking_litres_by_month"] = {k: round(v, 1) for k, v in sorted(mon_litres.items())}

# ------------------------------------------------------------------ SALES + INTERNAL USE (Milk Sales daily blocks) + P&L amounts
BUYER = {"city": "City Sale", "farm": "Farm Sale", "munshi": "Abdur Rasheed", "mehtab": "Mehtab", "hafiz": "Hafiz Muneeb", "nawaz": "Nawaz Khan", "engro": "Engro"}
USAGE = {"milk to calves": "CALF_USE", "milk to dog & wastage": "FARM_USE", "milk to labour": "EMPLOYEE_USE", "milk to basit": "EMPLOYEE_USE"}


def pnl_amounts(wb, month_cols):
    ws = wb["Profit & Loss"]
    rows = list(ws.iter_rows(min_row=1, max_row=70, values_only=True))
    res = {}
    for r in rows:
        lab = clean(r[2])
        if lab and lab.lower().startswith("sale "):
            who = lab.lower().split()[-1]
            for month, col in month_cols.items():
                v = num(r[col])
                if v:
                    res[(BUYER.get(who, who), month)] = v
    return res


pl25 = pnl_amounts(wb25, {"2025-10": 12, "2025-11": 13, "2025-12": 14})
pl26 = pnl_amounts(wb26, {f"2026-{m:02d}": 2 + m for m in range(1, 9)})
pl_amount = {**pl25, **pl26}


def blocks(wb, wanted):
    ws = wb["Milk Sales"]
    rows = list(ws.iter_rows(min_row=1, max_row=300, values_only=True))
    heads = [i for i, r in enumerate(rows) if r[0] in (None, "") and hasattr(r[1], "strftime")]
    for n, i in enumerate(heads):
        if n not in wanted:
            continue
        end = heads[n + 1] if n + 1 < len(heads) else len(rows)
        yield wanted[n], rows[i], rows[i + 1:end]


sale_daily = []   # (month, buyer, day, litres)
use_rows = []
wanted26 = {n: f"2026-{n + 1:02d}" for n in range(0, 8)}
wanted25 = {9: "2025-10", 10: "2025-11", 11: "2025-12"}
for wb, wanted in ((wb25, wanted25), (wb26, wanted26)):
    for month, hdr, body in blocks(wb, wanted):
        cols = [(i, hdr[i].day) for i in range(1, min(len(hdr), 33)) if hasattr(hdr[i], "strftime")]
        for r in body:
            lab = (clean(r[0]) or "")
            low = lab.lower()
            if low in USAGE:
                for i, day in cols:
                    v = num(r[i])
                    if v and v > 0:
                        use_rows.append(dict(date=f"{month}-{day:02d}", type=USAGE[low], litres=v, notes=MARK))
            elif low == "engro volume in kg":
                for i, day in cols:
                    v = num(r[i])
                    if v and v > 0:
                        sale_daily.append((month, "Engro", day, v / KG_PER_L))
            elif re.match(r"milk sold (to|at) ", low) and "engro" not in low:
                buyer = next((v for k, v in BUYER.items() if k in low), None)
                if not buyer:
                    report.setdefault("unknown_buyers", []).append(lab)
                    continue
                for i, day in cols:
                    v = num(r[i])
                    if v and v > 0:
                        sale_daily.append((month, buyer, day, v / KG_PER_L))

by = collections.defaultdict(list)
for month, buyer, day, lit in sale_daily:
    by[(buyer, month)].append((day, lit))
sales = []
no_amount = []
for (buyer, month), items in sorted(by.items()):
    litres_total = sum(l for _, l in items)
    amt = pl_amount.get((buyer, month))
    if not amt:
        no_amount.append(f"{buyer} {month} ({litres_total:.0f} L)")
    rate = (amt / litres_total) if amt and litres_total else 0.0
    running = 0.0
    for n, (day, lit) in enumerate(sorted(items)):
        a = round(lit * rate, 2)
        if n == len(items) - 1 and amt:
            a = round(amt - running, 2)
        running += a
        sales.append(dict(date=f"{month}-{day:02d}", buyer=buyer, litres=round(lit, 3), rate=round(rate, 4) if rate else None, amount=a, enteredBy="Backfill (cash ledger)"))
report["sales_rows"] = len(sales)
report["usage_rows"] = len(use_rows)
report["sales_without_pnl_amount"] = no_amount
sm = collections.defaultdict(lambda: [0.0, 0.0])
for s in sales:
    sm[s["date"][:7]][0] += s["litres"]; sm[s["date"][:7]][1] += s["amount"]
report["sales_by_month_litres_rs"] = {k: [round(v[0]), round(v[1])] for k, v in sorted(sm.items())}
um = collections.Counter()
for u in use_rows:
    um[u["date"][:7]] += u["litres"]
report["usage_litres_by_month"] = {k: round(v) for k, v in sorted(um.items())}
pl_total = collections.Counter()
for (b, m), v in pl_amount.items():
    pl_total[m] += v
report["pnl_sales_total_by_month"] = {k: round(v) for k, v in sorted(pl_total.items())}

json.dump(dict(feed=feed, cash=cash, milking=milking, sales=sales, usage=use_rows, report=report), open(OUT, "w"))
print(json.dumps(report, indent=1)[:6000])
