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

export function exportToCSV(deals) {
  const headers = [
    'Deal ID', 
    'Time', 
    'Deal Type', 
    'Seller Name', 
    'Seller PS Track', 
    'Asset Name', 
    'Github Link', 
    'Asking Price (Cr)', 
    'Buyer Team Name', 
    'Buyer PS Track', 
    'Negotiated Price (Cr)', 
    'SEBI Status'
  ];

  const rows = deals.map(d => [
    d.id,
    d.time || '—',
    d.type,
    d.seller,
    d.sellerPs || '—',
    d.asset,
    d.github || '—',
    d.askingPrice !== undefined ? d.askingPrice : '—',
    d.buyer,
    d.buyerPs || '—',
    d.type === 'Full Merger' ? `${d.price}% share` : `${d.price} Cr`,
    d.sebiStatus || 'Approved'
  ]);
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
    
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `hacquire-official-deals-${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
