import React from 'react';
import { formatMoney } from '../utils/dealsData';
import { Layers, Briefcase, IndianRupee, TrendingUp } from 'lucide-react';

export default function MarketOverview({ deals = [] }) {
  const featureCount = deals.filter(d => d.type === 'Feature').length;
  const consultingCount = deals.filter(d => d.type === 'Consulting').length;
  const totalValue = deals
    .filter(d => d.type !== 'Merger')
    .reduce((sum, d) => sum + Number(d.price || 0), 0);

  return (
    <div className="card">
      <h2>
        <TrendingUp className="orange" size={20} />
        Market Overview
      </h2>
      <div className="stats">
        <div className="stat">
          <small>Total Registered Deals</small>
          <strong className="orange">{deals.length}</strong>
        </div>
        <div className="stat">
          <small>Feature Acquisitions</small>
          <strong className="blue">{featureCount}</strong>
        </div>
        <div className="stat">
          <small>Consulting Slots</small>
          <strong className="gold">{consultingCount}</strong>
        </div>
        <div className="stat">
          <small>Virtual Money Moved</small>
          <strong className="green">{formatMoney(totalValue)}</strong>
        </div>
      </div>
    </div>
  );
}
