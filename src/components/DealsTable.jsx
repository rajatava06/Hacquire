import React, { useMemo } from 'react';
import { formatMoney } from '../utils/dealsData';
import { Search, Download, Trash2, Database, ExternalLink } from 'lucide-react';

export default function DealsTable({ 
  deals = [], 
  searchQuery, 
  setSearchQuery, 
  typeFilter, 
  setTypeFilter, 
  onExport,
  onDeleteDeal
}) {
  const filteredDeals = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return [...deals].reverse().filter(d => {
      const haystack = `${d.id} ${d.buyer} ${d.seller} ${d.asset} ${d.type} ${d.sellerPs || ''} ${d.buyerPs || ''} ${d.sebiStatus || ''}`.toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      const matchesType = typeFilter === 'All' || d.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [deals, searchQuery, typeFilter]);

  const renderSebiPill = (status) => {
    const s = (status || 'Approved').toLowerCase();
    const cls = s === 'approved' ? 'feature' : s === 'pending' ? 'consulting' : 'merger';
    return (
      <span className={`pill ${cls}`}>
        {status || 'Approved'}
      </span>
    );
  };

  return (
    <div className="card" style={{ marginTop: '18px' }}>
      <h2>
        <Database className="gold" size={20} />
        All Registered Deals (11-Attribute Schema)
      </h2>
      
      <div className="controls">
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search 
            size={16} 
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9cafc8' }} 
          />
          <input 
            style={{ paddingLeft: '36px', width: '100%' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search team, PS track, asset or SEBI status…" 
          />
        </div>

        <select 
          value={typeFilter} 
          onChange={(e) => setSearchQuery(e.target.value)}
        >
          <option value="All">All deal types</option>
          <option value="Feature Acquisition">Feature Acquisition</option>
          <option value="Consulting Slot">Consulting Slot</option>
          <option value="Full Merger">Full Merger</option>
        </select>

        <button className="secondary" onClick={onExport} title="Download proper Microsoft Excel (.xlsx) file">
          <Download size={16} />
          Export Excel (.xlsx)
        </button>
      </div>

      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Time</th>
              <th>Type</th>
              <th>Seller (Name & Track)</th>
              <th>Asset & Github</th>
              <th>Asking Price</th>
              <th>Buyer (Name & Track)</th>
              <th>Negotiated Price</th>
              <th>SEBI Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeals.length > 0 ? (
              filteredDeals.map((d) => (
                <tr key={d.id}>
                  <td><strong style={{ color: 'var(--orange)', fontFamily: 'monospace' }}>{d.id}</strong></td>
                  <td style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{d.time || '—'}</td>
                  <td>
                    <span className="pill feature" style={{ fontSize: '0.72rem' }}>
                      {d.type}
                    </span>
                  </td>
                  <td>
                    <div><strong>{d.seller}</strong></div>
                    {d.sellerPs && <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{d.sellerPs}</div>}
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{d.asset}</div>
                    {d.github && (
                      <a href={d.github} target="_blank" rel="noreferrer" style={{ fontSize: '0.74rem', color: 'var(--blue)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <ExternalLink size={10} /> Github Repo
                      </a>
                    )}
                  </td>
                  <td style={{ color: '#aaa', fontSize: '0.86rem' }}>
                    {d.askingPrice !== undefined && d.askingPrice !== '' ? formatMoney(d.askingPrice) : '—'}
                  </td>
                  <td>
                    <div><strong>{d.buyer}</strong></div>
                    {d.buyerPs && <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{d.buyerPs}</div>}
                  </td>
                  <td className="price" style={{ color: 'var(--gold)', fontWeight: 900 }}>
                    {d.type === 'Full Merger' ? `${d.price}% share` : formatMoney(d.price)}
                  </td>
                  <td>
                    {renderSebiPill(d.sebiStatus)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="action-btn"
                      title={`Remove ${d.id}`}
                      onClick={() => onDeleteDeal(d.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty" colSpan={10}>
                  No deals match your search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
