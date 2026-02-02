import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Shared Config
export const config = {
  runtime: 'nodejs',
};

// --- FIREBASE ADMIN INITIALIZATION ---
// This block ensures we don't crash the server if env vars are malformed.
if (!getApps().length) {
  try {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (key) {
      // FIX: Handle both standard newlines and escaped newlines (common in Vercel/Dotenv)
      const sanitizedKey = key.replace(/\\n/g, '\n');
      const serviceAccount = JSON.parse(sanitizedKey);
      
      initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT_KEY missing. Attempting Application Default Credentials...");
      // Fallback: This might work if deployed on GCP/Firebase Functions, but likely fails on Vercel without env var.
      initializeApp(); 
    }
  } catch (error) {
    console.error('CRITICAL: Firebase Admin Initialization Failed.', error);
  }
}

// SAFE EXPORT: If initialization failed, db is null. Endpoints must check this.
export const db = getApps().length ? getFirestore() : null;
export const serverTimestamp = FieldValue.serverTimestamp;

// --- AI CLIENT ---
export const getAIClient = () => {
  const key = process.env.API_KEY || process.env.Google_api;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
};

// --- DATA CLEANING ---
export const cleanJSON = (text: string) => {
  const clean = text.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try { return JSON.parse(clean.substring(firstBrace, lastBrace + 1)); } catch (e2) { return null; }
    }
    return null;
  }
};

// --- RESPONSE HELPERS ---
export const sendJson = (res: any, data: any, status = 200) => {
  res.status(status).json(data);
};

export const sendError = (res: any, message: string, code = 'internal_error', status = 500) => {
  res.status(status).json({ success: false, error: message, meta: { code } });
};