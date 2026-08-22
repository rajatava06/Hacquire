import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { MongoClient } from 'mongodb';
import url from 'url';
import https from 'https';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://stones741banks_db_user:6rxSSIivYhs4tqCZ@hacquire.6dnd9d6.mongodb.net/?appName=hacquire';
const DB_NAME = process.env.DATABASE_NAME || 'hacquire';

// Both SEBI Desk sheets — fetches Consolidated_Live_Feed tab directly from each
const SHEET_SOURCES = [
  {
    id: '1jhUKhxEkY5mfgJNHnvHgIKQ5PWEMLkgNgeqWKy255zk',
    label: 'Hall-A',
    // Try consolidated tab name first, fall back to officer tabs
    consolidatedTab: 'Consolidated_Live_Feed',
    officerTabs: ['Officer_1', 'Officer_2', 'Officer_3', 'Officer_4']
  },
  {
    id: '1Ji0QTIKxeNA2sb6wzUIi5LjGOVg-kOqogZHbtWDQioI',
    label: 'Hall-B',
    // GID 70228119 is the active tab shown in the URL
    consolidatedGid: '70228119',
    consolidatedTab: 'Consolidated_Live_Feed',
    officerTabs: ['Officer_1', 'Officer_2', 'Officer_3', 'Officer_4']
  }
];

let client = null;
async function getMongoDb() {
  if (!client) {
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    await client.connect();
  }
  return client.db(DB_NAME);
}

function getRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { resolve(null); }
    });
  });
}

/** Fetch a URL using Node https and return the full body as string */
function fetchText(urlStr) {
  return new Promise((resolve, reject) => {
    https.get(urlStr, (res) => {
      // Handle redirect
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchText(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/** RFC-compliant CSV row parser that handles quoted fields with commas */
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
    .map(line => line.replace(/\r$/, ''))
    .filter(line => line.trim())
    .map(parseCSVRow);
}

/** Normalize SEBI status strings */
function normalizeSebi(raw) {
  const s = (raw || '').trim().toLowerCase();
  if (s === 'approved') return 'Approved';
  if (s === 'rejected') return 'Rejected';
  if (s === 'pending') return 'Pending';
  return raw || 'Pending';
}

/** Strip currency suffix and parse as number */
function normalizePrice(raw) {
  if (!raw || raw.trim() === '') return '';
  const cleaned = raw.replace(/[₹,\s]/g, '').replace(/cr$/i, '').replace(/super vision/i, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? raw.trim() : n;
}

/** Normalize time — handle HH:MM strings and Excel decimal fractions */
function normalizeTime(raw) {
  if (!raw || raw.trim() === '') return '';
  const s = raw.trim();
  // If it looks like a time string (contains colon)
  if (s.includes(':')) return s;
  // Excel decimal fraction: 0.4763... → HH:MM AM/PM
  const num = parseFloat(s);
  if (!isNaN(num) && num >= 0 && num <= 1) {
    const totalMinutes = Math.round(num * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  return s;
}

/** Build a stable unique deal ID from key fields */
function makeDealId(tab, rowIdx, time, seller, buyer) {
  const slug = `${tab}-${time}-${seller}-${buyer}-${rowIdx}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 80);
  return slug;
}

/** Parse one officer tab's CSV rows into deal objects */
function parseOfficerRows(rows, tabName) {
  // Rows 0-2: title / instructions / floor rules
  // Row 3: column headers
  // Rows 4+: data
  const dataRows = rows.slice(4);
  const deals = [];

  for (let i = 0; i < dataRows.length; i++) {
    const cols = dataRows[i];
    // Need at minimum: time, seller, buyer
    const time = normalizeTime(cols[0] || '');
    const dealType = (cols[1] || '').trim() || 'Feature Acquisition';
    const seller = (cols[2] || '').trim();
    const sellerPs = (cols[3] || '').trim();
    const asset = (cols[4] || '').trim();
    const github = (cols[5] || '').trim();
    const askingPrice = normalizePrice(cols[6] || '');
    const buyer = (cols[7] || '').trim();
    const buyerPs = (cols[8] || '').trim();
    const price = normalizePrice(cols[9] || '');
    const sebiStatus = normalizeSebi(cols[10] || '');

    // Skip empty rows
    if (!seller && !buyer && !asset) continue;
    if (!time && !seller) continue;

    const id = makeDealId(tabName, i, time, seller, buyer);

    deals.push({
      id,
      time,
      type: dealType,
      seller,
      sellerPs,
      asset,
      github,
      askingPrice,
      buyer,
      buyerPs,
      price,
      sebiStatus,
      _source: tabName
    });
  }
  return deals;
}

/** Fetch one sheet source — tries consolidated tab, falls back to officer tabs */
async function fetchOneSheetSource(source) {
  const deals = [];

  // Strategy 1: try consolidated tab by name
  if (source.consolidatedTab) {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${source.id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(source.consolidatedTab)}`;
    try {
      const text = await fetchText(csvUrl);
      // Sanity check — if we get HTML (error page) skip it
      if (!text.trim().startsWith('<')) {
        const rows = parseCSV(text);
        const sheetDeals = parseOfficerRows(rows, `${source.label}-Consolidated`);
        if (sheetDeals.length > 0) {
          console.log(`[Sheets Sync] ${source.label} Consolidated: ${sheetDeals.length} deals`);
          return sheetDeals;
        }
      }
    } catch (err) {
      console.warn(`[Sheets Sync] ${source.label} consolidated tab failed:`, err.message);
    }
  }

  // Strategy 2: try consolidated by GID
  if (source.consolidatedGid) {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${source.id}/gviz/tq?tqx=out:csv&gid=${source.consolidatedGid}`;
    try {
      const text = await fetchText(csvUrl);
      if (!text.trim().startsWith('<')) {
        const rows = parseCSV(text);
        const sheetDeals = parseOfficerRows(rows, `${source.label}-Consolidated`);
        if (sheetDeals.length > 0) {
          console.log(`[Sheets Sync] ${source.label} Consolidated (GID): ${sheetDeals.length} deals`);
          return sheetDeals;
        }
      }
    } catch (err) {
      console.warn(`[Sheets Sync] ${source.label} GID tab failed:`, err.message);
    }
  }

  // Strategy 3: fall back to individual officer tabs
  console.log(`[Sheets Sync] ${source.label}: falling back to officer tabs…`);
  for (const tab of (source.officerTabs || [])) {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${source.id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
    try {
      const text = await fetchText(csvUrl);
      if (!text.trim().startsWith('<')) {
        const rows = parseCSV(text);
        const tabDeals = parseOfficerRows(rows, `${source.label}-${tab}`);
        deals.push(...tabDeals);
        console.log(`[Sheets Sync] ${source.label}/${tab}: ${tabDeals.length} deals`);
      }
    } catch (err) {
      console.warn(`[Sheets Sync] ${source.label}/${tab} failed:`, err.message);
    }
  }

  return deals;
}

/** Fetch both Hall A and Hall B consolidated feeds in parallel, merge all deals */
async function fetchDealsFromSheets() {
  // Fetch both sheets simultaneously
  const results = await Promise.allSettled(
    SHEET_SOURCES.map(source => fetchOneSheetSource(source))
  );

  const allDeals = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      allDeals.push(...r.value);
    } else {
      console.warn(`[Sheets Sync] ${SHEET_SOURCES[i].label} failed:`, r.reason?.message);
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

  console.log(`[Sheets Sync] TOTAL unique deals from both halls: ${deduped.length}`);
  return deduped;
}



export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mongodb-local-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const parsedUrl = url.parse(req.url, true);

          // ────────────────────────────────────────────────────
          // GOOGLE SHEETS SYNC ENDPOINT
          // ────────────────────────────────────────────────────
          if (parsedUrl.pathname === '/api/sheets-sync' && req.method === 'POST') {
            res.setHeader('Content-Type', 'application/json');
            try {
              const sheetDeals = await fetchDealsFromSheets();

              if (sheetDeals.length === 0) {
                res.statusCode = 200;
                res.end(JSON.stringify({ synced: 0, deals: [], message: 'No data in sheet yet' }));
                return;
              }

              // Replace ALL deals with ONLY what's currently in the sheets
              try {
                const db = await getMongoDb();
                const collection = db.collection('deals');
                // Wipe everything first
                await collection.deleteMany({});
                // Insert only the fresh sheet data
                const docsToInsert = sheetDeals.map(deal => ({
                  ...deal,
                  created_at: new Date(),
                  updated_at: new Date()
                }));
                await collection.insertMany(docsToInsert);
                console.log(`[Sheets Sync] Replaced DB with ${sheetDeals.length} deals from sheets`);
              } catch (dbErr) {
                // DB unavailable — still return the sheet data directly
                console.warn('[Sheets Sync] DB write skipped (offline):', dbErr.message);
              }

              // Always return exactly what came from the sheet — no DB leftovers
              res.statusCode = 200;
              res.end(JSON.stringify({ synced: sheetDeals.length, deals: sheetDeals }));
            } catch (err) {
              console.error('[Sheets Sync] Error:', err.message);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }


          // ────────────────────────────────────────────────────
          // DEALS CRUD ENDPOINT
          // ────────────────────────────────────────────────────
          if (parsedUrl.pathname === '/api/deals') {
            res.setHeader('Content-Type', 'application/json');

            try {
              const db = await getMongoDb();
              const collection = db.collection('deals');

              if (req.method === 'GET') {
                const deals = await collection.find({}).sort({ created_at: 1 }).toArray();
                res.statusCode = 200;
                res.end(JSON.stringify(deals));
                return;
              }

              if (req.method === 'POST') {
                const payload = await getRequestBody(req);

                if (Array.isArray(payload)) {
                  if (payload.length === 0) {
                    res.statusCode = 200;
                    res.end(JSON.stringify({ message: 'No deals to import' }));
                    return;
                  }
                  const operations = payload.map(deal => ({
                    updateOne: {
                      filter: { id: deal.id },
                      update: {
                        $set: {
                          id: deal.id, time: deal.time, type: deal.type,
                          seller: deal.seller, sellerPs: deal.sellerPs,
                          asset: deal.asset, github: deal.github,
                          askingPrice: deal.askingPrice, buyer: deal.buyer,
                          buyerPs: deal.buyerPs, price: deal.price,
                          sebiStatus: deal.sebiStatus || 'Approved',
                          updated_at: new Date()
                        },
                        $setOnInsert: { created_at: new Date() }
                      },
                      upsert: true
                    }
                  }));
                  const result = await collection.bulkWrite(operations);
                  res.statusCode = 200;
                  res.end(JSON.stringify({ message: 'Bulk import successful', result }));
                  return;
                } else if (payload) {
                  const result = await collection.updateOne(
                    { id: payload.id },
                    {
                      $set: {
                        id: payload.id, time: payload.time, type: payload.type,
                        seller: payload.seller, sellerPs: payload.sellerPs,
                        asset: payload.asset, github: payload.github,
                        askingPrice: payload.askingPrice, buyer: payload.buyer,
                        buyerPs: payload.buyerPs, price: payload.price,
                        sebiStatus: payload.sebiStatus || 'Approved',
                        updated_at: new Date()
                      },
                      $setOnInsert: { created_at: new Date() }
                    },
                    { upsert: true }
                  );
                  res.statusCode = 200;
                  res.end(JSON.stringify({ message: 'Deal registered successfully', result }));
                  return;
                }
              }

              if (req.method === 'DELETE') {
                const id = parsedUrl.query.id;
                if (!id) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Missing deal ID' }));
                  return;
                }
                const result = await collection.deleteOne({ id: id });
                res.statusCode = 200;
                res.end(JSON.stringify({ message: 'Deal deleted successfully', result }));
                return;
              }

            } catch (err) {
              console.warn('Local Mongo middleware timeout/fallback (deals):', err.message);
              client = null;
              res.statusCode = 200;
              res.end(JSON.stringify([]));
              return;
            }
          }

          // ────────────────────────────────────────────────────
          // EVALUATIONS CRUD ENDPOINT
          // ────────────────────────────────────────────────────
          if (parsedUrl.pathname === '/api/evaluations') {
            res.setHeader('Content-Type', 'application/json');

            try {
              const db = await getMongoDb();
              const collection = db.collection('evaluations');

              if (req.method === 'GET') {
                const evals = await collection.find({}).sort({ totalScore: -1 }).toArray();
                res.statusCode = 200;
                res.end(JSON.stringify(evals));
                return;
              }

              if (req.method === 'POST') {
                const payload = await getRequestBody(req);

                if (Array.isArray(payload)) {
                  if (payload.length === 0) {
                    res.statusCode = 200;
                    res.end(JSON.stringify({ message: 'No evaluations to import' }));
                    return;
                  }
                  const operations = payload.map(ev => ({
                    updateOne: {
                      filter: { teamId: ev.teamId },
                      update: {
                        $set: {
                          teamId: ev.teamId, teamName: ev.teamName,
                          problemStatement: ev.problemStatement,
                          dealsExecuted: ev.dealsExecuted, dealStatus: ev.dealStatus,
                          strategicRationale: ev.strategicRationale,
                          valuationPricing: ev.valuationPricing,
                          integrationQuality: ev.integrationQuality,
                          totalScore: ev.totalScore, feedback: ev.feedback,
                          updated_at: new Date()
                        },
                        $setOnInsert: { created_at: new Date() }
                      },
                      upsert: true
                    }
                  }));
                  const result = await collection.bulkWrite(operations);
                  res.statusCode = 200;
                  res.end(JSON.stringify({ message: 'Bulk evaluation import successful', result }));
                  return;
                } else if (payload) {
                  const result = await collection.updateOne(
                    { teamId: payload.teamId },
                    {
                      $set: {
                        teamId: payload.teamId, teamName: payload.teamName,
                        problemStatement: payload.problemStatement,
                        dealsExecuted: payload.dealsExecuted, dealStatus: payload.dealStatus,
                        strategicRationale: payload.strategicRationale,
                        valuationPricing: payload.valuationPricing,
                        integrationQuality: payload.integrationQuality,
                        totalScore: payload.totalScore, feedback: payload.feedback,
                        updated_at: new Date()
                      },
                      $setOnInsert: { created_at: new Date() }
                    },
                    { upsert: true }
                  );
                  res.statusCode = 200;
                  res.end(JSON.stringify({ message: 'Evaluation saved successfully', result }));
                  return;
                }
              }

              if (req.method === 'DELETE') {
                const teamId = parsedUrl.query.teamId;
                if (!teamId) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Missing teamId' }));
                  return;
                }
                const result = await collection.deleteOne({ teamId: teamId });
                res.statusCode = 200;
                res.end(JSON.stringify({ message: 'Evaluation deleted successfully', result }));
                return;
              }

            } catch (err) {
              console.warn('Local Mongo middleware timeout/fallback (evaluations):', err.message);
              client = null;
              res.statusCode = 200;
              res.end(JSON.stringify([]));
              return;
            }
          }

          next();
        });
      }
    }
  ]
});
