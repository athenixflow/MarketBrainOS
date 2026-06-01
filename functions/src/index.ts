
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';

admin.initializeApp();
const db = admin.firestore();

// --- SERVER-SIDE CONFIGURATION ---

const COSTS: Record<string, number> = {
  'AngleMiner_Generate': 3,
  'AngleMiner_Improve': 1,
  'ConversionDoctor_Audit': 4,
  'TestLab_Simulation': 5,
  'Workflow_ImproveAssets': 6,
  // PRD §14–22 analysis tools
  'StrategyLab_Analyze': 5,
  'OfferAnalyzer_Analyze': 4,
  'AudienceIntel_Analyze': 4,
  'MarketIntel_Analyze': 5,
  'Competitor_Analyze': 4,
  'Messaging_Analyze': 3,
  'ContentStrategy_Analyze': 4,
  'Campaign_Analyze': 4,
  'Growth_Analyze': 5,
  'Workflow_Analyze': 5
};

const MODULE_MAPPING: Record<string, string> = {
  'AngleMiner_Generate': 'AngleMiner',
  'AngleMiner_Improve': 'AngleMiner',
  'ConversionDoctor_Audit': 'ConversionDoctor',
  'TestLab_Simulation': 'TestLabPro',
  'Workflow_ImproveAssets': 'Workflow',
  // PRD §14–22 analysis tools
  'StrategyLab_Analyze': 'StrategyLab',
  'OfferAnalyzer_Analyze': 'OfferAnalyzer',
  'AudienceIntel_Analyze': 'AudienceIntel',
  'MarketIntel_Analyze': 'MarketIntel',
  'Competitor_Analyze': 'Competitor',
  'Messaging_Analyze': 'Messaging',
  'ContentStrategy_Analyze': 'ContentStrategy',
  'Campaign_Analyze': 'Campaign',
  'Growth_Analyze': 'Growth',
  'Workflow_Analyze': 'WorkflowAnalyzer'
};

const RATE_LIMIT_RULES = {
  COOLDOWN_MS: 10000,
  BURST_LIMIT: 3,
  FAILURE_LIMIT: 5,
  BURST_WINDOW_MS: 60000,
  FAILURE_WINDOW_MS: 600000,
  BLOCK_DURATION_MS: 600000
};

const TOP_UP_CONFIG = {
  PRICE_USD: 5,
  TOKENS_GRANTED: 100
};

const genAI = new GoogleGenerativeAI(process.env.API_KEY || '');

// --- HELPERS ---

const systemInstruction = `
You are the MarketBrainOS Intelligence Engine.
Core Mission: Provide high-confidence marketing angles, conversion audits, and performance simulations.
`;

// Canonical universal result sections (PRD §23 / V1 Tool Architecture). `summary`
// carries the Executive Summary; these eight follow in this exact order for every tool.
const UNIVERSAL_SECTIONS = [
  'Key Findings', 'Strengths', 'Weaknesses', 'Opportunities',
  'Risks', 'Recommendations', 'Action Plan', 'Next Steps'
];

// PRD §14–22 generic analysis tools — instruction + expected result sections.
const TOOL_PROMPTS: Record<string, { instruction: string; sections: string[]; scored: boolean }> = {
  'StrategyLab_Analyze': { instruction: "Evaluate whether the described idea/initiative is worth pursuing. Assess feasibility, opportunity, risk, competition, and execution difficulty.", sections: ['Strengths', 'Weaknesses', 'Opportunities', 'Threats', 'Recommendation'], scored: true },
  'OfferAnalyzer_Analyze': { instruction: "Assess how compelling this offer is. Evaluate value perception, pricing logic, competitive position, and clarity/appeal.", sections: ['Offer Breakdown', 'Improvement Opportunities', 'Pricing Feedback', 'Action Steps'], scored: true },
  'AudienceIntel_Analyze': { instruction: "Analyze the target audience. Map demographics, psychographics, pain points, desires, objections, and buying motivations.", sections: ['Primary Persona', 'Secondary Personas', 'Pain Points', 'Desires & Motivations', 'Opportunity Map'], scored: false },
  'MarketIntel_Analyze': { instruction: "Analyze the market for opportunities. Cover trends, market size, emerging opportunities, gaps, and threats.", sections: ['Market Overview', 'Trend Report', 'Opportunity Report', 'Risk Areas', 'Recommendations'], scored: false },
  'Competitor_Analyze': { instruction: "Compare the business against its competitors. Identify strengths, weaknesses, market position, and differentiation.", sections: ['Competitor Summary', 'Comparison Matrix', 'Advantage Opportunities', 'Differentiation'], scored: false },
  'Messaging_Analyze': { instruction: "Evaluate how effectively this messaging persuades. Assess clarity, persuasion, trust, emotion, and credibility.", sections: ['Messaging Review', 'Problem Areas', 'Optimization Suggestions'], scored: true },
  'ContentStrategy_Analyze': { instruction: "Build a content strategy. Define content pillars, topic ideas, themes, and distribution.", sections: ['Content Roadmap', 'Content Pillars', 'Topic Ideas', 'Publishing Strategy', 'Growth Opportunities'], scored: false },
  'Campaign_Analyze': { instruction: "Audit this campaign and find ways to improve performance. Identify weaknesses, optimizations, and scaling opportunities.", sections: ['Campaign Audit', 'Weaknesses', 'Improvement Plan', 'Scaling Strategy'], scored: true },
  'Growth_Analyze': { instruction: "Identify where the business can grow fastest. Surface growth opportunities, expansion ideas, and revenue opportunities.", sections: ['Growth Audit', 'Opportunity Map', 'Revenue Expansion Plan', 'Strategic Recommendations'], scored: false },
  'Workflow_Analyze': { instruction: "Analyze the described business workflow/process. Identify where time, money, and effort are wasted: bottlenecks, inefficiencies, redundancies, and automation opportunities.", sections: ['Bottlenecks', 'Inefficiencies', 'Redundancies', 'Automation Opportunities'], scored: false },
};

const cleanJSON = (text: string) => {
  const clean = text.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error("AI Output Malformed: Not valid JSON");
  }
};

const generateHash = (content: string, prevHash: string): string => {
  const hash = crypto.createHash('sha256');
  hash.update(content + prevHash);
  return hash.digest('hex');
};

const logAdminAudit = async (adminUid: string, adminEmail: string, action: string, targetUid: string, metadata: any) => {
  const logsRef = db.collection('admin_audit_logs');
  const lastLogQuery = await logsRef.orderBy('timestamp', 'desc').limit(1).get();
  const prevHash = lastLogQuery.empty 
    ? "0000000000000000000000000000000000000000000000000000000000000000" 
    : lastLogQuery.docs[0].data().hash;

  const timestamp = new Date().toISOString();
  const entry = {
    admin_uid: adminUid,
    admin_email: adminEmail,
    action_type: action,
    target: targetUid,
    metadata,
    timestamp
  };
  
  // Create deterministic string for hashing
  const content = JSON.stringify(entry);
  const hash = generateHash(content, prevHash);

  await logsRef.add({
    ...entry,
    hash,
    previous_hash: prevHash
  });
};

// --- CORE FUNCTION (Converted to onRequest for strict CORS control) ---

export const executeAnalysis = functions.https.onRequest(async (req: any, res: any) => {
  // 1. CORS MIDDLEWARE
  const allowedOrigins = [
    'https://www.marketbrainos.com', 
    'https://marketbrainos.com', 
    'http://localhost:5173'
  ];
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // 2. AUTHENTICATION MIDDLEWARE
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: { message: 'Unauthenticated', code: 'unauthenticated' } });
    return;
  }

  let uid: string;
  try {
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    uid = decodedToken.uid;
  } catch (e) {
    res.status(401).json({ error: { message: 'Invalid or expired token', code: 'unauthenticated' } });
    return;
  }

  // 3. EXECUTION LOGIC
  try {
    const { module, input } = req.body;

    if (!COSTS[module]) {
      res.status(400).json({ error: { message: `Unknown module: ${module}`, code: 'invalid-argument' } });
      return;
    }
    const cost = COSTS[module];

    // SYSTEM CONTROLS CHECK
    const settingsDoc = await db.collection('admin_settings').doc('global').get();
    if (settingsDoc.exists) {
      const settings = settingsDoc.data()!;
      
      if (settings.analyses_paused) {
        await db.collection('action_logs').add({
          uid, module, tokens_used: 0, status: 'blocked', error_code: 'SYSTEM_PAUSED', created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        res.status(503).json({ error: { message: 'System analysis is currently paused by administrators.', code: 'unavailable' } });
        return;
      }

      if (settings.maintenance_mode) {
        const userDoc = await db.collection('users').doc(uid).get();
        const role = userDoc.exists ? userDoc.data()!.role : 'user';
        if (role !== 'super_admin' && role !== 'ops_admin') {
          await db.collection('action_logs').add({
            uid, module, tokens_used: 0, status: 'blocked', error_code: 'MAINTENANCE_MODE', created_at: admin.firestore.FieldValue.serverTimestamp()
          });
          res.status(503).json({ error: { message: 'System is in maintenance mode.', code: 'unavailable' } });
          return;
        }
      }

      const moduleKey = MODULE_MAPPING[module];
      if (moduleKey && settings.modules_enabled && settings.modules_enabled[moduleKey] === false) {
        await db.collection('action_logs').add({
          uid, module, tokens_used: 0, status: 'blocked', error_code: 'MODULE_DISABLED', created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        res.status(503).json({ error: { message: `The ${moduleKey} module is currently disabled.`, code: 'unavailable' } });
        return;
      }
    }

    // RATE LIMIT CHECK
    const rateLimitRef = db.collection('rate_limits').doc(uid);
    const now = admin.firestore.Timestamp.now();
    let isRateLimited = false;
    let rateLimitMessage = '';

    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const doc = await t.get(rateLimitRef);
      const limitData = doc.exists ? doc.data()! : {
        last_request_at: null,
        requests_in_last_minute: 0,
        blocked_until: null,
        burst_window_start: now
      };

      if (limitData.blocked_until && limitData.blocked_until.toMillis() > now.toMillis()) {
        isRateLimited = true;
        rateLimitMessage = 'Account temporarily blocked due to rate limits.';
        return;
      }

      if (limitData.last_request_at && (now.toMillis() - limitData.last_request_at.toMillis() < RATE_LIMIT_RULES.COOLDOWN_MS)) {
        isRateLimited = true;
        rateLimitMessage = 'Please wait 10 seconds between analyses.';
        return;
      }

      if (limitData.burst_window_start && (now.toMillis() - limitData.burst_window_start.toMillis() > RATE_LIMIT_RULES.BURST_WINDOW_MS)) {
        limitData.requests_in_last_minute = 0;
        limitData.burst_window_start = now;
      }
      
      if (limitData.requests_in_last_minute >= RATE_LIMIT_RULES.BURST_LIMIT) {
         t.set(rateLimitRef, { ...limitData, blocked_until: admin.firestore.Timestamp.fromMillis(now.toMillis() + RATE_LIMIT_RULES.BLOCK_DURATION_MS) }, { merge: true });
         isRateLimited = true;
         rateLimitMessage = 'Rate limit exceeded. Pausing for 10 minutes.';
         return;
      }

      t.set(rateLimitRef, {
        ...limitData,
        last_request_at: now,
        requests_in_last_minute: limitData.requests_in_last_minute + 1,
        burst_window_start: limitData.burst_window_start || now
      }, { merge: true });
    });

    if (isRateLimited) {
      res.status(429).json({ error: { message: rateLimitMessage, code: 'resource-exhausted' } });
      return;
    }

    // BILLING & EXECUTION
    const userRef = db.collection('users').doc(uid);
    let tokensDeducted = false;

    try {
      await db.runTransaction(async (t: admin.firestore.Transaction) => {
        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw new Error('User profile not found.');
        
        const userData = userDoc.data()!;
        if (userData.is_suspended) throw new Error('Account suspended.');
        
        const currentTokens = userData.tokens || 0;
        if (currentTokens < cost) {
          throw new Error('Insufficient analysis credits.');
        }

        t.update(userRef, { tokens: currentTokens - cost, last_active: now.toDate().toISOString() });
        tokensDeducted = true;
      });
    } catch (e: any) {
      if (e.message === 'Insufficient analysis credits.') {
        res.status(429).json({ error: { message: e.message, code: 'resource-exhausted' } });
      } else if (e.message === 'Account suspended.') {
        res.status(403).json({ error: { message: e.message, code: 'permission-denied' } });
      } else {
        res.status(500).json({ error: { message: 'Billing failure', code: 'internal' } });
      }
      return;
    }

    try {
      let responseText = "";
      const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview", systemInstruction });

      if (module === 'AngleMiner_Generate') {
        const prompt = `
          Generate marketing angles. Product Name: ${input.productName || ''}, Description: ${input.product}, Audience: ${input.target}, Market: ${input.market || input.industry}, Goal: ${input.goal}, Tones: ${input.tones?.join(', ')}.
          Produce angles across these 8 types: Emotional, Fear, Aspiration, Curiosity, Authority, Differentiation, Story, Contrarian (at least one of each, more for the strongest).
          Each angle: { type (one of the 8 exact labels), title, hook, rational, score (0-100) }.
          Return strict JSON: { angles: [{type, title, hook, rational, score}], hooks: [{platform, short, expanded}] }
        `;
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        });
        responseText = result.response.text();
      } 
      else if (module === 'AngleMiner_Improve') {
        const result = await model.generateContent(`Refine this hook for higher conversion: "${input}"`);
        responseText = result.response.text();
      }
      else if (module === 'TestLab_Simulation') {
        const prompt = `Compare variants for ${input.type}: ${input.variants?.join(', ')}. Return JSON: { variants: [{label, text, score}], winnerLabel, explanation }`;
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        });
        responseText = result.response.text();
      }
      else if (module === 'ConversionDoctor_Audit') {
        const prompt = `Audit ${input.context}: "${input.input}". Return JSON: { score, summary, issues: [{blocker, impact}], fixes: [{what, how, expectedResult}] }`;
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        });
        responseText = result.response.text();
      }
      else if (module === 'Workflow_ImproveAssets') {
        const prompt = `Refine angle "${input.angle}" based on issues: ${input.issues?.join(', ')}. Return JSON: { headline, cta, offer }`;
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        });
        responseText = result.response.text();
      }
      else if (TOOL_PROMPTS[module]) {
        const cfg = TOOL_PROMPTS[module];
        const { _context, ...cleanInput } = (input || {});
        const prompt = [
          `Task: ${cfg.instruction}`,
          `Inputs: ${JSON.stringify(cleanInput).slice(0, 4000)}`,
          _context ? `Use this related prior analysis as supporting context — build on it, do not just repeat it: ${String(_context).slice(0, 3000)}` : "",
          cfg.scored ? "Include a numeric 'score' (0-100) and a short 'verdict' label." : "",
          `Provide a 'summary' (the Executive Summary) plus a 'sections' array that includes EVERY one of these sections, in this exact order: ${UNIVERSAL_SECTIONS.join(', ')}.`,
          "Each section: {title, items:[string]} with 3-6 specific, actionable items. Tailor the content of each section to the task above.",
          "Return strict JSON: { score?, verdict?, summary, sections: [{title, items:[string]}] }"
        ].filter(Boolean).join(' ');
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        });
        responseText = result.response.text();
      }

      let finalOutput;
      if (module !== 'AngleMiner_Improve') {
        finalOutput = cleanJSON(responseText);
        if (!finalOutput || Object.keys(finalOutput).length === 0) throw new Error("Empty JSON");
      } else {
        finalOutput = responseText.trim();
        if (!finalOutput) throw new Error("Empty Response");
      }

      await db.collection('action_logs').add({
        uid,
        module,
        tokens_used: cost,
        status: 'success',
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(200).json({ result: finalOutput });

    } catch (error: any) {
      if (tokensDeducted) {
        await db.runTransaction(async (t: admin.firestore.Transaction) => {
          const userDoc = await t.get(userRef);
          if (userDoc.exists) {
            const current = userDoc.data()!.tokens || 0;
            t.update(userRef, { tokens: current + cost });
          }
        });
      }

      await db.collection('action_logs').add({
        uid,
        module,
        tokens_used: 0,
        status: 'failed_refunded',
        error_code: error.message || 'unknown',
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      
      await db.runTransaction(async (t: admin.firestore.Transaction) => {
          const doc = await t.get(rateLimitRef);
          if(doc.exists) {
              const d = doc.data()!;
              t.update(rateLimitRef, { failed_requests_in_window: (d.failed_requests_in_window || 0) + 1 });
          }
      });

      res.status(500).json({ error: { message: 'Analysis failed. Tokens have been refunded.', code: 'internal' } });
    }

  } catch (err: any) {
    res.status(500).json({ error: { message: 'Internal Server Error', code: 'internal' } });
  }
});

// --- ADMIN MANAGEMENT FUNCTION ---

export const manageUser = functions.https.onCall(async (data: any, context: any) => {
  // 1. Auth Check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  
  const callerUid = context.auth.uid;
  const callerEmail = context.auth.token.email || 'unknown';
  
  // 2. Admin Role Check
  const callerRef = db.collection('users').doc(callerUid);
  const callerSnap = await callerRef.get();
  
  if (!callerSnap.exists) throw new functions.https.HttpsError('permission-denied', 'Caller profile missing');
  const callerData = callerSnap.data();
  
  // Allow super_admin and ops_admin
  if (callerData?.role !== 'super_admin' && callerData?.role !== 'ops_admin') {
     throw new functions.https.HttpsError('permission-denied', 'Insufficient privileges');
  }

  const { action, targetUserId, payload } = data;
  
  if (!targetUserId) throw new functions.https.HttpsError('invalid-argument', 'Target User ID required');

  const targetRef = db.collection('users').doc(targetUserId);
  
  // 3. Execution Logic
  try {
    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const targetDoc = await t.get(targetRef);
      if (!targetDoc.exists) throw new functions.https.HttpsError('not-found', 'Target user not found');
      
      const userData = targetDoc.data()!;
      
      switch (action) {
        case 'promoteToAdmin':
          if (userData.role === 'super_admin' || userData.role === 'ops_admin') {
            throw new functions.https.HttpsError('failed-precondition', 'User is already an admin');
          }
          t.update(targetRef, { role: 'ops_admin' });
          break;

        case 'demoteAdmin':
          if (userData.role !== 'ops_admin' && userData.role !== 'super_admin') {
             throw new functions.https.HttpsError('failed-precondition', 'User is not an admin');
          }
          // Prevent removing last admin
          const adminQuery = db.collection('users').where('role', 'in', ['super_admin', 'ops_admin']);
          const adminCountSnap = await t.get(adminQuery);
          if (adminCountSnap.size <= 1) {
             throw new functions.https.HttpsError('aborted', 'Cannot remove the last administrator');
          }
          t.update(targetRef, { role: 'user' });
          break;

        case 'changePlan':
          if (!['free', 'pro'].includes(payload.plan)) {
             throw new functions.https.HttpsError('invalid-argument', 'Invalid plan type');
          }
          t.update(targetRef, { tier: payload.plan });
          break;

        case 'resetTokens':
          const defaultTokens = userData.tier === 'pro' ? 200 : 4;
          t.update(targetRef, { tokens: defaultTokens });
          break;

        case 'toggleStatus':
          // Toggle between active and disabled (is_suspended)
          const newStatus = !userData.is_suspended;
          const updateData: any = { is_suspended: newStatus };
          if (newStatus) {
            updateData.suspension_reason = 'Administrative Action';
          } else {
            updateData.suspension_reason = admin.firestore.FieldValue.delete();
          }
          t.update(targetRef, updateData);
          break;

        default:
          throw new functions.https.HttpsError('invalid-argument', 'Unknown management action');
      }
    });
    
    // 4. Audit Logging
    await logAdminAudit(callerUid, callerEmail, action, targetUserId, payload);
    
    return { success: true };

  } catch (error: any) {
    console.error("Admin Action Failed:", error);
    // Re-throw valid HttpsErrors, wrap others
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Admin action failed');
  }
});

// --- ADMIN CONTROLS FUNCTION ---

export const updateSystemSettings = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  
  const callerUid = context.auth.uid;
  const callerRef = db.collection('users').doc(callerUid);
  const callerSnap = await callerRef.get();
  
  if (!callerSnap.exists) throw new functions.https.HttpsError('permission-denied', 'Caller profile missing');
  const callerData = callerSnap.data();
  
  if (callerData?.role !== 'super_admin' && callerData?.role !== 'ops_admin') {
     throw new functions.https.HttpsError('permission-denied', 'Insufficient privileges');
  }

  const { changes } = data; // Partial object of AdminSettings
  if (!changes || typeof changes !== 'object') throw new functions.https.HttpsError('invalid-argument', 'Invalid changes payload');

  const settingsRef = db.collection('admin_settings').doc('global');

  try {
    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const doc = await t.get(settingsRef);
      const currentData = doc.exists ? doc.data() : {};
      
      const newData = {
        ...currentData,
        ...changes,
        last_updated: new Date().toISOString(),
        updated_by: context.auth!.token.email
      };
      
      t.set(settingsRef, newData, { merge: true });
      
      // Audit Log
      await logAdminAudit(
        callerUid, 
        context.auth!.token.email || 'unknown', 
        'UPDATE_SYSTEM_SETTINGS', 
        'GLOBAL_SETTINGS', 
        { changes, previous: currentData }
      );
    });
    return { success: true };
  } catch (error: any) {
    console.error("System Update Failed:", error);
    throw new functions.https.HttpsError('internal', error.message || 'Update failed');
  }
});

// --- TOKEN TOP-UP FUNCTION ---

export const confirmTopUp = functions.https.onCall(async (data: any, context: any) => {
  // 1. AUTH & INPUT VALIDATION
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  const uid = context.auth.uid;
  const { paymentReference, amountPaid } = data;

  if (!paymentReference || typeof paymentReference !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Missing payment reference.');
  }
  
  // Strict economic enforcement: Client must acknowledge the exact price
  if (amountPaid !== TOP_UP_CONFIG.PRICE_USD) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid payment amount.');
  }

  const paymentRef = db.collection('payments').doc(paymentReference);
  const userRef = db.collection('users').doc(uid);

  try {
    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      // 2. IDEMPOTENCY CHECK
      // If payment already recorded, assume it was successful (idempotent) and return success.
      const paymentDoc = await t.get(paymentRef);
      if (paymentDoc.exists) {
        console.log(`Payment ${paymentReference} already processed. Skipping.`);
        return { success: true, message: 'Payment already processed.' };
      }

      // 3. ELIGIBILITY CHECKS
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
      }
      const userData = userDoc.data()!;

      if (userData.is_suspended) {
        throw new functions.https.HttpsError('permission-denied', 'Account suspended. Top-up rejected.');
      }

      if (userData.tier !== 'pro') {
        throw new functions.https.HttpsError('permission-denied', 'Only Pro users can purchase top-ups.');
      }

      // 4. MOCK VERIFICATION (In production, verify against Stripe/Provider API here)
      // verifyPaymentWithProvider(paymentReference);
      const verificationStatus = 'verified'; // Assumed valid for this implementation scope

      if (verificationStatus !== 'verified') {
        throw new functions.https.HttpsError('aborted', 'Payment verification failed.');
      }

      // 5. EXECUTE CREDIT
      const currentTokens = userData.tokens || 0;
      const newTokens = currentTokens + TOP_UP_CONFIG.TOKENS_GRANTED;

      // Update User
      t.update(userRef, { 
        tokens: newTokens, 
        last_topup: admin.firestore.FieldValue.serverTimestamp() 
      });

      // Create Payment Record (Immutable)
      t.set(paymentRef, {
        uid,
        payment_reference: paymentReference,
        amount_paid: TOP_UP_CONFIG.PRICE_USD,
        tokens_credited: TOP_UP_CONFIG.TOKENS_GRANTED,
        provider: 'stripe_simulated', // Placeholder
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // Create Action Log (Immutable)
      const actionLogRef = db.collection('action_logs').doc();
      t.set(actionLogRef, {
        uid,
        action: 'token_topup',
        tokens_added: TOP_UP_CONFIG.TOKENS_GRANTED,
        amount_paid: TOP_UP_CONFIG.PRICE_USD,
        payment_reference: paymentReference,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { success: true };
    });

    return { success: true };

  } catch (error: any) {
    console.error("Top-Up Failed:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Top-up transaction failed.');
  }
});

// --- SUBSCRIPTION LIFECYCLE FUNCTION (§30) ---
// Simulated billing: server-authoritative transitions. A real provider (Stripe) would
// verify payment before `upgrade`/`renew` — that check is the documented seam below.
const PRO_MONTHLY_TOKENS = 200;
const RENEWAL_DAYS = 30;

export const changeSubscription = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  const uid = context.auth.uid;
  const action = data?.action as 'upgrade' | 'cancel' | 'downgrade' | 'renew';
  if (!['upgrade', 'cancel', 'downgrade', 'renew'].includes(action)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid subscription action.');
  }

  const userRef = db.collection('users').doc(uid);

  try {
    let result: any = {};
    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User profile not found.');
      const userData = userDoc.data()!;
      if (userData.is_suspended) throw new functions.https.HttpsError('permission-denied', 'Account suspended.');

      const now = new Date();
      const renewsAt = new Date(now.getTime() + RENEWAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

      if (action === 'upgrade' || action === 'renew') {
        // SEAM: verify payment with provider here before granting (simulated as success).
        const currentTokens = userData.tokens || 0;
        t.update(userRef, {
          tier: 'pro',
          subscription_status: 'active',
          plan_renews_at: renewsAt,
          subscription_started_at: userData.subscription_started_at || now.toISOString(),
          // Renewal/upgrade grants the monthly Pro allocation.
          tokens: action === 'upgrade' ? currentTokens + PRO_MONTHLY_TOKENS : PRO_MONTHLY_TOKENS,
        });

        // Payment record (immutable) — subscription type.
        const payRef = db.collection('payments').doc();
        t.set(payRef, {
          uid,
          payment_reference: `sub_${action}_${now.getTime()}`,
          amount_paid: 7,
          tokens_credited: PRO_MONTHLY_TOKENS,
          type: 'subscription',
          provider: 'stripe_simulated',
          status: 'completed',
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        const logRef = db.collection('action_logs').doc();
        t.set(logRef, { uid, action: `subscription_${action}`, amount_paid: 7, created_at: admin.firestore.FieldValue.serverTimestamp() });
        result = { status: 'active', plan_renews_at: renewsAt };
      } else if (action === 'cancel') {
        // Cancelled but retains access/tokens until period end (status reflects intent).
        t.update(userRef, { subscription_status: 'cancelled' });
        const logRef = db.collection('action_logs').doc();
        t.set(logRef, { uid, action: 'subscription_cancel', created_at: admin.firestore.FieldValue.serverTimestamp() });
        result = { status: 'cancelled' };
      } else if (action === 'downgrade') {
        t.update(userRef, { tier: 'free', subscription_status: 'free', plan_renews_at: admin.firestore.FieldValue.delete() });
        const logRef = db.collection('action_logs').doc();
        t.set(logRef, { uid, action: 'subscription_downgrade', created_at: admin.firestore.FieldValue.serverTimestamp() });
        result = { status: 'free' };
      }
    });

    return { success: true, ...result };
  } catch (error: any) {
    console.error('Subscription change failed:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Subscription change failed.');
  }
});

// --- MONTHLY TOKEN REFRESH (§64) ---
// Scheduled monthly grant of the Pro allowance. Runs at 00:00 UTC on the 1st of each
// month. DEPLOY-TIME: only fires once deployed (`firebase deploy --only functions`) on
// the Blaze plan, which provisions Cloud Scheduler. Token reset uses the SAME rule as the
// `renew` branch of changeSubscription (set to PRO_MONTHLY_TOKENS) so there is one source
// of truth for the monthly allowance.
export const monthlyTokenRefresh = functions.pubsub
  .schedule('0 0 1 * *')
  .timeZone('UTC')
  .onRun(async () => {
    const now = new Date();
    const renewsAt = new Date(now.getTime() + RENEWAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Pro users whose subscription still entitles them to the monthly allowance.
    // 'cancelled' retains access until period end, so they are refreshed too.
    const snap = await db.collection('users').where('tier', '==', 'pro').get();
    const eligible = snap.docs.filter((d: admin.firestore.QueryDocumentSnapshot) => {
      const s = d.data().subscription_status;
      return s === 'active' || s === 'cancelled' || s === undefined;
    });

    let refreshed = 0;
    // Firestore batches cap at 500 ops; each user costs up to 3 writes (user + log + notification).
    const CHUNK = 150;
    for (let i = 0; i < eligible.length; i += CHUNK) {
      const batch = db.batch();
      for (const userDoc of eligible.slice(i, i + CHUNK)) {
        batch.update(userDoc.ref, {
          tokens: PRO_MONTHLY_TOKENS,
          plan_renews_at: renewsAt,
        });
        const logRef = db.collection('action_logs').doc();
        batch.set(logRef, {
          uid: userDoc.id,
          action: 'monthly_refresh',
          tokens_added: PRO_MONTHLY_TOKENS,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        const noteRef = db.collection('notifications').doc();
        batch.set(noteRef, {
          uid: userDoc.id,
          category: 'Token',
          title: 'Monthly tokens refreshed',
          body: `Your Pro plan was topped up to ${PRO_MONTHLY_TOKENS} tokens for the new cycle.`,
          read: false,
          created_at: now.toISOString(),
        });
        refreshed++;
      }
      await batch.commit();
    }

    console.log(`monthlyTokenRefresh: refreshed ${refreshed} Pro account(s).`);
    return null;
  });
