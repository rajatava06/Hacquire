import { STORAGE_KEY, DEFAULT_DEALS } from './dealsData';

const API_ENDPOINT = '/api/deals';

export function isDBConnected() {
  return true;
}

function getLocalDeals() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed reading local deals:', e);
  }
  return [];
}

function saveLocalDeals(deals) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
  } catch (e) {
    console.error('Failed saving local deals:', e);
  }
}

/**
 * Fetches deals from MongoDB API with instant 2-second timeout fallback.
 */
export async function fetchDealsFromDB() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const res = await fetch(API_ENDPOINT, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data)) {
        const formatted = data.map(d => ({
          id: d.id,
          time: d.time,
          type: d.type,
          seller: d.seller,
          sellerPs: d.sellerPs,
          asset: d.asset,
          github: d.github,
          askingPrice: d.askingPrice,
          buyer: d.buyer,
          buyerPs: d.buyerPs,
          price: d.type === 'Full Merger' ? d.price : Number(d.price),
          sebiStatus: d.sebiStatus || 'Approved'
        }));
        saveLocalDeals(formatted);
        return formatted;
      }
    }
  } catch (err) {
    console.warn('MongoDB API connection fallback:', err.message);
  }
  return getLocalDeals();
}

export async function saveDealToDB(deal) {
  const currentLocal = getLocalDeals();
  const updatedLocal = [...currentLocal.filter(d => d.id !== deal.id), deal];
  saveLocalDeals(updatedLocal);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deal),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return fetchDealsFromDB();
    }
  } catch (err) {
    console.error('MongoDB API save error, using local state:', err);
  }

  return updatedLocal;
}

export async function bulkSaveDealsToDB(newDealsArray) {
  const currentLocal = getLocalDeals();
  const map = new Map();
  currentLocal.forEach(d => map.set(d.id.toLowerCase(), d));
  newDealsArray.forEach(d => map.set(d.id.toLowerCase(), d));
  const merged = Array.from(map.values());

  saveLocalDeals(merged);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDealsArray),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return fetchDealsFromDB();
    }
  } catch (err) {
    console.error('MongoDB API bulk save error, using local state:', err);
  }

  return merged;
}

export async function deleteDealFromDB(dealId) {
  const currentLocal = getLocalDeals();
  const updatedLocal = currentLocal.filter(d => d.id.toLowerCase() !== dealId.toLowerCase());
  saveLocalDeals(updatedLocal);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${API_ENDPOINT}?id=${encodeURIComponent(dealId)}`, {
      method: 'DELETE',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return fetchDealsFromDB();
    }
  } catch (err) {
    console.error('MongoDB API delete error, using local state:', err);
  }

  return updatedLocal;
}

export function subscribeToDealsDB(onUpdate) {
  const intervalId = setInterval(async () => {
    const freshDeals = await fetchDealsFromDB();
    onUpdate(freshDeals);
  }, 10000);

  return () => {
    clearInterval(intervalId);
  };
}
