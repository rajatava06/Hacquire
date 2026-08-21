import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://stones741banks_db_user:6rxSSIivYhs4tqCZ@hacquire.6dnd9d6.mongodb.net/?appName=hacquire';
const DB_NAME = process.env.DATABASE_NAME || 'hacquire';
const COLLECTION_NAME = 'deals';

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
  // Enable CORS
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
      const deals = await collection.find({}).sort({ created_at: 1 }).toArray();
      res.status(200).json(deals);
      return;
    }

    if (req.method === 'POST') {
      const payload = req.body;

      if (Array.isArray(payload)) {
        if (payload.length === 0) {
          res.status(200).json({ message: 'No deals to import' });
          return;
        }
        // Bulk upsert logic with 11 attributes
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
                price: deal.price, // Negotiated Price (Cr)
                sebiStatus: deal.sebiStatus || 'Approved',
                updated_at: new Date()
              },
              $setOnInsert: { created_at: new Date() }
            },
            upsert: true
          }
        }));

        const result = await collection.bulkWrite(operations);
        res.status(200).json({ message: 'Bulk import successful', result });
        return;
      } else {
        // Single upsert logic
        const deal = payload;
        const result = await collection.updateOne(
          { id: deal.id },
          { 
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
          { upsert: true }
        );
        res.status(200).json({ message: 'Deal registered successfully', result });
        return;
      }
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        res.status(400).json({ error: 'Missing deal ID query parameter' });
        return;
      }

      const result = await collection.deleteOne({ id: id });
      res.status(200).json({ message: 'Deal deleted successfully', result });
      return;
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Database connection / operation error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
