# 🔧 AutoFix Pro — Auto Repair Shop Management System

A lightweight, browser-based management system for small auto repair shops. No server, no database, no build step — just open `index.html` and start managing.

![License](https://img.shields.io/badge/license-MIT-blue)
![No Backend](https://img.shields.io/badge/backend-none-green)
![Status](https://img.shields.io/badge/status-production--ready-brightgreen)

---

## Features

| Module | Description |
|---|---|
| **Dashboard** | KPI cards, 7-day revenue chart, category donut, low-stock alerts, sparkline trends |
| **Spare Parts** | Full CRUD inventory — cost, sell price, margin, reorder levels, stock status |
| **Service Orders** | Create jobs with customer + parts + labor, auto-deducts inventory, status tracking |
| **Customers** | Customer database with vehicle/plate info, order history, total spent |
| **Reports & Export** | Preview summary → Export to **Excel (.xlsx)** with 4 sheets (All Data or custom date range) |

### Additional Highlights

- 📱 **Fully responsive** — works on desktop, tablet, and mobile
- 💾 **Data persists** in `localStorage` — no backend needed
- 📊 **Charts are pure SVG** — zero charting library dependencies
- 📥 **Excel export** via SheetJS (CDN) with auto-column-width
- 🔔 **Toast notifications** for all CRUD actions
- 🔍 **Search & filter** on every data table
- 💬 **Developer comments** throughout the codebase

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/autofix-pro.git
cd autofix-pro

# Open in browser (no build step needed)
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

Or use any local server:

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

Then visit `http://localhost:8080`.

---

## Project Structure

```
autofix-pro/
├── index.html          # Entry point — loads CSS & JS
├── css/
│   └── styles.css      # All styles with CSS variables for theming
├── js/
│   ├── utils.js        # Helpers: uid, date/currency format, icons, modal, toast
│   ├── data.js         # Seed data, State object, localStorage persistence
│   ├── charts.js       # Pure SVG chart renderers (bar, donut, sparkline)
│   ├── export.js       # Excel export function (uses SheetJS)
│   ├── pages.js        # Page renderers: Dashboard, Parts, Orders, Customers, Reports
│   └── app.js          # App entry: navigation routing, sidebar toggle
├── .gitignore
└── README.md
```

### File Responsibilities

| File | Purpose |
|---|---|
| `utils.js` | Shared utilities — never imports from other app files |
| `data.js` | State management + seed data — depends on `utils.js` |
| `charts.js` | Chart rendering — depends on nothing (standalone SVG) |
| `export.js` | Excel export — depends on `utils.js` + SheetJS (CDN) |
| `pages.js` | All 5 page renderers — depends on everything above |
| `app.js` | Routing + boot — depends on `pages.js` |

---

## Configuration

### Currency

Edit the `fmtCurrency()` function in `js/utils.js`:

```js
// Change '฿' to your local currency symbol
function fmtCurrency(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { ... });
}
```

### Seed Data

The demo data in `js/data.js` is loaded only on first visit. To reset:

```js
// Run in browser console
localStorage.clear();
location.reload();
```

### Theming

All colors are CSS variables in `css/styles.css` under `:root`. Swap them for a light theme or your brand colors.

---

## Excel Export

The export generates a `.xlsx` file with 4 sheets:

1. **Spare Parts** — SKU, name, category, cost, price, margin, qty, reorder level, status
2. **Service Orders** — date, customer, vehicle, service, parts cost, labor, discount, total, status
3. **Customers** — name, phone, vehicle, plate, notes
4. **Summary** — order count, revenue breakdown, inventory stats

Users can choose **All Data** or a **custom date range** before exporting.

---

## Tech Stack

- **HTML5 / CSS3 / Vanilla JavaScript** — no framework, no build step
- **SheetJS** (CDN) — Excel file generation
- **Google Fonts** — DM Sans + JetBrains Mono
- **SVG** — all charts rendered as inline SVG

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
