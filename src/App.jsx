import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import TickerBar from './components/TickerBar';
import MarketOverview from './components/MarketOverview';
import DealsTable from './components/DealsTable';
import EvaluationTable from './components/EvaluationTable';
import LatestDeals from './components/LatestDeals';
import AdminDealForm from './components/AdminDealForm';
import EnlargedCarouselModal from './components/EnlargedCarouselModal';
import { useGoogleSheetsSync } from './hooks/useGoogleSheetsSync';
import {
  fetchEvaluationsFromDB,
  saveEvaluationToDB,
  bulkSaveEvaluationsToDB,
  deleteEvaluationFromDB
} from './utils/dbEvaluations';
import { exportToCSV } from './utils/dealsData';
import { AlertCircle, CheckCircle2, RefreshCw, Database, Award, RefreshCcw } from 'lucide-react';

export default function App() {
  const [deals, setDeals] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [mainTab, setMainTab] = useState('deals'); // 'deals' | 'evaluations'
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [lastUpdated, setLastUpdated] = useState('');
  const [toast, setToast] = useState(null);
  const [isCarouselOpen, setIsCarouselOpen] = useState(false);

  // Google Sheets is the ONLY data source for deals — syncs every 30 seconds
  const { syncing, lastSyncTime, lastSyncCount, syncError, syncNow } = useGoogleSheetsSync({
    onDealsUpdated: (freshDeals) => {
      setDeals(freshDeals);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    },
    intervalMs: 30000
  });

  // Initial evaluations load (evaluations still use DB)
  useEffect(() => {
    async function loadEvals() {
      const evalsData = await fetchEvaluationsFromDB();
      setEvaluations(evalsData);
    }
    loadEvals();
  }, []);

  // Auto-dismiss toast notification
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);



  // Deals are read-only from Google Sheets — delete is disabled
  const handleDeleteDeal = useCallback(() => {
    setToast({ type: 'error', message: 'Deals come from Google Sheets. Edit the sheet directly.' });
  }, []);

  // Evaluation handlers
  const handleAddEvaluation = useCallback(async (newEval) => {
    const updated = await saveEvaluationToDB(newEval);
    setEvaluations(updated);
  }, []);

  const handleBulkAddEvaluations = useCallback(async (newEvalsArray) => {
    const updated = await bulkSaveEvaluationsToDB(newEvalsArray);
    setEvaluations(updated);
  }, []);

  const handleDeleteEvaluation = useCallback(async (teamId) => {
    if (window.confirm(`Delete evaluation record for Team ID ${teamId}?`)) {
      const updated = await deleteEvaluationFromDB(teamId);
      setEvaluations(updated);
      setToast({ type: 'success', message: `Evaluation for Team ${teamId} deleted.` });
    }
  }, []);

  const handleResetDefaults = useCallback(async () => {
    if (window.confirm('Clear all deals and pitch evaluations data?')) {
      try {
        localStorage.removeItem('hacquire_live_deals_v1');
        localStorage.removeItem('hacquire_live_evaluations_v1');
        fetch('/api/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[]' });
        fetch('/api/evaluations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[]' });
      } catch (e) {}
      setDeals([]);
      setEvaluations([]);
      setToast({ type: 'success', message: 'All demo data removed.' });
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!deals.length) {
      setToast({ type: 'error', message: 'No deal records to export.' });
      return;
    }
    exportToCSV(deals);
    setToast({ type: 'success', message: 'Deals exported as official Excel (.xlsx) spreadsheet!' });
  }, [deals]);

  return (
    <main className="wrap">
      <Header 
        lastUpdated={lastUpdated} 
        onOpenCarousel={() => setIsCarouselOpen(true)}
      />

      <TickerBar 
        deals={deals} 
        onOpenCarousel={() => setIsCarouselOpen(true)}
      />

      {/* Google Sheets Live Sync Status Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '8px 16px', margin: '0 0 12px',
        background: syncError
          ? 'rgba(255,60,60,0.08)'
          : syncing
            ? 'rgba(255,174,66,0.10)'
            : 'rgba(50,213,131,0.08)',
        border: `1px solid ${syncError ? 'rgba(255,60,60,0.3)' : syncing ? 'rgba(255,174,66,0.3)' : 'rgba(50,213,131,0.25)'}`,
        borderRadius: '10px', fontSize: '0.82rem', flexWrap: 'wrap'
      }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700,
          color: syncError ? '#ff6b6b' : syncing ? '#ffae42' : '#32d583'
        }}>
          {syncing ? (
            <RefreshCcw size={14} style={{ animation: 'spin 1s linear infinite' }} />
          ) : syncError ? (
            <AlertCircle size={14} />
          ) : (
            <CheckCircle2 size={14} />
          )}
          {syncing ? 'Syncing from Google Sheets…' : syncError ? 'Sync Error' : '● Google Sheets Synced'}
        </span>
        {lastSyncTime && !syncError && (
          <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
            Last sync: {lastSyncTime}
            {lastSyncCount != null && ` · ${lastSyncCount} deals loaded`}
          </span>
        )}
        {syncError && (
          <span style={{ color: '#ff6b6b', fontSize: '0.78rem' }}>{syncError}</span>
        )}
        <span style={{ marginLeft: 'auto' }}>
          <button
            onClick={syncNow}
            disabled={syncing}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 12px', borderRadius: '7px', fontSize: '0.78rem',
              background: 'rgba(255,174,66,0.15)', border: '1px solid rgba(255,174,66,0.4)',
              color: '#ffae42', cursor: syncing ? 'not-allowed' : 'pointer', fontWeight: 700
            }}
          >
            <RefreshCcw size={12} />
            Sync Now
          </button>
        </span>
      </div>

      {/* 1. Full-Width Wide View OC Admin Panel at the Top */}
      <section style={{ marginBottom: '18px' }}>
        <AdminDealForm
          deals={deals}
          evaluations={evaluations}
          onAddEvaluation={handleAddEvaluation}
          onBulkAddEvaluations={handleBulkAddEvaluations}
          setToast={setToast}
        />
      </section>


      {/* 2. Market Overview & Main Content below the OC Admin Panel */}
      <section className="grid">
        <div>
          <MarketOverview deals={deals} />

          {/* Main Segmented Tab Control */}
          <div className="main-tab-bar" style={{ display: 'flex', gap: '8px', margin: '18px 0 12px' }}>
            <button 
              className={`main-tab-btn ${mainTab === 'deals' ? 'active' : ''}`}
              onClick={() => setMainTab('deals')}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: '10px', fontWeight: 800, fontSize: '0.9rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: mainTab === 'deals' ? 'linear-gradient(135deg, var(--gold), var(--orange))' : 'rgba(255,255,255,0.04)',
                color: mainTab === 'deals' ? '#08111f' : 'var(--muted)', border: '1px solid var(--line)', transition: 'all 0.2s ease'
              }}
            >
              <Database size={16} />
              Executed Deals Ledger ({deals.length})
            </button>
            <button 
              className={`main-tab-btn ${mainTab === 'evaluations' ? 'active' : ''}`}
              onClick={() => setMainTab('evaluations')}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: '10px', fontWeight: 800, fontSize: '0.9rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: mainTab === 'evaluations' ? 'linear-gradient(135deg, #32d583, #86f3ba)' : 'rgba(255,255,255,0.04)',
                color: mainTab === 'evaluations' ? '#08111f' : 'var(--muted)', border: '1px solid var(--line)', transition: 'all 0.2s ease'
              }}
            >
              <Award size={16} />
              Round 2 Pitch Scoreboard ({evaluations.length})
            </button>
          </div>

          {mainTab === 'deals' ? (
            <DealsTable
              deals={deals}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              onExport={handleExportCSV}
              onDeleteDeal={handleDeleteDeal}
            />
          ) : (
            <EvaluationTable 
              evaluations={evaluations}
              onDeleteEvaluation={handleDeleteEvaluation}
            />
          )}
        </div>

        <aside>
          <LatestDeals deals={deals} />
        </aside>
      </section>

      {/* Enlarged Deals Done Carousel Modal */}
      <EnlargedCarouselModal 
        isOpen={isCarouselOpen}
        onClose={() => setIsCarouselOpen(false)}
        deals={deals}
      />

      {/* Toast Alert Notification */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'error' ? (
            <AlertCircle className="red" size={20} />
          ) : (
            <CheckCircle2 className="green" size={20} />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <footer className="footer">
        <span>HACQUIRE 2026 &bull; MongoDB Atlas (hacquire) Connected &bull; Real-Time Market Board</span>
        <span>&bull;</span>
        <button className="reset-btn" onClick={handleResetDefaults}>
          <RefreshCw size={12} style={{ display: 'inline', marginRight: '4px' }} />
          Reset Demo Data
        </button>
      </footer>
    </main>
  );
}
