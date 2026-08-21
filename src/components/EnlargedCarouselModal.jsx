import React, { useMemo } from 'react';
import { formatMoney } from '../utils/dealsData';
import { X, Sparkles, Filter, Clock, ArrowRight, Zap, Building2, ShoppingBag } from 'lucide-react';

export default function EnlargedCarouselModal({ isOpen, onClose, deals = [] }) {
  const [filterType, setFilterType] = React.useState('All');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Always call useMemo hook at top level before any early return
  const filteredDeals = useMemo(() => {
    return [...deals].reverse().filter(d => {
      const haystack = `${d.id} ${d.buyer} ${d.seller} ${d.asset} ${d.type}`.toLowerCase();
      const matchesSearch = !searchQuery || haystack.includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'All' || d.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [deals, searchQuery, filterType]);

  // Early return ONLY after all hooks have been declared
  if (!isOpen) return null;

  // Distribute deals across 2 distinct row tracks for visual richness
  const row1Deals = filteredDeals.filter((_, idx) => idx % 2 === 0);
  const row2Deals = filteredDeals.filter((_, idx) => idx % 2 === 1);

  // If a row is small, duplicate items to ensure a seamless looping animation
  const makeLoop = (arr) => {
    if (!arr.length) return [];
    if (arr.length < 5) return [...arr, ...arr, ...arr, ...arr];
    return [...arr, ...arr];
  };

  const track1 = makeLoop(row1Deals.length ? row1Deals : filteredDeals);
  const track2 = makeLoop(row2Deals.length ? row2Deals : filteredDeals);

  // Fixed smooth, decreased carousel speed (65s duration)
  const baseDuration = 65;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container enlarged-carousel-window" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title">
            <div className="logo-small">H</div>
            <div>
              <div className="tag">
                <Sparkles size={12} className="orange" />
                Live Market Floor
              </div>
              <h2>Deals Done Carousel</h2>
            </div>
          </div>

          <div className="modal-actions">
            {/* Clean Close Button Only */}
            <button className="close-btn" onClick={onClose} title="Close Window">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Filter Bar */}
        <div className="modal-filter-bar">
          <input 
            className="modal-search"
            placeholder="Search deals in carousel…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="filter-pills">
            <Filter size={14} className="muted" />
            {['All', 'Feature', 'Consulting', 'Merger'].map((t) => (
              <button
                key={t}
                className={`filter-pill ${filterType === t ? 'active' : ''}`}
                onClick={() => setFilterType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Multi-Row Enlarged Carousel Area */}
        <div className="enlarged-carousel-body">
          {filteredDeals.length === 0 ? (
            <div className="empty">No deals match your carousel filter.</div>
          ) : (
            <>
              {/* Row 1 Track (Scrolling Left) */}
              <div className="carousel-row-container">
                <div 
                  className="carousel-row-track"
                  style={{ animationDuration: `${baseDuration}s` }}
                >
                  {track1.map((d, index) => (
                    <CarouselCard key={`row1-${d.id}-${index}`} deal={d} />
                  ))}
                </div>
              </div>

              {/* Row 2 Track (Scrolling Right / Reverse Direction) */}
              <div className="carousel-row-container">
                <div 
                  className="carousel-row-track reverse"
                  style={{ animationDuration: `${baseDuration * 1.15}s` }}
                >
                  {track2.map((d, index) => (
                    <CarouselCard key={`row2-${d.id}-${index}`} deal={d} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

function CarouselCard({ deal }) {
  const isMerger = (deal.type || '').toLowerCase().includes('merger');
  const priceDisplay = isMerger ? `${deal.price}% share` : formatMoney(deal.price);
  const typeLower = (deal.type || 'feature').toLowerCase().includes('consult') 
    ? 'consulting' 
    : isMerger ? 'merger' : 'feature';

  const sebiStatus = deal.sebiStatus || 'Approved';

  return (
    <div className={`enlarged-card card-glow-${typeLower}`}>
      {/* Top Bar: ID, Deal Type & TIME */}
      <div className="card-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="card-id-lbl">#{deal.id}</span>
          <span className={`pill-badge type-${typeLower}`}>{deal.type}</span>
        </div>
        <span className="card-time" style={{ fontWeight: 800, color: 'var(--orange)', fontSize: '0.78rem' }}>
          {deal.time || 'Live'}
        </span>
      </div>

      {/* Feature / Asset Title */}
      <div className="card-deal-section">
        <h4 className="deal-title">{deal.asset}</h4>
      </div>

      {/* Teams Trade Flow (Seller ➔ Buyer) */}
      <div className="card-flow-section">
        <div className="flow-step">
          <span className="flow-role seller">SELLER</span>
          <span className="flow-team-name">{deal.seller}</span>
        </div>
        <div className="flow-arrow">&rarr;</div>
        <div className="flow-step">
          <span className="flow-role buyer">BUYER</span>
          <span className="flow-team-name">{deal.buyer}</span>
        </div>
      </div>

      {/* Footer: Prominent Bargain Price */}
      <div className="card-footer-row" style={{ marginTop: '6px', paddingTop: '6px' }}>
        <div className="card-price-container" style={{ width: '100%', justifyContent: 'space-between', padding: '6px 12px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 800, letterSpacing: '0.5px' }}>PRICE:</span>
          <span className="price-val" style={{ fontSize: '1rem', color: 'var(--gold)', fontWeight: 950 }}>{priceDisplay}</span>
        </div>
      </div>
    </div>
  );
}
