import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://stones741banks_db_user:6rxSSIivYhs4tqCZ@hacquire.6dnd9d6.mongodb.net/?appName=hacquire';
const DB_NAME = process.env.DATABASE_NAME || 'hacquire';
const COLLECTION_NAME = 'evaluations';

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  const db = client.db(DB_NAME);
  
  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);

    if (req.method === 'GET') {
      const evals = await collection.find({}).sort({ totalScore: -1 }).toArray();
      res.status(200).json(evals);
      return;
    }

    if (req.method === 'POST') {
      const payload = req.body;

      if (Array.isArray(payload)) {
        if (payload.length === 0) {
          res.status(200).json({ message: 'No evaluations to import' });
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
        res.status(200).json({ message: 'Bulk evaluation import successful', result });
        return;
      } else {
        const ev = payload;
        const result = await collection.updateOne(
          { teamId: ev.teamId },
          { 
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
          { upsert: true }
        );
        res.status(200).json({ message: 'Evaluation saved successfully', result });
        return;
      }
    }

    if (req.method === 'DELETE') {
      const { teamId } = req.query;
      if (!teamId) {
        res.status(400).json({ error: 'Missing teamId query parameter' });
        return;
      }

      const result = await collection.deleteOne({ teamId: teamId });
      res.status(200).json({ message: 'Evaluation deleted successfully', result });
      return;
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Evaluations API error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
