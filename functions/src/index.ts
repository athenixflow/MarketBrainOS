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
  'Workflow_ImproveAssets': 6
};

const MODULE_MAPPING: Record<string, string> = {
  'AngleMiner_Generate': 'AngleMiner',
  'AngleMiner_Improve': 'AngleMiner',
  'ConversionDoctor_Audit': 'ConversionDoctor',
  'TestLab_Simulation': 'TestLabPro',
  'Workflow_ImproveAssets': 'Workflow'
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

// --- CORE FUNCTIONS ---

export const executeAnalysis = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }
  const uid = context.auth.uid;
  const { module, input } = data;

  if (!COSTS[module]) {
    throw new functions.https.HttpsError('invalid-argument', `Unknown module: ${module}`);
  }
  const cost = COSTS[module];

  // 1. SYSTEM CONTROLS CHECK (Before everything)
  const settingsDoc = await db.collection('admin_settings').doc('global').get();
  if (settingsDoc.exists) {
    const settings = settingsDoc.data()!;
    
    // Global Pause
    if (settings.analyses_paused) {
      await db.collection('action_logs').add({
        uid, module, tokens_used: 0, status: 'blocked', error_code: 'SYSTEM_PAUSED', created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      throw new functions.https.HttpsError('unavailable', 'System analysis is currently paused by administrators.');
    }

    // Maintenance Mode (Allow Admins)
    if (settings.maintenance_mode) {
      const userDoc = await db.collection('users').doc(uid).get();
      const role = userDoc.exists ? userDoc.data()!.role : 'user';
      if (role !== 'super_admin' && role !== 'ops_admin') {
        await db.collection('action_logs').add({
          uid, module, tokens_used: 0, status: 'blocked', error_code: 'MAINTENANCE_MODE', created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        throw new functions.https.HttpsError('unavailable', 'System is in maintenance mode. Please try again later.');
      }
    }

    // Module Specific Toggle
    const moduleKey = MODULE_MAPPING[module];
    if (moduleKey && settings.modules_enabled && settings.modules_enabled[moduleKey] === false) {
      await db.collection('action_logs').add({
        uid, module, tokens_used: 0, status: 'blocked', error_code: 'MODULE_DISABLED', created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      throw new functions.https.HttpsError('unavailable', `The ${moduleKey} module is currently disabled.`);
    }
  }

  const rateLimitRef = db.collection('rate_limits').doc(uid);
  const now = admin.firestore.Timestamp.now();
  
  await db.runTransaction(async (t) => {
    const doc = await t.get(rateLimitRef);
    const limitData = doc.exists ? doc.data()! : {
      last_request_at: null,
      requests_in_last_minute: 0,
      failed_requests_in_window: 0,
      blocked_until: null,
      burst_window_start: now
    };

    if (limitData.blocked_until && limitData.blocked_until.toMillis() > now.toMillis()) {
      throw new functions.https.HttpsError('resource-exhausted', 'Account temporarily blocked due to rate limits.');
    }

    if (limitData.last_request_at && (now.toMillis() - limitData.last_request_at.toMillis() < RATE_LIMIT_RULES.COOLDOWN_MS)) {
      throw new functions.https.HttpsError('resource-exhausted', 'Please wait 10 seconds between analyses.');
    }

    if (limitData.burst_window_start && (now.toMillis() - limitData.burst_window_start.toMillis() > RATE_LIMIT_RULES.BURST_WINDOW_MS)) {
      limitData.requests_in_last_minute = 0;
      limitData.burst_window_start = now;
    }
    
    if (limitData.requests_in_last_minute >= RATE_LIMIT_RULES.BURST_LIMIT) {
       t.set(rateLimitRef, { ...limitData, blocked_until: admin.firestore.Timestamp.fromMillis(now.toMillis() + RATE_LIMIT_RULES.BLOCK_DURATION_MS) }, { merge: true });
       throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded. Pausing for 10 minutes.');
    }

    t.set(rateLimitRef, {
      ...limitData,
      last_request_at: now,
      requests_in_last_minute: limitData.requests_in_last_minute + 1,
      burst_window_start: limitData.burst_window_start || now
    }, { merge: true });
  });

  const userRef = db.collection('users').doc(uid);
  let tokensDeducted = false;

  try {
    await db.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User profile not found.');
      
      const userData = userDoc.data()!;
      if (userData.is_suspended) throw new functions.https.HttpsError('permission-denied', 'Account suspended.');
      
      const currentTokens = userData.tokens || 0;
      if (currentTokens < cost) {
        throw new functions.https.HttpsError('resource-exhausted', 'Insufficient analysis credits.');
      }

      t.update(userRef, { tokens: currentTokens - cost, last_active: now.toISOString() });
      tokensDeducted = true;
    });
  } catch (e: any) {
    if (e.code === 'resource-exhausted' || e.code === 'permission-denied') throw e;
    throw new functions.https.HttpsError('internal', 'Billing transaction failed.');
  }

  try {
    let responseText = "";
    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview", systemInstruction });

    if (module === 'AngleMiner_Generate') {
      const prompt = `
        Analyze: Product: ${input.product}, Industry: ${input.industry}, Target: ${input.target}, Goal: ${input.goal}, Tones: ${input.tones?.join(', ')}.
        Return strict JSON: { prime: [{title, hook, rational, score}], supporting: [...], exploratory: [...], hooks: [{platform, short, expanded}] }
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

    return finalOutput;

  } catch (error: any) {
    if (tokensDeducted) {
      await db.runTransaction(async (t) => {
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
    
    await db.runTransaction(async (t) => {
        const doc = await t.get(rateLimitRef);
        if(doc.exists) {
            const d = doc.data()!;
            t.update(rateLimitRef, { failed_requests_in_window: (d.failed_requests_in_window || 0) + 1 });
        }
    });

    throw new functions.https.HttpsError('internal', 'Analysis failed. Tokens have been refunded.');
  }
});

// --- ADMIN MANAGEMENT FUNCTION ---

export const manageUser = functions.https.onCall(async (data, context) => {
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
    await db.runTransaction(async (t) => {
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
          const defaultTokens = userData.tier === 'pro' ? 50 : 4;
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

export const updateSystemSettings = functions.https.onCall(async (data, context) => {
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
    await db.runTransaction(async (t) => {
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

export const confirmTopUp = functions.https.onCall(async (data, context) => {
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
    await db.runTransaction(async (t) => {
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