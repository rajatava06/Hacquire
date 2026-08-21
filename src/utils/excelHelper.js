import * as XLSX from 'xlsx';

/**
 * Normalizes dynamic column headers for Deals from Excel or CSV files matching all 11 attributes:
 * Time, Deal Type, Seller Name, Seller PS Track, Asset Name, Github Link, Asking Price, Buyer Team Name, Buyer PS Track, Negotiated Price (Cr), SEBI Status
 */
function normalizeRow(row, index) {
  const getVal = (...possibleKeys) => {
    for (const key of Object.keys(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const target of possibleKeys) {
        if (cleanKey.includes(target)) {
          return String(row[key]).trim();
        }
      }
    }
    return '';
  };

  const rawId = getVal('dealid', 'id', 'code') || `D-${String(100 + index).padStart(3, '0')}`;
  const rawTime = getVal('time', 'timestamp', 'date') || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Deal Type
  let rawType = getVal('dealtype', 'type', 'category') || 'Feature Acquisition';
  const typeLower = rawType.toLowerCase();
  if (typeLower.includes('consult')) rawType = 'Consulting Slot';
  else if (typeLower.includes('merger') || typeLower.includes('full')) rawType = 'Full Merger';
  else rawType = 'Feature Acquisition';

  // Seller
  const rawSeller = getVal('sellername', 'sellerteam', 'seller', 'vendor') || 'Anonymous Seller';
  const rawSellerPs = getVal('sellerpstrack', 'sellerps', 'sellertrack', 'strack') || '';

  // Asset & Github
  const rawAsset = getVal('assetname', 'asset', 'feature', 'slot', 'deal', 'name') || 'Unspecified Asset';
  const rawGithub = getVal('githublink', 'github', 'repo', 'url', 'git') || '';

  // Asking Price
  const rawAskingStr = getVal('askingprice', 'asking', 'initialprice') || '0';
  const rawAskingNum = parseFloat(rawAskingStr.replace(/[^0-9.]/g, '')) || 0;

  // Buyer
  const rawBuyer = getVal('buyerteamname', 'buyerteam', 'buyer', 'purchaser') || 'Anonymous Buyer';
  const rawBuyerPs = getVal('buyerpstrack', 'buyerps', 'buyertrack', 'btrack') || '';

  // Negotiated Price
  const rawPriceStr = getVal('negotiatedpricecr', 'negotiatedprice', 'finalbargainprice', 'price', 'prizeshare', 'cost', 'amount') || '0';
  const rawPriceNum = parseFloat(rawPriceStr.replace(/[^0-9.]/g, '')) || 0;

  // SEBI Status
  let rawSebi = getVal('sebistatus', 'sebi', 'status', 'approval') || 'Approved';
  const sebiLower = rawSebi.toLowerCase();
  if (sebiLower.includes('reject')) rawSebi = 'Rejected';
  else if (sebiLower.includes('pend')) rawSebi = 'Pending';
  else rawSebi = 'Approved';

  return {
    id: rawId,
    time: rawTime,
    type: rawType,
    seller: rawSeller,
    sellerPs: rawSellerPs,
    asset: rawAsset,
    github: rawGithub,
    askingPrice: rawAskingNum,
    buyer: rawBuyer,
    buyerPs: rawBuyerPs,
    price: rawType === 'Full Merger' ? (rawPriceStr || `${rawPriceNum}`) : rawPriceNum,
    sebiStatus: rawSebi
  };
}

/**
 * Normalizes dynamic column headers for Round 2 Pitch & Dealmaking Evaluations.
 */
function normalizeEvalRow(row, index) {
  const getVal = (...possibleKeys) => {
    for (const key of Object.keys(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const target of possibleKeys) {
        if (cleanKey.includes(target)) {
          return String(row[key]).trim();
        }
      }
    }
    return '';
  };

  const teamId = getVal('teamid', 'id', 'code') || `T-${String(index + 1).padStart(2, '0')}`;
  const teamName = getVal('teamname', 'team', 'name') || `Team ${teamId}`;
  const problemStatement = getVal('problemstatementtrack', 'problemstatement', 'track', 'ps') || 'General Track';
  const dealsExecuted = parseInt(getVal('dealsexecuted', 'deals', 'min1'), 10) || 0;
  
  let dealStatus = getVal('mandatorydealstatus', 'dealstatus', 'status') || (dealsExecuted > 0 ? 'QUALIFIED' : 'NO DEALS - INELIGIBLE');
  if (!dealStatus.toUpperCase().includes('QUALIFIED')) {
    dealStatus = dealsExecuted > 0 ? 'QUALIFIED' : 'NO DEALS - INELIGIBLE';
  }

  const strategicRationale = parseFloat(getVal('strategicrationale', 'strategic', 'rationale')) || 0;
  const valuationPricing = parseFloat(getVal('valuationandpricing', 'valuation', 'pricing')) || 0;
  const integrationQuality = parseFloat(getVal('integrationquality', 'integration', 'quality')) || 0;
  
  const calculatedTotal = strategicRationale + valuationPricing + integrationQuality;
  const totalScore = parseFloat(getVal('totaldealmakingscore', 'totaldealmaking', 'totalscore', 'total')) || calculatedTotal;

  const feedback = getVal('judgefeedbacknotes', 'judgefeedback', 'notes', 'feedback', 'comments') || 'Evaluated live during formal pitch.';

  return {
    teamId,
    teamName,
    problemStatement,
    dealsExecuted,
    dealStatus,
    strategicRationale,
    valuationPricing,
    integrationQuality,
    totalScore,
    feedback
  };
}

/**
 * Parses an Excel (.xlsx, .xls) or .csv file into deal objects with 11 attributes.
 */
export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          reject(new Error('The uploaded sheet contains no valid data rows.'));
          return;
        }

        const parsedDeals = rawRows.map((row, idx) => normalizeRow(row, idx));
        resolve(parsedDeals);
      } catch (err) {
        reject(new Error(`Failed to parse Excel file: ${err.message}`));
      }
    };

    reader.onerror = () => reject(new Error('Error reading file.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parses an Excel or CSV file containing Round 2 Pitch & Dealmaking Evaluations.
 */
export function parseEvaluationExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          reject(new Error('The uploaded evaluation sheet contains no valid rows.'));
          return;
        }

        const validRows = rawRows.filter(r => {
          const keysStr = Object.keys(r).join(' ').toLowerCase();
          return keysStr.includes('team') || keysStr.includes('id') || r['Team ID'] || r['Team Name'];
        });

        const parsedEvals = (validRows.length ? validRows : rawRows)
          .map((row, idx) => normalizeEvalRow(row, idx))
          .filter(e => e.teamName && e.teamName !== 'Anonymous Team');

        resolve(parsedEvals);
      } catch (err) {
        reject(new Error(`Failed to parse Evaluation Excel file: ${err.message}`));
      }
    };

    reader.onerror = () => reject(new Error('Error reading evaluation file.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Downloads a sample pre-filled Deals Excel demo template file containing all 11 attributes.
 */
export function downloadExcelTemplate() {
  const sampleData = [
    {
      'Deal ID': 'D-001',
      'Time': '10:48 AM',
      'Deal Type': 'Feature Acquisition',
      'Seller Name': 'MATRIX',
      'Seller PS Track': "PS8: The Shopkeeper's Day",
      'Asset Name': 'Route Optimisation Engine',
      'Github Link': 'https://github.com/nirmalyajena01-lgtm',
      'Asking Price': 5.00,
      'Buyer Team Name': 'CodeCrafters',
      'Buyer PS Track': 'PS1: Smart Campus Emergency Response',
      'Negotiated Price (Cr)': 4.00,
      'SEBI Status': 'Approved'
    },
    {
      'Deal ID': 'D-002',
      'Time': '10:56 AM',
      'Deal Type': 'Feature Acquisition',
      'Seller Name': 'PARADOX',
      'Seller PS Track': 'PS4: Farmer-to-Market Platform',
      'Asset Name': 'OCR & WhatsApp Payment Module',
      'Github Link': 'https://github.com/Shaswata-codes',
      'Asking Price': 4.50,
      'Buyer Team Name': 'ByteBrigade',
      'Buyer PS Track': 'PS9: Getting Paid',
      'Negotiated Price (Cr)': 3.50,
      'SEBI Status': 'Approved'
    },
    {
      'Deal ID': 'D-003',
      'Time': '11:08 AM',
      'Deal Type': 'Consulting Slot',
      'Seller Name': 'CYPHER SQUAD',
      'Seller PS Track': 'PS3: Health Monitoring Platform',
      'Asset Name': 'Emergency Dispatch Consulting',
      'Github Link': 'https://github.com/Koustavdas-cloud',
      'Asking Price': 3.00,
      'Buyer Team Name': 'HyperLog',
      'Buyer PS Track': 'PS1: Smart Campus Emergency Response',
      'Negotiated Price (Cr)': 2.75,
      'SEBI Status': 'Approved'
    },
    {
      'Deal ID': 'D-004',
      'Time': '11:27 AM',
      'Deal Type': 'Full Merger',
      'Seller Name': 'T-08',
      'Seller PS Track': 'PS4: Farmer-to-Market',
      'Asset Name': 'Market Price Pipeline Merger',
      'Github Link': 'https://github.com/MandiTech-org',
      'Asking Price': 25.00,
      'Buyer Team Name': 'MandiTech',
      'Buyer PS Track': 'PS4: Farmer-to-Market Decision Platform',
      'Negotiated Price (Cr)': 20.00,
      'SEBI Status': 'Approved'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  worksheet['!cols'] = [
    { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 30 }, { wch: 35 }, { wch: 15 }, { wch: 18 }, { wch: 32 }, { wch: 22 }, { wch: 14 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hacquire Official Deals');
  XLSX.writeFile(workbook, 'hacquire_deals_11_attributes_template.xlsx');
}

/**
 * Downloads a sample pre-filled Pitch & Dealmaking Evaluation Excel demo template file.
 */
export function downloadEvaluationTemplate() {
  const sampleData = [
    {
      'Team ID': 'T-01',
      'Team Name': 'CodeCrafters',
      'Problem Statement Track': "PS8: The Shopkeeper's Day",
      'Deals Executed (Min 1)': 2,
      'Mandatory Deal Status': 'QUALIFIED',
      'Strategic Rationale (Max 15)': 13.5,
      'Valuation and Pricing (Max 10)': 9.0,
      'Integration Quality (Max 15)': 14.0,
      'Total Dealmaking Score (Max 40)': 36.5,
      'Judge Feedback / Notes': 'Acquired route engine; great synergy and live working demo.'
    },
    {
      'Team ID': 'T-02',
      'Team Name': 'ByteBrigade',
      'Problem Statement Track': 'PS9: Getting Paid',
      'Deals Executed (Min 1)': 1,
      'Mandatory Deal Status': 'QUALIFIED',
      'Strategic Rationale (Max 15)': 12.0,
      'Valuation and Pricing (Max 10)': 8.0,
      'Integration Quality (Max 15)': 13.0,
      'Total Dealmaking Score (Max 40)': 33.0,
      'Judge Feedback / Notes': 'Bought OCR module, clean WhatsApp payment integration.'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  worksheet['!cols'] = [
    { wch: 10 }, { wch: 18 }, { wch: 35 }, { wch: 22 }, { wch: 22 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 28 }, { wch: 45 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pitch Evaluations');
  XLSX.writeFile(workbook, 'hacquire_round2_evaluation_template.xlsx');
}
