/**
 * ============================================================
 * export.js — Excel (.xlsx) Export
 * ============================================================
 *
 * Uses SheetJS (loaded in index.html via CDN).
 *
 * exportToExcel({ parts, orders, customers, dateFrom, dateTo })
 *   → downloads a multi-sheet workbook:
 *       Sheet 1: Spare Parts inventory
 *       Sheet 2: Service Orders (filtered by date range)
 *       Sheet 3: Customer list
 *       Sheet 4: Summary / totals
 *
 * Developer: SheetJS is loaded with `defer` in index.html,
 * so it's available by the time the user clicks Export.
 */

function exportToExcel({ parts, orders, customers, dateFrom, dateTo }) {
  if (typeof XLSX === 'undefined') {
    showToast('SheetJS library not loaded. Check your internet connection.', 'warn');
    return;
  }

  /* ── Filter orders by date range if provided ── */
  const filtered = orders.filter(o => {
    if (dateFrom && o.date < dateFrom) return false;
    if (dateTo   && o.date > dateTo)   return false;
    return true;
  });

  /* ── Sheet 1: Parts ── */
  const partsRows = parts.map(p => ({
    'SKU':            p.sku,
    'Name':           p.name,
    'Category':       p.category,
    'Unit':           p.unit,
    'Cost (฿)':       p.cost,
    'Sell Price (฿)': p.price,
    'Margin (฿)':     p.price - p.cost,
    'Qty On Hand':    p.qty,
    'Reorder Level':  p.reorder,
    'Stock Status':   p.qty <= p.reorder ? 'LOW' : 'OK',
  }));

  /* ── Sheet 2: Orders ── */
  const orderRows = filtered.map(o => {
    const partsCost = o.partsUsed.reduce((s, p) => s + p.unitPrice * p.qty, 0);
    return {
      'Date':           o.date,
      'Customer':       o.customerName,
      'Vehicle':        o.vehicle,
      'Plate':          o.plate,
      'Service':        o.service,
      'Status':         o.status,
      'Parts Cost (฿)': partsCost,
      'Labor (฿)':      o.laborCost,
      'Discount (฿)':   o.discount,
      'Total (฿)':      Math.round((partsCost + o.laborCost - o.discount) * 100) / 100,
      'Notes':          o.notes,
    };
  });

  /* ── Sheet 3: Customers ── */
  const custRows = customers.map(c => {
    const vehicles = c.vehicles || (c.vehicle ? [{ vehicle: c.vehicle, plate: c.plate }] : []);
    return {
      'Name':    c.name,
      'Phone':   c.phone,
      'Vehicle': vehicles.map(v => v.vehicle).join(', '),
      'Plate':   vehicles.map(v => v.plate).join(', '),
      'Notes':   c.notes,
    };
  });

  /* ── Sheet 4: Summary ── */
  const totalRev   = orderRows.reduce((s, r) => s + r['Total (฿)'], 0);
  const totalParts = orderRows.reduce((s, r) => s + r['Parts Cost (฿)'], 0);
  const totalLabor = orderRows.reduce((s, r) => s + r['Labor (฿)'], 0);
  const summaryRows = [
    { Metric: 'Report Period',      Value: dateFrom && dateTo ? `${dateFrom} — ${dateTo}` : 'All Time' },
    { Metric: 'Total Orders',       Value: filtered.length },
    { Metric: 'Completed Orders',   Value: filtered.filter(o => o.status === 'completed').length },
    { Metric: 'Total Revenue (฿)',  Value: totalRev },
    { Metric: 'Parts Revenue (฿)',  Value: totalParts },
    { Metric: 'Labor Revenue (฿)',  Value: totalLabor },
    { Metric: 'Avg Order Value (฿)',Value: filtered.length ? Math.round(totalRev / filtered.length * 100) / 100 : 0 },
    { Metric: 'Inventory Items',    Value: parts.length },
    { Metric: 'Low Stock Items',    Value: parts.filter(p => p.qty <= p.reorder).length },
  ];

  /* ── Build workbook ── */
  const wb  = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(partsRows);
  const ws2 = XLSX.utils.json_to_sheet(orderRows);
  const ws3 = XLSX.utils.json_to_sheet(custRows);
  const ws4 = XLSX.utils.json_to_sheet(summaryRows);

  // Auto-width columns for readability
  [ws1, ws2, ws3, ws4].forEach(ws => {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const cols = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      let maxW = 10;
      for (let r = range.s.r; r <= range.e.r; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v) maxW = Math.max(maxW, String(cell.v).length + 2);
      }
      cols.push({ wch: Math.min(maxW, 40) });
    }
    ws['!cols'] = cols;
  });

  XLSX.utils.book_append_sheet(wb, ws1, 'Spare Parts');
  XLSX.utils.book_append_sheet(wb, ws2, 'Service Orders');
  XLSX.utils.book_append_sheet(wb, ws3, 'Customers');
  XLSX.utils.book_append_sheet(wb, ws4, 'Summary');

  /* ── Download ── */
  const fileName = `AutoFix_Report_${dateFrom || 'all'}_to_${dateTo || 'all'}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast(`Exported: ${fileName}`);
}
