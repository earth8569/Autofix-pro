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
const SEED_CUSTOMERS = [
  { id: uid(), name: 'Somchai Prasert',   phone: '081-234-5678', vehicle: 'Toyota Vios 2020',  plate: 'กก 1234', notes: '' },
  { id: uid(), name: 'Nattaya Wongkam',   phone: '089-876-5432', vehicle: 'Honda City 2019',   plate: 'ขข 5678', notes: 'Preferred customer' },
  { id: uid(), name: 'Prayut Chaiyo',     phone: '062-111-2222', vehicle: 'Isuzu D-Max 2021',  plate: 'คค 9012', notes: '' },
];

// ── Seed: Service Orders ──
const SEED_ORDERS = (() => {
  const out = [];
  const statuses = ['completed','completed','completed','in-progress','pending'];
  const services = ['Oil Change','Brake Replacement','Engine Tune-Up','A/C Recharge','Tire Rotation'];
  for (let i = 0; i < 5; i++) {
    const c = SEED_CUSTOMERS[i % 3];
    const p = SEED_PARTS[i % SEED_PARTS.length];
    out.push({
      id: uid(),
      date: new Date(Date.now() - i * 3 * 86400000).toISOString().slice(0, 10),
      customerId: c.id, customerName: c.name, vehicle: c.vehicle, plate: c.plate,
      service: services[i],
      partsUsed: [{ partId: p.id, partName: p.name, qty: 1, unitPrice: p.price }],
      laborCost: [800, 1500, 2000, 1200, 600][i],
      discount: 0,
      status: statuses[i],
      notes: '',
    });
  }
  return out;
})();


/* ══════════════════════════════════════
 *  STATE — loaded from localStorage
 *  or seeded on first visit.
 * ══════════════════════════════════════ */
const State = {
  parts:     load('ars_parts',     SEED_PARTS),
  orders:    load('ars_orders',    SEED_ORDERS),
  customers: load('ars_customers', SEED_CUSTOMERS),

  // Current page
  page: 'dashboard',

  /** Save all collections to localStorage */
  save() {
    persist('ars_parts',     this.parts);
    persist('ars_orders',    this.orders);
    persist('ars_customers', this.customers);
  },
};


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
