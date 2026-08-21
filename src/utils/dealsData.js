import * as XLSX from 'xlsx';

export const STORAGE_KEY = 'hacquire_live_deals_v1';

export const DEFAULT_DEALS = [
  { 
    id: 'D-001', 
    time: '10:48 AM', 
    type: 'Feature Acquisition', 
    seller: 'MATRIX', 
    sellerPs: "PS8: The Shopkeeper's Day", 
    asset: 'Route Optimisation Engine', 
    github: 'https://github.com/nirmalyajena01-lgtm', 
    askingPrice: 5.0, 
    buyer: 'CodeCrafters', 
    buyerPs: 'PS1: Smart Campus Emergency Response', 
    price: 4.0, 
    sebiStatus: 'Approved' 
  },
  { 
    id: 'D-002', 
    time: '10:56 AM', 
    type: 'Feature Acquisition', 
    seller: 'PARADOX', 
    sellerPs: 'PS4: Farmer-to-Market Platform', 
    asset: 'OCR & WhatsApp Payment Module', 
    github: 'https://github.com/Shaswata-codes', 
    askingPrice: 4.5, 
    buyer: 'ByteBrigade', 
    buyerPs: 'PS9: Getting Paid', 
    price: 3.5, 
    sebiStatus: 'Approved' 
  },
  { 
    id: 'D-003', 
    time: '11:08 AM', 
    type: 'Consulting Slot', 
    seller: 'CYPHER SQUAD', 
    sellerPs: 'PS3: Health Monitoring Platform', 
    asset: 'Emergency Dispatch Consulting', 
    github: 'https://github.com/Koustavdas-cloud', 
    askingPrice: 3.0, 
    buyer: 'HyperLog', 
    buyerPs: 'PS1: Smart Campus Emergency Response', 
    price: 2.75, 
    sebiStatus: 'Approved' 
  },
  { 
    id: 'D-004', 
    time: '11:15 AM', 
    type: 'Consulting Slot', 
    seller: '3I - CREW', 
    sellerPs: 'PS5: Logistics Engine', 
    asset: 'Architecture Strategy Slot', 
    github: 'https://github.com/krish2597', 
    askingPrice: 1.0, 
    buyer: 'HyperLog', 
    buyerPs: 'PS1: Smart Campus Emergency Response', 
    price: 0.75, 
    sebiStatus: 'Approved' 
  },
  { 
    id: 'D-005', 
    time: '11:27 AM', 
    type: 'Full Merger', 
    seller: 'T-08', 
    sellerPs: 'PS4: Farmer-to-Market', 
    asset: 'Market Price Pipeline Merger', 
    github: 'https://github.com/MandiTech-org', 
    askingPrice: 25.0, 
    buyer: 'MandiTech', 
    buyerPs: 'PS4: Farmer-to-Market Decision Platform', 
    price: 20.0, 
    sebiStatus: 'Approved' 
  }
];

export function getInitialDeals() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse localStorage deals', e);
  }
  return DEFAULT_DEALS;
}

export function saveDealsToStorage(deals) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
  } catch (e) {
    console.error('Failed to save deals to localStorage', e);
  }
}

export function formatMoney(value) {
  const num = Number(value);
  if (isNaN(num)) return '₹0 Cr';
  const formatted = num.toFixed(num % 1 !== 0 ? 2 : 0);
  return `₹${formatted} Cr`;
}

/**
 * Downloads a proper native Microsoft Excel (.xlsx) spreadsheet with column widths set.
 */
export function exportToCSV(deals) {
  if (!deals || deals.length === 0) return;

  const formattedData = deals.map(d => ({
    'Deal ID': d.id,
    'Time': d.time || '—',
    'Deal Type': d.type,
    'Seller Name': d.seller,
    'Seller PS Track': d.sellerPs || '—',
    'Asset Name': d.asset,
    'Github Link': d.github || '—',
    'Asking Price (₹ Cr)': d.askingPrice !== undefined && d.askingPrice !== '' ? Number(d.askingPrice) : '—',
    'Buyer Team Name': d.buyer,
    'Buyer PS Track': d.buyerPs || '—',
    'Negotiated Price (Cr)': d.type === 'Full Merger' ? `${d.price}% share` : Number(d.price),
    'SEBI Status': d.sebiStatus || 'Approved'
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);

  // Set explicit column widths so all headers and values are clearly visible in Excel
  const columnWidths = [
    { wch: 12 }, // Deal ID
    { wch: 14 }, // Time
    { wch: 22 }, // Deal Type
    { wch: 22 }, // Seller Name
    { wch: 32 }, // Seller PS Track
    { wch: 32 }, // Asset Name
    { wch: 45 }, // Github Link
    { wch: 20 }, // Asking Price
    { wch: 22 }, // Buyer Team Name
    { wch: 32 }, // Buyer PS Track
    { wch: 22 }, // Negotiated Price
    { wch: 16 }  // SEBI Status
  ];
  worksheet['!cols'] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Live Executed Deals');

  XLSX.writeFile(workbook, `hacquire-official-deals-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
