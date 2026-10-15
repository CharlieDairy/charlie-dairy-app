@AGENTS.md

## Where Charlie files live (standing rule from the owner, 15 Oct 2026)

All Charlie data that is kept on this PC lives on the **E: drive**. Everything else lives in the cloud.

- **Documents, exports, reports, videos, CashBook CSVs, workbooks, screenshots:** `E:\Charlie` (sub-folders by topic, e.g. `CashBook downloads`).
- **The app project** (source, git, `.env`, `backups/`): `E:\charlie-dairy-app`.
- **Local database backups:** `E:\Charlie Backups` (run `node scripts/backup-daily.js`). The off-site copy goes to Google Drive, `G:\My Drive\Charlie Backups`.
- **Never** save Charlie files to the C: drive, the Desktop, Downloads, Documents, OneDrive or D:. If a tool puts a file there, move it to E: and remove the stray copy.
- **Live data** (animals, milk, sales, cash, users) stays in the cloud database (Prisma Postgres) and photos in Vercel Blob. Do not keep the only copy of anything on the PC.
- Work that is not about Charlie must not be saved inside `E:\Charlie`.
