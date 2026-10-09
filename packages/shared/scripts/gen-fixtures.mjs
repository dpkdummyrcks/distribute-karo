#!/usr/bin/env node
// Generates packages/shared/fixtures/*.json — shapes follow docs/LLD.md §6.2.
// One dataset → every fixture, so totals, counts and stock balances always agree.
// Run: node packages/shared/scripts/gen-fixtures.mjs
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const BASE = 'https://app.distributekaro.in';

// ---------- helpers
let seq = 0;
const uuid = () => {
  seq += 1;
  const h = seq.toString(16).padStart(12, '0');
  return `0199c4e2-${h.slice(-4)}-7${h.slice(-3)}-8${h.slice(-3)}-${h}`;
};
/** IST wall-clock → UTC ISO string. day 0 = 2026-10-08 */
const ist = (dayOffset, hh, mm) => new Date(Date.UTC(2026, 9, 8 + dayOffset, hh, mm) - 330 * 60_000).toISOString();
/** LLD §2.2: linePaise = (ratePaise × qtyMilli + 500) / 1000, integer division */
const qtyMilli = (q) => {
  const [i, f = ''] = q.split('.');
  return BigInt(i) * 1000n + BigInt((f + '000').slice(0, 3));
};
const linePaise = (rate, q) => Number((BigInt(rate) * qtyMilli(q) + 500n) / 1000n);
const fmtQty = (milli) => {
  const neg = milli < 0n;
  const a = neg ? -milli : milli;
  const s = `${a / 1000n}.${(a % 1000n).toString().padStart(3, '0')}`.replace(/\.?0+$/, '');
  return (neg ? '-' : '') + (s === '' ? '0' : s);
};
const media = (kind) => `${BASE}/media/img/${kind}/${uuid()}.webp?X-Amz-Expires=7200&X-Amz-Signature=…`;
const page = (data, nextCursor = null) => ({ data, nextCursor });
const write = (name, obj) => writeFileSync(join(OUT, `${name}.json`), JSON.stringify(obj, null, 2) + '\n');

// ---------- distributor
const distributorId = uuid();
const slug = 'bT7kQ9xZr2Mw';
const distributorMe = {
  id: distributorId,
  publicSlug: slug,
  qrUrl: `${BASE}/d/${slug}`,
  businessName: 'Shree Balaji Traders',
  ownerName: 'Ramesh Agarwal',
  phone: '+919812345678',
  email: 'orders@shreebalaji.example',
  address: '42, Kishanpole Bazar, Jaipur, Rajasthan 302001',
  gstin: '08AAKCS1234F1Z5',
  logoUrl: null,
  status: 'ACTIVE',
  createdAt: ist(-120, 11, 0),
};
const publicDistributor = { businessName: distributorMe.businessName, logoUrl: distributorMe.logoUrl };

// ---------- items  [name, sku, unit, ratePaise, stock, threshold, category, active, hasImage, description]
const itemRows = [
  [
    'Aashirvaad Shudh Chakki Atta 10 kg',
    'ASH-ATTA-10',
    'PACK',
    46500,
    '120',
    '20',
    'Staples',
    true,
    true,
    'Whole wheat atta, 10 kg bag',
  ],
  ['Tata Salt 1 kg (case of 25)', 'TATA-SALT-25', 'CASE', 60000, '40', '10', 'Staples', true, true, null],
  ['Sugar (loose)', null, 'KG', 4250, '850.5', '100', 'Staples', true, false, 'S-30 grade, sold per kg'],
  ['Fortune Sunflower Oil', 'FOR-SUN-L', 'L', 15500, '320', '50', 'Edible Oil', true, true, 'Refined, sold per litre'],
  ['Toor Dal', null, 'KG', 13800, '6.5', '50', 'Pulses', true, false, 'Premium unpolished'],
  ['Basmati Rice (loose)', null, 'KG', 9600, '0', '50', 'Staples', true, false, null],
  ['Parle-G 80 g (box of 48)', 'PARLE-G-48', 'BOX', 48000, '64', '10', 'Biscuits', true, true, null],
  ['Britannia Good Day Cashew 200 g', 'BRIT-GD-200', 'PCS', 4000, '600', '50', 'Biscuits', true, true, null],
  [
    'Maggi 2-Minute Noodles 70 g',
    'MAGGI-70-DZ',
    'DOZEN',
    16800,
    '85',
    '10',
    'Instant Food',
    true,
    true,
    'Sold per dozen',
  ],
  ['Amul Butter 500 g', 'AMUL-BTR-500', 'PCS', 27500, '48', '50', 'Dairy', true, true, null],
  ['Amul Taaza Toned Milk', 'AMUL-TAAZA', 'L', 5400, '200', '40', 'Dairy', true, false, null],
  ['Surf Excel Easy Wash 1 kg', 'SURF-EW-1', 'PCS', 14000, '150', '20', 'Home Care', true, true, null],
  ['Vim Dishwash Bar 200 g (pack of 4)', 'VIM-BAR-4', 'PACK', 8800, '9', '20', 'Home Care', true, true, null],
  ['Colgate Strong Teeth 200 g', 'COL-ST-200', 'PCS', 11000, '230', '30', 'Personal Care', true, true, null],
  [
    'Dettol Original Soap 125 g (pack of 4)',
    'DET-SOAP-4',
    'PACK',
    22000,
    '75',
    '15',
    'Personal Care',
    true,
    true,
    null,
  ],
  ['Red Label Tea 1 kg', 'RL-TEA-1', 'PCS', 52000, '60', '10', 'Beverages', true, true, null],
  ['Bru Instant Coffee 200 g', 'BRU-200', 'PCS', 38500, '0', '10', 'Beverages', true, true, null],
  ["Haldiram's Aloo Bhujia 1 kg", 'HAL-BHU-1', 'PCS', 26000, '44', '10', 'Snacks', true, true, null],
  ['Everest Garam Masala 100 g', 'EVR-GM-100', 'PCS', 8200, '300', '30', 'Spices', false, true, 'Seasonal — paused'],
  ['Haldi Powder (loose)', null, 'G', 30, '25000', '5000', 'Spices', true, false, 'Sold per gram'],
];
const stockStatus = (stock, thr) =>
  qtyMilli(stock) === 0n ? 'OUT' : qtyMilli(thr) > 0n && qtyMilli(stock) <= qtyMilli(thr) ? 'LOW' : 'IN_STOCK';
const items = itemRows.map(
  ([name, sku, unit, ratePaise, stockQty, lowStockThreshold, category, isActive, img, description], i) => ({
    id: uuid(),
    name,
    sku,
    unit,
    ratePaise,
    stockQty,
    lowStockThreshold,
    stockStatus: stockStatus(stockQty, lowStockThreshold),
    category,
    description,
    imageUrl: img ? media('item') : null,
    isActive,
    createdAt: ist(-110 + i, 12, 0),
    updatedAt: ist(-(i % 6), 9, 30),
  }),
);
const I = Object.fromEntries(items.map((it, i) => [i + 1, it])); // 1-based like itemRows
const categories = [...new Set(items.map((i) => i.category).filter(Boolean))].sort();

// ---------- retailers
const retailerRows = [
  [
    'Rakesh Sharma',
    'Sharma General Store',
    '+919828011111',
    'Shop 4, Malviya Nagar Main Rd, Jaipur',
    26.853,
    75.805,
    'Malviya Nagar',
    true,
    'MANUAL',
    -0,
  ],
  [
    'Sunita Gupta',
    'Gupta Kirana',
    '+919828022222',
    'B-12, Vaishali Nagar, Jaipur',
    26.9115,
    75.7432,
    'Vaishali Nagar',
    true,
    'MANUAL',
    -0,
  ],
  [
    'Amit Jain',
    'Jain Provision Store',
    '+919828033333',
    'Raja Park Market, Jaipur',
    26.8925,
    75.8275,
    'Raja Park',
    true,
    'MANUAL',
    -0,
  ],
  [
    'Imran Khan',
    'New Bharat Mart',
    '+919828044444',
    'Sector 3, Mansarovar, Jaipur',
    26.8697,
    75.7633,
    'Mansarovar',
    true,
    'MANUAL',
    -0,
  ],
  [
    'Mohan Lal Meena',
    'Shiv Shakti Traders',
    '+919828055555',
    'Near Bus Stand, Sanganer, Jaipur',
    26.8217,
    75.7926,
    'Sanganer',
    false,
    'MANUAL',
    null,
  ],
  [
    'Pooja Verma',
    'Om Sai Kirana',
    '+919828066666',
    'Jagatpura Phatak, Jaipur',
    26.8315,
    75.8655,
    'Jagatpura',
    true,
    'ACCESS_REQUEST',
    -0,
  ],
];
const retailers = retailerRows.map(([name, shopName, phone, address, lat, lng, label, isActive, source], i) => ({
  id: uuid(),
  name,
  shopName,
  phone,
  email: null,
  address,
  shopPhotoUrl: i < 3 ? media('shop') : null,
  location: { lat, lng, label },
  isActive,
  source,
  lastOrderAt: null, // filled from orders below
  createdAt: ist(-100 + i * 9, 15, 0),
  updatedAt: ist(-3, 15, 0),
}));
const R = Object.fromEntries(retailers.map((r, i) => [i + 1, r]));

// ---------- orders  lines: [itemNo, requested, accepted|null, lineNote|null]
const orderDefs = [
  {
    no: 1040,
    r: 1,
    status: 'PENDING',
    at: [0, 10, 42],
    note: 'Please send before 5 PM',
    newDevice: false,
    lines: [
      [1, '5', null],
      [3, '25.5', null],
      [5, '50', null],
      [9, '4', null],
      [10, '10', null],
    ],
  },
  {
    no: 1039,
    r: 4,
    status: 'PENDING',
    at: [0, 9, 15],
    note: null,
    newDevice: true,
    lines: [
      [2, '2', null],
      [4, '30', null],
      [7, '3', null],
      [12, '12', null],
    ],
  },
  {
    no: 1038,
    r: 2,
    status: 'PARTIALLY_ACCEPTED',
    at: [0, 8, 5],
    decided: [0, 8, 40],
    note: null,
    lines: [
      [5, '40', '37', 'Only 37 kg available today'],
      [1, '10', '10'],
      [17, '6', '0', 'Out of stock — expected next week'],
    ],
  },
  {
    no: 1037,
    r: 3,
    status: 'ACCEPTED',
    at: [0, 7, 30],
    decided: [0, 7, 55],
    note: null,
    lines: [
      [16, '4', '4'],
      [14, '24', '24'],
      [15, '6', '6'],
    ],
  },
  {
    no: 1036,
    r: 6,
    status: 'ACCEPTED',
    at: [-1, 17, 10],
    decided: [-1, 18, 0],
    note: 'First order 🙏',
    lines: [
      [8, '48', '48'],
      [13, '10', '10'],
    ],
  },
  {
    no: 1035,
    r: 1,
    status: 'DISPATCHED',
    via: 'PARTIALLY_ACCEPTED',
    at: [-1, 11, 20],
    decided: [-1, 12, 5],
    dispatched: [-1, 16, 30],
    note: null,
    lines: [
      [5, '75', '75'],
      [3, '50', '40', '40 kg now, rest on Friday'],
      [11, '20', '20'],
    ],
  },
  {
    no: 1034,
    r: 2,
    status: 'DELIVERED',
    via: 'ACCEPTED',
    at: [-2, 10, 0],
    decided: [-2, 10, 30],
    dispatched: [-2, 14, 0],
    delivered: [-2, 18, 15],
    note: null,
    lines: [
      [1, '8', '8'],
      [4, '20', '20'],
      [20, '500', '500'],
    ],
  },
  {
    no: 1033,
    r: 4,
    status: 'REJECTED',
    at: [-2, 20, 45],
    decided: [-2, 21, 0],
    reason: "We don't deliver to Mansarovar on Sundays. Please reorder on Monday.",
    note: null,
    lines: [
      [18, '10', '0'],
      [9, '6', '0'],
    ],
  },
  {
    no: 1032,
    r: 3,
    status: 'DELIVERED',
    via: 'PARTIALLY_ACCEPTED',
    at: [-3, 9, 0],
    decided: [-3, 9, 40],
    dispatched: [-3, 13, 0],
    delivered: [-3, 17, 30],
    note: null,
    lines: [
      [10, '20', '12', 'Only 12 left'],
      [12, '6', '6'],
    ],
  },
  {
    no: 1031,
    r: 1,
    status: 'CANCELLED',
    at: [-4, 12, 0],
    cancelled: [-4, 12, 20],
    note: null,
    lines: [
      [7, '2', null],
      [8, '24', null],
    ],
  },
];

const actions = {
  PENDING: ['ACCEPT', 'REJECT'],
  ACCEPTED: ['DISPATCH'],
  PARTIALLY_ACCEPTED: ['DISPATCH'],
  DISPATCHED: ['DELIVER'],
  DELIVERED: [],
  REJECTED: [],
  CANCELLED: [],
};
const retailerActions = { PENDING: ['CANCEL'] };

const orders = orderDefs.map((d) => {
  const id = uuid();
  const createdAt = ist(...d.at);
  const lines = d.lines.map(([itemNo, req, acc, lineNote = null]) => {
    const it = I[itemNo];
    return {
      id: uuid(),
      itemId: it.id,
      name: it.name,
      unit: it.unit,
      ratePaise: it.ratePaise,
      requestedQty: req,
      acceptedQty: acc,
      requestedPaise: linePaise(it.ratePaise, req),
      acceptedPaise: acc === null ? null : linePaise(it.ratePaise, acc),
      lineNote,
      ...(d.status === 'PENDING' ? { availableStockQty: it.stockQty } : {}),
    };
  });
  const decidedTo = d.via ?? d.status;
  const events = [
    { id: uuid(), fromStatus: null, toStatus: 'PENDING', actorType: 'RETAILER', note: d.note, createdAt },
  ];
  if (d.decided)
    events.push({
      id: uuid(),
      fromStatus: 'PENDING',
      toStatus: decidedTo,
      actorType: 'DISTRIBUTOR',
      note: d.reason ?? null,
      createdAt: ist(...d.decided),
    });
  if (d.cancelled)
    events.push({
      id: uuid(),
      fromStatus: 'PENDING',
      toStatus: 'CANCELLED',
      actorType: 'RETAILER',
      note: null,
      createdAt: ist(...d.cancelled),
    });
  if (d.dispatched)
    events.push({
      id: uuid(),
      fromStatus: decidedTo,
      toStatus: 'DISPATCHED',
      actorType: 'DISTRIBUTOR',
      note: null,
      createdAt: ist(...d.dispatched),
    });
  if (d.delivered)
    events.push({
      id: uuid(),
      fromStatus: 'DISPATCHED',
      toStatus: 'DELIVERED',
      actorType: 'DISTRIBUTOR',
      note: null,
      createdAt: ist(...d.delivered),
    });
  const decided = lines.every((l) => l.acceptedQty !== null);
  const r = R[d.r];
  return {
    id,
    orderNo: d.no,
    status: d.status,
    retailerRef: r,
    lineCount: lines.length,
    totalRequestedPaise: lines.reduce((s, l) => s + l.requestedPaise, 0),
    totalAcceptedPaise: decided ? lines.reduce((s, l) => s + l.acceptedPaise, 0) : null,
    newDevice: d.newDevice ?? false,
    createdAt,
    updatedAt: events.at(-1).createdAt,
    note: d.note,
    rejectionReason: d.reason ?? null,
    lines,
    events,
    decidedAt: d.decided ? ist(...d.decided) : null,
  };
});
for (const o of orders) {
  const r = o.retailerRef;
  if (!r.lastOrderAt || o.createdAt > r.lastOrderAt) r.lastOrderAt = o.createdAt;
}

const dSummary = (o) => ({
  id: o.id,
  orderNo: o.orderNo,
  status: o.status,
  retailer: {
    id: o.retailerRef.id,
    name: o.retailerRef.name,
    shopName: o.retailerRef.shopName,
    locationLabel: o.retailerRef.location.label,
  },
  lineCount: o.lineCount,
  totalRequestedPaise: o.totalRequestedPaise,
  totalAcceptedPaise: o.totalAcceptedPaise,
  newDevice: o.newDevice,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
});
const dDetail = (o) => ({
  ...dSummary(o),
  note: o.note,
  rejectionReason: o.rejectionReason,
  lines: o.lines,
  events: o.events,
  allowedActions: actions[o.status],
});
const rSummary = (o) => ({
  id: o.id,
  orderNo: o.orderNo,
  status: o.status,
  distributor: { businessName: distributorMe.businessName },
  lineCount: o.lineCount,
  totalRequestedPaise: o.totalRequestedPaise,
  totalAcceptedPaise: o.totalAcceptedPaise,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
});
const rDetail = (o) => ({
  ...rSummary(o),
  note: o.note,
  rejectionReason: o.rejectionReason,
  lines: o.lines.map(({ availableStockQty, ...l }) => l),
  events: o.events,
  allowedActions: retailerActions[o.status] ?? [],
});
const byNo = Object.fromEntries(orders.map((o) => [o.orderNo, o]));

// ---------- counts & dashboard
const statuses = ['PENDING', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'CANCELLED', 'DISPATCHED', 'DELIVERED'];
const orderCounts = Object.fromEntries(statuses.map((s) => [s, orders.filter((o) => o.status === s).length]));

// ---------- access requests & enquiries
const accessRequests = [
  {
    id: uuid(),
    phone: '+919828077777',
    name: 'Deepak Saini',
    shopName: 'Saini Kirana & General',
    address: 'Plot 18, Pratap Nagar, Jaipur',
    locationLabel: 'Pratap Nagar',
    status: 'PENDING',
    retailerId: null,
    decisionNote: null,
    createdAt: ist(0, 9, 50),
    decidedAt: null,
  },
  {
    id: uuid(),
    phone: '+919828088888',
    name: 'Farhan Qureshi',
    shopName: 'Qureshi Super Store',
    address: null,
    locationLabel: 'Ramganj',
    status: 'PENDING',
    retailerId: null,
    decisionNote: null,
    createdAt: ist(-1, 19, 5),
    decidedAt: null,
  },
  {
    id: uuid(),
    phone: R[6].phone,
    name: R[6].name,
    shopName: R[6].shopName,
    address: R[6].address,
    locationLabel: 'Jagatpura',
    status: 'APPROVED',
    retailerId: R[6].id,
    decisionNote: null,
    createdAt: ist(-6, 13, 0),
    decidedAt: ist(-5, 10, 0),
  },
];
const enquiries = [
  {
    id: uuid(),
    phone: '+919828099999',
    name: 'Kavita Joshi',
    message: 'Do you supply Patanjali products? I run a small store in Sodala.',
    status: 'NEW',
    createdAt: ist(0, 8, 20),
  },
  {
    id: uuid(),
    phone: '+919829010101',
    name: 'Suresh Yadav',
    message: 'What is the minimum order for delivery to Bagru?',
    status: 'NEW',
    createdAt: ist(-1, 16, 45),
  },
  {
    id: uuid(),
    phone: '+919829020202',
    name: 'Anil Mathur',
    message: 'Do you give credit to new shops?',
    status: 'READ',
    createdAt: ist(-3, 11, 10),
  },
];
const inboxCounts = {
  orders: orderCounts,
  accessRequestsPending: accessRequests.filter((a) => a.status === 'PENDING').length,
  enquiriesNew: enquiries.filter((e) => e.status === 'NEW').length,
};

const isToday = (iso) => iso >= ist(0, 0, 0) && iso < ist(1, 0, 0);
const soldIn = (from) =>
  orders
    .filter((o) => o.decidedAt && o.decidedAt >= from && o.totalAcceptedPaise)
    .reduce((s, o) => s + o.totalAcceptedPaise, 0);
const todays = orders.filter((o) => isToday(o.createdAt));
const dashboard = {
  today: {
    orderCount: todays.length,
    requestedPaise: todays.reduce((s, o) => s + o.totalRequestedPaise, 0),
    acceptedPaise: todays.reduce((s, o) => s + (o.totalAcceptedPaise ?? 0), 0),
  },
  counts: inboxCounts,
  sales: { todaySoldPaise: soldIn(ist(0, 0, 0)), last7dSoldPaise: soldIn(ist(-7, 0, 0)) },
  lowStockItems: items.filter((i) => i.isActive && i.stockStatus !== 'IN_STOCK').slice(0, 10),
  recentOrders: orders.slice(0, 5).map(dSummary),
  setup: { hasProfile: true, itemCount: items.length, retailerCount: retailers.length, qrShared: true },
};
const dashboardNew = {
  today: { orderCount: 0, requestedPaise: 0, acceptedPaise: 0 },
  counts: { orders: Object.fromEntries(statuses.map((s) => [s, 0])), accessRequestsPending: 0, enquiriesNew: 0 },
  sales: { todaySoldPaise: 0, last7dSoldPaise: 0 },
  lowStockItems: [],
  recentOrders: [],
  setup: { hasProfile: true, itemCount: 0, retailerCount: 0, qrShared: false },
};

// ---------- stock movements for Toor Dal (item 5): replay oldest → newest, ends at 6.5
const toor = I[5];
const mv = [
  ['OPENING', '150', -40, null, null],
  ['SALE', '-50', -30, 1028, R[1]],
  ['SALE', '-40', -20, 1030, R[3]],
  ['RESTOCK', '60', -12, null, null, 'Received from Agarwal Mills, bill #A-5521'],
  ['SALE', '-75', -1, 1035, R[1]],
  ['ADJUSTMENT', '-1.5', -1, null, null, 'Damaged — bag torn in storage'],
  ['SALE', '-37', 0, 1038, R[2]],
];
let bal = 0n;
const movements = mv
  .map(([type, delta, day, orderNo, r, reason = null], i) => {
    bal += qtyMilli(delta.replace('-', '')) * (delta.startsWith('-') ? -1n : 1n);
    const o = orderNo ? byNo[orderNo] : null;
    return {
      id: uuid(),
      type,
      deltaQty: delta,
      balanceAfter: fmtQty(bal),
      amountPaise: type === 'SALE' ? linePaise(toor.ratePaise, delta.slice(1)) : null,
      order: orderNo ? { id: o?.id ?? uuid(), orderNo, retailerName: r.shopName } : null,
      reason,
      createdAt: ist(day, 9 + i, 15),
    };
  })
  .reverse();
if (fmtQty(bal) !== toor.stockQty) throw new Error(`ledger ${fmtQty(bal)} ≠ stock ${toor.stockQty}`);

// ---------- stock report (last 30 days)
const soldQtyByItem = {
  1: '64',
  2: '18',
  3: '412.5',
  4: '260',
  5: '202',
  6: '180',
  7: '41',
  8: '330',
  9: '52',
  10: '61',
  11: '140',
  12: '96',
  13: '38',
  14: '120',
  15: '33',
  16: '27',
  17: '14',
  18: '22',
  19: '0',
  20: '7500',
};
const reportRows = items
  .map((it, i) => {
    const sold = soldQtyByItem[i + 1];
    return {
      item: {
        id: it.id,
        name: it.name,
        unit: it.unit,
        imageUrl: it.imageUrl,
        category: it.category,
        stockStatus: it.stockStatus,
      },
      soldQty: sold,
      soldPaise: linePaise(it.ratePaise, sold),
      restockedQty: i % 3 === 0 ? fmtQty(qtyMilli(sold) / 2n) : '0',
      adjustedQty: i === 4 ? '-1.5' : '0',
      remainingQty: it.stockQty,
    };
  })
  .sort((a, b) => b.soldPaise - a.soldPaise);
const stockReport = {
  from: ist(-29, 0, 0),
  to: ist(1, 0, 0),
  totals: {
    soldPaise: reportRows.reduce((s, r) => s + r.soldPaise, 0),
    itemsSold: reportRows.filter((r) => r.soldQty !== '0').length,
  },
  data: reportRows,
  nextCursor: null,
};

// ---------- storefront
const publicItem = (it) => ({ id: it.id, name: it.name, unit: it.unit, category: it.category, imageUrl: it.imageUrl });
const activeItems = items.filter((i) => i.isActive);
const featuredIds = [1, 4, 7, 9, 10, 12, 16, 18].map((n) => I[n].id);
const storefrontContent = {
  tagline: "Jaipur's trusted wholesale partner since 1998",
  ownerNote:
    'Family-run distributor serving 300+ kirana and general stores across Jaipur. We stock leading FMCG brands and staples at wholesale rates, with same-day delivery in the city.',
  highlights: [
    { icon: 'truck', title: 'Same-day delivery', text: 'Order by 2 PM, get it today' },
    { icon: 'credit', title: '7-day credit', text: 'For regular retailers' },
    { icon: 'tag', title: 'Wholesale rates', text: 'Best prices, updated daily' },
    { icon: 'box', title: '500+ products', text: 'Staples, FMCG & home care' },
    { icon: 'phone', title: 'Order from your phone', text: 'No calls, no notebooks' },
    { icon: 'shield', title: 'Genuine products', text: 'Direct from brand depots' },
  ],
  brands: [
    'Aashirvaad',
    'Tata',
    'Fortune',
    'Parle',
    'Britannia',
    'Nestlé',
    'Amul',
    'HUL',
    'Colgate',
    'Dettol',
    "Haldiram's",
    'Everest',
  ],
  stats: [
    { value: '1998', label: 'Serving since' },
    { value: '300+', label: 'Stores served' },
    { value: '500+', label: 'Products' },
    { value: '8', label: 'Areas covered' },
  ],
  openingHours: { days: [1, 2, 3, 4, 5, 6], open: '08:00', close: '20:00' },
  sameDayCutoff: '14:00',
  godown: { lat: 26.9196, lng: 75.818, label: 'Kishanpole Bazar' },
};
// ADR-023: circle delivery zones (real coordinates, Jaipur)
const deliveryZones = [
  ['Malviya Nagar', 26.853, 75.805],
  ['Vaishali Nagar', 26.9115, 75.7432],
  ['Mansarovar', 26.8697, 75.7633],
  ['Raja Park', 26.8925, 75.8275],
  ['Sanganer', 26.8217, 75.7926],
  ['Jagatpura', 26.8315, 75.8655],
  ['C-Scheme', 26.905, 75.804],
  ['Pratap Nagar', 26.807, 75.823],
].map(([name, lat, lng], i) => ({
  id: uuid(),
  name,
  kind: 'CIRCLE',
  center: { lat, lng },
  radiusM: 1400,
  sortOrder: i,
  isActive: true,
}));
const publicZone = ({ sortOrder, isActive, ...z }) => z;
const coverUrl = media('cover');
const storefront = {
  distributor: { ...publicDistributor, coverUrl, tagline: storefrontContent.tagline },
  highlights: storefrontContent.highlights,
  stats: storefrontContent.stats,
  categories: [...new Set(activeItems.map((i) => i.category))].sort(),
  brands: storefrontContent.brands,
  openingHours: storefrontContent.openingHours,
  sameDayCutoff: storefrontContent.sameDayCutoff,
  owner: { name: distributorMe.ownerName, note: storefrontContent.ownerNote },
  map: { godown: storefrontContent.godown, zones: deliveryZones.map(publicZone) },
  featuredItems: featuredIds.map((id) => publicItem(items.find((i) => i.id === id))),
  viewer: null,
};
const storefrontMinimal = {
  distributor: { businessName: 'Maa Durga Agencies', logoUrl: null, coverUrl: null, tagline: null },
  highlights: [],
  stats: [],
  categories: ['Staples', 'Snacks'],
  brands: [],
  openingHours: null,
  sameDayCutoff: null,
  owner: null,
  map: { godown: null, zones: [] },
  featuredItems: [],
  viewer: null,
};
const storefrontSignedIn = { ...storefront, viewer: { retailerName: R[1].name, shopName: R[1].shopName } };
const storefrontAdmin = {
  ...storefrontContent,
  coverUploadId: null,
  featuredItemIds: featuredIds,
  published: true,
  coverUrl,
  previewUrl: distributorMe.qrUrl,
};

// ---------- retailer-side
const retailerSession = {
  accessToken: 'eyJhbGciOiJFZERTQSIsImtpZCI6ImsxIn0.…retailer…',
  accessTokenExpiresAt: ist(0, 11, 0),
  retailer: { id: R[1].id, name: R[1].name, shopName: R[1].shopName },
  distributor: publicDistributor,
};
const catalog = {
  distributor: publicDistributor,
  categories: storefront.categories,
  items: activeItems.map((it) => ({
    id: it.id,
    name: it.name,
    unit: it.unit,
    ratePaise: it.ratePaise,
    category: it.category,
    description: it.description,
    imageUrl: it.imageUrl,
  })),
  version: 'W/"c-9f2a1e"',
};
const sharmaOrders = orders.filter((o) => o.retailerRef === R[1]);

// ---------- problems (RFC 9457)
const problem = (code, status, title, detail, extra = {}) => ({
  type: `https://distributekaro.in/problems/${code.toLowerCase().replaceAll('_', '-')}`,
  title,
  status,
  code,
  detail,
  traceId: '01J9Z3K8V4QX7M2N',
  ...extra,
});
const pendingOrder = byNo[1040];
const toorLine = pendingOrder.lines.find((l) => l.itemId === toor.id);
const problems = {
  validation: problem('VALIDATION_FAILED', 422, 'Some fields need attention', null, {
    errors: [
      { path: 'name', message: 'Name is required' },
      { path: 'ratePaise', message: 'Rate must be 0 or more' },
    ],
  }),
  'invalid-credentials': problem('INVALID_CREDENTIALS', 401, 'Invalid phone number or password', null),
  'account-locked': problem('ACCOUNT_LOCKED', 429, 'Too many attempts', 'Try again in 15 minutes.', {
    retryAfterSec: 900,
  }),
  'rate-limited': problem('RATE_LIMITED', 429, 'Too many requests', 'Please wait a moment and try again.', {
    retryAfterSec: 60,
  }),
  'slug-invalid': problem(
    'SLUG_INVALID',
    404,
    'This QR code is no longer valid',
    'Ask your distributor for their latest QR code.',
  ),
  'request-pending': problem(
    'REQUEST_ALREADY_PENDING',
    409,
    'Request already sent',
    'The distributor will add you soon.',
  ),
  'item-unavailable': problem('ITEM_UNAVAILABLE', 422, 'Some items are no longer available', null, {
    errors: [{ path: 'lines[2].itemId', message: `${I[19].name} is currently unavailable` }],
  }),
  'insufficient-stock': problem('INSUFFICIENT_STOCK', 409, 'Not enough stock for some lines', null, {
    errors: [
      {
        path: `lines[${pendingOrder.lines.indexOf(toorLine)}]`,
        lineId: toorLine.id,
        itemId: toor.id,
        requested: toorLine.requestedQty,
        accepted: toorLine.requestedQty,
        available: toor.stockQty,
        message: `Only ${toor.stockQty} kg in stock`,
      },
    ],
  }),
};

// ---------- qty/money vectors (shared by TS, Kotlin, SQL tests)
const vectors = [
  [4250, '2.5'],
  [13800, '37'],
  [30, '250'],
  [15500, '1.333'],
  [9999, '0.001'],
  [1, '0.5'],
  [1, '0.499'],
  [46500, '10'],
  [5400, '0.75'],
].map(([ratePaise, qty]) => ({
  ratePaise,
  qty,
  qtyMilli: Number(qtyMilli(qty)),
  linePaise: linePaise(ratePaise, qty),
}));

// ---------- write
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.json')) unlinkSync(join(OUT, f));

write('distributor-me', distributorMe);
write('distributor-me.onboarding', {
  ...distributorMe,
  businessName: null,
  ownerName: null,
  email: null,
  address: null,
  gstin: null,
  status: 'ONBOARDING',
  createdAt: ist(0, 9, 0),
});
write('distributor-session', {
  accessToken: 'eyJhbGciOiJFZERTQSIsImtpZCI6ImsxIn0.…distributor…',
  accessTokenExpiresAt: ist(0, 11, 0),
  refreshToken: `${uuid()}.q9Xr…redacted`,
  distributor: distributorMe,
  onboardingRequired: false,
});
write('dashboard', dashboard);
write('dashboard.new-account', dashboardNew);
write('items.page', page(items));
write('item', I[5]);
write('categories', { data: categories });
write('stock-movements.page', page(movements));
write('stock-report', stockReport);
write('retailers.page', page(retailers));
write('retailer', R[1]);
write('access-requests.page', page(accessRequests));
write('enquiries.page', page(enquiries));
write('inbox-counts', inboxCounts);
write('orders.page', page(orders.map(dSummary)));
const detailFor = {
  pending: 1040,
  partial: 1038,
  accepted: 1037,
  rejected: 1033,
  dispatched: 1035,
  delivered: 1034,
  cancelled: 1031,
};
for (const [k, no] of Object.entries(detailFor)) write(`order-detail.${k}`, dDetail(byNo[no]));
write('storefront-admin', storefrontAdmin);
write('delivery-zones.page', page(deliveryZones));
write('storefront', storefront);
write('storefront.minimal', storefrontMinimal);
write('storefront.signed-in', storefrontSignedIn);
write('public-catalog.page', page(activeItems.map(publicItem)));
write('public-distributor', publicDistributor);
write('identify.authenticated', { result: 'AUTHENTICATED', session: retailerSession });
write('identify.not-registered', { result: 'NOT_REGISTERED', pendingAccessRequest: null });
write('identify.not-registered-pending', {
  result: 'NOT_REGISTERED',
  pendingAccessRequest: { createdAt: accessRequests[0].createdAt },
});
write('catalog', catalog);
write('retailer-orders.page', page(sharmaOrders.map(rSummary)));
write('retailer-order-detail', rDetail(byNo[1035]));
write('empty.page', page([]));
write('qty-money-vectors', vectors);
for (const [k, v] of Object.entries(problems)) write(`problem.${k}`, v);

// ---------- seed data for the API (same dataset as the fixtures; read by apps/api/src/db/seed.ts)
const SEED_DIR = join(OUT, '..', 'seed');
mkdirSync(SEED_DIR, { recursive: true });
const seed = {
  $comment: 'GENERATED by packages/shared/scripts/gen-fixtures.mjs. Do not edit.',
  distributor: distributorMe,
  items,
  retailers,
  accessRequests,
  enquiries,
  storefront: { ...storefrontContent, featuredItemIds: featuredIds, published: true },
  deliveryZones,
  orders: orders.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    status: o.status,
    retailerId: o.retailerRef.id,
    note: o.note,
    rejectionReason: o.rejectionReason,
    newDevice: o.newDevice,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    decidedAt: o.decidedAt,
    lines: o.lines.map(({ availableStockQty, ...l }) => l),
    events: o.events,
  })),
};
writeFileSync(join(SEED_DIR, 'seed.json'), JSON.stringify(seed, null, 2) + '\n');

console.log(`wrote ${readdirSync(OUT).length} fixtures → ${OUT}`);
