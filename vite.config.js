import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { MongoClient } from 'mongodb';
import url from 'url';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://stones741banks_db_user:6rxSSIivYhs4tqCZ@hacquire.6dnd9d6.mongodb.net/?appName=hacquire';
const DB_NAME = process.env.DATABASE_NAME || 'hacquire';

let client = null;
async function getMongoDb() {
  if (!client) {
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000
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
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve(null);
      }
    });
  });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mongodb-local-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const parsedUrl = url.parse(req.url, true);
          
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
