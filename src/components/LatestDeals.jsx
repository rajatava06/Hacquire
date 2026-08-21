import React from 'react';
import { formatMoney } from '../utils/dealsData';
import { Clock, Zap } from 'lucide-react';

export default function LatestDeals({ deals = [] }) {
  const latest = [...deals].reverse().slice(0, 6);

  const renderPill = (type) => {
    const typeClass = (type || '').toLowerCase();
    return <span className={`pill ${typeClass}`}>{type}</span>;
  };

  return (
    <div className="card">
      <h2>
        <Zap className="gold" size={20} />
        Latest Deals
      </h2>
      <div className="board">
        {latest.length > 0 ? (
          latest.map((d) => (
            <div key={d.id} className="deal-item">
              <div className="deal-item-top">
                <strong>
                  {d.buyer} <span className="orange">acquired</span> {d.asset}
                </strong>
                {renderPill(d.type)}
              </div>
              <p>
                From <b>{d.seller}</b> &bull;{' '}
                <span className="price">
                  {d.type === 'Merger' ? `${d.price}% prize share` : formatMoney(d.price)}
                </span>
              </p>
              <div className="mini">
                <Clock size={12} />
                <span>{d.id}</span> &bull; <span>{d.time || 'Just now'}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="empty">No registered deals yet.</div>
        )}
      </div>
    </div>
  );
}
