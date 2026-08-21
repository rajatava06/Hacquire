import React, { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  parseExcelFile, 
  parseEvaluationExcelFile,
  downloadExcelTemplate, 
  downloadEvaluationTemplate 
} from '../utils/excelHelper';
import { REGISTERED_TEAMS, validateTeam, findTeamName } from '../utils/teamsData';
import { 
  PlusCircle, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  FileSpreadsheet, 
  UploadCloud, 
  Download, 
  Check, 
  Award,
  Layers,
  Link,
  DollarSign
} from 'lucide-react';

export default function AdminDealForm({ 
  deals = [], 
  evaluations = [],
  onAddDeal, 
  onBulkAddDeals, 
  onAddEvaluation,
  onBulkAddEvaluations,
  setToast 
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [sectionMode, setSectionMode] = useState('deals'); // 'deals' | 'evaluations'
  const [activeTab, setActiveTab] = useState('excel'); // 'excel' | 'single'

  // Single deal state with all 11 attributes
  const [dealId, setDealId] = useState('');
  const [time, setTime] = useState('');
  const [dealType, setDealType] = useState('Feature Acquisition');
  const [seller, setSeller] = useState('');
  const [sellerPs, setSellerPs] = useState('');
  const [asset, setAsset] = useState('');
  const [github, setGithub] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [buyer, setBuyer] = useState('');
  const [buyerPs, setBuyerPs] = useState('');
  const [price, setPrice] = useState(''); // Negotiated Price
  const [sebiStatus, setSebiStatus] = useState('Approved');

  // Single Evaluation state
  const [teamId, setTeamId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [dealsExecuted, setDealsExecuted] = useState(1);
  const [dealStatus, setDealStatus] = useState('QUALIFIED');
  const [strategicRationale, setStrategicRationale] = useState('');
  const [valuationPricing, setValuationPricing] = useState('');
  const [integrationQuality, setIntegrationQuality] = useState('');
  const [feedback, setFeedback] = useState('');

  // Excel Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [parsedRows, setParsedRows] = useState(null);
  const [parsedEvalRows, setParsedEvalRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef(null);

  // Single Deal Submission (11 Attributes)
  const handleSingleSubmit = (e) => {
    e.preventDefault();

    const trimmedId = dealId.trim() || `D-${String(Math.floor(100 + Math.random() * 900))}`;
    const trimmedBuyer = buyer.trim();
    const trimmedSeller = seller.trim();
    const trimmedAsset = asset.trim();

    if (!trimmedBuyer || !trimmedSeller || !trimmedAsset || !price) {
      setToast({ type: 'error', message: 'Please fill in all required fields (Seller, Buyer, Asset, Price).' });
      return;
    }

    if (!validateTeam(trimmedBuyer)) {
      setToast({ type: 'error', message: `Buyer "${trimmedBuyer}" is not a registered team name or code.` });
      return;
    }

    if (!validateTeam(trimmedSeller)) {
      setToast({ type: 'error', message: `Seller "${trimmedSeller}" is not a registered team name or code.` });
      return;
    }

    const exists = deals.some(d => d.id.toLowerCase() === trimmedId.toLowerCase());
    if (exists) {
      setToast({ type: 'error', message: `Deal ID "${trimmedId}" already exists. Use a unique ID.` });
      return;
    }

    const currentTime = time.trim() || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const normalizedBuyer = findTeamName(trimmedBuyer);
    const normalizedSeller = findTeamName(trimmedSeller);

    const newDeal = {
      id: trimmedId,
      time: currentTime,
      type: dealType,
      seller: normalizedSeller,
      sellerPs: sellerPs.trim(),
      asset: trimmedAsset,
      github: github.trim(),
      askingPrice: askingPrice ? Number(askingPrice) : 0,
      buyer: normalizedBuyer,
      buyerPs: buyerPs.trim(),
      price: dealType === 'Full Merger' ? price : Number(price), // Negotiated Price
      sebiStatus: sebiStatus
    };

    onAddDeal(newDeal);
    setToast({ type: 'success', message: `Deal ${trimmedId} registered successfully!` });

    try {
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.8 }, colors: ['#ff7a18', '#ffbf3f', '#32d583'] });
    } catch (err) {}

    // Reset Form
    setDealId(''); setTime(''); setDealType('Feature Acquisition');
    setSeller(''); setSellerPs(''); setAsset(''); setGithub('');
    setAskingPrice(''); setBuyer(''); setBuyerPs(''); setPrice(''); setSebiStatus('Approved');
  };

  // Single Evaluation Submission
  const handleSingleEvalSubmit = (e) => {
    e.preventDefault();
    if (!teamId || !teamName) {
      setToast({ type: 'error', message: 'Team ID and Team Name are required.' });
      return;
    }

    const rat = parseFloat(strategicRationale) || 0;
    const val = parseFloat(valuationPricing) || 0;
    const intQ = parseFloat(integrationQuality) || 0;
    const totalScore = rat + val + intQ;
    const execCount = parseInt(dealsExecuted, 10) || 0;
    const status = execCount === 0 ? 'NO DEALS - INELIGIBLE' : dealStatus;

    const newEval = {
      teamId: teamId.trim(),
      teamName: teamName.trim(),
      problemStatement: problemStatement.trim() || 'General Track',
      dealsExecuted: execCount,
      dealStatus: status,
      strategicRationale: rat,
      valuationPricing: val,
      integrationQuality: intQ,
      totalScore,
      feedback: feedback.trim() || 'Evaluated live during pitch.'
    };

    if (onAddEvaluation) {
      onAddEvaluation(newEval);
      setToast({ type: 'success', message: `Evaluation saved for ${teamName} (${totalScore} pts)!` });
    }

    setTeamId(''); setTeamName(''); setProblemStatement(''); setStrategicRationale('');
    setValuationPricing(''); setIntegrationQuality(''); setFeedback('');
  };

  // Process uploaded Excel / CSV file
  const processFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setToast({ type: 'error', message: 'Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file.' });
      return;
    }

    setIsParsing(true);
    setFileName(file.name);

    try {
      if (sectionMode === 'deals') {
        const rows = await parseExcelFile(file);
        const normalizedRows = rows.map(r => ({
          ...r,
          buyer: findTeamName(r.buyer),
          seller: findTeamName(r.seller)
        }));

        setParsedRows(normalizedRows);
        setToast({ type: 'success', message: `Parsed ${rows.length} deal rows from "${file.name}"!` });
      } else {
        const evals = await parseEvaluationExcelFile(file);
        setParsedEvalRows(evals);
        setToast({ type: 'success', message: `Parsed ${evals.length} evaluation score rows from "${file.name}"!` });
      }
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Error parsing file.' });
      setParsedRows(null);
      setParsedEvalRows(null);
      setFileName('');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleImportParsedDeals = () => {
    if (!parsedRows || parsedRows.length === 0) return;
    onBulkAddDeals(parsedRows);
    setToast({ type: 'success', message: `Successfully imported ${parsedRows.length} deals to MongoDB!` });
    setParsedRows(null);
    setFileName('');
  };

  const handleImportParsedEvaluations = () => {
    if (!parsedEvalRows || parsedEvalRows.length === 0) return;
    if (onBulkAddEvaluations) {
      onBulkAddEvaluations(parsedEvalRows);
      setToast({ type: 'success', message: `Successfully imported ${parsedEvalRows.length} pitch evaluations to MongoDB!` });
    }
    setParsedEvalRows(null);
    setFileName('');
  };

  return (
    <div className="admin card">
      <div className="admin-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="admin-title">
          <ShieldCheck size={22} />
          OC Admin Console — 11-Attribute Deal & Evaluation Desk
        </div>
        <div className="toggle-icon">
          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {isOpen && (
        <>
          {/* Main Section Mode Switcher */}
          <div className="section-mode-bar" style={{ display: 'flex', gap: '12px', marginTop: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
            <button 
              className={`mode-btn ${sectionMode === 'deals' ? 'active' : ''}`}
              onClick={() => { setSectionMode('deals'); setParsedRows(null); setParsedEvalRows(null); }}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer',
                background: sectionMode === 'deals' ? 'linear-gradient(135deg, #ff7a18, #ffbf3f)' : 'rgba(255,255,255,0.05)',
                color: sectionMode === 'deals' ? '#111' : 'var(--muted)', border: 'none'
              }}
            >
              <Layers size={16} style={{ display: 'inline', marginRight: '6px' }} />
              1. Live Deals Management (11 Attributes)
            </button>
            <button 
              className={`mode-btn ${sectionMode === 'evaluations' ? 'active' : ''}`}
              onClick={() => { setSectionMode('evaluations'); setParsedRows(null); setParsedEvalRows(null); }}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer',
                background: sectionMode === 'evaluations' ? 'linear-gradient(135deg, #32d583, #86f3ba)' : 'rgba(255,255,255,0.05)',
                color: sectionMode === 'evaluations' ? '#111' : 'var(--muted)', border: 'none'
              }}
            >
              <Award size={16} style={{ display: 'inline', marginRight: '6px' }} />
              2. Round 2 Pitch Scoreboard
            </button>
          </div>

          {/* Sub Tab Bar */}
          <div className="admin-tabs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 16px' }}>
            <div className="tabs-left" style={{ display: 'flex', gap: '8px' }}>
              <button 
                className={`tab-btn ${activeTab === 'excel' ? 'active' : ''}`}
                onClick={() => setActiveTab('excel')}
              >
                <FileSpreadsheet size={16} />
                Bulk Excel Upload
              </button>
              <button 
                className={`tab-btn ${activeTab === 'single' ? 'active' : ''}`}
                onClick={() => setActiveTab('single')}
              >
                <PlusCircle size={16} />
                11-Attribute Manual Registration
              </button>
            </div>

            <button 
              className="template-btn" 
              onClick={sectionMode === 'deals' ? downloadExcelTemplate : downloadEvaluationTemplate}
              title="Download pre-filled Excel demo template"
            >
              <Download size={14} />
              {sectionMode === 'deals' ? '11-Attribute Deals Template (.xlsx)' : 'Pitch Scorecard Template (.xlsx)'}
            </button>
          </div>

          {activeTab === 'excel' ? (
            <div className="excel-uploader-wrapper">
              <div 
                className={`dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => e.target.files && processFile(e.target.files[0])}
                  accept=".xlsx,.xls,.csv" 
                  style={{ display: 'none' }} 
                />

                <UploadCloud size={40} className="upload-icon" />

                {fileName ? (
                  <div className="file-info">
                    <strong>Selected: {fileName}</strong>
                    <span className="green">
                      {sectionMode === 'deals' 
                        ? (parsedRows ? `${parsedRows.length} deal rows parsed!` : 'Parsing file...') 
                        : (parsedEvalRows ? `${parsedEvalRows.length} team evaluation rows parsed!` : 'Parsing file...')}
                    </span>
                  </div>
                ) : (
                  <div>
                    <strong>Drop your {sectionMode === 'deals' ? '11-Attribute Deals' : 'Pitch Evaluation'} Excel / CSV sheet here, or click to browse</strong>
                    <p className="note-text">
                      {sectionMode === 'deals' 
                        ? 'Headers: Time, Deal Type, Seller Name, Seller PS Track, Asset Name, Github Link, Asking Price, Buyer Team Name, Buyer PS Track, Negotiated Price (Cr), SEBI Status' 
                        : 'Headers: Team ID, Team Name, Rationale (15), Valuation (10), Integration (15)'}
                    </p>
                  </div>
                )}
              </div>

              {/* Parsed Deals Preview List */}
              {sectionMode === 'deals' && parsedRows && parsedRows.length > 0 && (
                <div className="excel-preview-box" style={{ marginTop: '16px' }}>
                  <div className="preview-header">
                    <span>Detected {parsedRows.length} Deals:</span>
                    <button className="import-btn" onClick={handleImportParsedDeals}>
                      <Check size={16} />
                      Import All {parsedRows.length} Deals to MongoDB
                    </button>
                  </div>
                  <div className="preview-table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th><th>Time</th><th>Type</th><th>Seller</th><th>Asset</th><th>Buyer</th><th>Asking</th><th>Negotiated</th><th>SEBI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td>{r.id}</td>
                            <td>{r.time}</td>
                            <td><span className="pill feature">{r.type}</span></td>
                            <td>{r.seller}</td>
                            <td>{r.asset}</td>
                            <td>{r.buyer}</td>
                            <td>₹{r.askingPrice} Cr</td>
                            <td><strong style={{ color: 'var(--gold)' }}>₹{r.price} Cr</strong></td>
                            <td><span className={`pill ${r.sebiStatus === 'Approved' ? 'feature' : 'merger'}`}>{r.sebiStatus}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Parsed Evaluations Preview List */}
              {sectionMode === 'evaluations' && parsedEvalRows && parsedEvalRows.length > 0 && (
                <div className="excel-preview-box" style={{ marginTop: '16px' }}>
                  <div className="preview-header">
                    <span>Detected {parsedEvalRows.length} Team Evaluations:</span>
                    <button className="import-btn" onClick={handleImportParsedEvaluations} style={{ background: 'linear-gradient(135deg, #32d583, #86f3ba)', color: '#111' }}>
                      <Check size={16} />
                      Import {parsedEvalRows.length} Evaluations to MongoDB
                    </button>
                  </div>
                  <div className="preview-table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Team ID</th><th>Team Name</th><th>Track</th><th>Status</th><th>Rationale (/15)</th><th>Valuation (/10)</th><th>Integration (/15)</th><th>Total (/40)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedEvalRows.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td>{r.teamId}</td>
                            <td><strong>{r.teamName}</strong></td>
                            <td>{r.problemStatement}</td>
                            <td><span className={`pill ${r.dealStatus.includes('QUALIFIED') ? 'feature' : 'merger'}`}>{r.dealStatus}</span></td>
                            <td>{r.strategicRationale}</td>
                            <td>{r.valuationPricing}</td>
                            <td>{r.integrationQuality}</td>
                            <td><strong style={{ color: 'var(--gold)' }}>{r.totalScore}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : sectionMode === 'deals' ? (
            /* Single Deal Form (11 Attributes) */
            <form onSubmit={handleSingleSubmit} className="form-grid">
              <input
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                placeholder="Deal ID (e.g. D-001)"
              />

              <input
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="Time (e.g. 10:48 AM)"
              />

              <select 
                value={dealType} 
                onChange={(e) => setDealType(e.target.value)} 
                required
              >
                <option value="Feature Acquisition">Feature Acquisition</option>
                <option value="Consulting Slot">Consulting Slot</option>
                <option value="Full Merger">Full Merger</option>
              </select>

              <select 
                value={sebiStatus} 
                onChange={(e) => setSebiStatus(e.target.value)} 
                required
              >
                <option value="Approved">SEBI Status: Approved</option>
                <option value="Pending">SEBI Status: Pending</option>
                <option value="Rejected">SEBI Status: Rejected</option>
              </select>

              <input
                value={seller}
                onChange={(e) => setSeller(e.target.value)}
                placeholder="Seller Name (e.g. MATRIX)"
                list="registered-teams-list"
                required
              />

              <input
                value={sellerPs}
                onChange={(e) => setSellerPs(e.target.value)}
                placeholder="Seller PS Track (e.g. PS8: The Shopkeeper's Day)"
              />

              <input
                value={buyer}
                onChange={(e) => setBuyer(e.target.value)}
                placeholder="Buyer Team Name (e.g. CodeCrafters)"
                list="registered-teams-list"
                required
              />

              <input
                value={buyerPs}
                onChange={(e) => setBuyerPs(e.target.value)}
                placeholder="Buyer PS Track (e.g. PS1: Smart Campus)"
              />

              <input
                className="full"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                placeholder="Asset Name (e.g. Route Optimisation Engine)"
                required
              />

              <input
                className="full"
                type="url"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="Github Link (e.g. https://github.com/...)"
              />

              <input
                type="number"
                min="0"
                step="0.25"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="Asking Price (₹ Cr)"
              />

              <input
                type="number"
                min="0"
                step="0.25"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={dealType === 'Full Merger' ? "Negotiated Price (% share)" : "Negotiated Price (₹ Cr)"}
                required
              />

              <button className="full" type="submit">
                <PlusCircle size={18} />
                Register 11-Attribute Deal
              </button>

              <datalist id="registered-teams-list">
                {REGISTERED_TEAMS.map((t, idx) => (
                  <option key={idx} value={t.code}>{t.name} ({t.code})</option>
                ))}
              </datalist>
            </form>
          ) : (
            /* Single Evaluation Form */
            <form onSubmit={handleSingleEvalSubmit} className="form-grid">
              <input
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                placeholder="Team ID (e.g. T-01)"
                required
              />

              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team Name (e.g. CodeCrafters)"
                required
              />

              <input
                className="full"
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                placeholder="Problem Statement Track (e.g. PS8: The Shopkeeper's Day)"
              />

              <input
                type="number"
                min="0"
                value={dealsExecuted}
                onChange={(e) => setDealsExecuted(e.target.value)}
                placeholder="Deals Executed (Min 1)"
                required
              />

              <select 
                value={dealStatus}
                onChange={(e) => setDealStatus(e.target.value)}
              >
                <option value="QUALIFIED">QUALIFIED</option>
                <option value="NO DEALS - INELIGIBLE">NO DEALS - INELIGIBLE</option>
              </select>

              <input
                type="number"
                min="0"
                max="15"
                step="0.5"
                value={strategicRationale}
                onChange={(e) => setStrategicRationale(e.target.value)}
                placeholder="Strategic Rationale (Max 15)"
                required
              />

              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={valuationPricing}
                onChange={(e) => setValuationPricing(e.target.value)}
                placeholder="Valuation and Pricing (Max 10)"
                required
              />

              <input
                type="number"
                min="0"
                max="15"
                step="0.5"
                value={integrationQuality}
                onChange={(e) => setIntegrationQuality(e.target.value)}
                placeholder="Integration Quality (Max 15)"
                required
              />

              <input
                className="full"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Judge Feedback / Rationale Defense Notes"
              />

              <button className="full" type="submit" style={{ background: 'linear-gradient(135deg, #32d583, #86f3ba)', color: '#111' }}>
                <Award size={18} />
                Save Pitch Evaluation Score
              </button>
            </form>
          )}

          <p className="note">
            All 11 deal attributes sync live to MongoDB Atlas <strong>(Database: hacquire)</strong>!
          </p>
        </>
      )}
    </div>
  );
}
