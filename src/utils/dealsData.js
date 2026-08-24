import * as XLSX from 'xlsx';

export const STORAGE_KEY = 'hacquire_live_deals_v1';

export const DEFAULT_DEALS = [];

export function getInitialDeals() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
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
  return `₹${num} Cr`;
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
