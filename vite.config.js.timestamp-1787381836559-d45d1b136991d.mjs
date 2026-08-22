// vite.config.js
import { defineConfig } from "file:///E:/Hacquire/node_modules/vite/dist/node/index.js";
import react from "file:///E:/Hacquire/node_modules/@vitejs/plugin-react/dist/index.js";
import { MongoClient } from "file:///E:/Hacquire/node_modules/mongodb/lib/index.js";
import url from "url";
import https from "https";
var MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://stones741banks_db_user:6rxSSIivYhs4tqCZ@hacquire.6dnd9d6.mongodb.net/?appName=hacquire";
var DB_NAME = process.env.DATABASE_NAME || "hacquire";
var SHEET_ID = "1jhUKhxEkY5mfgJNHnvHgIKQ5PWEMLkgNgeqWKy255zk";
var OFFICER_TABS = ["Officer_1", "Officer_2", "Officer_3", "Officer_4"];
var client = null;
async function getMongoDb() {
  if (!client) {
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5e3,
      connectTimeoutMS: 5e3
    });
    await client.connect();
  }
  return client.db(DB_NAME);
}
function getRequestBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve(null);
      }
    });
  });
}
function fetchText(urlStr) {
  return new Promise((resolve, reject) => {
    https.get(urlStr, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchText(res.headers.location).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}
function parseCSVRow(line) {
  const cols = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (c === "," && !inQuote) {
      cols.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  cols.push(cur.trim());
  return cols;
}
function parseCSV(text) {
  return text.split("\n").map((line) => line.replace(/\r$/, "")).filter((line) => line.trim()).map(parseCSVRow);
}
function normalizeSebi(raw) {
  const s = (raw || "").trim().toLowerCase();
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  if (s === "pending") return "Pending";
  return raw || "Pending";
}
function normalizePrice(raw) {
  if (!raw || raw.trim() === "") return "";
  const cleaned = raw.replace(/[₹,\s]/g, "").replace(/cr$/i, "").replace(/super vision/i, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? raw.trim() : n;
}
function normalizeTime(raw) {
  if (!raw || raw.trim() === "") return "";
  const s = raw.trim();
  if (s.includes(":")) return s;
  const num = parseFloat(s);
  if (!isNaN(num) && num >= 0 && num <= 1) {
    const totalMinutes = Math.round(num * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
  }
  return s;
}
function makeDealId(tab, rowIdx, time, seller, buyer) {
  const slug = `${tab}-${time}-${seller}-${buyer}-${rowIdx}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
  return slug;
}
function parseOfficerRows(rows, tabName) {
  const dataRows = rows.slice(4);
  const deals = [];
  for (let i = 0; i < dataRows.length; i++) {
    const cols = dataRows[i];
    const time = normalizeTime(cols[0] || "");
    const dealType = (cols[1] || "").trim() || "Feature Acquisition";
    const seller = (cols[2] || "").trim();
    const sellerPs = (cols[3] || "").trim();
    const asset = (cols[4] || "").trim();
    const github = (cols[5] || "").trim();
    const askingPrice = normalizePrice(cols[6] || "");
    const buyer = (cols[7] || "").trim();
    const buyerPs = (cols[8] || "").trim();
    const price = normalizePrice(cols[9] || "");
    const sebiStatus = normalizeSebi(cols[10] || "");
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
async function fetchDealsFromSheets() {
  const allDeals = [];
  for (const tab of OFFICER_TABS) {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
    try {
      const text = await fetchText(csvUrl);
      const rows = parseCSV(text);
      const deals = parseOfficerRows(rows, tab);
      allDeals.push(...deals);
      console.log(`[Sheets Sync] ${tab}: ${deals.length} deals`);
    } catch (err) {
      console.warn(`[Sheets Sync] Failed to fetch ${tab}:`, err.message);
    }
  }
  const seen = /* @__PURE__ */ new Set();
  const deduped = [];
  for (const deal of allDeals) {
    const key = `${deal.time}|${deal.seller}|${deal.asset}|${deal.buyer}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(deal);
    }
  }
  console.log(`[Sheets Sync] Total unique deals: ${deduped.length}`);
  return deduped;
}
var vite_config_default = defineConfig({
  plugins: [
    react(),
    {
      name: "mongodb-local-proxy",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const parsedUrl = url.parse(req.url, true);
          if (parsedUrl.pathname === "/api/sheets-sync" && req.method === "POST") {
            res.setHeader("Content-Type", "application/json");
            try {
              const sheetDeals = await fetchDealsFromSheets();
              if (sheetDeals.length === 0) {
                res.statusCode = 200;
                res.end(JSON.stringify({ synced: 0, message: "No data in sheet yet" }));
                return;
              }
              const db = await getMongoDb();
              const collection = db.collection("deals");
              const operations = sheetDeals.map((deal) => ({
                updateOne: {
                  filter: { id: deal.id },
                  update: {
                    $set: {
                      id: deal.id,
                      time: deal.time,
                      type: deal.type,
                      seller: deal.seller,
                      sellerPs: deal.sellerPs,
                      asset: deal.asset,
                      github: deal.github,
                      askingPrice: deal.askingPrice,
                      buyer: deal.buyer,
                      buyerPs: deal.buyerPs,
                      price: deal.price,
                      sebiStatus: deal.sebiStatus,
                      _source: deal._source,
                      updated_at: /* @__PURE__ */ new Date()
                    },
                    $setOnInsert: { created_at: /* @__PURE__ */ new Date() }
                  },
                  upsert: true
                }
              }));
              await collection.bulkWrite(operations);
              const allDeals = await collection.find({}).sort({ created_at: 1 }).toArray();
              res.statusCode = 200;
              res.end(JSON.stringify({ synced: sheetDeals.length, deals: allDeals }));
            } catch (err) {
              console.error("[Sheets Sync] Error:", err.message);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }
          if (parsedUrl.pathname === "/api/deals") {
            res.setHeader("Content-Type", "application/json");
            try {
              const db = await getMongoDb();
              const collection = db.collection("deals");
              if (req.method === "GET") {
                const deals = await collection.find({}).sort({ created_at: 1 }).toArray();
                res.statusCode = 200;
                res.end(JSON.stringify(deals));
                return;
              }
              if (req.method === "POST") {
                const payload = await getRequestBody(req);
                if (Array.isArray(payload)) {
                  if (payload.length === 0) {
                    res.statusCode = 200;
                    res.end(JSON.stringify({ message: "No deals to import" }));
                    return;
                  }
                  const operations = payload.map((deal) => ({
                    updateOne: {
                      filter: { id: deal.id },
                      update: {
                        $set: {
                          id: deal.id,
                          time: deal.time,
                          type: deal.type,
                          seller: deal.seller,
                          sellerPs: deal.sellerPs,
                          asset: deal.asset,
                          github: deal.github,
                          askingPrice: deal.askingPrice,
                          buyer: deal.buyer,
                          buyerPs: deal.buyerPs,
                          price: deal.price,
                          sebiStatus: deal.sebiStatus || "Approved",
                          updated_at: /* @__PURE__ */ new Date()
                        },
                        $setOnInsert: { created_at: /* @__PURE__ */ new Date() }
                      },
                      upsert: true
                    }
                  }));
                  const result = await collection.bulkWrite(operations);
                  res.statusCode = 200;
                  res.end(JSON.stringify({ message: "Bulk import successful", result }));
                  return;
                } else if (payload) {
                  const result = await collection.updateOne(
                    { id: payload.id },
                    {
                      $set: {
                        id: payload.id,
                        time: payload.time,
                        type: payload.type,
                        seller: payload.seller,
                        sellerPs: payload.sellerPs,
                        asset: payload.asset,
                        github: payload.github,
                        askingPrice: payload.askingPrice,
                        buyer: payload.buyer,
                        buyerPs: payload.buyerPs,
                        price: payload.price,
                        sebiStatus: payload.sebiStatus || "Approved",
                        updated_at: /* @__PURE__ */ new Date()
                      },
                      $setOnInsert: { created_at: /* @__PURE__ */ new Date() }
                    },
                    { upsert: true }
                  );
                  res.statusCode = 200;
                  res.end(JSON.stringify({ message: "Deal registered successfully", result }));
                  return;
                }
              }
              if (req.method === "DELETE") {
                const id = parsedUrl.query.id;
                if (!id) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "Missing deal ID" }));
                  return;
                }
                const result = await collection.deleteOne({ id });
                res.statusCode = 200;
                res.end(JSON.stringify({ message: "Deal deleted successfully", result }));
                return;
              }
            } catch (err) {
              console.warn("Local Mongo middleware timeout/fallback (deals):", err.message);
              client = null;
              res.statusCode = 200;
              res.end(JSON.stringify([]));
              return;
            }
          }
          if (parsedUrl.pathname === "/api/evaluations") {
            res.setHeader("Content-Type", "application/json");
            try {
              const db = await getMongoDb();
              const collection = db.collection("evaluations");
              if (req.method === "GET") {
                const evals = await collection.find({}).sort({ totalScore: -1 }).toArray();
                res.statusCode = 200;
                res.end(JSON.stringify(evals));
                return;
              }
              if (req.method === "POST") {
                const payload = await getRequestBody(req);
                if (Array.isArray(payload)) {
                  if (payload.length === 0) {
                    res.statusCode = 200;
                    res.end(JSON.stringify({ message: "No evaluations to import" }));
                    return;
                  }
                  const operations = payload.map((ev) => ({
                    updateOne: {
                      filter: { teamId: ev.teamId },
                      update: {
                        $set: {
                          teamId: ev.teamId,
                          teamName: ev.teamName,
                          problemStatement: ev.problemStatement,
                          dealsExecuted: ev.dealsExecuted,
                          dealStatus: ev.dealStatus,
                          strategicRationale: ev.strategicRationale,
                          valuationPricing: ev.valuationPricing,
                          integrationQuality: ev.integrationQuality,
                          totalScore: ev.totalScore,
                          feedback: ev.feedback,
                          updated_at: /* @__PURE__ */ new Date()
                        },
                        $setOnInsert: { created_at: /* @__PURE__ */ new Date() }
                      },
                      upsert: true
                    }
                  }));
                  const result = await collection.bulkWrite(operations);
                  res.statusCode = 200;
                  res.end(JSON.stringify({ message: "Bulk evaluation import successful", result }));
                  return;
                } else if (payload) {
                  const result = await collection.updateOne(
                    { teamId: payload.teamId },
                    {
                      $set: {
                        teamId: payload.teamId,
                        teamName: payload.teamName,
                        problemStatement: payload.problemStatement,
                        dealsExecuted: payload.dealsExecuted,
                        dealStatus: payload.dealStatus,
                        strategicRationale: payload.strategicRationale,
                        valuationPricing: payload.valuationPricing,
                        integrationQuality: payload.integrationQuality,
                        totalScore: payload.totalScore,
                        feedback: payload.feedback,
                        updated_at: /* @__PURE__ */ new Date()
                      },
                      $setOnInsert: { created_at: /* @__PURE__ */ new Date() }
                    },
                    { upsert: true }
                  );
                  res.statusCode = 200;
                  res.end(JSON.stringify({ message: "Evaluation saved successfully", result }));
                  return;
                }
              }
              if (req.method === "DELETE") {
                const teamId = parsedUrl.query.teamId;
                if (!teamId) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "Missing teamId" }));
                  return;
                }
                const result = await collection.deleteOne({ teamId });
                res.statusCode = 200;
                res.end(JSON.stringify({ message: "Evaluation deleted successfully", result }));
                return;
              }
            } catch (err) {
              console.warn("Local Mongo middleware timeout/fallback (evaluations):", err.message);
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
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxIYWNxdWlyZVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRTpcXFxcSGFjcXVpcmVcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0U6L0hhY3F1aXJlL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHsgTW9uZ29DbGllbnQgfSBmcm9tICdtb25nb2RiJztcbmltcG9ydCB1cmwgZnJvbSAndXJsJztcbmltcG9ydCBodHRwcyBmcm9tICdodHRwcyc7XG5cbmNvbnN0IE1PTkdPREJfVVJJID0gcHJvY2Vzcy5lbnYuTU9OR09EQl9VUkkgfHwgJ21vbmdvZGIrc3J2Oi8vc3RvbmVzNzQxYmFua3NfZGJfdXNlcjo2cnhTU0lpdlloczR0cUNaQGhhY3F1aXJlLjZkbmQ5ZDYubW9uZ29kYi5uZXQvP2FwcE5hbWU9aGFjcXVpcmUnO1xuY29uc3QgREJfTkFNRSA9IHByb2Nlc3MuZW52LkRBVEFCQVNFX05BTUUgfHwgJ2hhY3F1aXJlJztcbmNvbnN0IFNIRUVUX0lEID0gJzFqaFVLaHhFa1k1bWZnSk5IbnZIZ0lLUTVQV0VNTGtnTmdlcVdLeTI1NXprJztcblxuLy8gNCBvZmZpY2VyIHRhYnMgKyBjb25zb2xpZGF0ZWQgXHUyMDE0IHVzaW5nIHNoZWV0LW5hbWUgQ1NWIGV4cG9ydCAobm8gQVBJIGtleSBuZWVkZWQpXG5jb25zdCBPRkZJQ0VSX1RBQlMgPSBbJ09mZmljZXJfMScsICdPZmZpY2VyXzInLCAnT2ZmaWNlcl8zJywgJ09mZmljZXJfNCddO1xuXG5sZXQgY2xpZW50ID0gbnVsbDtcbmFzeW5jIGZ1bmN0aW9uIGdldE1vbmdvRGIoKSB7XG4gIGlmICghY2xpZW50KSB7XG4gICAgY2xpZW50ID0gbmV3IE1vbmdvQ2xpZW50KE1PTkdPREJfVVJJLCB7XG4gICAgICBzZXJ2ZXJTZWxlY3Rpb25UaW1lb3V0TVM6IDUwMDAsXG4gICAgICBjb25uZWN0VGltZW91dE1TOiA1MDAwXG4gICAgfSk7XG4gICAgYXdhaXQgY2xpZW50LmNvbm5lY3QoKTtcbiAgfVxuICByZXR1cm4gY2xpZW50LmRiKERCX05BTUUpO1xufVxuXG5mdW5jdGlvbiBnZXRSZXF1ZXN0Qm9keShyZXEpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgbGV0IGJvZHkgPSAnJztcbiAgICByZXEub24oJ2RhdGEnLCBjaHVuayA9PiB7IGJvZHkgKz0gY2h1bms7IH0pO1xuICAgIHJlcS5vbignZW5kJywgKCkgPT4ge1xuICAgICAgdHJ5IHsgcmVzb2x2ZShKU09OLnBhcnNlKGJvZHkpKTsgfVxuICAgICAgY2F0Y2ggKGUpIHsgcmVzb2x2ZShudWxsKTsgfVxuICAgIH0pO1xuICB9KTtcbn1cblxuLyoqIEZldGNoIGEgVVJMIHVzaW5nIE5vZGUgaHR0cHMgYW5kIHJldHVybiB0aGUgZnVsbCBib2R5IGFzIHN0cmluZyAqL1xuZnVuY3Rpb24gZmV0Y2hUZXh0KHVybFN0cikge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGh0dHBzLmdldCh1cmxTdHIsIChyZXMpID0+IHtcbiAgICAgIC8vIEhhbmRsZSByZWRpcmVjdFxuICAgICAgaWYgKHJlcy5zdGF0dXNDb2RlID09PSAzMDEgfHwgcmVzLnN0YXR1c0NvZGUgPT09IDMwMikge1xuICAgICAgICByZXR1cm4gZmV0Y2hUZXh0KHJlcy5oZWFkZXJzLmxvY2F0aW9uKS50aGVuKHJlc29sdmUpLmNhdGNoKHJlamVjdCk7XG4gICAgICB9XG4gICAgICBsZXQgZGF0YSA9ICcnO1xuICAgICAgcmVzLm9uKCdkYXRhJywgY2h1bmsgPT4geyBkYXRhICs9IGNodW5rOyB9KTtcbiAgICAgIHJlcy5vbignZW5kJywgKCkgPT4gcmVzb2x2ZShkYXRhKSk7XG4gICAgfSkub24oJ2Vycm9yJywgcmVqZWN0KTtcbiAgfSk7XG59XG5cbi8qKiBSRkMtY29tcGxpYW50IENTViByb3cgcGFyc2VyIHRoYXQgaGFuZGxlcyBxdW90ZWQgZmllbGRzIHdpdGggY29tbWFzICovXG5mdW5jdGlvbiBwYXJzZUNTVlJvdyhsaW5lKSB7XG4gIGNvbnN0IGNvbHMgPSBbXTtcbiAgbGV0IGN1ciA9ICcnO1xuICBsZXQgaW5RdW90ZSA9IGZhbHNlO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmUubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjID0gbGluZVtpXTtcbiAgICBpZiAoYyA9PT0gJ1wiJykge1xuICAgICAgaWYgKGluUXVvdGUgJiYgbGluZVtpICsgMV0gPT09ICdcIicpIHsgY3VyICs9ICdcIic7IGkrKzsgfVxuICAgICAgZWxzZSB7IGluUXVvdGUgPSAhaW5RdW90ZTsgfVxuICAgIH0gZWxzZSBpZiAoYyA9PT0gJywnICYmICFpblF1b3RlKSB7XG4gICAgICBjb2xzLnB1c2goY3VyLnRyaW0oKSk7XG4gICAgICBjdXIgPSAnJztcbiAgICB9IGVsc2Uge1xuICAgICAgY3VyICs9IGM7XG4gICAgfVxuICB9XG4gIGNvbHMucHVzaChjdXIudHJpbSgpKTtcbiAgcmV0dXJuIGNvbHM7XG59XG5cbmZ1bmN0aW9uIHBhcnNlQ1NWKHRleHQpIHtcbiAgcmV0dXJuIHRleHQuc3BsaXQoJ1xcbicpXG4gICAgLm1hcChsaW5lID0+IGxpbmUucmVwbGFjZSgvXFxyJC8sICcnKSlcbiAgICAuZmlsdGVyKGxpbmUgPT4gbGluZS50cmltKCkpXG4gICAgLm1hcChwYXJzZUNTVlJvdyk7XG59XG5cbi8qKiBOb3JtYWxpemUgU0VCSSBzdGF0dXMgc3RyaW5ncyAqL1xuZnVuY3Rpb24gbm9ybWFsaXplU2ViaShyYXcpIHtcbiAgY29uc3QgcyA9IChyYXcgfHwgJycpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICBpZiAocyA9PT0gJ2FwcHJvdmVkJykgcmV0dXJuICdBcHByb3ZlZCc7XG4gIGlmIChzID09PSAncmVqZWN0ZWQnKSByZXR1cm4gJ1JlamVjdGVkJztcbiAgaWYgKHMgPT09ICdwZW5kaW5nJykgcmV0dXJuICdQZW5kaW5nJztcbiAgcmV0dXJuIHJhdyB8fCAnUGVuZGluZyc7XG59XG5cbi8qKiBTdHJpcCBjdXJyZW5jeSBzdWZmaXggYW5kIHBhcnNlIGFzIG51bWJlciAqL1xuZnVuY3Rpb24gbm9ybWFsaXplUHJpY2UocmF3KSB7XG4gIGlmICghcmF3IHx8IHJhdy50cmltKCkgPT09ICcnKSByZXR1cm4gJyc7XG4gIGNvbnN0IGNsZWFuZWQgPSByYXcucmVwbGFjZSgvW1x1MjBCOSxcXHNdL2csICcnKS5yZXBsYWNlKC9jciQvaSwgJycpLnJlcGxhY2UoL3N1cGVyIHZpc2lvbi9pLCAnJykudHJpbSgpO1xuICBjb25zdCBuID0gcGFyc2VGbG9hdChjbGVhbmVkKTtcbiAgcmV0dXJuIGlzTmFOKG4pID8gcmF3LnRyaW0oKSA6IG47XG59XG5cbi8qKiBOb3JtYWxpemUgdGltZSBcdTIwMTQgaGFuZGxlIEhIOk1NIHN0cmluZ3MgYW5kIEV4Y2VsIGRlY2ltYWwgZnJhY3Rpb25zICovXG5mdW5jdGlvbiBub3JtYWxpemVUaW1lKHJhdykge1xuICBpZiAoIXJhdyB8fCByYXcudHJpbSgpID09PSAnJykgcmV0dXJuICcnO1xuICBjb25zdCBzID0gcmF3LnRyaW0oKTtcbiAgLy8gSWYgaXQgbG9va3MgbGlrZSBhIHRpbWUgc3RyaW5nIChjb250YWlucyBjb2xvbilcbiAgaWYgKHMuaW5jbHVkZXMoJzonKSkgcmV0dXJuIHM7XG4gIC8vIEV4Y2VsIGRlY2ltYWwgZnJhY3Rpb246IDAuNDc2My4uLiBcdTIxOTIgSEg6TU0gQU0vUE1cbiAgY29uc3QgbnVtID0gcGFyc2VGbG9hdChzKTtcbiAgaWYgKCFpc05hTihudW0pICYmIG51bSA+PSAwICYmIG51bSA8PSAxKSB7XG4gICAgY29uc3QgdG90YWxNaW51dGVzID0gTWF0aC5yb3VuZChudW0gKiAyNCAqIDYwKTtcbiAgICBjb25zdCBoID0gTWF0aC5mbG9vcih0b3RhbE1pbnV0ZXMgLyA2MCkgJSAyNDtcbiAgICBjb25zdCBtID0gdG90YWxNaW51dGVzICUgNjA7XG4gICAgY29uc3QgYW1wbSA9IGggPj0gMTIgPyAnUE0nIDogJ0FNJztcbiAgICBjb25zdCBob3VyMTIgPSBoICUgMTIgPT09IDAgPyAxMiA6IGggJSAxMjtcbiAgICByZXR1cm4gYCR7aG91cjEyfToke1N0cmluZyhtKS5wYWRTdGFydCgyLCAnMCcpfSAke2FtcG19YDtcbiAgfVxuICByZXR1cm4gcztcbn1cblxuLyoqIEJ1aWxkIGEgc3RhYmxlIHVuaXF1ZSBkZWFsIElEIGZyb20ga2V5IGZpZWxkcyAqL1xuZnVuY3Rpb24gbWFrZURlYWxJZCh0YWIsIHJvd0lkeCwgdGltZSwgc2VsbGVyLCBidXllcikge1xuICBjb25zdCBzbHVnID0gYCR7dGFifS0ke3RpbWV9LSR7c2VsbGVyfS0ke2J1eWVyfS0ke3Jvd0lkeH1gXG4gICAgLnRvTG93ZXJDYXNlKClcbiAgICAucmVwbGFjZSgvW15hLXowLTldKy9nLCAnLScpXG4gICAgLnNsaWNlKDAsIDgwKTtcbiAgcmV0dXJuIHNsdWc7XG59XG5cbi8qKiBQYXJzZSBvbmUgb2ZmaWNlciB0YWIncyBDU1Ygcm93cyBpbnRvIGRlYWwgb2JqZWN0cyAqL1xuZnVuY3Rpb24gcGFyc2VPZmZpY2VyUm93cyhyb3dzLCB0YWJOYW1lKSB7XG4gIC8vIFJvd3MgMC0yOiB0aXRsZSAvIGluc3RydWN0aW9ucyAvIGZsb29yIHJ1bGVzXG4gIC8vIFJvdyAzOiBjb2x1bW4gaGVhZGVyc1xuICAvLyBSb3dzIDQrOiBkYXRhXG4gIGNvbnN0IGRhdGFSb3dzID0gcm93cy5zbGljZSg0KTtcbiAgY29uc3QgZGVhbHMgPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGFSb3dzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY29scyA9IGRhdGFSb3dzW2ldO1xuICAgIC8vIE5lZWQgYXQgbWluaW11bTogdGltZSwgc2VsbGVyLCBidXllclxuICAgIGNvbnN0IHRpbWUgPSBub3JtYWxpemVUaW1lKGNvbHNbMF0gfHwgJycpO1xuICAgIGNvbnN0IGRlYWxUeXBlID0gKGNvbHNbMV0gfHwgJycpLnRyaW0oKSB8fCAnRmVhdHVyZSBBY3F1aXNpdGlvbic7XG4gICAgY29uc3Qgc2VsbGVyID0gKGNvbHNbMl0gfHwgJycpLnRyaW0oKTtcbiAgICBjb25zdCBzZWxsZXJQcyA9IChjb2xzWzNdIHx8ICcnKS50cmltKCk7XG4gICAgY29uc3QgYXNzZXQgPSAoY29sc1s0XSB8fCAnJykudHJpbSgpO1xuICAgIGNvbnN0IGdpdGh1YiA9IChjb2xzWzVdIHx8ICcnKS50cmltKCk7XG4gICAgY29uc3QgYXNraW5nUHJpY2UgPSBub3JtYWxpemVQcmljZShjb2xzWzZdIHx8ICcnKTtcbiAgICBjb25zdCBidXllciA9IChjb2xzWzddIHx8ICcnKS50cmltKCk7XG4gICAgY29uc3QgYnV5ZXJQcyA9IChjb2xzWzhdIHx8ICcnKS50cmltKCk7XG4gICAgY29uc3QgcHJpY2UgPSBub3JtYWxpemVQcmljZShjb2xzWzldIHx8ICcnKTtcbiAgICBjb25zdCBzZWJpU3RhdHVzID0gbm9ybWFsaXplU2ViaShjb2xzWzEwXSB8fCAnJyk7XG5cbiAgICAvLyBTa2lwIGVtcHR5IHJvd3NcbiAgICBpZiAoIXNlbGxlciAmJiAhYnV5ZXIgJiYgIWFzc2V0KSBjb250aW51ZTtcbiAgICBpZiAoIXRpbWUgJiYgIXNlbGxlcikgY29udGludWU7XG5cbiAgICBjb25zdCBpZCA9IG1ha2VEZWFsSWQodGFiTmFtZSwgaSwgdGltZSwgc2VsbGVyLCBidXllcik7XG5cbiAgICBkZWFscy5wdXNoKHtcbiAgICAgIGlkLFxuICAgICAgdGltZSxcbiAgICAgIHR5cGU6IGRlYWxUeXBlLFxuICAgICAgc2VsbGVyLFxuICAgICAgc2VsbGVyUHMsXG4gICAgICBhc3NldCxcbiAgICAgIGdpdGh1YixcbiAgICAgIGFza2luZ1ByaWNlLFxuICAgICAgYnV5ZXIsXG4gICAgICBidXllclBzLFxuICAgICAgcHJpY2UsXG4gICAgICBzZWJpU3RhdHVzLFxuICAgICAgX3NvdXJjZTogdGFiTmFtZVxuICAgIH0pO1xuICB9XG4gIHJldHVybiBkZWFscztcbn1cblxuLyoqIEZldGNoIGFsbCA0IG9mZmljZXIgdGFicyBmcm9tIEdvb2dsZSBTaGVldHMgYW5kIG1lcmdlIGRlYWxzICovXG5hc3luYyBmdW5jdGlvbiBmZXRjaERlYWxzRnJvbVNoZWV0cygpIHtcbiAgY29uc3QgYWxsRGVhbHMgPSBbXTtcblxuICBmb3IgKGNvbnN0IHRhYiBvZiBPRkZJQ0VSX1RBQlMpIHtcbiAgICBjb25zdCBjc3ZVcmwgPSBgaHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vc3ByZWFkc2hlZXRzL2QvJHtTSEVFVF9JRH0vZ3Zpei90cT90cXg9b3V0OmNzdiZzaGVldD0ke2VuY29kZVVSSUNvbXBvbmVudCh0YWIpfWA7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHRleHQgPSBhd2FpdCBmZXRjaFRleHQoY3N2VXJsKTtcbiAgICAgIGNvbnN0IHJvd3MgPSBwYXJzZUNTVih0ZXh0KTtcbiAgICAgIGNvbnN0IGRlYWxzID0gcGFyc2VPZmZpY2VyUm93cyhyb3dzLCB0YWIpO1xuICAgICAgYWxsRGVhbHMucHVzaCguLi5kZWFscyk7XG4gICAgICBjb25zb2xlLmxvZyhgW1NoZWV0cyBTeW5jXSAke3RhYn06ICR7ZGVhbHMubGVuZ3RofSBkZWFsc2ApO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc29sZS53YXJuKGBbU2hlZXRzIFN5bmNdIEZhaWxlZCB0byBmZXRjaCAke3RhYn06YCwgZXJyLm1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIC8vIERlZHVwbGljYXRlIGJ5IGNvbXBvc2l0ZSBrZXk6IHRpbWUgKyBzZWxsZXIgKyBhc3NldFxuICBjb25zdCBzZWVuID0gbmV3IFNldCgpO1xuICBjb25zdCBkZWR1cGVkID0gW107XG4gIGZvciAoY29uc3QgZGVhbCBvZiBhbGxEZWFscykge1xuICAgIGNvbnN0IGtleSA9IGAke2RlYWwudGltZX18JHtkZWFsLnNlbGxlcn18JHtkZWFsLmFzc2V0fXwke2RlYWwuYnV5ZXJ9YC50b0xvd2VyQ2FzZSgpO1xuICAgIGlmICghc2Vlbi5oYXMoa2V5KSkge1xuICAgICAgc2Vlbi5hZGQoa2V5KTtcbiAgICAgIGRlZHVwZWQucHVzaChkZWFsKTtcbiAgICB9XG4gIH1cblxuICBjb25zb2xlLmxvZyhgW1NoZWV0cyBTeW5jXSBUb3RhbCB1bmlxdWUgZGVhbHM6ICR7ZGVkdXBlZC5sZW5ndGh9YCk7XG4gIHJldHVybiBkZWR1cGVkO1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICB7XG4gICAgICBuYW1lOiAnbW9uZ29kYi1sb2NhbC1wcm94eScsXG4gICAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICAgICAgY29uc3QgcGFyc2VkVXJsID0gdXJsLnBhcnNlKHJlcS51cmwsIHRydWUpO1xuXG4gICAgICAgICAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gICAgICAgICAgLy8gR09PR0xFIFNIRUVUUyBTWU5DIEVORFBPSU5UXG4gICAgICAgICAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gICAgICAgICAgaWYgKHBhcnNlZFVybC5wYXRobmFtZSA9PT0gJy9hcGkvc2hlZXRzLXN5bmMnICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHNoZWV0RGVhbHMgPSBhd2FpdCBmZXRjaERlYWxzRnJvbVNoZWV0cygpO1xuXG4gICAgICAgICAgICAgIGlmIChzaGVldERlYWxzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzeW5jZWQ6IDAsIG1lc3NhZ2U6ICdObyBkYXRhIGluIHNoZWV0IHlldCcgfSkpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIFVwc2VydCBhbGwgZGVhbHMgaW50byBNb25nb0RCXG4gICAgICAgICAgICAgIGNvbnN0IGRiID0gYXdhaXQgZ2V0TW9uZ29EYigpO1xuICAgICAgICAgICAgICBjb25zdCBjb2xsZWN0aW9uID0gZGIuY29sbGVjdGlvbignZGVhbHMnKTtcblxuICAgICAgICAgICAgICBjb25zdCBvcGVyYXRpb25zID0gc2hlZXREZWFscy5tYXAoZGVhbCA9PiAoe1xuICAgICAgICAgICAgICAgIHVwZGF0ZU9uZToge1xuICAgICAgICAgICAgICAgICAgZmlsdGVyOiB7IGlkOiBkZWFsLmlkIH0sXG4gICAgICAgICAgICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICAgICAgICAgICAgJHNldDoge1xuICAgICAgICAgICAgICAgICAgICAgIGlkOiBkZWFsLmlkLFxuICAgICAgICAgICAgICAgICAgICAgIHRpbWU6IGRlYWwudGltZSxcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBkZWFsLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgc2VsbGVyOiBkZWFsLnNlbGxlcixcbiAgICAgICAgICAgICAgICAgICAgICBzZWxsZXJQczogZGVhbC5zZWxsZXJQcyxcbiAgICAgICAgICAgICAgICAgICAgICBhc3NldDogZGVhbC5hc3NldCxcbiAgICAgICAgICAgICAgICAgICAgICBnaXRodWI6IGRlYWwuZ2l0aHViLFxuICAgICAgICAgICAgICAgICAgICAgIGFza2luZ1ByaWNlOiBkZWFsLmFza2luZ1ByaWNlLFxuICAgICAgICAgICAgICAgICAgICAgIGJ1eWVyOiBkZWFsLmJ1eWVyLFxuICAgICAgICAgICAgICAgICAgICAgIGJ1eWVyUHM6IGRlYWwuYnV5ZXJQcyxcbiAgICAgICAgICAgICAgICAgICAgICBwcmljZTogZGVhbC5wcmljZSxcbiAgICAgICAgICAgICAgICAgICAgICBzZWJpU3RhdHVzOiBkZWFsLnNlYmlTdGF0dXMsXG4gICAgICAgICAgICAgICAgICAgICAgX3NvdXJjZTogZGVhbC5fc291cmNlLFxuICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWRfYXQ6IG5ldyBEYXRlKClcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgJHNldE9uSW5zZXJ0OiB7IGNyZWF0ZWRfYXQ6IG5ldyBEYXRlKCkgfVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHVwc2VydDogdHJ1ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICAgIGF3YWl0IGNvbGxlY3Rpb24uYnVsa1dyaXRlKG9wZXJhdGlvbnMpO1xuXG4gICAgICAgICAgICAgIC8vIFJldHVybiBhbGwgY3VycmVudCBkZWFsc1xuICAgICAgICAgICAgICBjb25zdCBhbGxEZWFscyA9IGF3YWl0IGNvbGxlY3Rpb24uZmluZCh7fSkuc29ydCh7IGNyZWF0ZWRfYXQ6IDEgfSkudG9BcnJheSgpO1xuICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN5bmNlZDogc2hlZXREZWFscy5sZW5ndGgsIGRlYWxzOiBhbGxEZWFscyB9KSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1NoZWV0cyBTeW5jXSBFcnJvcjonLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGVyci5tZXNzYWdlIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICAgICAgICAvLyBERUFMUyBDUlVEIEVORFBPSU5UXG4gICAgICAgICAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gICAgICAgICAgaWYgKHBhcnNlZFVybC5wYXRobmFtZSA9PT0gJy9hcGkvZGVhbHMnKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zdCBkYiA9IGF3YWl0IGdldE1vbmdvRGIoKTtcbiAgICAgICAgICAgICAgY29uc3QgY29sbGVjdGlvbiA9IGRiLmNvbGxlY3Rpb24oJ2RlYWxzJyk7XG5cbiAgICAgICAgICAgICAgaWYgKHJlcS5tZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGVhbHMgPSBhd2FpdCBjb2xsZWN0aW9uLmZpbmQoe30pLnNvcnQoeyBjcmVhdGVkX2F0OiAxIH0pLnRvQXJyYXkoKTtcbiAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KGRlYWxzKSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgaWYgKHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSBhd2FpdCBnZXRSZXF1ZXN0Qm9keShyZXEpO1xuXG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGF5bG9hZCkpIHtcbiAgICAgICAgICAgICAgICAgIGlmIChwYXlsb2FkLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IG1lc3NhZ2U6ICdObyBkZWFscyB0byBpbXBvcnQnIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgY29uc3Qgb3BlcmF0aW9ucyA9IHBheWxvYWQubWFwKGRlYWwgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlT25lOiB7XG4gICAgICAgICAgICAgICAgICAgICAgZmlsdGVyOiB7IGlkOiBkZWFsLmlkIH0sXG4gICAgICAgICAgICAgICAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAkc2V0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBkZWFsLmlkLCB0aW1lOiBkZWFsLnRpbWUsIHR5cGU6IGRlYWwudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsbGVyOiBkZWFsLnNlbGxlciwgc2VsbGVyUHM6IGRlYWwuc2VsbGVyUHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0OiBkZWFsLmFzc2V0LCBnaXRodWI6IGRlYWwuZ2l0aHViLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBhc2tpbmdQcmljZTogZGVhbC5hc2tpbmdQcmljZSwgYnV5ZXI6IGRlYWwuYnV5ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGJ1eWVyUHM6IGRlYWwuYnV5ZXJQcywgcHJpY2U6IGRlYWwucHJpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNlYmlTdGF0dXM6IGRlYWwuc2ViaVN0YXR1cyB8fCAnQXBwcm92ZWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkX2F0OiBuZXcgRGF0ZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgJHNldE9uSW5zZXJ0OiB7IGNyZWF0ZWRfYXQ6IG5ldyBEYXRlKCkgfVxuICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgdXBzZXJ0OiB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNvbGxlY3Rpb24uYnVsa1dyaXRlKG9wZXJhdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSAyMDA7XG4gICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgbWVzc2FnZTogJ0J1bGsgaW1wb3J0IHN1Y2Nlc3NmdWwnLCByZXN1bHQgfSkpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocGF5bG9hZCkge1xuICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29sbGVjdGlvbi51cGRhdGVPbmUoXG4gICAgICAgICAgICAgICAgICAgIHsgaWQ6IHBheWxvYWQuaWQgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICRzZXQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBwYXlsb2FkLmlkLCB0aW1lOiBwYXlsb2FkLnRpbWUsIHR5cGU6IHBheWxvYWQudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGxlcjogcGF5bG9hZC5zZWxsZXIsIHNlbGxlclBzOiBwYXlsb2FkLnNlbGxlclBzLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXQ6IHBheWxvYWQuYXNzZXQsIGdpdGh1YjogcGF5bG9hZC5naXRodWIsXG4gICAgICAgICAgICAgICAgICAgICAgICBhc2tpbmdQcmljZTogcGF5bG9hZC5hc2tpbmdQcmljZSwgYnV5ZXI6IHBheWxvYWQuYnV5ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICBidXllclBzOiBwYXlsb2FkLmJ1eWVyUHMsIHByaWNlOiBwYXlsb2FkLnByaWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2ViaVN0YXR1czogcGF5bG9hZC5zZWJpU3RhdHVzIHx8ICdBcHByb3ZlZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkX2F0OiBuZXcgRGF0ZSgpXG4gICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAkc2V0T25JbnNlcnQ6IHsgY3JlYXRlZF9hdDogbmV3IERhdGUoKSB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgdXBzZXJ0OiB0cnVlIH1cbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBtZXNzYWdlOiAnRGVhbCByZWdpc3RlcmVkIHN1Y2Nlc3NmdWxseScsIHJlc3VsdCB9KSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgaWYgKHJlcS5tZXRob2QgPT09ICdERUxFVEUnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaWQgPSBwYXJzZWRVcmwucXVlcnkuaWQ7XG4gICAgICAgICAgICAgICAgaWYgKCFpZCkge1xuICAgICAgICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDA7XG4gICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdNaXNzaW5nIGRlYWwgSUQnIH0pKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29sbGVjdGlvbi5kZWxldGVPbmUoeyBpZDogaWQgfSk7XG4gICAgICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSAyMDA7XG4gICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IG1lc3NhZ2U6ICdEZWFsIGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5JywgcmVzdWx0IH0pKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUud2FybignTG9jYWwgTW9uZ28gbWlkZGxld2FyZSB0aW1lb3V0L2ZhbGxiYWNrIChkZWFscyk6JywgZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICBjbGllbnQgPSBudWxsO1xuICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShbXSkpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gICAgICAgICAgLy8gRVZBTFVBVElPTlMgQ1JVRCBFTkRQT0lOVFxuICAgICAgICAgIC8vIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAgICAgICAgIGlmIChwYXJzZWRVcmwucGF0aG5hbWUgPT09ICcvYXBpL2V2YWx1YXRpb25zJykge1xuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgZGIgPSBhd2FpdCBnZXRNb25nb0RiKCk7XG4gICAgICAgICAgICAgIGNvbnN0IGNvbGxlY3Rpb24gPSBkYi5jb2xsZWN0aW9uKCdldmFsdWF0aW9ucycpO1xuXG4gICAgICAgICAgICAgIGlmIChyZXEubWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGV2YWxzID0gYXdhaXQgY29sbGVjdGlvbi5maW5kKHt9KS5zb3J0KHsgdG90YWxTY29yZTogLTEgfSkudG9BcnJheSgpO1xuICAgICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoZXZhbHMpKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IGF3YWl0IGdldFJlcXVlc3RCb2R5KHJlcSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXlsb2FkKSkge1xuICAgICAgICAgICAgICAgICAgaWYgKHBheWxvYWQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgbWVzc2FnZTogJ05vIGV2YWx1YXRpb25zIHRvIGltcG9ydCcgfSkpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBjb25zdCBvcGVyYXRpb25zID0gcGF5bG9hZC5tYXAoZXYgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlT25lOiB7XG4gICAgICAgICAgICAgICAgICAgICAgZmlsdGVyOiB7IHRlYW1JZDogZXYudGVhbUlkIH0sXG4gICAgICAgICAgICAgICAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAkc2V0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRlYW1JZDogZXYudGVhbUlkLCB0ZWFtTmFtZTogZXYudGVhbU5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHByb2JsZW1TdGF0ZW1lbnQ6IGV2LnByb2JsZW1TdGF0ZW1lbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGRlYWxzRXhlY3V0ZWQ6IGV2LmRlYWxzRXhlY3V0ZWQsIGRlYWxTdGF0dXM6IGV2LmRlYWxTdGF0dXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHN0cmF0ZWdpY1JhdGlvbmFsZTogZXYuc3RyYXRlZ2ljUmF0aW9uYWxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1YXRpb25QcmljaW5nOiBldi52YWx1YXRpb25QcmljaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBpbnRlZ3JhdGlvblF1YWxpdHk6IGV2LmludGVncmF0aW9uUXVhbGl0eSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdG90YWxTY29yZTogZXYudG90YWxTY29yZSwgZmVlZGJhY2s6IGV2LmZlZWRiYWNrLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkX2F0OiBuZXcgRGF0ZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgJHNldE9uSW5zZXJ0OiB7IGNyZWF0ZWRfYXQ6IG5ldyBEYXRlKCkgfVxuICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgdXBzZXJ0OiB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNvbGxlY3Rpb24uYnVsa1dyaXRlKG9wZXJhdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSAyMDA7XG4gICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgbWVzc2FnZTogJ0J1bGsgZXZhbHVhdGlvbiBpbXBvcnQgc3VjY2Vzc2Z1bCcsIHJlc3VsdCB9KSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwYXlsb2FkKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjb2xsZWN0aW9uLnVwZGF0ZU9uZShcbiAgICAgICAgICAgICAgICAgICAgeyB0ZWFtSWQ6IHBheWxvYWQudGVhbUlkIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAkc2V0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZWFtSWQ6IHBheWxvYWQudGVhbUlkLCB0ZWFtTmFtZTogcGF5bG9hZC50ZWFtTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb2JsZW1TdGF0ZW1lbnQ6IHBheWxvYWQucHJvYmxlbVN0YXRlbWVudCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlYWxzRXhlY3V0ZWQ6IHBheWxvYWQuZGVhbHNFeGVjdXRlZCwgZGVhbFN0YXR1czogcGF5bG9hZC5kZWFsU3RhdHVzLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RyYXRlZ2ljUmF0aW9uYWxlOiBwYXlsb2FkLnN0cmF0ZWdpY1JhdGlvbmFsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVhdGlvblByaWNpbmc6IHBheWxvYWQudmFsdWF0aW9uUHJpY2luZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGludGVncmF0aW9uUXVhbGl0eTogcGF5bG9hZC5pbnRlZ3JhdGlvblF1YWxpdHksXG4gICAgICAgICAgICAgICAgICAgICAgICB0b3RhbFNjb3JlOiBwYXlsb2FkLnRvdGFsU2NvcmUsIGZlZWRiYWNrOiBwYXlsb2FkLmZlZWRiYWNrLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlZF9hdDogbmV3IERhdGUoKVxuICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgJHNldE9uSW5zZXJ0OiB7IGNyZWF0ZWRfYXQ6IG5ldyBEYXRlKCkgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7IHVwc2VydDogdHJ1ZSB9XG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSAyMDA7XG4gICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgbWVzc2FnZTogJ0V2YWx1YXRpb24gc2F2ZWQgc3VjY2Vzc2Z1bGx5JywgcmVzdWx0IH0pKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ0RFTEVURScpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0ZWFtSWQgPSBwYXJzZWRVcmwucXVlcnkudGVhbUlkO1xuICAgICAgICAgICAgICAgIGlmICghdGVhbUlkKSB7XG4gICAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwMDtcbiAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ01pc3NpbmcgdGVhbUlkJyB9KSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNvbGxlY3Rpb24uZGVsZXRlT25lKHsgdGVhbUlkOiB0ZWFtSWQgfSk7XG4gICAgICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSAyMDA7XG4gICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IG1lc3NhZ2U6ICdFdmFsdWF0aW9uIGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5JywgcmVzdWx0IH0pKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUud2FybignTG9jYWwgTW9uZ28gbWlkZGxld2FyZSB0aW1lb3V0L2ZhbGxiYWNrIChldmFsdWF0aW9ucyk6JywgZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICBjbGllbnQgPSBudWxsO1xuICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShbXSkpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbmV4dCgpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIF1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF1TixTQUFTLG9CQUFvQjtBQUNwUCxPQUFPLFdBQVc7QUFDbEIsU0FBUyxtQkFBbUI7QUFDNUIsT0FBTyxTQUFTO0FBQ2hCLE9BQU8sV0FBVztBQUVsQixJQUFNLGNBQWMsUUFBUSxJQUFJLGVBQWU7QUFDL0MsSUFBTSxVQUFVLFFBQVEsSUFBSSxpQkFBaUI7QUFDN0MsSUFBTSxXQUFXO0FBR2pCLElBQU0sZUFBZSxDQUFDLGFBQWEsYUFBYSxhQUFhLFdBQVc7QUFFeEUsSUFBSSxTQUFTO0FBQ2IsZUFBZSxhQUFhO0FBQzFCLE1BQUksQ0FBQyxRQUFRO0FBQ1gsYUFBUyxJQUFJLFlBQVksYUFBYTtBQUFBLE1BQ3BDLDBCQUEwQjtBQUFBLE1BQzFCLGtCQUFrQjtBQUFBLElBQ3BCLENBQUM7QUFDRCxVQUFNLE9BQU8sUUFBUTtBQUFBLEVBQ3ZCO0FBQ0EsU0FBTyxPQUFPLEdBQUcsT0FBTztBQUMxQjtBQUVBLFNBQVMsZUFBZSxLQUFLO0FBQzNCLFNBQU8sSUFBSSxRQUFRLENBQUMsWUFBWTtBQUM5QixRQUFJLE9BQU87QUFDWCxRQUFJLEdBQUcsUUFBUSxXQUFTO0FBQUUsY0FBUTtBQUFBLElBQU8s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
