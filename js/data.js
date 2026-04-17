/**
 * ============================================================
 * data.js — Data Layer & State Management
 * ============================================================
 *
 * Responsibilities:
 *   - Define seed (demo) data loaded on first run
 *   - Provide getters/setters that auto-persist to localStorage
 *   - Expose computed helpers (orderTotal, lowStockParts, etc.)
 *
 * Developer: to reset all data, run  localStorage.clear()  in
 * the browser console, then reload the page.
 *
 * Storage keys:
 *   ars_parts      — spare parts inventory
 *   ars_orders     — service orders
 *   ars_customers  — customer list
 */

// ── Seed: Spare Parts ──
const SEED_PARTS = [
  { id: uid(), name: 'Engine Oil 5W-40 (4L)',  sku: 'OIL-5W40',  category: 'Lubricants',   cost: 450,  price: 650,  qty: 24, reorder: 5,  unit: 'bottle' },
  { id: uid(), name: 'Oil Filter — Toyota',    sku: 'FLT-TOY01', category: 'Filters',      cost: 85,   price: 180,  qty: 30, reorder: 10, unit: 'pc' },
  { id: uid(), name: 'Brake Pad Set (Front)',   sku: 'BRK-FP01',  category: 'Brakes',       cost: 550,  price: 950,  qty: 12, reorder: 4,  unit: 'set' },
  { id: uid(), name: 'Air Filter — Honda',      sku: 'FLT-HON01', category: 'Filters',      cost: 120,  price: 280,  qty: 18, reorder: 6,  unit: 'pc' },
  { id: uid(), name: 'Spark Plug NGK (x4)',     sku: 'SPK-NGK4',  category: 'Ignition',     cost: 320,  price: 520,  qty: 15, reorder: 5,  unit: 'set' },
  { id: uid(), name: 'Coolant 50/50 (1L)',      sku: 'CLT-5050',  category: 'Fluids',       cost: 90,   price: 160,  qty: 36, reorder: 8,  unit: 'bottle' },
  { id: uid(), name: 'Wiper Blade 20"',         sku: 'WPR-20',    category: 'Accessories',  cost: 75,   price: 180,  qty: 20, reorder: 6,  unit: 'pc' },
  { id: uid(), name: 'Battery 12V 60Ah',        sku: 'BAT-60AH',  category: 'Electrical',   cost: 1800, price: 2800, qty: 6,  reorder: 2,  unit: 'pc' },
];

// ── Seed: Customers ──
// Each customer now has a `vehicles` array (supports multiple cars).
const SEED_CUSTOMERS = [
  { id: uid(), name: 'Somchai Prasert', phone: '081-234-5678',
    vehicles: [{ id: uid(), vehicle: 'Toyota Vios 2020',     plate: 'กก 1234' }],
    notes: '' },
  { id: uid(), name: 'Nattaya Wongkam', phone: '089-876-5432',
    vehicles: [{ id: uid(), vehicle: 'Honda City 2019',       plate: 'ขข 5678' },
               { id: uid(), vehicle: 'Toyota Fortuner 2022',  plate: 'ขข 9999' }],
    notes: 'Preferred customer' },
  { id: uid(), name: 'Prayut Chaiyo',  phone: '062-111-2222',
    vehicles: [{ id: uid(), vehicle: 'Isuzu D-Max 2021',      plate: 'คค 9012' }],
    notes: '' },
];

// ── Seed: Service Orders ──
const SEED_ORDERS = (() => {
  const out = [];
  const statuses = ['completed','completed','completed','in-progress','pending'];
  const services = ['Oil Change','Brake Replacement','Engine Tune-Up','A/C Recharge','Tire Rotation'];
  for (let i = 0; i < 5; i++) {
    const c = SEED_CUSTOMERS[i % 3];
    const v = c.vehicles[0]; // use customer's first vehicle
    const p = SEED_PARTS[i % SEED_PARTS.length];
    out.push({
      id: uid(),
      date: new Date(Date.now() - i * 3 * 86400000).toISOString().slice(0, 10),
      customerId: c.id, customerName: c.name, vehicle: v.vehicle, plate: v.plate,
      service: services[i],
      partsUsed: [{ partId: p.id, partName: p.name, qty: 1, unitPrice: p.price }],
      laborCost: [800, 1500, 2000, 1200, 600][i],
      discount: 0,
      status: statuses[i],
      fulfilled: true,  // seed orders already have inventory accounted for
      notes: '',
    });
  }
  return out;
})();


/* ══════════════════════════════════════
 *  MIGRATION — convert old customer format
 * ══════════════════════════════════════ */

/**
 * Converts customers saved with flat `vehicle`/`plate` fields
 * (pre-multi-vehicle) to the new `vehicles: [...]` array format.
 */
function migrateCustomers(customers) {
  return customers.map(c => {
    if (c.vehicles) return c; // already new format
    return {
      ...c,
      vehicles: [{ id: uid(), vehicle: c.vehicle || '', plate: c.plate || '' }],
    };
  });
}

/* ══════════════════════════════════════
 *  SERVER LOAD — synchronous XHR so that
 *  State can be initialised normally.
 *  Falls back to localStorage when the
 *  Python server is not running.
 *
 *  If the server reports the data file is
 *  corrupt (HTTP 500 + corrupt:true), we
 *  stash the available backups on window
 *  so app.js can show a recovery modal
 *  after the app shell finishes booting.
 * ══════════════════════════════════════ */
function _loadFromServer() {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data', false); // false = synchronous
    xhr.send();
    if (xhr.status === 200) return JSON.parse(xhr.responseText);
    if (xhr.status === 500) {
      try {
        const body = JSON.parse(xhr.responseText);
        if (body && body.corrupt) {
          window.__corruptOnBoot  = true;
          window.__corruptBackups = body.backups || [];
        }
      } catch (_) { /* non-JSON error body — ignore */ }
    }
  } catch (e) { /* server not running — that's OK */ }
  return null;
}
const _srv = _loadFromServer();

/* ══════════════════════════════════════
 *  STATE — server file has priority;
 *  localStorage is the fallback.
 * ══════════════════════════════════════ */
const State = {
  parts:     _srv?.parts     ?? load('ars_parts',     SEED_PARTS),
  orders:    _srv?.orders    ?? load('ars_orders',    SEED_ORDERS),
  customers: migrateCustomers(_srv?.customers ?? load('ars_customers', SEED_CUSTOMERS)),
  stockLog:  _srv?.stockLog  ?? load('ars_stock_log', []),

  // Current page
  page: 'dashboard',

  /** Save all collections to localStorage AND the server file on disk */
  save() {
    persist('ars_parts',     this.parts);
    persist('ars_orders',    this.orders);
    persist('ars_customers', this.customers);
    persist('ars_stock_log', this.stockLog);
    // Mirror to disk via Python server (fire-and-forget)
    saveToServer({
      parts:     this.parts,
      orders:    this.orders,
      customers: this.customers,
      stockLog:  this.stockLog,
    });
  },
};

/**
 * logStockMove(partId, type, qty, balanceBefore, balanceAfter, reason)
 * Prepends a stock movement entry. type: 'in' | 'out'
 * Automatically persists.
 */
function logStockMove(partId, type, qty, balanceBefore, balanceAfter, reason) {
  const now = new Date();
  State.stockLog.unshift({
    id:            uid(),
    partId,
    date:          now.toISOString().slice(0, 10),
    time:          now.toTimeString().slice(0, 5),
    type,
    qty,
    balanceBefore,
    balanceAfter,
    reason,
  });
  persist('ars_stock_log', State.stockLog);
}


/* ══════════════════════════════════════
 *  Computed helpers
 * ══════════════════════════════════════ */

/** Calculate the total of a single order */
function orderTotal(o) {
  const partsSum = o.partsUsed.reduce((s, p) => s + p.unitPrice * p.qty, 0);
  return partsSum + o.laborCost - o.discount;
}

/** Return parts whose qty <= reorder level */
function lowStockParts() {
  return State.parts.filter(p => p.qty <= p.reorder);
}

/** Total revenue across all (or filtered) orders */
function totalRevenue(orders) {
  return orders.reduce((s, o) => s + orderTotal(o), 0);
}

/** Unique categories from parts list */
function partCategories() {
  return ['All', ...new Set(State.parts.map(p => p.category))];
}

/**
 * checkPartsStock(partsUsed)
 * Returns an array of shortage objects for every part that does not have
 * enough physical stock to cover the requested qty.
 * { name, required, available }   — empty array means all parts are OK.
 */
function checkPartsStock(partsUsed) {
  const shortages = [];
  partsUsed.forEach(pu => {
    if (!pu.partId) return;
    const pt = State.parts.find(p => p.id === pu.partId);
    if (pt && pt.qty < pu.qty) {
      shortages.push({ name: pu.partName, required: pu.qty, available: pt.qty });
    }
  });
  return shortages;
}

/**
 * checkPartsStockAfterReversal(newParts, oldParts)
 * Used when editing a fulfilled order: simulates adding oldParts back to stock
 * first, then checks whether newParts can be deducted from the resulting qty.
 * Returns shortage objects for any part still insufficient after the reversal.
 */
function checkPartsStockAfterReversal(newParts, oldParts) {
  const shortages = [];
  newParts.forEach(pu => {
    if (!pu.partId) return;
    const pt = State.parts.find(p => p.id === pu.partId);
    if (!pt) return;
    const oldPu = oldParts.find(p => p.partId === pu.partId);
    const effectiveStock = pt.qty + (oldPu ? oldPu.qty : 0);
    if (effectiveStock < pu.qty) {
      shortages.push({ name: pu.partName, required: pu.qty, available: effectiveStock });
    }
  });
  return shortages;
}

/**
 * Total qty of a part currently booked (reserved) in unfulfilled
 * pending or in-progress orders — not yet deducted from stock.
 */
function bookedQty(partId) {
  return State.orders
    .filter(o => o.fulfilled !== true && (o.status === 'pending' || o.status === 'in-progress'))
    .reduce((sum, o) => {
      const pu = o.partsUsed.find(p => p.partId === partId);
      return sum + (pu ? pu.qty : 0);
    }, 0);
}
