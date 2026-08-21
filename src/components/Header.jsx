import React from 'react';
import { Activity, Maximize2, Database } from 'lucide-react';
import { isDBConnected } from '../utils/db';

export default function Header({ lastUpdated, onOpenCarousel }) {
  const dbStatus = isDBConnected();

  return (
    <header>
      <div className="brand">
        <div className="logo" title="HACQUIRE">H</div>
        <div>
          <div className="tag">
            <Activity className="w-3 h-3 text-amber-500" size={12} />
            FED KIIT presents
          </div>
          <h1>HACQUIRE — Live Deal Ticker</h1>
        </div>
      </div>
      <div className="header-meta">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
          <div className="live">
            <span className="dot"></span> MARKET OPEN
          </div>
          <button 
            className="secondary expand-carousel-header-btn"
            onClick={onOpenCarousel}
            title="Open enlarged Deals Done Carousel in separate window"
          >
            <Maximize2 size={14} />
            Enlarge Carousel
          </button>
        </div>
        <div style={{ marginTop: '6px', fontSize: '0.8rem', display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
          <span title={dbStatus ? "Connected to Supabase Cloud Database" : "Using Local Storage Mode (Set VITE_SUPABASE_URL for Vercel DB sync)"}>
            <Database size={12} style={{ display: 'inline', marginRight: '4px', color: dbStatus ? 'var(--green)' : 'var(--gold)' }} />
            {dbStatus ? 'Cloud DB Active' : 'Local DB Mode'}
          </span>
          <span>&bull;</span>
          <span>Last updated: {lastUpdated || '—'}</span>
        </div>
      </div>
    </header>
  );
}
