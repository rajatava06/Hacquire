import React, { useState } from 'react';
import { Award, CheckCircle, AlertOctagon, MessageSquare, Trash2 } from 'lucide-react';

export default function EvaluationTable({ evaluations = [], onDeleteEvaluation }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filtered = evaluations.filter(ev => {
    const matchesSearch = ev.teamName.toLowerCase().includes(search.toLowerCase()) ||
                          ev.teamId.toLowerCase().includes(search.toLowerCase()) ||
                          (ev.problemStatement && ev.problemStatement.toLowerCase().includes(search.toLowerCase()));
    
    const matchesStatus = statusFilter === 'All' || 
      (statusFilter === 'QUALIFIED' && ev.dealStatus.includes('QUALIFIED')) ||
      (statusFilter === 'INELIGIBLE' && ev.dealStatus.includes('INELIGIBLE'));

    return matchesSearch && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

  return (
    <div className="card evaluation-section" style={{ marginTop: '0' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Award size={20} style={{ color: 'var(--green)' }} />
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
            Round 2: Pitch & Dealmaking Scoreboard (40%)
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search team or PS track..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '0.85rem', maxWidth: '220px', borderRadius: '8px' }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '8px' }}
          >
            <option value="All">All Statuses</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="INELIGIBLE">Ineligible (0 Deals)</option>
          </select>
        </div>
      </div>

      <div className="table-responsive" style={{ marginTop: '16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 12px' }}>Team ID</th>
              <th style={{ padding: '10px 12px' }}>Team Name</th>
              <th style={{ padding: '10px 12px' }}>Problem Statement Track</th>
              <th style={{ padding: '10px 12px' }}>Deals Executed</th>
              <th style={{ padding: '10px 12px' }}>Status</th>
              <th style={{ padding: '10px 12px' }}>Rationale (/15)</th>
              <th style={{ padding: '10px 12px' }}>Valuation (/10)</th>
              <th style={{ padding: '10px 12px' }}>Integration (/15)</th>
              <th style={{ padding: '10px 12px' }}>Total Score (/40)</th>
              <th style={{ padding: '10px 12px' }}>Judge Feedback / Notes</th>
              {onDeleteEvaluation && <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                  No evaluation scores recorded yet. Upload the evaluation sheet in OC Admin!
                </td>
              </tr>
            ) : (
              sorted.map((ev, idx) => {
                const isQualified = ev.dealStatus && ev.dealStatus.includes('QUALIFIED');
                return (
                  <tr key={ev.teamId || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 800, color: 'var(--orange)' }}>
                      {ev.teamId}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 800, color: '#fff' }}>
                      {ev.teamName}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#ccc', fontSize: '0.85rem' }}>
                      {ev.problemStatement || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                      {ev.dealsExecuted} deal{ev.dealsExecuted === 1 ? '' : 's'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`pill ${isQualified ? 'feature' : 'merger'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {isQualified ? <CheckCircle size={12} /> : <AlertOctagon size={12} />}
                        {ev.dealStatus}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{ev.strategicRationale}</td>
                    <td style={{ padding: '10px 12px' }}>{ev.valuationPricing}</td>
                    <td style={{ padding: '10px 12px' }}>{ev.integrationQuality}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--gold)' }}>
                        {ev.totalScore}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: 'var(--muted)', maxWidth: '240px' }}>
                      <MessageSquare size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      {ev.feedback || '—'}
                    </td>
                    {onDeleteEvaluation && (
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button 
                          className="action-btn"
                          onClick={() => onDeleteEvaluation(ev.teamId)}
                          title="Delete Evaluation Record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
