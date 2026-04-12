# AutoFix Pro — Auto Repair Shop Management System

A lightweight, browser-based management system for small auto repair shops.
No framework, no database, no build step — run one Python file and you're live.

![License](https://img.shields.io/badge/license-MIT-blue)
![Stack](https://img.shields.io/badge/stack-HTML%2FCSS%2FJS-yellow)
![Status](https://img.shields.io/badge/status-production--ready-brightgreen)

---

## Features

| Module | Description |
|---|---|
| **Dashboard** | KPI cards, 7-day revenue chart, category donut, low-stock alerts, sparkline |
| **Spare Parts** | Full CRUD — cost, price, margin, reorder levels, stock status, booked qty |
| **Service Orders** | Create jobs with customer + parts + labor; auto-deducts inventory; status tracking |
| **Customers** | Customer database with multiple vehicles per customer, order history, total spent |
| **Stock History** | Full ledger of every stock movement (in/out) with date, qty, reason, running balance |
| **Reports & Export** | Summary preview → Export to **Excel (.xlsx)** with 4 sheets, custom date range |

### Data & Persistence

- **File-based storage** — data is saved to `autofix_data.json` on disk via the Python server; survives browser cache clears
- **Auto-backup on close** — a timestamped backup is written to `autofix_backups/` every time the server shuts down
- **Daily snapshots** — one backup per day is also created automatically on first save of the day
- **10 backups kept** — oldest files are pruned automatically; no manual cleanup needed
- **Fallback to localStorage** — if the Python server is not running (file:// mode), data is still kept in the browser

### Inventory Control

- **Restock with weighted average cost** — add stock at a different purchase price; the system blends the old and new cost automatically
- **Duplicate SKU detection** — when adding a new part with an existing SKU, the system asks whether to restock the existing entry or save a new variant
- **Stock sufficiency check** — jobs cannot be marked complete if any required part has insufficient stock; shows a clear breakdown of shortages
- **Booked qty column** — shows how much of each part is reserved in pending/in-progress orders (not yet deducted)

### Order Management

- **Created date & completed date** — auto-stamped at order creation and at all completion paths
- **Admin-protected edits** — changing parts on a fulfilled order requires an admin password; simulates stock reversal before checking availability

### UI & Developer Experience

- **Bilingual (EN / TH)** — full Thai and English translation via `js/i18n.js`; toggle in the header
- **Fully responsive** — works on desktop, tablet, and mobile
- **Charts are pure SVG** — zero charting library dependencies
- **Toast notifications** for all CRUD actions
- **Search & filter** on every data table
- **Developer comments** throughout the codebase

---

## Quick Start

### Recommended: Python server (preserves data on disk)

```bash
# Windows — double-click
AutoFix Pro.bat

# Or run directly
python start.py
```

Then visit `http://localhost:8080`.

> **Why use the server?** The browser gives every origin its own private storage bucket.
> Running through the server keeps your data consistently on `http://localhost:8080`
> and writes a real file to disk so data survives browser cache clears.

### Alternative: open index.html directly

Works for a quick look, but data is stored in the browser's `file://` origin —
different from the server origin, so the two data sets are separate.

---

## Data Storage & Backup

```
autofix-pro/
├── autofix_data.json          ← live data; written on every save (created at runtime)
└── autofix_backups/           ← backup folder (created at runtime)
    ├── autofix_backup_2026-04-11_103045_shutdown.json   ← on every server close
    ├── autofix_backup_2026-04-11.json                   ← daily snapshot
    └── ...  (10 most recent kept)
```

**To recover from a backup:**

1. Open `autofix_backups\`
2. Copy the most recent `.json` file to the `autofix-pro\` folder
3. Rename it to `autofix_data.json`
4. Start the server — data loads automatically

**To reset to demo data:**

```js
// Run in browser console
localStorage.clear();
// Then delete autofix_data.json and restart the server
```

---

## Project Structure

```
autofix-pro/
├── index.html              # Entry point — loads all CSS & JS
├── start.py                # Python local server + /api/data persistence + backup
├── AutoFix Pro.bat         # Windows one-click launcher
├── css/
│   └── styles.css          # All styles; CSS variables for theming
├── js/
│   ├── utils.js            # Helpers: uid, date/currency format, SVG icons, modal, toast, saveToServer
│   ├── i18n.js             # EN / TH translations; t() lookup function
│   ├── data.js             # Seed data, State object, server-first loading, stock helpers
│   ├── charts.js           # Pure SVG chart renderers (bar, donut, sparkline)
│   ├── export.js           # Excel export (SheetJS CDN)
│   ├── pages.js            # All page renderers: Dashboard, Parts, Orders, Customers, Stock History, Reports
│   └── app.js              # App entry: auth check, navigation routing, sidebar toggle
├── autofix_data.json       # Runtime — live data file (git-ignored)
├── autofix_backups/        # Runtime — backup snapshots (git-ignored)
├── .gitignore
└── README.md
```

### File Responsibilities

| File | Purpose |
|---|---|
| `utils.js` | Shared utilities — no imports from other app files |
| `i18n.js` | All UI strings in EN and TH; `t(key)` returns the active language string |
| `data.js` | State management, seed data, server-first load, stock check helpers |
| `charts.js` | SVG chart rendering — standalone, no dependencies |
| `export.js` | Excel export — depends on `utils.js` + SheetJS (CDN) |
| `pages.js` | All 6 page renderers — depends on everything above |
| `app.js` | Routing + boot — depends on `pages.js` |
| `start.py` | HTTP file server + `/api/data` GET/POST + daily & shutdown backup logic |

---

## Configuration

### Currency

Edit `fmtCurrency()` in `js/utils.js`:

```js
// Change '฿' to your local currency symbol
function fmtCurrency(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { ... });
}
```

### Language

Click the **EN / TH** toggle in the top-right header, or change `load('ars_lang', 'en')` default in `js/i18n.js`.

### Theming

All colors are CSS variables in `css/styles.css` under `:root`. Swap them for a light theme or your brand colors.

### Admin Password

The default admin password protecting sensitive edits is set in `js/i18n.js` / `js/pages.js`.
Search for `ADMIN_PASS` to change it.

---

## Excel Export

The export generates a `.xlsx` file with 4 sheets:

1. **Spare Parts** — SKU, name, category, cost, price, margin, qty, reorder level, status
2. **Service Orders** — date, customer, vehicle, service, parts cost, labor, discount, total, status
3. **Customers** — name, phone, vehicle, plate, notes
4. **Summary** — order count, revenue breakdown, inventory value

Users choose **All Data** or a **custom date range** before exporting.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5 / CSS3 / Vanilla JavaScript (no framework) |
| Server | Python 3 `http.server` (stdlib only — no pip install) |
| Excel export | SheetJS (CDN) |
| Fonts | Google Fonts — DM Sans + JetBrains Mono |
| Charts | Inline SVG (hand-rolled) |

---

## Browser Support

| Browser | Support |
|---|---|
| Chrome 80+ | ✅ |
| Firefox 78+ | ✅ |
| Safari 14+ | ✅ |
| Edge 80+ | ✅ |
| Mobile browsers | ✅ |

---

## License

MIT — free for personal and commercial use.
