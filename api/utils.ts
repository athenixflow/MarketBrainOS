
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Shared Config - Force Node.js runtime for Admin SDK compatibility
export const config = {
  runtime: 'nodejs',
};

// Initialize Firebase Admin (Singleton)
if (!admin.apps.length) {
  try {
    // 1. Try Service Account from Env (Best for Vercel)
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) 
      : undefined;
      
    admin.initializeApp({
      credential: serviceAccount ? admin.credential.cert(serviceAccount) : undefined,
    });
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
  }
}

export const db = admin.firestore();
export const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

// AI Client
export const getAIClient = () => {
  const key = process.env.API_KEY || process.env.Google_api;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
};

// Data Cleaning Helper
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

// Node.js Response Helpers (Express-like style for Vercel Functions)
export const sendJson = (res: any, data: any, status = 200) => {
  res.status(status).json(data);
};

export const sendError = (res: any, message: string, code = 'internal_error', status = 500) => {
  res.status(status).json({ success: false, error: message, meta: { code } });
};
