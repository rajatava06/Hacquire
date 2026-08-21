# HACQUIRE — Vercel & MongoDB Atlas Cloud Database Deployment Guide

This HACQUIRE React application comes with dual database support:
1. **Local Mode (Default)**: Persists deals dynamically in `localStorage` when running locally or offline.
2. **Cloud Mode (Vercel Ready)**: Automatically syncs deals live in real-time across all users and devices when deployed to Vercel connected to MongoDB Atlas!

---

## 1. MongoDB Atlas Setup

We have integrated your MongoDB Atlas database connection string directly into the Vercel serverless function backend:
`mongodb+srv://stones741banks_db_user:6rxSSIivYhs4tqCZ@hacquire.6dnd9d6.mongodb.net/?appName=hacquire`

- Database: `hacquire`
- Collection: `deals`

---

## 2. Deploying to Vercel

1. Push your repository to GitHub or upload to Vercel using `vercel cli`.
2. Vercel will automatically discover the serverless backend function inside `api/deals.js` and serve it at `/api/deals`.
3. In your **Vercel Project Settings** -> **Environment Variables** (Optional, for production overrides):
   - `MONGODB_URI`: `mongodb+srv://stones741banks_db_user:6rxSSIivYhs4tqCZ@hacquire.6dnd9d6.mongodb.net/?appName=hacquire`
4. Deploy! Your app will now fetch, register, bulk-import via Excel, and sync deals live across all Vercel visitors in real time!

---

## 3. Features Included

- 📊 **Excel Bulk Import**: Upload `.xlsx`, `.xls`, or `.csv` sheets with automatic header mapping.
- 📥 **Download Demo Template**: Pre-formatted `hacquire_deals_template.xlsx` demo file ready in OC Admin.
- 🎠 **Enlarged Deals Done Carousel**: Fullscreen/modal multi-row carousel window with custom-speed scroll and play/pause controls.
- ⚡ **Real-time Synchronization**: Live updates across all connected clients on Vercel via background database polling.
