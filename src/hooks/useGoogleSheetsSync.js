import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Polls /api/sheets-sync every `intervalMs` milliseconds (default 30s).
 * Calls `onDealsUpdated` with the fresh deals array whenever new data arrives.
 */
export function useGoogleSheetsSync({ onDealsUpdated, intervalMs = 30000 }) {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [lastSyncCount, setLastSyncCount] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const timerRef = useRef(null);

  const syncNow = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`Sync failed: HTTP ${res.status}`);
      const data = await res.json();

      if (data.deals && Array.isArray(data.deals)) {
        // Normalize deals from MongoDB response
        const formatted = data.deals.map(d => ({
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
          price: d.type === 'Full Merger' ? d.price : Number(d.price) || d.price,
          sebiStatus: d.sebiStatus || 'Approved'
        }));
        onDealsUpdated(formatted);
        setLastSyncCount(data.synced);
      } else if (data.message) {
        // No data in sheet yet
        setLastSyncCount(0);
      }

      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      setSyncError(err.message);
      console.warn('[Sheets Sync] Error:', err.message);
    } finally {
      setSyncing(false);
    }
  }, [onDealsUpdated, syncing]);

  useEffect(() => {
    // Initial sync on mount
    syncNow();

    // Then every intervalMs
    timerRef.current = setInterval(syncNow, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [intervalMs]); // intentionally exclude syncNow to avoid re-registering timer on each render

  return { syncing, lastSyncTime, lastSyncCount, syncError, syncNow };
}
