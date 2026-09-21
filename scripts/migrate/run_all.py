import os
import datetime
from common import OUTPUT_DIR, ReconLog
import extract_cows
import extract_milking
import extract_cash
import extract_feed
import extract_capital
import extract_assets

if __name__ == "__main__":
    report_path = os.path.join(OUTPUT_DIR, "reconciliation_report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(f"# Charlie Dairy — Migration Reconciliation Report\nGenerated {datetime.datetime.now().isoformat()}\n\n")

    log = ReconLog()
    for mod in (extract_cows, extract_milking, extract_cash, extract_feed, extract_capital, extract_assets):
        log.note(f"\n## {mod.__name__}")
        mod.run(log)
    log.write(report_path)
    print(f"\nDone. Full report at {report_path}")
