import https from 'https';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://stones741banks_db_user:6rxSSIivYhs4tqCZ@hacquire.6dnd9d6.mongodb.net/?appName=hacquire';
const DB_NAME = process.env.DATABASE_NAME || 'hacquire';

// Both SEBI Desk sheets — fetch Consolidated_Live_Feed from each
const SHEET_SOURCES = [
  {
    id: '1jhUKhxEkY5mfgJNHnvHgIKQ5PWEMLkgNgeqWKy255zk',
    label: 'Hall-A',
    consolidatedTab: 'Consolidated_Live_Feed'
  },
  {
    id: '1Ji0QTIKxeNA2sb6wzUIi5LjGOVg-kOqogZHbtWDQioI',
    label: 'Hall-B',
    consolidatedTab: 'Consolidated_Live_Feed'
  }
];

let cachedClient = null;

async function getMongoDb() {
  if (!cachedClient) {
    cachedClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    await cachedClient.connect();
  }
  return cachedClient.db(DB_NAME);
}

/** Fetch a URL following redirects */
function fetchText(urlStr) {
  return new Promise((resolve, reject) => {
    https.get(urlStr, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchText(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/** RFC-compliant CSV row parser (handles quoted commas) */
function parseCSVRow(line) {
  const cols = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (c === ',' && !inQuote) {
      cols.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  cols.push(cur.trim());
  return cols;
}

function parseCSV(text) {
  return text.split('\n')
    .map(l => l.replace(/\r$/, ''))
    .filter(l => l.trim())
    .map(parseCSVRow);
}

function normalizeSebi(raw) {
  const s = (raw || '').trim().toLowerCase();
  if (s === 'approved') return 'Approved';
  if (s === 'rejected') return 'Rejected';
  if (s === 'pending') return 'Pending';
  return 'Pending';
}

function normalizePrice(raw) {
  if (!raw || raw.trim() === '') return '';
  const cleaned = raw.replace(/[₹,\s]/g, '').replace(/cr$/i, '').replace(/super\s*vision/i, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? raw.trim() : n;
}

function normalizeTime(raw) {
  if (!raw || raw.trim() === '') return '';
  const s = raw.trim();
  if (s.includes(':')) return s;
  // Excel decimal fraction → HH:MM AM/PM
  const num = parseFloat(s);
  if (!isNaN(num) && num >= 0 && num <= 1) {
    const totalMins = Math.round(num * 24 * 60);
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  return s;
}

function makeDealId(label, rowIdx, time, seller, buyer) {
  return `${label}-${time}-${seller}-${buyer}-${rowIdx}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 80);
}

/** Parse CSV rows into deal objects (rows 0-3 are header, data starts row 4) */
function parseRows(rows, label) {
  const deals = [];
  const dataRows = rows.slice(4);
  for (let i = 0; i < dataRows.length; i++) {
    const cols = dataRows[i];
    const time = normalizeTime(cols[0] || '');
    const type = (cols[1] || '').trim() || 'Feature Acquisition';
    const seller = (cols[2] || '').trim();
    const sellerPs = (cols[3] || '').trim();
    const asset = (cols[4] || '').trim();
    const github = (cols[5] || '').trim();
    const askingPrice = normalizePrice(cols[6] || '');
    const buyer = (cols[7] || '').trim();
    const buyerPs = (cols[8] || '').trim();
    const price = normalizePrice(cols[9] || '');
    const sebiStatus = normalizeSebi(cols[10] || '');
    if (!seller && !buyer && !asset) continue;
    if (!time && !seller) continue;
    deals.push({
      id: makeDealId(label, i, time, seller, buyer),
      time, type, seller, sellerPs, asset, github,
      askingPrice, buyer, buyerPs, price, sebiStatus,
      _source: label
    });
  }
  return deals;
}

/** Fetch one sheet's Consolidated_Live_Feed tab */
async function fetchOneSheet(source) {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${source.id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(source.consolidatedTab)}`;
  try {
    const text = await fetchText(csvUrl);
    if (text.trim().startsWith('<')) {
      console.warn(`[Sheets Sync] ${source.label}: returned HTML (sheet may be private)`);
      return [];
    }
    const rows = parseCSV(text);
    const deals = parseRows(rows, source.label);
    console.log(`[Sheets Sync] ${source.label} Consolidated: ${deals.length} deals`);
    return deals;
  } catch (err) {
    console.warn(`[Sheets Sync] ${source.label} failed:`, err.message);
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Fetch both sheets in parallel
    const results = await Promise.allSettled(
      SHEET_SOURCES.map(source => fetchOneSheet(source))
    );

    const allDeals = [];
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'fulfilled') {
        allDeals.push(...results[i].value);
      }
    }

    // Global deduplicate by time + seller + asset + buyer
    const seen = new Set();
    const deduped = [];
    for (const deal of allDeals) {
      const key = `${deal.time}|${deal.seller}|${deal.asset}|${deal.buyer}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(deal);
      }
    }

    console.log(`[Sheets Sync] TOTAL unique deals: ${deduped.length}`);

    if (deduped.length === 0) {
      res.status(200).json({ synced: 0, deals: [], message: 'No data in sheets yet' });
      return;
    }

    // Replace DB with only sheet data (best-effort, non-blocking on failure)
    try {
      const db = await getMongoDb();
      const collection = db.collection('deals');
      await collection.deleteMany({});
      await collection.insertMany(deduped.map(d => ({
        ...d,
        created_at: new Date(),
        updated_at: new Date()
      })));
      console.log(`[Sheets Sync] DB replaced with ${deduped.length} deals`);
    } catch (dbErr) {
      console.warn('[Sheets Sync] DB write skipped:', dbErr.message);
    }

    // Return exactly what came from the sheets
    res.status(200).json({ synced: deduped.length, deals: deduped });
  } catch (err) {
    console.error('[Sheets Sync] Fatal error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
