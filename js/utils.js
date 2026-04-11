/**
 * ============================================================
 * utils.js — Shared Utility Functions
 * ============================================================
 *
 * Contains:
 *   - uid()           Unique ID generator
 *   - today()         Current date as YYYY-MM-DD
 *   - fmtDate(d)      Format date string to "DD Mon YYYY"
 *   - fmtCurrency(n)  Format number to "฿X,XXX.XX"
 *   - persist(key,val) Save to localStorage
 *   - load(key,def)    Load from localStorage
 *   - icon(name)       Return inline SVG string for an icon
 *   - showToast(msg)   Display a toast notification
 *
 * Developer: Change the currency symbol below if not using THB.
 */

// ── Unique ID ──
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Date helpers ──
function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// ── Currency ──
// Developer: change the "฿" prefix to your local currency if needed
function fmtCurrency(n) {
  return '฿' + Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ── localStorage persistence ──
function persist(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); }
  catch (e) { console.warn('persist() failed:', e); }
}

function load(key, defaultVal) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch {
    return defaultVal;
  }
}

// ── SVG icon paths (24×24 viewBox) ──
// Developer: add more icons here as needed.
const ICONS = {
  dashboard:  'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1',
  parts:      'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  orders:     'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  customers:  'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  reports:    'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  plus:       'M12 4v16m8-8H4',
  edit:       'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:      'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  search:     'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  download:   'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  alert:      'M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  check:      'M5 13l4 4L19 7',
  x:          'M6 18L18 6M6 6l12 12',
  settings:   'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  wrench:     'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
  fulfill:    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  car:        'M3 13h18M3 13l3-7h12l3 7M3 13v5h18v-5M8 18v1m8-1v1',
  history:    'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
};

/**
 * icon(name, size, color)
 * Returns an inline SVG string for use in innerHTML.
 */
function icon(name, size = 20, color = 'currentColor') {
  const d = ICONS[name] || '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

/**
 * showToast(msg, type)
 * Briefly displays a toast notification at the bottom-right.
 * type: "success" (default) | "warn"
 */
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = (type === 'success' ? '✓ ' : '⚠ ') + msg;
  container.appendChild(el);
  setTimeout(() => { el.remove(); }, 2500);
}

/**
 * openModal(title, contentHTML, maxWidth)
 * Opens a centered modal dialog. Returns the modal body element.
 * Call closeModal() to dismiss.
 */
function openModal(title, contentHTML, maxWidth = 560) {
  // Remove any existing modal first
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'active-modal';
  backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };
  backdrop.innerHTML = `
    <div class="modal-box" style="max-width:${maxWidth}px" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="btn-icon" onclick="closeModal()">${icon('x')}</button>
      </div>
      <div class="modal-body">${contentHTML}</div>
    </div>
  `;
  document.body.appendChild(backdrop);
  return backdrop.querySelector('.modal-body');
}

function closeModal() {
  const m = document.getElementById('active-modal');
  if (m) m.remove();
}
