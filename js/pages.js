/**
 * ============================================================
 * pages.js — Page Renderers
 * ============================================================
 *
 * Each function renders a full page into #main-content.
 *
 *   renderDashboard()   — KPIs, charts, low-stock alerts
 *   renderParts()       — Spare parts inventory CRUD
 *   renderOrders()      — Service orders CRUD
 *   renderCustomers()   — Customer database CRUD
 *   renderReports()     — Date-range selector + Excel export
 *
 * Developer: every page follows the same pattern:
 *   1. Build an HTML string
 *   2. Inject into #main-content
 *   3. Attach event listeners via inline onclick or
 *      post-render querySelector
 *
 * All state mutations go through the State object (data.js)
 * and call State.save() + re-render.
 * All UI strings go through t() from i18n.js.
 */


// Pending admin-protected part edit (set before admin modal opens)
let _pendingPartEdit = null;
// Pending admin-protected order edit when parts change on a fulfilled order
let _pendingOrderEdit = null;
// Pending new-part data when a duplicate SKU choice modal is open
let _pendingNewPart = null;

/** Minimal HTML escaper — prevents XSS when interpolating user data into innerHTML. */
function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Shared autocomplete helpers ──

/**
 * Render filtered suggestions into an autocomplete <ul>.
 * items: [{val, label, sub?}]
 * listId: id of the <ul> element
 * clickFn: name of a global function to call; receives (val, label) from data-attrs
 */
function _acRender(listId, items, clickFn) {
  const list = document.getElementById(listId);
  if (!list) return;
  if (!items.length) { list.innerHTML = ''; list.style.display = 'none'; return; }
  list.dataset.active = '-1';
  list.innerHTML = items.map(it =>
    `<li class="ac-item" data-val="${_esc(it.val)}" data-label="${_esc(it.label)}"
       onmousedown="event.preventDefault()"
       onclick="${clickFn}(this.dataset.val, this.dataset.label)">
       ${_esc(it.label)}${it.sub ? `<span class='ac-sub'>${_esc(it.sub)}</span>` : ''}
    </li>`
  ).join('');
  list.style.display = 'block';
}

/** Keyboard navigation for any autocomplete list (arrow keys, Enter, Escape). */
function _acKeydown(listId, e) {
  const list = document.getElementById(listId);
  if (!list || list.style.display === 'none') return;
  const items = list.querySelectorAll('.ac-item');
  if (!items.length) return;
  let active = parseInt(list.dataset.active ?? '-1');
  if      (e.key === 'ArrowDown')  { e.preventDefault(); active = Math.min(active + 1, items.length - 1); }
  else if (e.key === 'ArrowUp')    { e.preventDefault(); active = Math.max(active - 1, 0); }
  else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); items[active].click(); return; }
  else if (e.key === 'Escape')     { list.innerHTML = ''; list.style.display = 'none'; return; }
  else return;
  list.dataset.active = active;
  items.forEach((el, i) => el.classList.toggle('ac-active', i === active));
  items[active]?.scrollIntoView({ block: 'nearest' });
}

/** Hide autocomplete dropdown after a short delay (allows click to register first). */
function _acBlur(listId) {
  setTimeout(() => {
    const list = document.getElementById(listId);
    if (list) { list.innerHTML = ''; list.style.display = 'none'; }
  }, 150);
}

// ── Customer autocomplete (order form) ──
function _acCustInput() {
  const inp  = document.getElementById('of-customer-input');
  const q    = (inp?.value || '').toLowerCase();
  const matches = State.customers.filter(c =>
    !q || c.name.toLowerCase().includes(q) ||
    (c.vehicles || []).some(v => v.plate.toLowerCase().includes(q))
  ).slice(0, 10).map(c => ({
    val:   c.id,
    label: c.name,
    sub:   (c.vehicles || [])[0]?.plate || '',
  }));
  _acRender('of-cust-ac', matches, '_acCustPick');
}

function _acCustPick(id, name) {
  const inp    = document.getElementById('of-customer-input');
  const hidden = document.getElementById('of-customer');
  if (inp)    { inp.value = name; inp.classList.remove('input-error'); }
  if (hidden) hidden.value = id;
  _acBlur('of-cust-ac');
  pickOrderCustomer();
}

// ── Brand autocomplete (customer vehicle form) ──
function _acBrandInput(i) {
  const typeSel = document.querySelector(`.vi-type[data-idx="${i}"]`);
  const inp     = document.querySelector(`.vi-brand-input[data-idx="${i}"]`);
  const list    = document.getElementById(`vi-brand-ac-${i}`);
  if (!inp || !list) return;
  const type = typeSel?.value || '';
  const pool = type === 'car'  ? VEHICLE_BRANDS.car
             : type === 'moto' ? VEHICLE_BRANDS.moto
             : [...VEHICLE_BRANDS.car, ...VEHICLE_BRANDS.moto];
  const q = inp.value.toLowerCase();
  const matches = pool.filter(b => !q || b.toLowerCase().includes(q)).slice(0, 10);
  if (!matches.length) { list.innerHTML = ''; list.style.display = 'none'; return; }
  list.dataset.active = '-1';
  list.innerHTML = matches.map(b =>
    `<li class="ac-item" data-val="${_esc(b)}"
       onmousedown="event.preventDefault()"
       onclick="_acBrandPick(${i}, this.dataset.val)">${_esc(b)}</li>`
  ).join('');
  list.style.display = 'block';
}

function _acBrandPick(i, brand) {
  const inp = document.querySelector(`.vi-brand-input[data-idx="${i}"]`);
  if (inp) inp.value = brand;
  _acBlur(`vi-brand-ac-${i}`);
  updateVehicleValue(i);
}

// ── Per-table sort state ──
const _partsSort     = { col: '', dir: 'asc' };
const _ordersSort    = { col: '', dir: 'asc' };
const _customersSort = { col: '', dir: 'asc' };
const _stockSort     = { col: '', dir: 'asc' };

/** Toggle sort column/direction, then trigger a re-sort. */
function _toggleSort(state, col) {
  if (state.col === col) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
  else { state.col = col; state.dir = 'asc'; }
}

/** Update ↑/↓/↕ icons and active class on sortable <th> elements. */
function _updateSortHeaders(tbodyId, state) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.closest('table').querySelectorAll('thead th[data-sort]').forEach(th => {
    const active = th.dataset.sort === state.col;
    th.classList.toggle('sort-active', active);
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = active ? (state.dir === 'asc' ? '↑' : '↓') : '↕';
  });
}

/** Sort an array by a column; valFn(row, col) extracts the sort value. */
function _sortArr(arr, state, valFn) {
  if (!state.col) return arr;
  const { col, dir } = state;
  return [...arr].sort((a, b) => {
    const va = valFn ? valFn(a, col) : a[col];
    const vb = valFn ? valFn(b, col) : b[col];
    if (typeof va === 'number' && typeof vb === 'number')
      return dir === 'asc' ? va - vb : vb - va;
    return dir === 'asc'
      ? String(va ?? '').localeCompare(String(vb ?? ''))
      : String(vb ?? '').localeCompare(String(va ?? ''));
  });
}

function sortPartsBy(col)     { _toggleSort(_partsSort, col);     _updateSortHeaders('parts-tbody',  _partsSort);     filterPartsTable(); }
function sortOrdersBy(col)    { _toggleSort(_ordersSort, col);    _updateSortHeaders('orders-tbody', _ordersSort);    filterOrdersTable(); }
function sortCustomersBy(col) { _toggleSort(_customersSort, col); _updateSortHeaders('cust-tbody',   _customersSort); filterCustomersTable(); }
function sortStockBy(col)     { _toggleSort(_stockSort, col);     _updateSortHeaders('sh-tbody',     _stockSort);     filterStockHistory(); }

// ── Vehicle brand lists ──
const VEHICLE_BRANDS = {
  car:  ['Toyota','Honda','Isuzu','Mitsubishi','Nissan','Ford','Mazda','Suzuki',
         'Hyundai','Kia','MG','BYD','BMW','Mercedes-Benz','Audi','Volkswagen',
         'Subaru','Chevrolet','Volvo','Lexus','Porsche','Jeep'],
  moto: ['Honda','Yamaha','Kawasaki','Suzuki','Ducati','Harley-Davidson','KTM',
         'Royal Enfield','Triumph','BMW','Aprilia','Benelli'],
};

/**
 * parseBrandModel(vehicleStr)
 * Splits "Toyota Vios 2020" → { type:'car', brandText:'Toyota', model:'Vios 2020' }
 * Unknown brands return { type:'', brandText:'SomeBrand', model:'...' }
 */
function parseBrandModel(vehicleStr) {
  const str = (vehicleStr || '').trim();
  for (const b of VEHICLE_BRANDS.car) {
    if (str.toLowerCase() === b.toLowerCase()) return { type: 'car', brandText: b, model: '' };
    if (str.toLowerCase().startsWith(b.toLowerCase() + ' '))
      return { type: 'car', brandText: b, model: str.slice(b.length).trim() };
  }
  for (const b of VEHICLE_BRANDS.moto) {
    if (str.toLowerCase() === b.toLowerCase()) return { type: 'moto', brandText: b, model: '' };
    if (str.toLowerCase().startsWith(b.toLowerCase() + ' '))
      return { type: 'moto', brandText: b, model: str.slice(b.length).trim() };
  }
  // Unknown brand — split on first space
  const sp = str.indexOf(' ');
  if (sp > 0) return { type: '', brandText: str.slice(0, sp), model: str.slice(sp + 1).trim() };
  return { type: '', brandText: str, model: '' };
}


/**
 * showInsufficientStock(shortages)
 * Displays a modal listing every part that has insufficient stock.
 * shortages: [{ name, required, available }, ...]
 */
function showInsufficientStock(shortages) {
  const rows = shortages.map(s =>
    `<li style="margin:6px 0;font-size:13px">
       <strong>${s.name}</strong><br>
       <span style="color:var(--text-muted);font-size:12px">
         ${t('insufficientStockNeed')}: <strong>${s.required}</strong> &nbsp;|&nbsp;
         ${t('insufficientStockHave')}: <strong style="color:var(--danger)">${s.available}</strong>
       </span>
     </li>`
  ).join('');
  openModal(t('insufficientStockTitle'), `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      ${icon('alert', 20, 'var(--danger)')}
      <p style="margin:0;font-size:13px;color:var(--text-muted)">${t('insufficientStockDesc')}</p>
    </div>
    <ul style="margin:0 0 14px;padding-left:18px">${rows}</ul>
    <p style="margin:0 0 16px;font-size:12px;color:var(--danger)">${t('insufficientStockFooter')}</p>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">${t('close')}</button>
    </div>
  `, 420);
}

/* ═══════════════════════════════════════════════
 *  DASHBOARD PAGE
 * ═══════════════════════════════════════════════ */
function renderDashboard() {
  const { parts, orders } = State;
  const rev       = totalRevenue(orders);
  const completed = orders.filter(o => o.status === 'completed').length;
  const pending   = orders.filter(o => o.status !== 'completed').length;
  const lowStock  = lowStockParts();
  const invValue  = parts.reduce((s, p) => s + p.cost * p.qty, 0);

  // Revenue last 7 days
  const revByDay = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const dayRev = orders.filter(o => o.date === d).reduce((s, o) => s + orderTotal(o), 0);
    revByDay.push({ label: d.slice(5), value: dayRev });
  }

  // Parts by category
  const catMap = {};
  parts.forEach(p => { catMap[p.category] = (catMap[p.category] || 0) + p.qty; });
  const byCategory = Object.entries(catMap).map(([label, value]) => ({ label, value }));

  // Sparkline: daily orders last 14 days
  const spark = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    spark.push(orders.filter(o => o.date === d).length);
  }

  // Low stock table rows
  let alertHTML = '';
  if (lowStock.length) {
    const rows = lowStock.map(p => `
      <tr>
        <td class="mono">${p.sku}</td><td>${p.name}</td>
        <td class="danger-text">${p.qty}</td><td>${p.reorder}</td>
        <td><span class="badge badge-danger">${t('badgeReorder')}</span></td>
      </tr>
    `).join('');
    alertHTML = `
      <div class="alert-section">
        <h3>${icon('alert', 18, 'var(--danger)')} ${t('lowStockAlerts')}</h3>
        <table class="data-table">
          <thead><tr>
            <th>${t('skuCol')}</th><th>${t('partNameCol')}</th>
            <th>${t('onHandCol')}</th><th>${t('reorderLvlCol')}</th>
            <th>${t('colStatus')}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  document.getElementById('main-content').innerHTML = `
    <div class="page fade-in">
      <h2 class="page-title">${icon('dashboard', 24)} ${t('dashboard')}</h2>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">${t('totalRevenue')}</div>
          <div class="kpi-value accent">${fmtCurrency(rev)}</div>
          ${renderSparkline(spark)}
        </div>
        <div class="kpi-card">
          <div class="kpi-label">${t('completedJobs')}</div>
          <div class="kpi-value">${completed}</div>
          <div class="kpi-sub">${pending} ${t('pendingCount')}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">${t('inventoryValue')}</div>
          <div class="kpi-value">${fmtCurrency(invValue)}</div>
          <div class="kpi-sub">${parts.length} ${t('itemsTracked')}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">${t('lowStockAlerts')}</div>
          <div class="kpi-value ${lowStock.length ? 'danger' : ''}">${lowStock.length}</div>
          <div class="kpi-sub">${t('itemsBelow')}</div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card">${renderBarChart(revByDay, { label: t('revenueLastDays') })}</div>
        <div class="chart-card">${renderDonutChart(byCategory, { label: t('stockByCategory') })}</div>
      </div>

      ${alertHTML}
    </div>
  `;
}


/* ═══════════════════════════════════════════════
 *  SPARE PARTS PAGE
 * ═══════════════════════════════════════════════ */
function renderParts() {
  const cats = partCategories();

  document.getElementById('main-content').innerHTML = `
    <div class="page fade-in">
      <div class="page-header">
        <h2 class="page-title">${icon('parts', 24)} ${t('spareParts')}</h2>
        <div style="display:flex;gap:8px">
          <button class="btn btn-success" onclick="openRestockDropdown()">${icon('download', 16)} ${t('restockBtn')}</button>
          <button class="btn btn-primary" onclick="openPartForm()">${icon('plus', 16)} ${t('addPart')}</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="search-box">${icon('search', 16)}<input id="part-search" placeholder="${t('searchParts')}" oninput="filterPartsTable()"/></div>
        <select id="part-cat-filter" onchange="filterPartsTable()">
          ${cats.map(c => `<option>${c === 'All' ? t('all') : c}</option>`).join('')}
        </select>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>
            <th class="sortable" data-sort="sku"      onclick="sortPartsBy('sku')"     >${t('colSku')}      <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="name"     onclick="sortPartsBy('name')"    >${t('colPartName')} <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="category" onclick="sortPartsBy('category')">${t('colCategory')} <span class="sort-icon">↕</span></th>
            <th>${t('colUnit')}</th>
            <th class="sortable" data-sort="cost"     onclick="sortPartsBy('cost')"    >${t('colCost')}     <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="price"    onclick="sortPartsBy('price')"   >${t('colPrice')}    <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="margin"   onclick="sortPartsBy('margin')"  >${t('colMargin')}   <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="qty"      onclick="sortPartsBy('qty')"     >${t('colQty')}      <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="booked"   onclick="sortPartsBy('booked')"  title="${t('bookedTooltip')}">${t('colBooked')} <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="status"   onclick="sortPartsBy('status')"  >${t('colStatus')}   <span class="sort-icon">↕</span></th>
            <th style="width:110px">${t('colActions')}</th>
          </tr></thead>
          <tbody id="parts-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  filterPartsTable();
}

/** Filters and re-renders parts table body */
function filterPartsTable() {
  const search = (document.getElementById('part-search')?.value || '').toLowerCase();
  const catRaw = document.getElementById('part-cat-filter')?.value || '';
  // Map translated "ทั้งหมด" back to 'All' for filtering
  const cat = (catRaw === t('all') || catRaw === 'All') ? 'All' : catRaw;
  let filtered = State.parts.filter(p => {
    if (cat !== 'All' && p.category !== cat) return false;
    if (search && !(p.name + ' ' + p.sku).toLowerCase().includes(search)) return false;
    return true;
  });
  filtered = _sortArr(filtered, _partsSort, (p, col) => {
    if (col === 'margin') return p.price - p.cost;
    if (col === 'booked') return bookedQty(p.id);
    if (col === 'status') return p.qty <= p.reorder ? 0 : 1; // low=0 sorts first asc
    return p[col];
  });
  const tbody = document.getElementById('parts-tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty">${t('noPartsFound')}</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(p => `
    <tr class="${p.qty <= p.reorder ? 'row-warn' : ''}">
      <td class="mono">${p.sku}</td>
      <td>${p.name}</td>
      <td><span class="badge">${p.category}</span></td>
      <td>${p.unit}</td>
      <td>${fmtCurrency(p.cost)}</td>
      <td>${fmtCurrency(p.price)}</td>
      <td class="accent-text">${fmtCurrency(p.price - p.cost)}</td>
      <td>${p.qty}</td>
      <td title="${t('bookedTooltip')}">${(() => { const bk = bookedQty(p.id); return bk > 0 ? `<span class="badge badge-warn">${bk}</span>` : `<span style="color:var(--text-muted)">—</span>`; })()}</td>
      <td>${p.qty <= p.reorder
        ? `<span class="badge badge-danger">${t('badgeLow')}</span>`
        : `<span class="badge badge-ok">${t('badgeOk')}</span>`}</td>
      <td class="actions">
        <button class="btn-icon" title="${t('stockLog')}" onclick="openStockLog('${p.id}')">${icon('history', 16)}</button>
        <button class="btn-icon" title="${t('editPart')}" onclick="openPartForm('${p.id}')">${icon('edit', 16)}</button>
        <button class="btn-icon danger" title="${t('confirmDeletePart')}" onclick="deletePart('${p.id}')">${icon('trash', 16)}</button>
      </td>
    </tr>
  `).join('');
}

/** Opens the add/edit modal for a part */
function openPartForm(id) {
  const isNew = !id;
  const p = isNew
    ? { name: '', sku: '', category: '', cost: 0, price: 0, qty: 0, reorder: 5, unit: 'pc' }
    : State.parts.find(x => x.id === id);

  openModal(isNew ? t('addNewPart') : t('editPart'), `
    <div class="form-grid">
      <label>${t('skuLabel')}<input id="pf-sku" value="${p.sku}" oninput="this.classList.remove('input-error')"/></label>
      <label>${t('partNameLabel')}<input id="pf-name" value="${p.name}" oninput="this.classList.remove('input-error')"/></label>
      <label>${t('categoryLabel')}<input id="pf-cat" value="${p.category}" placeholder="${t('catPlaceholder')}"/></label>
      <label>${t('unitLabel')}<input id="pf-unit" value="${p.unit}" placeholder="${t('unitPlaceholder')}"/></label>
      <label>${t('costLabel')}<input id="pf-cost" type="number" value="${p.cost}"/></label>
      <label>${t('priceLabel')}<input id="pf-price" type="number" value="${p.price}"/></label>
      <label>${t('qtyLabel')}<input id="pf-qty" type="number" value="${p.qty}"/></label>
      <label>${t('reorderLevelLabel')}<input id="pf-reorder" type="number" value="${p.reorder}"/></label>
    </div>
    <div class="form-actions">
      <button class="btn" onclick="closeModal()">${t('cancel')}</button>
      <button class="btn btn-primary" onclick="savePart('${id || ''}')">${icon('check', 16)} ${t('save')}</button>
    </div>
  `);
}

function savePart(id) {
  const g = (sel) => document.querySelector(sel)?.value?.trim() || '';
  const n = (sel) => Number(document.querySelector(sel)?.value) || 0;

  const skuEl  = document.getElementById('pf-sku');
  const nameEl = document.getElementById('pf-name');
  let valid = true;
  if (!skuEl.value.trim())  { skuEl.classList.add('input-error');  skuEl.focus();  valid = false; }
  if (!nameEl.value.trim()) { nameEl.classList.add('input-error'); if (valid) nameEl.focus(); valid = false; }
  if (!valid) return;

  const sku = g('#pf-sku'), name = g('#pf-name');

  const data = { sku, name, category: g('#pf-cat'), unit: g('#pf-unit'), cost: n('#pf-cost'), price: n('#pf-price'), qty: n('#pf-qty'), reorder: n('#pf-reorder') };

  if (id) {
    const idx = State.parts.findIndex(p => p.id === id);
    if (idx !== -1) {
      const oldQty = State.parts[idx].qty;
      if (data.qty !== oldQty) {
        // Qty changed — require admin confirmation before applying
        _pendingPartEdit = { id, data, oldQty };
        openAdminPartSaveModal(id, data, oldQty);
        return;
      }
      // No qty change — save other fields freely
      State.parts[idx] = { ...State.parts[idx], ...data };
    }
    showToast(t('partUpdated'));
    State.save();
    closeModal();
    renderParts();
  } else {
    // Detect duplicate SKU before creating a new entry
    const duplicate = State.parts.find(p => p.sku.toUpperCase() === sku.toUpperCase());
    if (duplicate) {
      _pendingNewPart = data;
      openDuplicateSkuModal(duplicate);
      return;
    }
    const newId = uid();
    State.parts.push({ id: newId, ...data });
    if (data.qty > 0) {
      logStockMove(newId, 'in', data.qty, 0, data.qty, 'logReasonInitial');
    }
    showToast(t('partAdded'));
    State.save();
    closeModal();
    renderParts();
  }
}

function deletePart(id) {
  if (!confirm(t('confirmDeletePart'))) return;
  State.parts = State.parts.filter(p => p.id !== id);
  State.save();
  showToast(t('partDeleted'), 'warn');
  renderParts();
}

/**
 * openRestockDropdown(prefillId)
 * Opens a part-picker modal with a dropdown + qty/cost inputs.
 * Called from the "Restock" button in the Parts page header.
 * prefillId optionally pre-selects a part (e.g. from duplicate-SKU flow).
 */
function openRestockDropdown(prefillId = '') {
  const parts = [...State.parts].sort((a, b) => a.name.localeCompare(b.name));
  if (!parts.length) { showToast(t('noPartsFound'), 'warn'); return; }
  const options = parts.map(p =>
    `<option value="${p.id}" ${p.id === prefillId ? 'selected' : ''}>${p.name} (${p.sku})</option>`
  ).join('');
  openModal(t('restockTitle'), `
    <div class="form-grid" style="grid-template-columns:1fr;margin-bottom:4px">
      <label>${t('restockPartLabel')}
        <select id="rs-part" onchange="updateRestockInfo()">${options}</select>
      </label>
    </div>
    <div id="rs-info"></div>
    <div class="form-grid">
      <label>${t('restockQtyLabel')}
        <input id="rs-qty" type="number" min="1" placeholder="0"
               oninput="this.classList.remove('input-error')"/>
      </label>
      <label>${t('restockCostLabel')}
        <input id="rs-cost" type="number" min="0"/>
      </label>
    </div>
    <p style="font-size:12px;color:var(--text-muted);margin:0 0 14px;line-height:1.5">${t('restockCostHint')}</p>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">${t('cancel')}</button>
      <button class="btn btn-primary" onclick="saveRestockDropdown()">${icon('download', 16)} ${t('restockConfirm')}</button>
    </div>
  `, 440);
  updateRestockInfo();
}

/** Updates the info strip and cost placeholder when the selected part changes. */
function updateRestockInfo() {
  const sel = document.getElementById('rs-part');
  if (!sel) return;
  const p = State.parts.find(x => x.id === sel.value);
  if (!p) return;
  const costInput = document.getElementById('rs-cost');
  if (costInput) costInput.placeholder = p.cost;
  const info = document.getElementById('rs-info');
  if (info) {
    info.innerHTML = `
      <div style="background:var(--bg-card,rgba(255,255,255,.04));border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:14px;font-size:13px">
        <div class="mono" style="color:var(--text-muted);font-size:12px">${p.sku}</div>
        <div style="margin-top:6px;color:var(--text-muted)">
          ${t('qtyLabel')}: <strong>${p.qty} ${p.unit}</strong> &nbsp;·&nbsp;
          ${t('costLabel')}: <strong>${fmtCurrency(p.cost)}</strong>
        </div>
      </div>
    `;
  }
}

/** Reads the selected part from the dropdown and delegates to saveRestock(). */
function saveRestockDropdown() {
  const sel = document.getElementById('rs-part');
  if (!sel) return;
  saveRestock(sel.value);
}

/**
 * openRestockForm(id, prefillQty, prefillCost)
 * Opens a focused modal to receive new stock for an existing part.
 * prefillQty / prefillCost are optional — used when redirected from a
 * duplicate-SKU modal so the values the user already typed carry over.
 */
function openRestockForm(id, prefillQty = '', prefillCost = '') {
  const p = State.parts.find(x => x.id === id);
  if (!p) return;
  openModal(t('restockTitle'), `
    <div style="background:var(--bg-card,rgba(255,255,255,.04));border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:16px;font-size:13px">
      <div style="font-weight:600">${p.name}</div>
      <div class="mono" style="color:var(--text-muted);font-size:12px">${p.sku}</div>
      <div style="margin-top:6px;color:var(--text-muted)">
        ${t('qtyLabel')}: <strong>${p.qty} ${p.unit}</strong> &nbsp;·&nbsp;
        ${t('costLabel')}: <strong>${fmtCurrency(p.cost)}</strong>
      </div>
    </div>
    <div class="form-grid">
      <label>${t('restockQtyLabel')}
        <input id="rs-qty" type="number" min="1" value="${prefillQty}" placeholder="0"
               oninput="this.classList.remove('input-error')"/>
      </label>
      <label>${t('restockCostLabel')}
        <input id="rs-cost" type="number" min="0" value="${prefillCost}" placeholder="${p.cost}"/>
      </label>
    </div>
    <p style="font-size:12px;color:var(--text-muted);margin:0 0 14px;line-height:1.5">${t('restockCostHint')}</p>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">${t('cancel')}</button>
      <button class="btn btn-primary" onclick="saveRestock('${id}')">${icon('download', 16)} ${t('restockConfirm')}</button>
    </div>
  `, 400);
}

/** Applies a restock: adds qty, recalculates weighted avg cost if needed, logs movement. */
function saveRestock(id) {
  const p = State.parts.find(x => x.id === id);
  if (!p) return;

  const qtyEl  = document.getElementById('rs-qty');
  const addQty = Number(qtyEl?.value) || 0;
  if (addQty <= 0) { qtyEl.classList.add('input-error'); qtyEl.focus(); return; }

  const rawCost = document.getElementById('rs-cost')?.value.trim();
  const buyCost = rawCost !== '' && Number(rawCost) > 0 ? Number(rawCost) : p.cost;

  const balanceBefore = p.qty;

  // Weighted average cost when purchase price differs from current cost
  if (buyCost !== p.cost) {
    if (p.qty > 0) {
      // Blend existing stock value with new purchase
      p.cost = Math.round(((p.qty * p.cost) + (addQty * buyCost)) / (p.qty + addQty) * 100) / 100;
    } else {
      // No existing stock — new cost becomes the cost
      p.cost = buyCost;
    }
  }

  p.qty += addQty;
  logStockMove(p.id, 'in', addQty, balanceBefore, p.qty,
    `logReasonRestock|${buyCost}`);
  State.save();
  closeModal();
  showToast(t('restockSuccess'));
  renderParts();
}

/**
 * openDuplicateSkuModal(existing)
 * Shown when a new part's SKU matches an existing part.
 * Lets the user choose: restock the existing part, or save as a separate variant.
 */
function openDuplicateSkuModal(existing) {
  openModal(t('duplicateSkuTitle'), `
    <p style="font-size:13px;color:var(--text-muted);margin:0 0 12px">${t('duplicateSkuDesc')}</p>
    <div style="background:var(--bg-card,rgba(255,255,255,.04));border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:16px;font-size:13px">
      <div style="font-weight:600">${existing.name}</div>
      <div class="mono" style="color:var(--text-muted);font-size:12px">${existing.sku}</div>
      <div style="margin-top:6px;color:var(--text-muted)">
        ${t('qtyLabel')}: <strong>${existing.qty} ${existing.unit}</strong> &nbsp;·&nbsp;
        ${t('costLabel')}: <strong>${fmtCurrency(existing.cost)}</strong>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-primary" onclick="openRestockFromDuplicate('${existing.id}')">${icon('download', 16)} ${t('duplicateRestockInstead')}</button>
      <button class="btn" onclick="savePartForced()">${icon('plus', 16)} ${t('duplicateSaveNew')}</button>
      <button class="btn btn-ghost" onclick="closeModal()">${t('cancel')}</button>
    </div>
  `, 420);
}

/** Redirects to the restock form, carrying over the qty and cost the user already entered. */
function openRestockFromDuplicate(existingId) {
  if (!_pendingNewPart) { closeModal(); return; }
  const qty  = _pendingNewPart.qty  > 0 ? _pendingNewPart.qty  : '';
  const cost = _pendingNewPart.cost > 0 ? _pendingNewPart.cost : '';
  _pendingNewPart = null;
  openRestockForm(existingId, qty, cost);
}

/** Saves the pending new part regardless of the duplicate SKU (user chose "separate variant"). */
function savePartForced() {
  if (!_pendingNewPart) { closeModal(); return; }
  const data  = _pendingNewPart;
  _pendingNewPart = null;
  const newId = uid();
  State.parts.push({ id: newId, ...data });
  if (data.qty > 0) {
    logStockMove(newId, 'in', data.qty, 0, data.qty, 'logReasonInitial');
  }
  showToast(t('partAdded'));
  State.save();
  closeModal();
  renderParts();
}

/** Opens admin-credentials modal before applying a qty change to a part. */
function openAdminPartSaveModal(id, data, oldQty) {
  const p = State.parts.find(x => x.id === id);
  const diff    = data.qty - oldQty;
  const diffStr = (diff > 0 ? '+' : '') + diff;
  const diffClr = diff > 0 ? 'var(--success)' : 'var(--danger)';

  openModal(t('adminConfirmTitle'), `
    <p style="margin:0 0 14px;color:var(--text-muted);font-size:13px;line-height:1.5">${t('adminStockEditDesc')}</p>
    <div style="background:var(--bg-card,rgba(255,255,255,.04));border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:14px;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <span><strong>${p?.name || ''}</strong> &nbsp;<span class="mono" style="font-size:12px;color:var(--text-muted)">${p?.sku || ''}</span></span>
      <span style="white-space:nowrap">${t('colQty')}: <strong>${oldQty}</strong> → <strong style="color:${diffClr}">${data.qty}</strong> <span style="color:${diffClr};font-size:12px">(${diffStr})</span></span>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <label style="font-size:13px;font-weight:500">${t('userId')}
        <input id="ac-id" type="text" placeholder="${t('enterUserId')}" autocomplete="off"
          style="display:block;width:100%;margin-top:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font);font-size:13px;padding:8px 10px;box-sizing:border-box"
          oninput="document.getElementById('ac-err').textContent='';this.classList.remove('input-error')">
      </label>
      <label style="font-size:13px;font-weight:500">${t('password')}
        <input id="ac-pw" type="password" placeholder="${t('enterPassword')}" autocomplete="off"
          style="display:block;width:100%;margin-top:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font);font-size:13px;padding:8px 10px;box-sizing:border-box"
          oninput="document.getElementById('ac-err').textContent='';this.classList.remove('input-error')"
          onkeydown="if(event.key==='Enter')confirmAdminPartSave()">
      </label>
    </div>
    <div id="ac-err" style="color:var(--danger);font-size:12px;margin-top:8px;min-height:16px"></div>
    <div class="form-actions" style="margin-top:16px">
      <button class="btn btn-primary" onclick="confirmAdminPartSave()">${icon('check',16)} ${t('save')}</button>
      <button class="btn btn-ghost" onclick="closeModal()">${t('cancel')}</button>
    </div>
  `, 440);
  setTimeout(() => document.getElementById('ac-id')?.focus(), 100);
}

/** Validates admin credentials then applies the pending qty change. */
function confirmAdminPartSave() {
  const adminId = document.getElementById('ac-id').value.trim();
  const adminPw = document.getElementById('ac-pw').value;
  const errEl   = document.getElementById('ac-err');
  const idEl    = document.getElementById('ac-id');
  const pwEl    = document.getElementById('ac-pw');

  if (!adminId) { idEl.classList.add('input-error'); idEl.focus(); errEl.textContent = t('errBothRequired'); return; }
  if (!adminPw) { pwEl.classList.add('input-error'); pwEl.focus(); errEl.textContent = t('errBothRequired'); return; }

  const valid = USERS.find(u => u.id === adminId && u.password === adminPw);
  if (!valid) {
    pwEl.value = '';
    pwEl.classList.add('input-error');
    pwEl.focus();
    errEl.textContent = t('errInvalidCreds');
    return;
  }

  if (!_pendingPartEdit) { closeModal(); return; }
  const { id, data, oldQty } = _pendingPartEdit;
  _pendingPartEdit = null;

  const idx = State.parts.findIndex(p => p.id === id);
  if (idx !== -1) {
    State.parts[idx] = { ...State.parts[idx], ...data };
    const diff = data.qty - oldQty;
    logStockMove(id, diff > 0 ? 'in' : 'out', Math.abs(diff), oldQty, data.qty, 'logReasonAdjusted');
  }
  State.save();
  closeModal();
  showToast(t('partUpdated'));
  renderParts();
}

/** Opens admin-credentials modal before saving an order whose partsUsed changed. */
function openAdminOrderSaveModal(id, data, oldParts) {
  const o = State.orders.find(x => x.id === id);

  const partList = (parts) => parts.filter(p => p.partId).map(p =>
    `<li style="margin:2px 0">${p.partName} × <strong>${p.qty}</strong></li>`
  ).join('') || `<li style="color:var(--text-muted)">—</li>`;

  openModal(t('adminConfirmTitle'), `
    <p style="margin:0 0 14px;color:var(--text-muted);font-size:13px;line-height:1.5">${t('adminOrderEditDesc')}</p>
    <div style="background:var(--bg-card,rgba(255,255,255,.04));border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:14px;font-size:13px">
      <strong>${o?.service || ''}</strong> &nbsp;<span style="color:var(--text-muted);font-size:12px">${o?.date || ''}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;font-size:12px">
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px">
        <div style="font-weight:600;color:var(--text-muted);margin-bottom:4px">Before</div>
        <ul style="margin:0;padding-left:16px">${partList(oldParts)}</ul>
      </div>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px">
        <div style="font-weight:600;color:var(--success);margin-bottom:4px">After</div>
        <ul style="margin:0;padding-left:16px">${partList(data.partsUsed)}</ul>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <label style="font-size:13px;font-weight:500">${t('userId')}
        <input id="ac-id" type="text" placeholder="${t('enterUserId')}" autocomplete="off"
          style="display:block;width:100%;margin-top:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font);font-size:13px;padding:8px 10px;box-sizing:border-box"
          oninput="document.getElementById('ac-err').textContent='';this.classList.remove('input-error')">
      </label>
      <label style="font-size:13px;font-weight:500">${t('password')}
        <input id="ac-pw" type="password" placeholder="${t('enterPassword')}" autocomplete="off"
          style="display:block;width:100%;margin-top:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font);font-size:13px;padding:8px 10px;box-sizing:border-box"
          oninput="document.getElementById('ac-err').textContent='';this.classList.remove('input-error')"
          onkeydown="if(event.key==='Enter')confirmAdminOrderSave()">
      </label>
    </div>
    <div id="ac-err" style="color:var(--danger);font-size:12px;margin-top:8px;min-height:16px"></div>
    <div class="form-actions" style="margin-top:16px">
      <button class="btn btn-primary" onclick="confirmAdminOrderSave()">${icon('check',16)} ${t('save')}</button>
      <button class="btn btn-ghost" onclick="closeModal()">${t('cancel')}</button>
    </div>
  `, 480);
  setTimeout(() => document.getElementById('ac-id')?.focus(), 100);
}

/** Validates admin credentials then applies the pending order parts change + stock adjustments. */
function confirmAdminOrderSave() {
  const adminId = document.getElementById('ac-id').value.trim();
  const adminPw = document.getElementById('ac-pw').value;
  const errEl   = document.getElementById('ac-err');
  const idEl    = document.getElementById('ac-id');
  const pwEl    = document.getElementById('ac-pw');

  if (!adminId) { idEl.classList.add('input-error'); idEl.focus(); errEl.textContent = t('errBothRequired'); return; }
  if (!adminPw) { pwEl.classList.add('input-error'); pwEl.focus(); errEl.textContent = t('errBothRequired'); return; }

  const valid = USERS.find(u => u.id === adminId && u.password === adminPw);
  if (!valid) {
    pwEl.value = '';
    pwEl.classList.add('input-error');
    pwEl.focus();
    errEl.textContent = t('errInvalidCreds');
    return;
  }

  if (!_pendingOrderEdit) { closeModal(); return; }
  const { id, data, oldParts } = _pendingOrderEdit;

  // Check stock after simulated reversal — new parts must be coverable
  const shortages = checkPartsStockAfterReversal(data.partsUsed, oldParts);
  if (shortages.length > 0) { showInsufficientStock(shortages); return; }

  _pendingOrderEdit = null;

  // Reverse old stock deductions (add back)
  oldParts.forEach(pu => {
    if (!pu.partId) return;
    const pt = State.parts.find(p => p.id === pu.partId);
    if (pt) {
      const before = pt.qty;
      pt.qty += pu.qty;
      logStockMove(pt.id, 'in', pu.qty, before, pt.qty, `logReasonOrderEdit|${data.service}`);
    }
  });

  // Apply new stock deductions
  data.partsUsed.forEach(pu => {
    if (!pu.partId) return;
    const pt = State.parts.find(p => p.id === pu.partId);
    if (pt) {
      const before = pt.qty;
      pt.qty = Math.max(0, pt.qty - pu.qty);
      logStockMove(pt.id, 'out', pu.qty, before, pt.qty, `logReasonOrderEdit|${data.service}`);
    }
  });

  const idx = State.orders.findIndex(o => o.id === id);
  if (idx !== -1) State.orders[idx] = { ...State.orders[idx], ...data };
  State.save();
  closeModal();
  showToast(t('orderUpdated'));
  renderOrders();
}

/**
 * Translates a stored reason string to the active language.
 * New format: "logReasonKey|arg"  (pipe separates key from optional arg)
 * Old format: raw translated text — returned as-is for backward compatibility.
 */
function translateReason(reason) {
  if (!reason) return '';
  const pipeIdx = reason.indexOf('|');
  if (pipeIdx > -1) {
    const key = reason.slice(0, pipeIdx);
    const arg = reason.slice(pipeIdx + 1);
    const base = TRANSLATIONS[getLang()]?.[key];
    if (!base) return reason; // unknown key — show raw
    if (key === 'logReasonRestock') return `${base} @ ${fmtCurrency(parseFloat(arg))}`;
    return arg ? `${base}: ${arg}` : base;
  }
  // No pipe — check if it's a bare key (no arg)
  const bare = TRANSLATIONS[getLang()]?.[reason];
  return bare ?? reason; // bare key → translate; unknown → show raw (old data)
}

/** Opens a modal showing the full stock in/out log for a part. */
function openStockLog(partId) {
  const p = State.parts.find(x => x.id === partId);
  if (!p) return;
  const log = State.stockLog.filter(e => e.partId === partId);

  const rows = log.length
    ? log.map(e => {
        const isIn  = e.type === 'in';
        const badge = isIn
          ? `<span class="badge badge-ok">${t('logIn')}</span>`
          : `<span class="badge badge-danger">${t('logOut')}</span>`;
        const change = isIn
          ? `<span style="color:var(--success);font-weight:600">+${e.qty}</span>`
          : `<span style="color:var(--danger);font-weight:600">−${e.qty}</span>`;
        return `<tr>
          <td class="mono" style="white-space:nowrap;font-size:12px">${e.date} ${e.time}</td>
          <td>${badge}</td>
          <td style="text-align:center">${change}</td>
          <td style="text-align:center">${e.balanceBefore}</td>
          <td style="text-align:center;font-weight:600">${e.balanceAfter}</td>
          <td style="font-size:12px;color:var(--text-muted)">${translateReason(e.reason)}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="6" class="empty">${t('noLogEntries')}</td></tr>`;

  openModal(
    `${icon('history', 18)} ${p.name} — ${t('stockLogTitle')}`,
    `<div style="margin-bottom:10px;font-size:13px;color:var(--text-muted)">
       <span class="mono">${p.sku}</span> &nbsp;|&nbsp; ${t('colQty')}: <strong>${p.qty}</strong> ${p.unit}
     </div>
     <div class="table-scroll" style="max-height:380px">
       <table class="data-table">
         <thead><tr>
           <th>${t('logColDate')}</th>
           <th>${t('logColType')}</th>
           <th style="text-align:center">${t('logColQty')}</th>
           <th style="text-align:center">${t('logColBefore')}</th>
           <th style="text-align:center">${t('logColAfter')}</th>
           <th>${t('logColReason')}</th>
         </tr></thead>
         <tbody>${rows}</tbody>
       </table>
     </div>
     <div class="form-actions" style="margin-top:14px">
       <button class="btn btn-ghost" onclick="closeModal()">${t('close')}</button>
     </div>`,
    660
  );
}


/* ═══════════════════════════════════════════════
 *  STOCK HISTORY PAGE
 * ═══════════════════════════════════════════════ */
function renderStockHistory() {
  document.getElementById('main-content').innerHTML = `
    <div class="page fade-in">
      <div class="page-header">
        <h2 class="page-title">${icon('ledger', 24)} ${t('stockHistoryTitle')}</h2>
      </div>
      <div class="toolbar" style="flex-wrap:wrap;gap:8px">
        <div class="search-box" style="flex:1;min-width:200px">
          ${icon('search', 16)}
          <input id="sh-search" placeholder="${t('searchStockHistory')}" oninput="filterStockHistory()"/>
        </div>
        <select id="sh-type" onchange="filterStockHistory()">
          <option value="All">${t('filterAll')}</option>
          <option value="in">${t('logIn')}</option>
          <option value="out">${t('logOut')}</option>
        </select>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-muted)">
          ${t('fromLabel')}
          <input type="date" id="sh-from" onchange="filterStockHistory()"
            style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font);font-size:13px;padding:6px 8px"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-muted)">
          ${t('toLabel')}
          <input type="date" id="sh-to" onchange="filterStockHistory()"
            style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font);font-size:13px;padding:6px 8px"/>
        </label>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>
            <th class="sortable" data-sort="date"          onclick="sortStockBy('date')"         >${t('logColDate')}   <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="partName"      onclick="sortStockBy('partName')"     >${t('colPartName')}  <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="partSku"       onclick="sortStockBy('partSku')"      >${t('colSku')}       <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="type"          onclick="sortStockBy('type')"         >${t('logColType')}   <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="qty" style="text-align:center" onclick="sortStockBy('qty')"          >${t('logColQty')}    <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="balanceBefore" onclick="sortStockBy('balanceBefore')" style="text-align:center">${t('logColBefore')} <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="balanceAfter"  onclick="sortStockBy('balanceAfter')"  style="text-align:center">${t('logColAfter')}  <span class="sort-icon">↕</span></th>
            <th>${t('logColReason')}</th>
          </tr></thead>
          <tbody id="sh-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  filterStockHistory();
}

function filterStockHistory() {
  const search = (document.getElementById('sh-search')?.value || '').toLowerCase();
  const type   = document.getElementById('sh-type')?.value   || 'All';
  const from   = document.getElementById('sh-from')?.value   || '';
  const to     = document.getElementById('sh-to')?.value     || '';

  // Enrich each log entry with current part name/SKU (resolved at render time)
  let entries = State.stockLog.map(e => {
    const part = State.parts.find(p => p.id === e.partId);
    return { ...e, partName: part?.name || '—', partSku: part?.sku || '—' };
  });

  if (type !== 'All') entries = entries.filter(e => e.type === type);
  if (from)           entries = entries.filter(e => e.date >= from);
  if (to)             entries = entries.filter(e => e.date <= to);
  if (search)         entries = entries.filter(e =>
    (e.partName + ' ' + e.partSku + ' ' + e.reason).toLowerCase().includes(search)
  );
  entries = _sortArr(entries, _stockSort);

  const tbody = document.getElementById('sh-tbody');
  if (!tbody) return;

  if (!entries.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">${t('noLogEntries')}</td></tr>`;
    return;
  }

  tbody.innerHTML = entries.map(e => {
    const isIn   = e.type === 'in';
    const badge  = isIn
      ? `<span class="badge badge-ok">${t('logIn')}</span>`
      : `<span class="badge badge-danger">${t('logOut')}</span>`;
    const change = isIn
      ? `<span style="color:var(--success);font-weight:600">+${e.qty}</span>`
      : `<span style="color:var(--danger);font-weight:600">−${e.qty}</span>`;
    return `<tr>
      <td class="mono" style="white-space:nowrap;font-size:12px">${e.date} ${e.time}</td>
      <td>${e.partName}</td>
      <td class="mono" style="font-size:12px">${e.partSku}</td>
      <td>${badge}</td>
      <td style="text-align:center">${change}</td>
      <td style="text-align:center;color:var(--text-muted)">${e.balanceBefore}</td>
      <td style="text-align:center;font-weight:600">${e.balanceAfter}</td>
      <td style="font-size:12px;color:var(--text-muted)">${translateReason(e.reason)}</td>
    </tr>`;
  }).join('');
}


/* ═══════════════════════════════════════════════
 *  SERVICE ORDERS PAGE
 * ═══════════════════════════════════════════════ */
function renderOrders() {
  document.getElementById('main-content').innerHTML = `
    <div class="page fade-in">
      <div class="page-header">
        <h2 class="page-title">${icon('orders', 24)} ${t('serviceOrders')}</h2>
        <button class="btn btn-primary" onclick="openOrderForm()">${icon('plus', 16)} ${t('newOrder')}</button>
      </div>
      <div class="toolbar">
        <div class="search-box">${icon('search', 16)}<input id="order-search" placeholder="${t('searchOrders')}" oninput="filterOrdersTable()"/></div>
        <select id="order-status-filter" onchange="filterOrdersTable()">
          <option value="All">${t('filterAll')}</option>
          <option value="pending">${t('filterPending')}</option>
          <option value="in-progress">${t('filterInProgress')}</option>
          <option value="completed">${t('filterCompleted')}</option>
        </select>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>
            <th class="sortable" data-sort="date"         onclick="sortOrdersBy('date')"        >${t('colDate')}     <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="customerName" onclick="sortOrdersBy('customerName')">${t('colCustomer')} <span class="sort-icon">↕</span></th>
            <th>${t('colVehicle')}</th>
            <th class="sortable" data-sort="service"      onclick="sortOrdersBy('service')"     >${t('colService')}  <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="partsCost"    onclick="sortOrdersBy('partsCost')"   >${t('colParts')}    <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="laborCost"    onclick="sortOrdersBy('laborCost')"   >${t('colLabor')}    <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="total"        onclick="sortOrdersBy('total')"       >${t('colTotal')}    <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="status"       onclick="sortOrdersBy('status')"      >${t('colStatus')}   <span class="sort-icon">↕</span></th>
            <th style="width:120px">${t('colActions')}</th>
          </tr></thead>
          <tbody id="orders-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  filterOrdersTable();
}

function filterOrdersTable() {
  const search = (document.getElementById('order-search')?.value || '').toLowerCase();
  const status = document.getElementById('order-status-filter')?.value || 'All';
  const statusColors = { pending: 'badge-warn', 'in-progress': 'badge-info', completed: 'badge-ok' };

  let filtered = State.orders.filter(o => {
    if (status !== 'All' && o.status !== status) return false;
    if (search && !(o.customerName + ' ' + o.service + ' ' + o.plate).toLowerCase().includes(search)) return false;
    return true;
  });
  filtered = _sortArr(filtered, _ordersSort, (o, col) => {
    if (col === 'partsCost') return o.partsUsed.reduce((s, p) => s + p.unitPrice * p.qty, 0);
    if (col === 'total')     return orderTotal(o);
    return o[col];
  });

  const tbody = document.getElementById('orders-tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty">${t('noOrdersFound')}</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(o => {
    const pc = o.partsUsed.reduce((s, p) => s + p.unitPrice * p.qty, 0);
    // fulfilled === undefined → legacy order (inventory already adjusted before this feature)
    const isFulfilled = o.fulfilled !== false;
    const fulfillBtn = isFulfilled
      ? `<button class="btn-icon fulfilled" title="${t('alreadyFulfilled')}" disabled>${icon('fulfill', 16)}</button>`
      : `<button class="btn-icon" title="${t('fulfillParts')}" style="color:var(--warn)" onclick="fulfillOrderParts('${o.id}')">${icon('fulfill', 16)}</button>`;
    return `<tr>
      <td>
        <div>${fmtDate(o.date)}</div>
        ${o.completedDate ? `<small style="color:var(--success);font-size:11px">✓ ${t('completedOn')}: ${fmtDate(o.completedDate)}</small>` : ''}
      </td>
      <td>${o.customerName}</td>
      <td>${o.vehicle}<br><small class="mono">${o.plate}</small></td>
      <td>${o.service}</td>
      <td>${fmtCurrency(pc)}</td><td>${fmtCurrency(o.laborCost)}</td>
      <td class="accent-text bold">${fmtCurrency(orderTotal(o))}</td>
      <td><span class="badge ${statusColors[o.status]}">${tStatus(o.status)}</span></td>
      <td class="actions">
        ${fulfillBtn}
        <button class="btn-icon" onclick="openOrderForm('${o.id}')">${icon('edit', 16)}</button>
        <button class="btn-icon danger" onclick="deleteOrder('${o.id}')">${icon('trash', 16)}</button>
      </td>
    </tr>`;
  }).join('');
}

/**
 * openOrderForm — renders the order creation/edit modal.
 * Parts line items are managed via a global _orderPartsUsed array.
 */
let _orderPartsUsed = [];

function openOrderForm(id) {
  const isNew = !id;
  const o = isNew
    ? { date: today(), customerId: '', customerName: '', vehicle: '', plate: '', service: '', partsUsed: [], laborCost: 0, discount: 0, status: 'pending', notes: '' }
    : State.orders.find(x => x.id === id);

  _orderPartsUsed = JSON.parse(JSON.stringify(o.partsUsed));

  const custName = o.customerId
    ? (State.customers.find(x => x.id === o.customerId)?.name || '') : '';

  openModal(isNew ? t('newServiceOrder') : t('editOrder'), `
    ${!isNew ? `
    <div style="display:flex;flex-wrap:wrap;gap:16px;padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:12px;font-size:12px;color:var(--text-muted)">
      <span>${t('colCreatedDate')}: <strong style="color:var(--text)">${fmtDate(o.createdDate || o.date)}</strong></span>
      ${o.completedDate ? `<span>${t('colCompletedDate')}: <strong style="color:var(--success)">${fmtDate(o.completedDate)}</strong></span>` : ''}
    </div>` : ''}
    <div class="form-grid">
      <label>${t('dateLabel')}<input id="of-date" type="date" value="${o.date}"/></label>
      <label>${t('customerLabel')}
        <div class="autocomplete-wrap" style="position:relative">
          <input id="of-customer-input" autocomplete="off"
            placeholder="${t('selectCustomer')}"
            value="${_esc(custName)}"
            oninput="_acCustInput()"
            onkeydown="_acKeydown('of-cust-ac', event)"
            onfocus="_acCustInput()"
            onblur="_acBlur('of-cust-ac')"/>
          <input type="hidden" id="of-customer" value="${_esc(o.customerId || '')}"/>
          <ul class="autocomplete-list" id="of-cust-ac"></ul>
        </div>
      </label>
    </div>
    <div id="of-vehicle-selector" style="display:none;margin:8px 0 12px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm)">
      <label style="font-size:12px;color:var(--text-muted);font-weight:500;display:block">
        ${icon('car', 13)} ${t('selectVehicle')}
        <select id="of-vehicle-pick" onchange="applyVehiclePick()" style="display:block;width:100%;margin-top:6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font);font-size:13px;padding:7px 10px;"></select>
      </label>
    </div>
    <div class="form-grid">
      <label>${t('vehicleLabel')}<input id="of-vehicle" value="${o.vehicle}"/></label>
      <label>${t('plateLabel')}<input id="of-plate" value="${o.plate}"/></label>
      <label class="span-2">${t('serviceDescLabel')}<input id="of-service" value="${o.service}" placeholder="${t('serviceDescPlaceholder')}" oninput="this.classList.remove('input-error')"/></label>
    </div>
    <div class="section-label">${t('partsUsedSection')}</div>
    <div id="of-parts-lines"></div>
    <button class="btn btn-sm" onclick="addOrderPartLine()">${icon('plus', 14)} ${t('addPartLine')}</button>
    <div class="form-grid" style="margin-top:16px">
      <label>${t('laborLabel')}<input id="of-labor" type="number" value="${o.laborCost}" oninput="recalcOrderTotal()"/></label>
      <label>${t('discountLabel')}<input id="of-discount" type="number" value="${o.discount}" oninput="recalcOrderTotal()"/></label>
      <label>${t('statusLabel')}
        <select id="of-status">
          <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>${t('statusPending')}</option>
          <option value="in-progress" ${o.status === 'in-progress' ? 'selected' : ''}>${t('statusInProgress')}</option>
          <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>${t('statusCompleted')}</option>
        </select>
      </label>
      <label>${t('notesLabel')}<input id="of-notes" value="${o.notes || ''}"/></label>
    </div>
    <div class="order-total" id="of-total">${t('orderTotalLabel')}: <strong>${fmtCurrency(0)}</strong></div>
    <div class="form-actions">
      <button class="btn" onclick="closeModal()">${t('cancel')}</button>
      <button class="btn btn-primary" onclick="saveOrder('${id || ''}')">${icon('check', 16)} ${t('saveOrder')}</button>
    </div>
  `, 640);

  renderOrderPartLines();
}

function renderOrderPartLines() {
  const container = document.getElementById('of-parts-lines');
  if (!container) return;
  container.innerHTML = _orderPartsUsed.map((pl, i) => `
    <div class="part-line">
      <select onchange="updateOrderPartLine(${i}, this.value)">
        <option value="">${t('selectPart')}</option>
        ${State.parts.map(p => `<option value="${p.id}" ${p.id === pl.partId ? 'selected' : ''}>${p.name} (${p.qty})</option>`).join('')}
      </select>
      <input type="number" min="1" value="${pl.qty}" style="width:60px" onchange="updateOrderPartQty(${i}, this.value)"/>
      <span class="part-price">${fmtCurrency(pl.unitPrice * pl.qty)}</span>
      <button class="btn-icon danger" onclick="removeOrderPartLine(${i})">${icon('x', 14)}</button>
    </div>
  `).join('');
  recalcOrderTotal();
}

function addOrderPartLine() {
  _orderPartsUsed.push({ partId: '', partName: '', qty: 1, unitPrice: 0 });
  renderOrderPartLines();
}
function removeOrderPartLine(i) {
  _orderPartsUsed.splice(i, 1);
  renderOrderPartLines();
}
function updateOrderPartLine(i, partId) {
  const pt = State.parts.find(p => p.id === partId);
  if (pt) { _orderPartsUsed[i].partId = pt.id; _orderPartsUsed[i].partName = pt.name; _orderPartsUsed[i].unitPrice = pt.price; }
  renderOrderPartLines();
}
function updateOrderPartQty(i, qty) {
  _orderPartsUsed[i].qty = Math.max(1, Number(qty));
  renderOrderPartLines();
}
function recalcOrderTotal() {
  const pc    = _orderPartsUsed.reduce((s, p) => s + p.unitPrice * p.qty, 0);
  const labor = Number(document.getElementById('of-labor')?.value) || 0;
  const disc  = Number(document.getElementById('of-discount')?.value) || 0;
  const el = document.getElementById('of-total');
  if (el) el.innerHTML = `${t('orderTotalLabel')}: <strong>${fmtCurrency(pc + labor - disc)}</strong>`;
}

function pickOrderCustomer() {
  const cid = document.getElementById('of-customer').value;
  const c = State.customers.find(x => x.id === cid);
  const selector   = document.getElementById('of-vehicle-selector');
  const vehiclePick = document.getElementById('of-vehicle-pick');

  if (!c) {
    if (selector) selector.style.display = 'none';
    return;
  }

  const vehicles = c.vehicles || [];

  if (vehicles.length > 1) {
    // Show vehicle picker dropdown
    if (vehiclePick) {
      vehiclePick.innerHTML = `<option value="">${t('selectVehicle')}</option>` +
        vehicles.map((v, i) => `<option value="${i}">${v.vehicle} — ${v.plate}</option>`).join('');
    }
    if (selector) selector.style.display = 'block';
    document.getElementById('of-vehicle').value = '';
    document.getElementById('of-plate').value   = '';
  } else {
    // Single vehicle — auto-fill
    const v = vehicles[0] || {};
    document.getElementById('of-vehicle').value = v.vehicle || '';
    document.getElementById('of-plate').value   = v.plate   || '';
    if (selector) selector.style.display = 'none';
  }
}

function applyVehiclePick() {
  const cid = document.getElementById('of-customer').value;
  const c = State.customers.find(x => x.id === cid);
  if (!c) return;
  const idx = Number(document.getElementById('of-vehicle-pick').value);
  const v = (c.vehicles || [])[idx];
  if (v) {
    document.getElementById('of-vehicle').value = v.vehicle;
    document.getElementById('of-plate').value   = v.plate;
  }
}

function saveOrder(id) {
  const g = (sel) => document.querySelector(sel)?.value?.trim() || '';
  const n = (sel) => Number(document.querySelector(sel)?.value) || 0;

  const custInputEl = document.getElementById('of-customer-input');
  const serviceEl   = document.getElementById('of-service');
  const cid = g('#of-customer');
  const c = State.customers.find(x => x.id === cid);
  const customerName = c ? c.name : '';

  let valid = true;
  if (!customerName) { custInputEl?.classList.add('input-error'); valid = false; }
  if (!g('#of-service')) { serviceEl?.classList.add('input-error'); if (valid) serviceEl?.focus(); valid = false; }
  if (!valid) return;

  const data = {
    date: g('#of-date'), customerId: cid, customerName,
    vehicle: g('#of-vehicle'), plate: g('#of-plate'), service: g('#of-service'),
    partsUsed: _orderPartsUsed, laborCost: n('#of-labor'), discount: n('#of-discount'),
    status: g('#of-status'), notes: g('#of-notes'),
  };

  if (id) {
    const idx = State.orders.findIndex(o => o.id === id);
    const existing = State.orders[idx];

    // If the order is fulfilled, check whether partsUsed changed — stock must be adjusted
    if (existing && existing.fulfilled === true) {
      const partsChanged = JSON.stringify(existing.partsUsed) !== JSON.stringify(data.partsUsed);
      if (partsChanged) {
        _pendingOrderEdit = { id, data, oldParts: JSON.parse(JSON.stringify(existing.partsUsed)) };
        openAdminOrderSaveModal(id, data, existing.partsUsed);
        return;
      }
    }

    // Auto-deduct parts when an unfulfilled order is saved with status 'completed'
    if (existing && existing.fulfilled !== true && data.status === 'completed') {
      const shortages = checkPartsStock(data.partsUsed);
      if (shortages.length > 0) { showInsufficientStock(shortages); return; }
      if (idx !== -1) State.orders[idx] = { ...State.orders[idx], ...data, fulfilled: true, completedDate: today() };
      data.partsUsed.forEach(pu => {
        if (!pu.partId) return;
        const pt = State.parts.find(p => p.id === pu.partId);
        if (pt) {
          const oldQty = pt.qty;
          pt.qty = Math.max(0, pt.qty - pu.qty);
          logStockMove(pt.id, 'out', pu.qty, oldQty, pt.qty, `logReasonOrder|${data.service}`);
        }
      });
      State.save();
      closeModal();
      showToast(t('autoDeductSuccess'));
      renderOrders();
      return;
    }

    if (idx !== -1) State.orders[idx] = { ...State.orders[idx], ...data };
    showToast(t('orderUpdated'));
  } else {
    // New order: auto-deduct immediately if created with status 'completed'
    const newId = uid();
    const autoFulfill = data.status === 'completed';
    if (autoFulfill) {
      const shortages = checkPartsStock(data.partsUsed);
      if (shortages.length > 0) { showInsufficientStock(shortages); return; }
    }
    State.orders.unshift({
      id: newId, ...data,
      fulfilled:     autoFulfill,
      createdDate:   today(),
      completedDate: autoFulfill ? today() : null,
    });
    if (autoFulfill) {
      data.partsUsed.forEach(pu => {
        if (!pu.partId) return;
        const pt = State.parts.find(p => p.id === pu.partId);
        if (pt) {
          const oldQty = pt.qty;
          pt.qty = Math.max(0, pt.qty - pu.qty);
          logStockMove(pt.id, 'out', pu.qty, oldQty, pt.qty, `logReasonOrder|${data.service}`);
        }
      });
      showToast(t('autoDeductSuccess'));
    } else {
      showToast(t('orderCreated'));
    }
  }
  State.save();
  closeModal();
  renderOrders();
}

/** Opens a confirmation modal before completing a job and deducting parts. */
function fulfillOrderParts(id) {
  const o = State.orders.find(x => x.id === id);
  if (!o || o.fulfilled === true) return;

  const partLines = o.partsUsed.filter(p => p.partId).map(p =>
    `<li style="margin:2px 0">${p.partName} × <strong>${p.qty}</strong></li>`
  ).join('') || `<li style="color:var(--text-muted)">—</li>`;

  openModal(t('completeJobTitle'), `
    <p style="margin:0 0 14px;color:var(--text-muted);font-size:13px;line-height:1.5">${t('completeJobDesc')}</p>
    <div style="background:var(--bg-card,rgba(255,255,255,.04));border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:14px;font-size:13px">
      <div><strong>${o.service}</strong></div>
      <div style="color:var(--text-muted);font-size:12px;margin-top:2px">${o.customerName} — ${o.vehicle} <span class="mono">${o.plate}</span></div>
    </div>
    <div style="font-size:13px;margin-bottom:14px">
      <div style="font-weight:600;margin-bottom:6px">${t('partsUsedSection')}:</div>
      <ul style="margin:0;padding-left:18px">${partLines}</ul>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="doFulfillOrderParts('${id}')">${icon('check', 16)} ${t('completeAndDeduct')}</button>
      <button class="btn btn-ghost" onclick="closeModal()">${t('cancel')}</button>
    </div>
  `, 420);
}

/** Performs the actual deduction after the user confirms via the modal. */
function doFulfillOrderParts(id) {
  const o = State.orders.find(x => x.id === id);
  if (!o || o.fulfilled === true) { closeModal(); return; }
  const shortages = checkPartsStock(o.partsUsed);
  if (shortages.length > 0) { showInsufficientStock(shortages); return; }
  o.partsUsed.forEach(pu => {
    const pt = State.parts.find(p => p.id === pu.partId);
    if (pt) {
      const oldQty = pt.qty;
      pt.qty = Math.max(0, pt.qty - pu.qty);
      logStockMove(pt.id, 'out', pu.qty, oldQty, pt.qty, `logReasonOrder|${o.service}`);
    }
  });
  o.fulfilled = true;
  o.status = 'completed';
  o.completedDate = today();
  State.save();
  closeModal();
  showToast(t('autoDeductSuccess'));
  renderOrders();
}

function deleteOrder(id) {
  if (!confirm(t('confirmDeleteOrder'))) return;
  State.orders = State.orders.filter(o => o.id !== id);
  State.save();
  showToast(t('orderDeleted'), 'warn');
  renderOrders();
}


/* ═══════════════════════════════════════════════
 *  CUSTOMERS PAGE
 * ═══════════════════════════════════════════════ */
function renderCustomers() {
  document.getElementById('main-content').innerHTML = `
    <div class="page fade-in">
      <div class="page-header">
        <h2 class="page-title">${icon('customers', 24)} ${t('customersTitle')}</h2>
        <button class="btn btn-primary" onclick="openCustomerForm()">${icon('plus', 16)} ${t('addCustomer')}</button>
      </div>
      <div class="toolbar">
        <div class="search-box">${icon('search', 16)}<input id="cust-search" placeholder="${t('searchCustomers')}" oninput="filterCustomersTable()"/></div>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>
            <th class="sortable" data-sort="name"       onclick="sortCustomersBy('name')"      >${t('colName')}       <span class="sort-icon">↕</span></th>
            <th>${t('colPhone')}</th>
            <th>${t('colVehicle')}</th>
            <th>${t('colPlate')}</th>
            <th class="sortable" data-sort="orders"     onclick="sortCustomersBy('orders')"    >${t('colOrders')}     <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort="totalSpent" onclick="sortCustomersBy('totalSpent')">${t('colTotalSpent')} <span class="sort-icon">↕</span></th>
            <th>${t('colNotes')}</th>
            <th style="width:90px">${t('colActions')}</th>
          </tr></thead>
          <tbody id="cust-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  filterCustomersTable();
}

function filterCustomersTable() {
  const search = (document.getElementById('cust-search')?.value || '').toLowerCase();
  let filtered = State.customers.filter(c => {
    if (!search) return true;
    const vehicleText = (c.vehicles || []).map(v => v.vehicle + ' ' + v.plate).join(' ');
    return (c.name + ' ' + c.phone + ' ' + vehicleText).toLowerCase().includes(search);
  });
  filtered = _sortArr(filtered, _customersSort, (c, col) => {
    if (col === 'orders')     return State.orders.filter(o => o.customerId === c.id).length;
    if (col === 'totalSpent') return State.orders.filter(o => o.customerId === c.id).reduce((s, o) => s + orderTotal(o), 0);
    return c[col];
  });
  const tbody = document.getElementById('cust-tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">${t('noCustomersFound')}</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(c => {
    const oc = State.orders.filter(o => o.customerId === c.id).length;
    const ts = State.orders.filter(o => o.customerId === c.id).reduce((s, o) => s + orderTotal(o), 0);
    const vehicles = c.vehicles || [];
    const firstV   = vehicles[0] || { vehicle: c.vehicle || '', plate: c.plate || '' };
    const extraBadge = vehicles.length > 1
      ? ` <span class="badge" title="${vehicles.slice(1).map(v=>v.plate).join(', ')}">+${vehicles.length - 1}</span>` : '';
    return `<tr>
      <td class="bold">${c.name}</td><td>${c.phone}</td>
      <td>${firstV.vehicle}${extraBadge}</td>
      <td class="mono">${firstV.plate}</td>
      <td>${oc}</td><td class="accent-text">${fmtCurrency(ts)}</td><td>${c.notes}</td>
      <td class="actions">
        <button class="btn-icon" onclick="openCustomerForm('${c.id}')">${icon('edit', 16)}</button>
        <button class="btn-icon danger" onclick="deleteCustomer('${c.id}')">${icon('trash', 16)}</button>
      </td>
    </tr>`;
  }).join('');
}

// Temporary vehicle array for the customer form (like _orderPartsUsed)
let _customerVehicles = [];

function openCustomerForm(id) {
  const isNew = !id;
  const c = isNew
    ? { name: '', phone: '', vehicles: [{ id: uid(), vehicle: '', plate: '' }], notes: '' }
    : State.customers.find(x => x.id === id);

  _customerVehicles = JSON.parse(JSON.stringify(
    c.vehicles || [{ id: uid(), vehicle: c.vehicle || '', plate: c.plate || '' }]
  ));

  openModal(isNew ? t('addCustomerTitle') : t('editCustomerTitle'), `
    <div class="form-grid">
      <label>${t('fullNameLabel')}<input id="cf-name" value="${c.name}" oninput="this.classList.remove('input-error')"/></label>
      <label>${t('phoneLabel')}<input id="cf-phone" value="${c.phone}"/></label>
      <label class="span-2">${t('colNotes')}<input id="cf-notes" value="${c.notes}"/></label>
    </div>
    <div class="section-label">${icon('car', 14)} ${t('vehicles')}</div>
    <div id="cf-vehicles-lines"></div>
    <button class="btn btn-sm" style="margin-bottom:12px" onclick="addCustomerVehicle()">${icon('plus', 14)} ${t('addVehicle')}</button>
    <div class="form-actions">
      <button class="btn" onclick="closeModal()">${t('cancel')}</button>
      <button class="btn btn-primary" onclick="saveCustomer('${id || ''}')">${icon('check', 16)} ${t('save')}</button>
    </div>
  `);
  renderCustomerVehicleLines();
}

function renderCustomerVehicleLines() {
  const container = document.getElementById('cf-vehicles-lines');
  if (!container) return;
  container.innerHTML = _customerVehicles.map((v, i) => {
    const p = parseBrandModel(v.vehicle);
    return `
    <div class="vehicle-line">
      <div class="vl-row">
        <select class="vi-type" data-idx="${i}" onchange="onVehicleTypeChange(${i})">
          <option value="">${t('selectVehicleType')}</option>
          <option value="car"  ${p.type === 'car'  ? 'selected' : ''}>${t('typeCar')}</option>
          <option value="moto" ${p.type === 'moto' ? 'selected' : ''}>${t('typeMoto')}</option>
        </select>
        <div class="autocomplete-wrap" style="flex:1;position:relative">
          <input class="vi-brand-input" data-idx="${i}" autocomplete="off"
            placeholder="${t('selectBrand')}"
            value="${_esc(p.brandText)}"
            oninput="_acBrandInput(${i}); updateVehicleValue(${i})"
            onkeydown="_acKeydown('vi-brand-ac-${i}', event)"
            onfocus="_acBrandInput(${i})"
            onblur="_acBlur('vi-brand-ac-${i}'); updateVehicleValue(${i})"/>
          <ul class="autocomplete-list" id="vi-brand-ac-${i}"></ul>
        </div>
      </div>
      <div class="vl-row">
        <input class="vi-model-text" data-idx="${i}"
          placeholder="${t('modelYearLabel')}"
          value="${_esc(p.model)}"
          oninput="updateVehicleValue(${i}); this.classList.remove('input-error')"/>
        <input class="vi-plate" placeholder="${t('licensePlateLabel')}" value="${_esc(v.plate)}"
          oninput="updateCustomerVehicle(${i},'plate',this.value)"/>
        ${_customerVehicles.length > 1
          ? `<button class="btn-icon danger" onclick="removeCustomerVehicle(${i})">${icon('x', 14)}</button>`
          : ''}
      </div>
    </div>`;
  }).join('');
}

/** Clear brand input and suggestions when vehicle type changes. */
function onVehicleTypeChange(i) {
  const brandInp = document.querySelector(`.vi-brand-input[data-idx="${i}"]`);
  if (brandInp) brandInp.value = '';
  const acList = document.getElementById(`vi-brand-ac-${i}`);
  if (acList) { acList.innerHTML = ''; acList.style.display = 'none'; }
  updateVehicleValue(i);
}

/** Rebuilds the stored vehicle string from brand text input + model input. */
function updateVehicleValue(i) {
  const brandInp = document.querySelector(`.vi-brand-input[data-idx="${i}"]`);
  const modelInp = document.querySelector(`.vi-model-text[data-idx="${i}"]`);
  if (!brandInp || !modelInp) return;
  const combined = [brandInp.value.trim(), modelInp.value.trim()].filter(Boolean).join(' ');
  updateCustomerVehicle(i, 'vehicle', combined);
}

function addCustomerVehicle() {
  _customerVehicles.push({ id: uid(), vehicle: '', plate: '' });
  renderCustomerVehicleLines();
}
function removeCustomerVehicle(i) {
  if (_customerVehicles.length <= 1) return;
  _customerVehicles.splice(i, 1);
  renderCustomerVehicleLines();
}
function updateCustomerVehicle(i, field, value) {
  if (_customerVehicles[i]) _customerVehicles[i][field] = value;
}

function saveCustomer(id) {
  const g = (sel) => document.querySelector(sel)?.value?.trim() || '';
  const nameEl = document.getElementById('cf-name');
  let valid = true;

  if (!nameEl.value.trim()) {
    nameEl.classList.add('input-error');
    nameEl.focus();
    valid = false;
  }
  // Ensure at least one vehicle with a brand entered
  const firstBrandEl = document.querySelector('#cf-vehicles-lines .vi-brand-input');
  if (!_customerVehicles.length || !_customerVehicles[0].vehicle.trim()) {
    if (firstBrandEl) {
      firstBrandEl.classList.add('input-error');
      if (valid) firstBrandEl.focus();
    }
    valid = false;
  }
  if (!valid) return;

  const data = {
    name: nameEl.value.trim(),
    phone: g('#cf-phone'),
    vehicles: _customerVehicles.filter(v => v.vehicle.trim() || v.plate.trim()),
    notes: g('#cf-notes'),
  };
  if (!data.vehicles.length) data.vehicles = [{ id: uid(), vehicle: '', plate: '' }];

  if (id) {
    const idx = State.customers.findIndex(c => c.id === id);
    if (idx !== -1) State.customers[idx] = { ...State.customers[idx], ...data };
    showToast(t('customerUpdated'));
  } else {
    State.customers.push({ id: uid(), ...data });
    showToast(t('customerAdded'));
  }
  State.save();
  closeModal();
  renderCustomers();
}

function deleteCustomer(id) {
  const c = State.customers.find(x => x.id === id);
  if (!c) return;
  openModal(t('adminConfirmTitle'), `
    <p style="margin:0 0 14px;color:var(--text-muted);font-size:13px;line-height:1.5">${t('adminConfirmDesc')}</p>
    <div style="background:var(--danger-bg,rgba(239,68,68,.08));border:1px solid rgba(239,68,68,.25);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:14px;font-size:13px">
      ${icon('trash',14)} <strong>${c.name}</strong>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <label style="font-size:13px;font-weight:500">${t('userId')}
        <input id="ac-id" type="text" placeholder="${t('enterUserId')}" autocomplete="off"
          style="display:block;width:100%;margin-top:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font);font-size:13px;padding:8px 10px;box-sizing:border-box"
          oninput="document.getElementById('ac-err').textContent='';this.classList.remove('input-error')">
      </label>
      <label style="font-size:13px;font-weight:500">${t('password')}
        <input id="ac-pw" type="password" placeholder="${t('enterPassword')}" autocomplete="off"
          style="display:block;width:100%;margin-top:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font);font-size:13px;padding:8px 10px;box-sizing:border-box"
          oninput="document.getElementById('ac-err').textContent='';this.classList.remove('input-error')"
          onkeydown="if(event.key==='Enter')confirmAdminDelete('${id}')">
      </label>
    </div>
    <div id="ac-err" style="color:var(--danger);font-size:12px;margin-top:8px;min-height:16px"></div>
    <div class="form-actions" style="margin-top:16px">
      <button class="btn btn-danger" onclick="confirmAdminDelete('${id}')">${icon('trash',16)} ${t('confirmDeleteCustomer')}</button>
      <button class="btn btn-ghost" onclick="closeModal()">${t('cancel')}</button>
    </div>
  `, 400);
  setTimeout(() => document.getElementById('ac-id')?.focus(), 100);
}

function confirmAdminDelete(id) {
  const adminId = document.getElementById('ac-id').value.trim();
  const adminPw = document.getElementById('ac-pw').value;
  const errEl   = document.getElementById('ac-err');
  const idEl    = document.getElementById('ac-id');
  const pwEl    = document.getElementById('ac-pw');

  if (!adminId) { idEl.classList.add('input-error'); idEl.focus(); errEl.textContent = t('errBothRequired'); return; }
  if (!adminPw) { pwEl.classList.add('input-error'); pwEl.focus(); errEl.textContent = t('errBothRequired'); return; }

  const valid = USERS.find(u => u.id === adminId && u.password === adminPw);
  if (!valid) {
    pwEl.value = '';
    pwEl.classList.add('input-error');
    pwEl.focus();
    errEl.textContent = t('errInvalidCreds');
    return;
  }

  State.customers = State.customers.filter(c => c.id !== id);
  State.save();
  closeModal();
  showToast(t('customerDeleted'), 'warn');
  renderCustomers();
}


/* ═══════════════════════════════════════════════
 *  REPORTS & EXPORT PAGE
 * ═══════════════════════════════════════════════ */
function renderReports() {
  document.getElementById('main-content').innerHTML = `
    <div class="page fade-in">
      <h2 class="page-title">${icon('reports', 24)} ${t('reportsTitle')}</h2>

      <div class="export-settings">
        <h3>${icon('settings', 18)} ${t('exportSettings')}</h3>
        <div class="radio-group">
          <label class="radio-label"><input type="radio" name="export-mode" value="all" checked onchange="toggleDateRange()"/> ${t('exportAll')}</label>
          <label class="radio-label"><input type="radio" name="export-mode" value="range" onchange="toggleDateRange()"/> ${t('customRange')}</label>
        </div>
        <div class="date-range" id="date-range-fields" style="display:none">
          <label>${t('fromLabel')} <input type="date" id="exp-from"/></label>
          <label>${t('toLabel')}   <input type="date" id="exp-to"/></label>
        </div>
        <button class="btn btn-primary btn-lg" onclick="handleExport()">${icon('download', 18)} ${t('exportExcel')}</button>
        <p class="hint">${t('exportHint')}</p>
      </div>

      <div class="report-preview" id="report-preview"></div>
    </div>
  `;
  updateReportPreview();
}

function toggleDateRange() {
  const mode = document.querySelector('input[name="export-mode"]:checked')?.value;
  document.getElementById('date-range-fields').style.display = mode === 'range' ? 'flex' : 'none';
  updateReportPreview();
}

function updateReportPreview() {
  const mode = document.querySelector('input[name="export-mode"]:checked')?.value || 'all';
  const from = document.getElementById('exp-from')?.value || '';
  const to   = document.getElementById('exp-to')?.value   || '';

  const filtered = State.orders.filter(o => {
    if (mode === 'all') return true;
    if (from && o.date < from) return false;
    if (to   && o.date > to)   return false;
    return true;
  });

  const rev   = totalRevenue(filtered);
  const parts = filtered.reduce((s, o) => s + o.partsUsed.reduce((ps, p) => ps + p.unitPrice * p.qty, 0), 0);
  const labor = filtered.reduce((s, o) => s + o.laborCost, 0);

  const revByStatus = [
    { label: t('statusCompleted'),   value: filtered.filter(o => o.status === 'completed').reduce((s, o) => s + orderTotal(o), 0),    color: '#10b981' },
    { label: t('statusInProgress'),  value: filtered.filter(o => o.status === 'in-progress').reduce((s, o) => s + orderTotal(o), 0), color: '#3b82f6' },
    { label: t('statusPending'),     value: filtered.filter(o => o.status === 'pending').reduce((s, o) => s + orderTotal(o), 0),     color: '#f97316' },
  ];

  const previewTitle = mode === 'all' ? t('previewAllTime') : `${fmtDate(from)} — ${fmtDate(to)}`;

  document.getElementById('report-preview').innerHTML = `
    <h3>Preview — ${previewTitle}</h3>
    <div class="kpi-grid small">
      <div class="kpi-card"><div class="kpi-label">${t('previewOrders')}</div><div class="kpi-value">${filtered.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">${t('previewRevenue')}</div><div class="kpi-value accent">${fmtCurrency(rev)}</div></div>
      <div class="kpi-card"><div class="kpi-label">${t('previewParts')}</div><div class="kpi-value">${fmtCurrency(parts)}</div></div>
      <div class="kpi-card"><div class="kpi-label">${t('previewLabor')}</div><div class="kpi-value">${fmtCurrency(labor)}</div></div>
    </div>
    <div class="chart-card" style="margin-top:20px">
      ${renderBarChart(revByStatus, { label: t('revenueByStatus'), width: 420, height: 200 })}
    </div>
  `;
}

function handleExport() {
  const mode = document.querySelector('input[name="export-mode"]:checked')?.value || 'all';
  exportToExcel({
    parts:     State.parts,
    orders:    State.orders,
    customers: State.customers,
    dateFrom:  mode === 'range' ? document.getElementById('exp-from')?.value : null,
    dateTo:    mode === 'range' ? document.getElementById('exp-to')?.value   : null,
  });
}
