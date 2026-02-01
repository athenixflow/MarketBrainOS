
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Shared Config
export const config = {
  runtime: 'edge',
};

// Initialize Firebase (Edge Compatible)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Singleton Init pattern for Edge
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// AI Client
export const getAIClient = () => {
  const key = process.env.API_KEY || process.env.Google_api;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
};

// Response Helpers
export const jsonResponse = (data: any, status = 200) => 
  new Response(JSON.stringify(data), { 
    status, 
    headers: { 'Content-Type': 'application/json' } 
  });

export const errorResponse = (message: string, code = 'internal_error', status = 500) =>
  jsonResponse({ success: false, error: message, meta: { code } }, status);

// Data Cleaning
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
