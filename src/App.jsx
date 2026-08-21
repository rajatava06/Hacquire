import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import TickerBar from './components/TickerBar';
import MarketOverview from './components/MarketOverview';
import DealsTable from './components/DealsTable';
import EvaluationTable from './components/EvaluationTable';
import LatestDeals from './components/LatestDeals';
import AdminDealForm from './components/AdminDealForm';
import EnlargedCarouselModal from './components/EnlargedCarouselModal';
import { 
  fetchDealsFromDB, 
  saveDealToDB, 
  bulkSaveDealsToDB, 
  deleteDealFromDB, 
  subscribeToDealsDB 
} from './utils/db';
import {
  fetchEvaluationsFromDB,
  saveEvaluationToDB,
  bulkSaveEvaluationsToDB,
  deleteEvaluationFromDB
} from './utils/dbEvaluations';
import { exportToCSV, DEFAULT_DEALS } from './utils/dealsData';
import { DEFAULT_EVALUATIONS } from './utils/evaluationData';
import { AlertCircle, CheckCircle2, RefreshCw, Database, Award } from 'lucide-react';

export default function App() {
  const [deals, setDeals] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [mainTab, setMainTab] = useState('deals'); // 'deals' | 'evaluations'
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [lastUpdated, setLastUpdated] = useState('');
  const [toast, setToast] = useState(null);
  const [isCarouselOpen, setIsCarouselOpen] = useState(false);

  // Initial DB Load & Real-Time Sync Subscription
  useEffect(() => {
    async function loadData() {
      const dealsData = await fetchDealsFromDB();
      setDeals(dealsData);

      const evalsData = await fetchEvaluationsFromDB();
      setEvaluations(evalsData);

      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    loadData();

    const unsubscribe = subscribeToDealsDB((updatedDeals) => {
      setDeals(updatedDeals);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    });

    return () => unsubscribe();
  }, []);

  // Auto-dismiss toast notification
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Deal handlers
  const handleAddDeal = useCallback(async (newDeal) => {
    const updated = await saveDealToDB(newDeal);
    setDeals(updated);
    setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, []);

  const handleBulkAddDeals = useCallback(async (newDealsArray) => {
    const updated = await bulkSaveDealsToDB(newDealsArray);
    setDeals(updated);
    setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, []);

  const handleDeleteDeal = useCallback(async (dealId) => {
    if (window.confirm(`Are you sure you want to delete Deal ID ${dealId}?`)) {
      const updated = await deleteDealFromDB(dealId);
      setDeals(updated);
      setToast({ type: 'success', message: `Deal ${dealId} deleted.` });
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
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
    if (window.confirm('Reset all deals and pitch evaluations back to initial default dataset?')) {
      const updatedDeals = await bulkSaveDealsToDB(DEFAULT_DEALS);
      setDeals(updatedDeals);

      const updatedEvals = await bulkSaveEvaluationsToDB(DEFAULT_EVALUATIONS);
      setEvaluations(updatedEvals);

      setToast({ type: 'success', message: 'Deals and Evaluations reset to default dataset.' });
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

      {/* 1. Full-Width Wide View OC Admin Panel at the Top */}
      <section style={{ marginBottom: '18px' }}>
        <AdminDealForm
          deals={deals}
          evaluations={evaluations}
          onAddDeal={handleAddDeal}
          onBulkAddDeals={handleBulkAddDeals}
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
