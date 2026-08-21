import React from 'react';
import { formatMoney } from '../utils/dealsData';
import { Maximize2 } from 'lucide-react';

export default function TickerBar({ deals = [], onOpenCarousel }) {
  const latestDeals = [...deals].reverse().slice(0, 8);

  if (!latestDeals.length) {
    return (
      <div className="ticker">
        <div className="ticker-track-container">
          <div className="ticker-track">No registered deals yet.</div>
        </div>
      </div>
    );
  }

  const tickerItems = [...latestDeals, ...latestDeals];

  return (
    <div className="ticker-wrapper">
      <div className="ticker" title="Hover to pause ticker">
        <div className="ticker-track-container">
          <div className="ticker-track">
            {tickerItems.map((d, index) => {
              const priceStr = d.type === 'Merger' ? `${d.price}% prize share` : formatMoney(d.price);
              return (
                <span key={`${d.id}-${index}`} className="ticker-item">
                  <strong className="orange">{d.id}:</strong> {d.buyer} ↔ {d.seller} &bull; <span style={{ color: '#fff' }}>{d.asset}</span> &bull; <span className="gold">{priceStr}</span>
                  <span className="ticker-separator">&nbsp;&nbsp;&nbsp;&nbsp;&#10022;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <button 
        className="ticker-enlarge-btn"
        onClick={onOpenCarousel}
        title="Open enlarged Deals Done Carousel window"
      >
        <Maximize2 size={16} />
        <span>Enlarge</span>
      </button>
    </div>
  );
}
