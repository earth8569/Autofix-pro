/**
 * ============================================================
 * i18n.js — Internationalisation (EN / TH)
 * ============================================================
 *
 * Usage:
 *   t('key')          — translated string for the current lang
 *   getLang()         — returns 'en' or 'th'
 *   setLang('th')     — switches language and re-renders the view
 *   updateLangUI()    — syncs toggle buttons + static shell text
 *   tStatus(status)   — translates order-status value → display text
 */

const TRANSLATIONS = {
  en: {
    // App shell
    appSub:        'Repair Shop Manager',
    appTagline:    'Repair Shop Management System',
    dataInBrowser: 'Data saved in browser',
    signOut:       'Sign Out',

    // Login
    userId:           'User ID',
    password:         'Password',
    enterUserId:      'Enter your ID',
    enterPassword:    'Enter password',
    signIn:           'Sign In',
    errBothRequired:  'Please enter both User ID and Password.',
    errInvalidCreds:  'Invalid User ID or Password.',

    // Navigation
    dashboard:    'Dashboard',
    parts:        'Spare Parts',
    orders:       'Service Orders',
    customers:    'Customers',
    reports:      'Reports',
    stockHistory: 'Stock History',

    // Dashboard
    totalRevenue:    'Total Revenue',
    completedJobs:   'Completed Jobs',
    inventoryValue:  'Inventory Value',
    lowStockAlerts:  'Low Stock Alerts',
    pendingCount:    'pending',
    itemsTracked:    'items tracked',
    itemsBelow:      'items below reorder',
    revenueLastDays: 'Revenue — Last 7 Days (฿)',
    stockByCategory: 'Stock by Category',
    // Dashboard table cols
    skuCol:       'SKU',
    partNameCol:  'Part Name',
    onHandCol:    'On Hand',
    reorderLvlCol:'Reorder Lvl',

    // Parts page
    spareParts:    'Spare Parts Inventory',
    addPart:       'Add Part',
    searchParts:   'Search parts...',
    addNewPart:    'Add New Part',
    editPart:      'Edit Part',
    // Form labels
    skuLabel:          'SKU *',
    partNameLabel:     'Part Name *',
    categoryLabel:     'Category',
    unitLabel:         'Unit',
    costLabel:         'Cost (฿)',
    priceLabel:        'Sell Price (฿)',
    qtyLabel:          'Quantity',
    reorderLevelLabel: 'Reorder Level',
    unitPlaceholder:   'pc, set, bottle',
    catPlaceholder:    'e.g. Filters',
    // Table columns
    colSku:      'SKU',
    colPartName: 'Part Name',
    colCategory: 'Category',
    colUnit:     'Unit',
    colCost:     'Cost',
    colPrice:    'Price',
    colMargin:   'Margin',
    colQty:      'Qty',
    colStatus:   'Status',
    colActions:  'Actions',
    noPartsFound:       'No parts found.',
    skuRequired:        'SKU and Name are required.',
    partUpdated:        'Part updated',
    partAdded:          'Part added successfully',
    partDeleted:        'Part deleted',
    confirmDeletePart:  'Delete this part? This cannot be undone.',
    restockBtn:              'Restock',
    restockTitle:            'Restock Part',
    restockPartLabel:        'Select Part',
    restockQtyLabel:         'Quantity to Add',
    restockCostLabel:        'Purchase Cost (per unit)',
    restockCostHint:         'Leave blank to keep the current cost. If the cost differs, a weighted average will be calculated automatically.',
    restockConfirm:          'Confirm Restock',
    restockSuccess:          'Stock replenished successfully',
    duplicateSkuTitle:       'Duplicate SKU Detected',
    duplicateSkuDesc:        'A part with this SKU already exists in your inventory:',
    duplicateRestockInstead: 'Restock Existing Part',
    duplicateSaveNew:        'Save as Separate Variant',
    all:                'All',
    badgeLow:    'LOW',
    badgeOk:     'OK',
    badgeReorder:'REORDER',

    // Orders page
    serviceOrders: 'Service Orders',
    newOrder:      'New Order',
    searchOrders:  'Search orders...',
    newServiceOrder: 'New Service Order',
    editOrder:       'Edit Order',
    // Table columns
    colDate:          'Date',
    colCreatedDate:   'Created',
    colCompletedDate: 'Completed',
    completedOn:      'Completed',
    colCustomer: 'Customer',
    colVehicle:  'Vehicle',
    colService:  'Service',
    colParts:    'Parts',
    colLabor:    'Labor',
    colTotal:    'Total',
    noOrdersFound: 'No orders found.',
    // Form labels
    dateLabel:             'Date',
    customerLabel:         'Customer',
    vehicleLabel:          'Vehicle',
    plateLabel:            'Plate',
    serviceDescLabel:      'Service Description',
    serviceDescPlaceholder:'e.g. Oil Change, Brake Repair',
    partsUsedSection:      'Parts Used',
    addPartLine:           'Add Part',
    laborLabel:            'Labor Cost (฿)',
    discountLabel:         'Discount (฿)',
    statusLabel:           'Status',
    notesLabel:            'Notes',
    orderTotalLabel:       'Order Total',
    saveOrder:             'Save Order',
    selectCustomer:        '— select —',
    selectPart:            '— pick part —',
    availText:             'avail',
    // Filters
    filterAll:         'All',
    filterPending:     'Pending',
    filterInProgress:  'In Progress',
    filterCompleted:   'Completed',
    // Status display
    statusPending:     'Pending',
    statusInProgress:  'In Progress',
    statusCompleted:   'Completed',
    // Toasts / alerts
    errSelectCustomer:  'Please select a customer.',
    errServiceRequired: 'Service description is required.',
    orderUpdated:       'Order updated',
    orderCreated:       'Service order created',
    orderDeleted:       'Order deleted',
    confirmDeleteOrder: 'Delete this order?',

    // Customers page
    customersTitle:    'Customers',
    addCustomer:       'Add Customer',
    searchCustomers:   'Search customers...',
    addCustomerTitle:  'Add Customer',
    editCustomerTitle: 'Edit Customer',
    // Table columns
    colName:       'Name',
    colPhone:      'Phone',
    colPlate:      'Plate',
    colOrders:     'Orders',
    colTotalSpent: 'Total Spent',
    colNotes:      'Notes',
    noCustomersFound: 'No customers found.',
    // Form labels
    fullNameLabel:      'Full Name *',
    phoneLabel:         'Phone',
    vehiclePlaceholder: 'e.g. Honda Civic 2022',
    licensePlateLabel:  'License Plate',
    // Toasts / alerts
    errNameRequired:       'Name is required.',
    customerUpdated:       'Customer updated',
    customerAdded:         'Customer added',
    customerDeleted:       'Customer removed',
    confirmDeleteCustomer: 'Delete this customer?',
    adminConfirmTitle:     'Admin Confirmation Required',
    adminConfirmDesc:      'This action is protected. Enter admin credentials to permanently delete this customer.',
    adminStockEditDesc:    'Editing the stock quantity is a protected action. Enter admin credentials to apply this change.',
    adminOrderEditDesc:    'Parts used in this fulfilled order have changed. Stock will be adjusted automatically. Enter admin credentials to save.',

    // Reports page
    reportsTitle:    'Reports & Export',
    exportSettings:  'Export Settings',
    exportAll:       'Export All Data',
    customRange:     'Custom Date Range',
    fromLabel:       'From',
    toLabel:         'To',
    exportExcel:     'Export to Excel (.xlsx)',
    exportHint:      'The Excel file includes 4 sheets: Spare Parts, Service Orders, Customers, and a Summary page.',
    previewAllTime:  'All Time',
    previewOrders:   'Orders',
    previewRevenue:  'Revenue',
    previewParts:    'Parts Revenue',
    previewLabor:    'Labor Revenue',
    revenueByStatus: 'Revenue by Order Status (฿)',

    // Multiple vehicles (customer form)
    vehicles:           'Vehicles',
    addVehicle:         'Add Vehicle',
    vehicleModelLabel:  'Vehicle',
    selectVehicle:      '— pick vehicle —',
    errVehicleRequired: 'Please add at least one vehicle.',

    // Fulfill parts (order actions)
    fulfillParts:       'Fulfill Parts',
    fulfillConfirm:     'Deduct parts used in this order from inventory? This cannot be undone.',
    fulfillSuccess:     'Parts deducted from inventory',
    alreadyFulfilled:   'Already fulfilled',
    completeJobTitle:   'Complete Job',
    completeJobDesc:    'This will mark the order as Completed and deduct the parts from stock. This cannot be undone.',
    completeAndDeduct:  'Complete & Deduct Parts',
    autoDeductSuccess:  'Job completed – parts deducted from inventory',
    colBooked:          'Booked',
    bookedTooltip:      'Reserved for active jobs (not yet deducted)',
    insufficientStockTitle:  'Insufficient Stock',
    insufficientStockDesc:   'The following parts do not have enough stock to complete this job:',
    insufficientStockFooter: 'Please restock the items above before completing this job.',
    insufficientStockNeed:   'Need',
    insufficientStockHave:   'In stock',

    // Stock Log
    stockLog:           'Stock Log',
    stockLogTitle:      'Stock Log',
    logIn:              'IN',
    logOut:             'OUT',
    logColDate:         'Date / Time',
    logColType:         'Type',
    logColQty:          'Change',
    logColBefore:       'Before',
    logColAfter:        'After',
    logColReason:       'Reason',
    noLogEntries:       'No log entries yet.',
    logReasonInitial:   'Initial stock',
    logReasonAdjusted:  'Manual adjustment',
    logReasonRestock:   'Restock',
    logReasonOrder:     'Order fulfilled',
    logReasonOrderEdit: 'Order edit',
    close:              'Close',

    // Stock History page
    stockHistoryTitle:   'Stock Movement History',
    searchStockHistory:  'Search by part name, SKU, or reason…',
    save:   'Save',
    cancel: 'Cancel',
  },

  th: {
    // App shell
    appSub:        'ระบบจัดการอู่',
    appTagline:    'ระบบจัดการอู่ซ่อมรถ',
    dataInBrowser: 'ข้อมูลบันทึกในเบราว์เซอร์',
    signOut:       'ออกจากระบบ',

    // Login
    userId:           'ชื่อผู้ใช้',
    password:         'รหัสผ่าน',
    enterUserId:      'ใส่ชื่อผู้ใช้',
    enterPassword:    'ใส่รหัสผ่าน',
    signIn:           'เข้าสู่ระบบ',
    errBothRequired:  'กรุณาใส่ชื่อผู้ใช้และรหัสผ่าน',
    errInvalidCreds:  'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',

    // Navigation
    dashboard:    'แดชบอร์ด',
    parts:        'อะไหล่',
    orders:       'ใบสั่งซ่อม',
    customers:    'ลูกค้า',
    reports:      'รายงาน',
    stockHistory: 'ประวัติสต็อก',

    // Dashboard
    totalRevenue:    'รายได้รวม',
    completedJobs:   'งานที่เสร็จแล้ว',
    inventoryValue:  'มูลค่าอะไหล่',
    lowStockAlerts:  'อะไหล่ใกล้หมด',
    pendingCount:    'รอดำเนินการ',
    itemsTracked:    'รายการ',
    itemsBelow:      'รายการต่ำกว่าจุดสั่งซื้อ',
    revenueLastDays: 'รายได้ 7 วันล่าสุด (฿)',
    stockByCategory: 'สินค้าแยกตามหมวดหมู่',
    // Dashboard table cols
    skuCol:       'รหัสสินค้า',
    partNameCol:  'ชื่ออะไหล่',
    onHandCol:    'คงเหลือ',
    reorderLvlCol:'จุดสั่งซื้อ',

    // Parts page
    spareParts:    'คลังอะไหล่',
    addPart:       'เพิ่มอะไหล่',
    searchParts:   'ค้นหาอะไหล่...',
    addNewPart:    'เพิ่มอะไหล่ใหม่',
    editPart:      'แก้ไขอะไหล่',
    // Form labels
    skuLabel:          'รหัสสินค้า *',
    partNameLabel:     'ชื่ออะไหล่ *',
    categoryLabel:     'หมวดหมู่',
    unitLabel:         'หน่วย',
    costLabel:         'ต้นทุน (฿)',
    priceLabel:        'ราคาขาย (฿)',
    qtyLabel:          'จำนวน',
    reorderLevelLabel: 'จุดสั่งซื้อ',
    unitPlaceholder:   'ชิ้น, ชุด, ขวด',
    catPlaceholder:    'เช่น กรองน้ำมัน',
    // Table columns
    colSku:      'รหัส',
    colPartName: 'ชื่ออะไหล่',
    colCategory: 'หมวดหมู่',
    colUnit:     'หน่วย',
    colCost:     'ต้นทุน',
    colPrice:    'ราคาขาย',
    colMargin:   'กำไร',
    colQty:      'จำนวน',
    colStatus:   'สถานะ',
    colActions:  'จัดการ',
    noPartsFound:      'ไม่พบอะไหล่',
    skuRequired:       'กรุณากรอกรหัสสินค้าและชื่ออะไหล่',
    partUpdated:       'อัปเดตอะไหล่แล้ว',
    partAdded:         'เพิ่มอะไหล่เรียบร้อย',
    partDeleted:       'ลบอะไหล่แล้ว',
    confirmDeletePart: 'ลบอะไหล่นี้? ไม่สามารถกู้คืนได้',
    restockBtn:              'รับเข้าสต็อก',
    restockTitle:            'รับเข้าสต็อก',
    restockPartLabel:        'เลือกอะไหล่',
    restockQtyLabel:         'จำนวนที่รับเข้า',
    restockCostLabel:        'ต้นทุนต่อหน่วย',
    restockCostHint:         'หากไม่กรอกจะใช้ต้นทุนเดิม หากต้นทุนต่างออกไปจะคำนวณต้นทุนถัวเฉลี่ยให้อัตโนมัติ',
    restockConfirm:          'ยืนยันรับเข้า',
    restockSuccess:          'รับเข้าสต็อกเรียบร้อย',
    duplicateSkuTitle:       'พบรหัส SKU ซ้ำ',
    duplicateSkuDesc:        'มีอะไหล่รหัส SKU นี้อยู่ในคลังสินค้าแล้ว:',
    duplicateRestockInstead: 'รับเข้าสต็อกของเดิม',
    duplicateSaveNew:        'บันทึกเป็นรายการแยก',
    all:               'ทั้งหมด',
    badgeLow:    'ใกล้หมด',
    badgeOk:     'ปกติ',
    badgeReorder:'สั่งซื้อ',

    // Orders page
    serviceOrders: 'ใบสั่งซ่อม',
    newOrder:      'ใบสั่งซ่อมใหม่',
    searchOrders:  'ค้นหาใบสั่งซ่อม...',
    newServiceOrder: 'ใบสั่งซ่อมใหม่',
    editOrder:       'แก้ไขใบสั่งซ่อม',
    // Table columns
    colDate:          'วันที่',
    colCreatedDate:   'วันที่สร้าง',
    colCompletedDate: 'วันที่ปิดงาน',
    completedOn:      'ปิดงาน',
    colCustomer: 'ลูกค้า',
    colVehicle:  'รถ',
    colService:  'รายการซ่อม',
    colParts:    'อะไหล่',
    colLabor:    'ค่าแรง',
    colTotal:    'รวม',
    noOrdersFound: 'ไม่พบใบสั่งซ่อม',
    // Form labels
    dateLabel:             'วันที่',
    customerLabel:         'ลูกค้า',
    vehicleLabel:          'รถ',
    plateLabel:            'ทะเบียน',
    serviceDescLabel:      'รายละเอียดการซ่อม',
    serviceDescPlaceholder:'เช่น เปลี่ยนน้ำมัน, ซ่อมเบรค',
    partsUsedSection:      'อะไหล่ที่ใช้',
    addPartLine:           'เพิ่มอะไหล่',
    laborLabel:            'ค่าแรง (฿)',
    discountLabel:         'ส่วนลด (฿)',
    statusLabel:           'สถานะ',
    notesLabel:            'หมายเหตุ',
    orderTotalLabel:       'ยอดรวม',
    saveOrder:             'บันทึกใบสั่งซ่อม',
    selectCustomer:        '— เลือกลูกค้า —',
    selectPart:            '— เลือกอะไหล่ —',
    availText:             'คงเหลือ',
    // Filters
    filterAll:         'ทั้งหมด',
    filterPending:     'รอดำเนินการ',
    filterInProgress:  'กำลังซ่อม',
    filterCompleted:   'เสร็จแล้ว',
    // Status display
    statusPending:     'รอดำเนินการ',
    statusInProgress:  'กำลังซ่อม',
    statusCompleted:   'เสร็จแล้ว',
    // Toasts / alerts
    errSelectCustomer:  'กรุณาเลือกลูกค้า',
    errServiceRequired: 'กรุณาใส่รายละเอียดการซ่อม',
    orderUpdated:       'อัปเดตใบสั่งซ่อมแล้ว',
    orderCreated:       'สร้างใบสั่งซ่อมเรียบร้อย',
    orderDeleted:       'ลบใบสั่งซ่อมแล้ว',
    confirmDeleteOrder: 'ลบใบสั่งซ่อมนี้?',

    // Customers page
    customersTitle:    'ลูกค้า',
    addCustomer:       'เพิ่มลูกค้า',
    searchCustomers:   'ค้นหาลูกค้า...',
    addCustomerTitle:  'เพิ่มลูกค้า',
    editCustomerTitle: 'แก้ไขข้อมูลลูกค้า',
    // Table columns
    colName:       'ชื่อ',
    colPhone:      'โทรศัพท์',
    colPlate:      'ทะเบียน',
    colOrders:     'ใบสั่งซ่อม',
    colTotalSpent: 'ยอดรวม',
    colNotes:      'หมายเหตุ',
    noCustomersFound: 'ไม่พบลูกค้า',
    // Form labels
    fullNameLabel:      'ชื่อ-นามสกุล *',
    phoneLabel:         'โทรศัพท์',
    vehiclePlaceholder: 'เช่น Honda Civic 2022',
    licensePlateLabel:  'ทะเบียนรถ',
    // Toasts / alerts
    errNameRequired:       'กรุณาใส่ชื่อ',
    customerUpdated:       'อัปเดตข้อมูลลูกค้าแล้ว',
    customerAdded:         'เพิ่มลูกค้าเรียบร้อย',
    customerDeleted:       'ลบลูกค้าแล้ว',
    confirmDeleteCustomer: 'ลบลูกค้านี้?',
    adminConfirmTitle:     'ต้องการยืนยันจากผู้ดูแล',
    adminConfirmDesc:      'การดำเนินการนี้ต้องได้รับการยืนยัน กรุณาใส่ข้อมูลผู้ดูแลเพื่อลบลูกค้าถาวร',
    adminStockEditDesc:    'การแก้ไขจำนวนสต็อกต้องได้รับการยืนยัน กรุณาใส่ข้อมูลผู้ดูแลเพื่อดำเนินการ',
    adminOrderEditDesc:    'รายการอะไหล่ในใบสั่งซ่อมที่ตัดสต็อกแล้วมีการเปลี่ยนแปลง ระบบจะปรับยอดสต็อกอัตโนมัติ กรุณาใส่ข้อมูลผู้ดูแลเพื่อบันทึก',

    // Reports page
    reportsTitle:    'รายงาน & ส่งออก',
    exportSettings:  'ตั้งค่าการส่งออก',
    exportAll:       'ส่งออกข้อมูลทั้งหมด',
    customRange:     'กำหนดช่วงวันที่',
    fromLabel:       'จาก',
    toLabel:         'ถึง',
    exportExcel:     'ส่งออกเป็น Excel (.xlsx)',
    exportHint:      'ไฟล์ Excel มี 4 ชีท: อะไหล่, ใบสั่งซ่อม, ลูกค้า และหน้าสรุป',
    previewAllTime:  'ข้อมูลทั้งหมด',
    previewOrders:   'ใบสั่งซ่อม',
    previewRevenue:  'รายได้',
    previewParts:    'รายได้อะไหล่',
    previewLabor:    'ค่าแรง',
    revenueByStatus: 'รายได้แยกตามสถานะ (฿)',

    // Multiple vehicles (customer form)
    vehicles:           'รถ',
    addVehicle:         'เพิ่มรถ',
    vehicleModelLabel:  'รุ่นรถ',
    selectVehicle:      '— เลือกรถ —',
    errVehicleRequired: 'กรุณาเพิ่มรถอย่างน้อย 1 คัน',

    // Fulfill parts (order actions)
    fulfillParts:       'ตัดสต็อก',
    fulfillConfirm:     'ตัดสต็อกอะไหล่ที่ใช้ในใบสั่งซ่อมนี้? ไม่สามารถกู้คืนได้',
    fulfillSuccess:     'ตัดสต็อกเรียบร้อย',
    alreadyFulfilled:   'ตัดสต็อกแล้ว',
    completeJobTitle:   'ปิดงาน',
    completeJobDesc:    'ยืนยันปิดงานและตัดสต็อกอะไหล่ที่ใช้ในใบสั่งซ่อม ไม่สามารถกู้คืนได้',
    completeAndDeduct:  'ปิดงานและตัดสต็อก',
    autoDeductSuccess:  'ปิดงานสำเร็จ – ตัดสต็อกเรียบร้อย',
    colBooked:          'จอง',
    bookedTooltip:      'จองสำหรับงานที่ยังไม่ตัดสต็อก',
    insufficientStockTitle:  'สต็อกไม่เพียงพอ',
    insufficientStockDesc:   'อะไหล่ต่อไปนี้มีในสต็อกไม่เพียงพอสำหรับปิดงานนี้:',
    insufficientStockFooter: 'กรุณาเติมสต็อกอะไหล่ด้านบนก่อนทำการปิดงาน',
    insufficientStockNeed:   'ต้องการ',
    insufficientStockHave:   'มีในสต็อก',

    // Stock Log
    stockLog:           'ประวัติสต็อก',
    stockLogTitle:      'ประวัติสต็อก',
    logIn:              'รับเข้า',
    logOut:             'เบิกออก',
    logColDate:         'วัน / เวลา',
    logColType:         'ประเภท',
    logColQty:          'เปลี่ยนแปลง',
    logColBefore:       'ก่อน',
    logColAfter:        'หลัง',
    logColReason:       'เหตุผล',
    noLogEntries:       'ยังไม่มีประวัติสต็อก',
    logReasonInitial:   'สต็อกเริ่มต้น',
    logReasonAdjusted:  'ปรับยอดด้วยตนเอง',
    logReasonRestock:   'รับเข้าสต็อก',
    logReasonOrder:     'ตัดสต็อกจากใบสั่งซ่อม',
    logReasonOrderEdit: 'แก้ไขใบสั่งซ่อม',
    close:              'ปิด',

    // Stock History page
    stockHistoryTitle:   'ประวัติการเคลื่อนไหวสต็อก',
    searchStockHistory:  'ค้นหาตามชื่ออะไหล่ รหัส หรือเหตุผล…',
    save:   'บันทึก',
    cancel: 'ยกเลิก',
  },
};

/** Returns current language code ('en' or 'th') */
function getLang() {
  return localStorage.getItem('ars_lang') || 'en';
}

/** Returns translated string for key in the current language */
function t(key) {
  const lang = getLang();
  return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS.en[key] || key;
}

/** Translates a stored order-status value ('pending' etc.) to display text */
function tStatus(status) {
  const map = {
    'pending':     'statusPending',
    'in-progress': 'statusInProgress',
    'completed':   'statusCompleted',
  };
  return t(map[status] || status);
}

/** Syncs lang-toggle button active states + translatable static shell text */
function updateLangUI() {
  const lang = getLang();

  // Sidebar lang buttons
  const enBtn = document.getElementById('lb-en');
  const thBtn = document.getElementById('lb-th');
  if (enBtn) enBtn.classList.toggle('active', lang === 'en');
  if (thBtn) thBtn.classList.toggle('active', lang === 'th');

  // Sidebar brand subtitle
  const brandSub = document.getElementById('brand-sub');
  if (brandSub) brandSub.textContent = t('appSub');

  // Sidebar footer data note
  const note = document.getElementById('sidebar-data-note');
  if (note) note.textContent = t('dataInBrowser');
}

/**
 * setLang(lang)
 * Saves the chosen language and re-renders the current view.
 */
function setLang(lang) {
  localStorage.setItem('ars_lang', lang);
  updateLangUI();

  if (document.getElementById('login-screen')) {
    // On login screen — rebuild it in the new language
    if (typeof showLoginScreen === 'function') showLoginScreen();
  } else {
    // Inside the app — re-render nav + current page
    if (typeof renderNav === 'function') renderNav();
    if (typeof PAGE_RENDERERS !== 'undefined' && typeof State !== 'undefined') {
      const renderer = PAGE_RENDERERS[State.page];
      if (renderer) renderer();
    }
  }
}
