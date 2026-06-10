
// Pinned to the v1 (gen1) API on purpose: this file uses the v1 surface throughout
// (https.onCall((data, context) => …), https.onRequest, pubsub.schedule). firebase-functions v7's
// bare 'firebase-functions' import defaults to v2, which removes pubsub.schedule and changes the
// callable handler signature — do NOT "simplify" this back to 'firebase-functions'.
import * as functions from 'firebase-functions/v1';
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
You are the MarketBrainOS Intelligence Engine — a senior strategy consultant and growth operator with
deep expertise in marketing, sales, positioning, pricing, audience research, and operations.

Standards for EVERY analysis:
- Be specific and evidence-led. Reference the user's actual inputs by name; never generic filler.
- Quantify wherever reasonable (ranges, %, benchmarks, rough $ impact) and state key assumptions.
- Every point must stand on its own: a concrete insight, why it matters, and the exact next move.
- Write in plain, direct language a busy founder can act on today. No restating the question, no fluff.
- Prioritise: lead with what matters most and would move the needle fastest.
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
    const { module, input, scope } = req.body;

    if (!COSTS[module]) {
      res.status(400).json({ error: { message: `Unknown module: ${module}`, code: 'invalid-argument' } });
      return;
    }
    const cost = COSTS[module];

    // SCOPE-OWNER BILLING (Master Wiring): when an analysis is run inside a Team workspace,
    // tokens are deducted from the workspace OWNER's pooled wallet, not the runner's. We
    // verify the runner is an active member before resolving the owner.
    let billingUid = uid;
    let billedWorkspaceId: string | null = null;
    let billedClientId: string | null = null;
    if (scope && scope.level === 'team' && scope.workspaceId) {
      const memberSnap = await db.collection('workspace_members').doc(`${scope.workspaceId}_${uid}`).get();
      if (!memberSnap.exists || memberSnap.data()!.status === 'removed') {
        res.status(403).json({ error: { message: 'Not a member of this workspace.', code: 'permission-denied' } });
        return;
      }
      const wsSnap = await db.collection('workspaces').doc(scope.workspaceId).get();
      const wsStatus = wsSnap.exists ? wsSnap.data()!.status : null;
      if (wsStatus === 'suspended' || wsStatus === 'archived') {
        await db.collection('action_logs').add({
          uid, module, tokens_used: 0, status: 'blocked', error_code: 'WORKSPACE_SUSPENDED', created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        res.status(403).json({ error: { message: 'This workspace has been suspended by an administrator.', code: 'permission-denied' } });
        return;
      }
      if (wsSnap.exists && wsSnap.data()!.owner_id) {
        billingUid = wsSnap.data()!.owner_id;
        billedWorkspaceId = scope.workspaceId;
      }
    } else if (scope && scope.level === 'client' && scope.clientId && scope.agencyId) {
      // Agency member must belong to the agency AND (be owner/director OR be assigned to the client).
      const agMember = await db.collection('agency_members').doc(`${scope.agencyId}_${uid}`).get();
      if (!agMember.exists || agMember.data()!.status === 'removed') {
        res.status(403).json({ error: { message: 'Not a member of this agency.', code: 'permission-denied' } });
        return;
      }
      const role = agMember.data()!.role;
      const privileged = role === 'agency_owner' || role === 'agency_director';
      if (!privileged) {
        const assign = await db.collection('client_assignments').doc(`${scope.clientId}_${uid}`).get();
        if (!assign.exists) {
          res.status(403).json({ error: { message: 'Not assigned to this client.', code: 'permission-denied' } });
          return;
        }
      }
      const agSnap = await db.collection('agencies').doc(scope.agencyId).get();
      const agStatus = agSnap.exists ? agSnap.data()!.status : null;
      if (agStatus === 'suspended' || agStatus === 'archived') {
        await db.collection('action_logs').add({
          uid, module, tokens_used: 0, status: 'blocked', error_code: 'AGENCY_SUSPENDED', created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        res.status(403).json({ error: { message: 'This agency has been suspended by an administrator.', code: 'permission-denied' } });
        return;
      }
      if (agSnap.exists && agSnap.data()!.owner_id) {
        billingUid = agSnap.data()!.owner_id;  // agency owner's pooled wallet
        billedClientId = scope.clientId;
      }
    }

    // SUSPENSION ENFORCEMENT (server-authoritative) — a disabled runner, or a disabled billing
    // owner whose pooled wallet funds the run, may not execute. Mirrors the client-side block so
    // admin "Disable account" / "Suspend organization" are enforced at the engine, not cosmetic.
    const runnerSnap = await db.collection('users').doc(uid).get();
    if (runnerSnap.exists && runnerSnap.data()!.is_suspended) {
      await db.collection('action_logs').add({
        uid, module, tokens_used: 0, status: 'blocked', error_code: 'ACCOUNT_SUSPENDED', created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      res.status(403).json({ error: { message: 'Account access has been suspended.', code: 'permission-denied' } });
      return;
    }
    if (billingUid !== uid) {
      const ownerSnap = await db.collection('users').doc(billingUid).get();
      if (ownerSnap.exists && ownerSnap.data()!.is_suspended) {
        await db.collection('action_logs').add({
          uid, module, tokens_used: 0, status: 'blocked', error_code: 'OWNER_SUSPENDED', created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        res.status(403).json({ error: { message: 'The owning account for this workspace is suspended.', code: 'permission-denied' } });
        return;
      }
    }

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

    // BILLING & EXECUTION — deduct from the resolved billing wallet (owner for team scope).
    const userRef = db.collection('users').doc(billingUid);
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
          As a senior direct-response copywriter, generate high-converting marketing angles.
          Product Name: ${input.productName || ''}. Description: ${input.product}. Audience: ${input.target}. Market: ${input.market || input.industry}. Goal: ${input.goal}. Tones: ${input.tones?.join(', ')}.
          ${input.competitors ? `Competitors: ${input.competitors}.` : ''}${input.objections ? ` Objections to overcome: ${input.objections}.` : ''}${input.brandVoice ? ` Brand voice: ${input.brandVoice}.` : ''}${input.proofPoints ? ` Proof / credibility to use: ${input.proofPoints}.` : ''}${input.pricePoint ? ` Price point: ${input.pricePoint}.` : ''}
          Produce angles across these 8 types: Emotional, Fear, Aspiration, Curiosity, Authority, Differentiation, Story, Contrarian (at least one of each; more for the strongest).
          For each angle: 'type' (one of the 8 exact labels), 'title' (the angle name), 'hook' (a ready-to-use headline/opening line, written in the chosen tone and specific to THIS product and audience), 'rational' (2-3 sentences on the psychology of why it works for this audience and when to use it), 'score' (0-100 estimated strength).
          Also produce 'hooks': 3-5 platform-ready variations, each { platform (e.g. Meta, Google, Email, LinkedIn), short (a punchy hook under 15 words), expanded (a 1-2 sentence version) }.
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
        const prompt = `As a senior performance-marketing analyst, predict how these ${input.type} variants would perform and explain why. Variants: ${input.variants?.join(' | ')}.${input.audience ? ` Audience: ${input.audience}.` : ''}${input.goal ? ` Desired action: ${input.goal}.` : ''}${input.channel ? ` Channel/placement: ${input.channel}.` : ''}${input.product ? ` Product/offer: ${input.product}.` : ''} For each variant give { label, text (the variant, lightly cleaned), score (0-100 predicted performance) }. Pick 'winnerLabel'. Write a detailed 'explanation' (3-5 sentences): why the winner wins, the key clarity/psychology differences between variants, and one concrete way to make the winner even stronger. Return strict JSON: { variants: [{label, text, score}], winnerLabel, explanation }`;
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        });
        responseText = result.response.text();
      }
      else if (module === 'ConversionDoctor_Audit') {
        const prompt = [
          `As a senior conversion-rate-optimization (CRO) expert, audit this ${input.context}.`,
          `Page or copy: "${String(input.input || '').slice(0, 16000)}".`,
          input.audience ? `Target audience: ${input.audience}.` : '',
          input.goal ? `Primary conversion goal: ${input.goal}.` : '',
          input.trafficSource ? `Traffic source: ${input.trafficSource}.` : '',
          `Give a 'score' (0-100) and a 1-2 sentence 'summary'. Identify the real conversion blockers (most impactful first) and concrete, specific fixes.`,
          `Return strict JSON: { score, summary, issues: [{ blocker, impact, severity }], fixes: [{ what, how, expectedResult, priority }] } with 4-7 issues and 4-7 fixes.`,
          `'severity' = Critical|High|Medium|Low; 'impact' = why it costs conversions; 'how' = exactly how to implement it; 'expectedResult' = the likely lift; 'priority' = High|Medium|Low.`,
        ].filter(Boolean).join(' ');
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        });
        responseText = result.response.text();
      }
      else if (module === 'Workflow_ImproveAssets') {
        const prompt = `As a senior conversion copywriter, refine these campaign assets. Base angle: "${input.angle}". Issues to fix: ${input.issues?.join(', ')}. Produce a stronger 'headline' (specific, benefit-led), a high-converting 'cta' (action-oriented), and a sharpened 'offer' (the value proposition stated compellingly) — each directly addressing the issues above. Return strict JSON: { headline, cta, offer }`;
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
          `Role & task: As a senior strategist, ${cfg.instruction}`,
          `Business inputs (use them specifically — do not ignore any provided field; treat blank fields as unknown): ${JSON.stringify(cleanInput).slice(0, 16000)}`,
          _context ? `Related prior analysis to build on (extend it, do not just repeat it): ${String(_context).slice(0, 3000)}` : "",
          cfg.scored ? "Include a numeric 'score' (0-100) for overall quality/viability and a short 'verdict' label (e.g. 'Strong', 'Promising', 'Needs work')." : "",
          `Write a thorough 'summary' (3-5 sentences): the executive read — the headline takeaways and the single highest-leverage move.`,
          `Then a 'sections' array containing EVERY one of these sections, in this exact order: ${UNIVERSAL_SECTIONS.join(', ')}.`,
          `Each section = { title, items }. Provide 4-7 items per section. Each item is an object { insight, evidence, action }:`,
          `- 'insight': the specific point, 1-2 sentences, grounded in the inputs.`,
          `- 'evidence': why it matters — the reasoning, signal, or rough quantified impact, 1-2 sentences.`,
          `- 'action': the single concrete next move, 1 sentence, imperative.`,
          `Make every item distinct, detailed, and tailored to the inputs. No vague or repeated points.`,
          `Return strict JSON only: { score?, verdict?, summary, sections: [{ title, items: [{ insight, evidence, action }] }] }`
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
        uid,                          // actor (the member who ran it)
        billing_uid: billingUid,      // wallet charged (owner for team/agency scope)
        workspace_id: billedWorkspaceId,
        client_id: billedClientId,
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

// --- ADMIN: assert caller is a platform admin (shared by the admin mutations below) ---
const assertAdmin = async (context: any): Promise<{ uid: string; email: string; data: any }> => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const uid = context.auth.uid;
  const email = context.auth.token.email || 'unknown';
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) throw new functions.https.HttpsError('permission-denied', 'Caller profile missing');
  const data = snap.data();
  if (data?.role !== 'super_admin' && data?.role !== 'ops_admin') {
    throw new functions.https.HttpsError('permission-denied', 'Insufficient privileges');
  }
  return { uid, email, data };
};

const writeServerActionLog = (t: admin.firestore.Transaction, entry: any) => {
  const ref = db.collection('action_logs').doc();
  t.set(ref, { created_at: admin.firestore.FieldValue.serverTimestamp(), ...entry });
};

// --- ADMIN: token adjustments (add / remove / refund / bonus / reset) ---
export const adminManageTokens = functions.https.onCall(async (data: any, context: any) => {
  const caller = await assertAdmin(context);
  const { action, targetUserId, payload } = data;
  if (!targetUserId) throw new functions.https.HttpsError('invalid-argument', 'Target User ID required');
  const amount = Math.abs(Number(payload?.amount) || 0);
  const reason = (payload?.reason || '').toString().slice(0, 280);
  if (['add', 'remove', 'refund', 'bonus'].includes(action) && amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'A positive amount is required');
  }
  const targetRef = db.collection('users').doc(targetUserId);
  try {
    let delta = 0; let newBalance = 0;
    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const doc = await t.get(targetRef);
      if (!doc.exists) throw new functions.https.HttpsError('not-found', 'Target user not found');
      const u = doc.data()!;
      const current = Number(u.tokens) || 0;
      switch (action) {
        case 'add': case 'bonus': case 'refund': delta = amount; break;
        case 'remove': delta = -Math.min(amount, current); break;
        case 'reset': delta = (u.tier === 'pro' ? 200 : 4) - current; break;
        default: throw new functions.https.HttpsError('invalid-argument', 'Unknown token action');
      }
      newBalance = Math.max(0, current + delta);
      t.update(targetRef, { tokens: newBalance });
      writeServerActionLog(t, {
        uid: targetUserId, action: `admin_token_${action}`, module: 'AdminTokens',
        tokens_added: delta, status: 'success', admin_uid: caller.uid, reason,
      });
    });
    await logAdminAudit(caller.uid, caller.email, `TOKENS_${action.toUpperCase()}`, targetUserId, { amount, delta, newBalance, reason });
    return { success: true, newBalance };
  } catch (e: any) {
    if (e instanceof functions.https.HttpsError) throw e;
    throw new functions.https.HttpsError('internal', e.message || 'Token adjustment failed');
  }
});

// --- ADMIN: subscription management (grant / trial / extend / cancel / changePlan) ---
export const adminManageSubscription = functions.https.onCall(async (data: any, context: any) => {
  const caller = await assertAdmin(context);
  const { action, targetUserId, payload } = data;
  if (!targetUserId) throw new functions.https.HttpsError('invalid-argument', 'Target User ID required');
  const targetRef = db.collection('users').doc(targetUserId);
  const days = Math.max(0, Number(payload?.days) || 0);
  try {
    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const doc = await t.get(targetRef);
      if (!doc.exists) throw new functions.https.HttpsError('not-found', 'Target user not found');
      const u = doc.data()!;
      const now = Date.now();
      const renews = (extra: number) => new Date(now + extra * 86400000).toISOString();
      switch (action) {
        case 'grant':
        case 'changePlan': {
          const plan = payload?.plan;
          if (!['free', 'pro', 'team', 'agency', 'enterprise'].includes(plan)) throw new functions.https.HttpsError('invalid-argument', 'Invalid plan');
          const upd: any = { tier: plan, subscription_status: plan === 'free' ? 'free' : 'active' };
          if (plan !== 'free') upd.plan_renews_at = renews(30);
          if (plan === 'pro' && (Number(u.tokens) || 0) < 200) upd.tokens = 200;
          t.update(targetRef, upd);
          break;
        }
        case 'trial': {
          if (days <= 0) throw new functions.https.HttpsError('invalid-argument', 'Trial days required');
          t.update(targetRef, { tier: 'pro', subscription_status: 'active', plan_renews_at: renews(days), tokens: Math.max(Number(u.tokens) || 0, 200) });
          break;
        }
        case 'extend': {
          if (days <= 0) throw new functions.https.HttpsError('invalid-argument', 'Extension days required');
          const base = u.plan_renews_at ? new Date(u.plan_renews_at).getTime() : now;
          t.update(targetRef, { plan_renews_at: new Date(Math.max(base, now) + days * 86400000).toISOString() });
          break;
        }
        case 'cancel':
          t.update(targetRef, { subscription_status: 'cancelled' });
          break;
        default:
          throw new functions.https.HttpsError('invalid-argument', 'Unknown subscription action');
      }
    });
    await logAdminAudit(caller.uid, caller.email, `SUBSCRIPTION_${action.toUpperCase()}`, targetUserId, payload || {});
    return { success: true };
  } catch (e: any) {
    if (e instanceof functions.https.HttpsError) throw e;
    throw new functions.https.HttpsError('internal', e.message || 'Subscription action failed');
  }
});

// --- ADMIN: bulk operations over a set of users ---
export const adminBulkAction = functions.https.onCall(async (data: any, context: any) => {
  const caller = await assertAdmin(context);
  const { action, targetUserIds, payload } = data;
  if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) throw new functions.https.HttpsError('invalid-argument', 'targetUserIds required');
  if (targetUserIds.length > 400) throw new functions.https.HttpsError('invalid-argument', 'Limit 400 users per bulk action');
  try {
    const batch = db.batch();
    for (const uid of targetUserIds) {
      const ref = db.collection('users').doc(uid);
      if (action === 'suspend') batch.update(ref, { is_suspended: true, suspension_reason: 'Bulk administrative action' });
      else if (action === 'unsuspend') batch.update(ref, { is_suspended: false, suspension_reason: admin.firestore.FieldValue.delete() });
      else if (action === 'grantTokens') batch.update(ref, { tokens: admin.firestore.FieldValue.increment(Math.abs(Number(payload?.amount) || 0)) });
      else if (action === 'changePlan') { if (!['free', 'pro'].includes(payload?.plan)) throw new functions.https.HttpsError('invalid-argument', 'Invalid plan'); batch.update(ref, { tier: payload.plan }); }
      else if (action === 'notify') {
        const nref = db.collection('notifications').doc();
        batch.set(nref, { uid, category: 'System', title: (payload?.title || 'Announcement').slice(0, 120), body: (payload?.body || '').slice(0, 500), read: false, created_at: new Date().toISOString() });
      } else throw new functions.https.HttpsError('invalid-argument', 'Unknown bulk action');
    }
    await batch.commit();
    await logAdminAudit(caller.uid, caller.email, `BULK_${action.toUpperCase()}`, `${targetUserIds.length} users`, { count: targetUserIds.length, payload });
    return { success: true, count: targetUserIds.length };
  } catch (e: any) {
    if (e instanceof functions.https.HttpsError) throw e;
    throw new functions.https.HttpsError('internal', e.message || 'Bulk action failed');
  }
});

// --- ADMIN: create a new user (Auth + profile) ---
export const adminCreateUser = functions.https.onCall(async (data: any, context: any) => {
  const caller = await assertAdmin(context);
  const { email, password, tier } = data || {};
  if (!email || !password) throw new functions.https.HttpsError('invalid-argument', 'Email and password required');
  if (String(password).length < 6) throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters');
  try {
    const userRecord = await admin.auth().createUser({ email, password });
    const plan = ['free', 'pro'].includes(tier) ? tier : 'free';
    await db.collection('users').doc(userRecord.uid).set({
      id: userRecord.uid, email, tokens: plan === 'pro' ? 200 : 4, tier: plan,
      role: 'user', onboarded: false, subscription_status: plan === 'pro' ? 'active' : 'free',
      created_at: new Date().toISOString(), last_active: new Date().toISOString(),
    });
    await logAdminAudit(caller.uid, caller.email, 'CREATE_USER', userRecord.uid, { email, tier: plan });
    return { success: true, uid: userRecord.uid };
  } catch (e: any) {
    if (e instanceof functions.https.HttpsError) throw e;
    throw new functions.https.HttpsError('internal', e.message || 'User creation failed');
  }
});

// --- ADMIN: organization administration (suspend / restore / archive / transfer) ---
export const adminManageOrg = functions.https.onCall(async (data: any, context: any) => {
  const caller = await assertAdmin(context);
  const { kind, orgId, action, payload } = data;
  const COLL: Record<string, string> = { workspace: 'workspaces', agency: 'agencies', enterprise: 'enterprises' };
  const coll = COLL[kind];
  if (!coll || !orgId) throw new functions.https.HttpsError('invalid-argument', 'kind and orgId required');
  const ref = db.collection(coll).doc(orgId);
  try {
    const doc = await ref.get();
    if (!doc.exists) throw new functions.https.HttpsError('not-found', 'Organization not found');
    let upd: any = {};
    switch (action) {
      case 'suspend': upd = { status: 'suspended' }; break;
      case 'restore': upd = { status: 'active' }; break;
      case 'archive': upd = { status: 'archived' }; break;
      case 'transfer':
        if (!payload?.newOwnerId) throw new functions.https.HttpsError('invalid-argument', 'newOwnerId required');
        upd = { owner_id: payload.newOwnerId };
        break;
      default: throw new functions.https.HttpsError('invalid-argument', 'Unknown org action');
    }
    upd.updated_at = new Date().toISOString();
    await ref.update(upd);
    await logAdminAudit(caller.uid, caller.email, `ORG_${kind.toUpperCase()}_${action.toUpperCase()}`, orgId, { ...upd, name: doc.data()?.name });
    return { success: true };
  } catch (e: any) {
    if (e instanceof functions.https.HttpsError) throw e;
    throw new functions.https.HttpsError('internal', e.message || 'Organization action failed');
  }
});

// --- ADMIN: issue a refund (records a refund entry; simulated provider — no external settlement) ---
export const adminRefund = functions.https.onCall(async (data: any, context: any) => {
  const caller = await assertAdmin(context);
  const { paymentId, uid, amount, reason } = data || {};
  const amt = Math.abs(Number(amount) || 0);
  if (!uid || amt <= 0) throw new functions.https.HttpsError('invalid-argument', 'uid and a positive amount required');
  try {
    const ref = db.collection('payments').doc();
    await ref.set({
      uid,
      payment_reference: `refund_${Date.now()}`,
      original_payment_id: paymentId || null,
      amount_paid: -amt,
      tokens_credited: 0,
      provider: 'admin_refund',
      status: 'refunded',
      type: 'refund',
      reason: (reason || '').toString().slice(0, 280),
      refunded_by: caller.email,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    await logAdminAudit(caller.uid, caller.email, 'REFUND_ISSUED', uid, { amount: amt, paymentId: paymentId || null, reason });
    return { success: true };
  } catch (e: any) {
    if (e instanceof functions.https.HttpsError) throw e;
    throw new functions.https.HttpsError('internal', e.message || 'Refund failed');
  }
});

// --- ADMIN: report management (archive / delete / restore) ---
export const adminManageReport = functions.https.onCall(async (data: any, context: any) => {
  const caller = await assertAdmin(context);
  const { reportId, action } = data || {};
  if (!reportId) throw new functions.https.HttpsError('invalid-argument', 'reportId required');
  const ref = db.collection('reports').doc(reportId);
  try {
    if (action === 'delete') {
      await ref.delete();
    } else if (action === 'archive') {
      await ref.update({ status: 'archived' });
    } else if (action === 'restore') {
      await ref.update({ status: 'active' });
    } else {
      throw new functions.https.HttpsError('invalid-argument', 'Unknown report action');
    }
    await logAdminAudit(caller.uid, caller.email, `REPORT_${action.toUpperCase()}`, reportId, {});
    return { success: true };
  } catch (e: any) {
    if (e instanceof functions.https.HttpsError) throw e;
    throw new functions.https.HttpsError('internal', e.message || 'Report action failed');
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

// ============================================================
// PHASE 6.1 — TEAM WORKSPACE (server-authoritative, Master Wiring)
// Privileged mutations only. firestore.rules deny client writes to these collections, so
// all creation/membership changes flow through here (Admin SDK bypasses rules). Simulated
// billing: upgrading to Team grants a pooled token allowance on the OWNER's wallet.
// ============================================================

const TEAM_MONTHLY_TOKENS = 500;   // simulated pooled Team allowance (owner's wallet)
const TEAM_SEAT_LIMIT = 10;        // simulated seat cap

// Server mirror of the workspace permission matrix (keep in sync with permissionService.ts).
const wsCanManageMembers = (role: string) => role === 'owner' || role === 'admin';
const wsCanManageSettings = (role: string) => role === 'owner' || role === 'admin';
// Roles that may be granted via invite (never 'owner' — ownership changes only via transfer).
const WORKSPACE_INVITE_ROLES = ['admin', 'manager', 'analyst', 'viewer'];

const getWorkspaceMemberDoc = async (wid: string, uid: string) => {
  const snap = await db.collection('workspace_members').doc(`${wid}_${uid}`).get();
  return snap.exists ? (snap.data() as any) : null;
};

const writeWorkspaceActivity = async (
  wid: string, type: string, actorUid: string, actorName: string, summary: string
) => {
  await db.collection('workspace_activity').add({
    workspace_id: wid, type, actor_uid: actorUid, actor_name: actorName,
    summary, created_at: new Date().toISOString(),
  });
};

export const manageWorkspace = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const uid = context.auth.uid;
  const email = context.auth.token.email || '';
  const action = data?.action as 'create' | 'update' | 'delete' | 'transfer';
  const payload = data?.payload || {};

  if (action === 'create') {
    const name = (payload.name || '').toString().trim();
    if (name.length < 2) throw new functions.https.HttpsError('invalid-argument', 'Workspace name is required.');

    const userRef = db.collection('users').doc(uid);
    const wsRef = db.collection('workspaces').doc();
    const now = new Date();

    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User profile not found.');
      const userData = userDoc.data()!;
      if (userData.is_suspended) throw new functions.https.HttpsError('permission-denied', 'Account suspended.');

      // Simulated upgrade: creating a workspace promotes Free/Pro → Team and grants the
      // pooled allowance. (SEAM: a real provider would verify payment first.)
      const belowTeam = userData.tier === 'free' || userData.tier === 'pro';
      if (belowTeam) {
        const renewsAt = new Date(now.getTime() + RENEWAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
        t.update(userRef, {
          tier: 'team',
          subscription_status: 'active',
          plan_renews_at: renewsAt,
          subscription_started_at: userData.subscription_started_at || now.toISOString(),
          tokens: (userData.tokens || 0) + TEAM_MONTHLY_TOKENS,
        });
        const payRef = db.collection('payments').doc();
        t.set(payRef, {
          uid, payment_reference: `sub_team_${now.getTime()}`, amount_paid: 0,
          tokens_credited: TEAM_MONTHLY_TOKENS, type: 'subscription', provider: 'stripe_simulated',
          status: 'completed', created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      t.set(wsRef, {
        name,
        description: (payload.description || '').toString().slice(0, 1000),
        logo: payload.logo || null,
        owner_id: uid,
        status: 'active',
        member_count: 1,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });

      // Owner membership doc (id convention `${wid}_${uid}` — firestore.rules depends on it).
      const memberRef = db.collection('workspace_members').doc(`${wsRef.id}_${uid}`);
      t.set(memberRef, {
        uid, container_id: wsRef.id, name, email, role: 'owner',
        status: 'active', joined_at: now.toISOString(),
      });
    });

    await writeWorkspaceActivity(wsRef.id, 'workspace_created', uid, email, `Workspace "${name}" created`);
    return { success: true, workspaceId: wsRef.id };
  }

  // For update/delete/transfer the caller must be a member with sufficient role.
  const wid = (payload.workspaceId || '').toString();
  if (!wid) throw new functions.https.HttpsError('invalid-argument', 'workspaceId required.');
  const member = await getWorkspaceMemberDoc(wid, uid);
  if (!member) throw new functions.https.HttpsError('permission-denied', 'Not a member of this workspace.');

  const wsRef = db.collection('workspaces').doc(wid);

  if (action === 'update') {
    if (!wsCanManageSettings(member.role)) throw new functions.https.HttpsError('permission-denied', 'Insufficient role.');
    const updates: any = { updated_at: new Date().toISOString() };
    if (typeof payload.name === 'string' && payload.name.trim().length >= 2) updates.name = payload.name.trim();
    if (typeof payload.description === 'string') updates.description = payload.description.slice(0, 1000);
    if ('logo' in payload) updates.logo = payload.logo || null;
    if (payload.status === 'active' || payload.status === 'archived') updates.status = payload.status;
    await wsRef.update(updates);
    await writeWorkspaceActivity(wid, 'settings_updated', uid, email, 'Workspace settings updated');
    return { success: true };
  }

  if (action === 'delete') {
    if (member.role !== 'owner') throw new functions.https.HttpsError('permission-denied', 'Only the owner can delete.');
    // Soft-delete: archive the workspace (preserves analyses/history per Master Wiring).
    await wsRef.update({ status: 'archived', updated_at: new Date().toISOString() });
    return { success: true };
  }

  if (action === 'transfer') {
    if (member.role !== 'owner') throw new functions.https.HttpsError('permission-denied', 'Only the owner can transfer.');
    const targetUid = (payload.targetUid || '').toString();
    const targetMember = await getWorkspaceMemberDoc(wid, targetUid);
    if (!targetMember) throw new functions.https.HttpsError('not-found', 'Target is not a member.');
    const batch = db.batch();
    batch.update(wsRef, { owner_id: targetUid, updated_at: new Date().toISOString() });
    batch.update(db.collection('workspace_members').doc(`${wid}_${targetUid}`), { role: 'owner' });
    batch.update(db.collection('workspace_members').doc(`${wid}_${uid}`), { role: 'admin' });
    await batch.commit();
    await writeWorkspaceActivity(wid, 'role_changed', uid, email, `Ownership transferred`);
    return { success: true };
  }

  throw new functions.https.HttpsError('invalid-argument', 'Unknown workspace action.');
});

export const manageMembership = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const uid = context.auth.uid;
  const email = (context.auth.token.email || '').toLowerCase();
  const action = data?.action as 'invite' | 'accept' | 'updateRole' | 'remove' | 'revoke';
  const payload = data?.payload || {};
  const wid = (payload.workspaceId || '').toString();
  if (!wid) throw new functions.https.HttpsError('invalid-argument', 'workspaceId required.');

  // ACCEPT is performed by the invitee themselves (no prior membership).
  if (action === 'accept') {
    const inviteId = (payload.invitationId || '').toString();
    const invRef = db.collection('workspace_invitations').doc(inviteId);
    const wsRef = db.collection('workspaces').doc(wid);
    let wsName = 'Workspace';
    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const inv = await t.get(invRef);
      if (!inv.exists) throw new functions.https.HttpsError('not-found', 'Invitation not found.');
      const invData = inv.data()!;
      if (invData.status !== 'pending') throw new functions.https.HttpsError('failed-precondition', 'Invitation no longer valid.');
      if ((invData.email || '').toLowerCase() !== email) throw new functions.https.HttpsError('permission-denied', 'Invitation is for a different account.');
      const ws = await t.get(wsRef);
      wsName = ws.exists ? (ws.data()!.name || 'Workspace') : 'Workspace';

      // Re-validate the stored role at accept time (defense-in-depth).
      const safeRole = WORKSPACE_INVITE_ROLES.includes(invData.role) ? invData.role : 'analyst';
      t.set(db.collection('workspace_members').doc(`${wid}_${uid}`), {
        uid, container_id: wid, name: wsName, email, role: safeRole,
        status: 'active', joined_at: new Date().toISOString(),
      });
      t.update(invRef, { status: 'accepted' });
      if (ws.exists) t.update(wsRef, { member_count: (ws.data()!.member_count || 1) + 1 });
    });
    await writeWorkspaceActivity(wid, 'member_added', uid, email, `${email} joined the workspace`);
    return { success: true };
  }

  // All other actions require the caller to be an owner/admin of the workspace.
  const caller = await getWorkspaceMemberDoc(wid, uid);
  if (!caller || !wsCanManageMembers(caller.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Insufficient role to manage members.');
  }

  if (action === 'invite') {
    const inviteEmail = (payload.email || '').toString().toLowerCase().trim();
    const role = (payload.role || 'analyst') as string;
    if (!inviteEmail || !inviteEmail.includes('@')) throw new functions.https.HttpsError('invalid-argument', 'Valid email required.');
    // Prevent privilege escalation: only assignable roles may be invited (never 'owner').
    if (!WORKSPACE_INVITE_ROLES.includes(role)) throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');

    // Seat limit (simulated).
    const membersSnap = await db.collection('workspace_members').where('container_id', '==', wid).get();
    const active = membersSnap.docs.filter((d: any) => d.data().status !== 'removed').length;
    if (active >= TEAM_SEAT_LIMIT) throw new functions.https.HttpsError('resource-exhausted', `Seat limit (${TEAM_SEAT_LIMIT}) reached.`);

    const ws = await db.collection('workspaces').doc(wid).get();
    await db.collection('workspace_invitations').add({
      workspace_id: wid,
      workspace_name: ws.exists ? ws.data()!.name : 'Workspace',
      email: inviteEmail, role, invited_by: uid, status: 'pending',
      created_at: new Date().toISOString(),
    });
    // EMAIL SEAM (§67): a deployed trigger would email the invitee here.
    await writeWorkspaceActivity(wid, 'member_added', uid, email, `Invited ${inviteEmail} as ${role}`);
    return { success: true };
  }

  if (action === 'revoke') {
    const inviteId = (payload.invitationId || '').toString();
    await db.collection('workspace_invitations').doc(inviteId).update({ status: 'revoked' });
    return { success: true };
  }

  const targetUid = (payload.targetUid || '').toString();
  if (!targetUid) throw new functions.https.HttpsError('invalid-argument', 'targetUid required.');
  const targetRef = db.collection('workspace_members').doc(`${wid}_${targetUid}`);

  if (action === 'updateRole') {
    const role = (payload.role || '').toString();
    if (!['admin', 'manager', 'analyst', 'viewer'].includes(role)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid role (use transfer to change owner).');
    }
    const target = await targetRef.get();
    if (!target.exists) throw new functions.https.HttpsError('not-found', 'Member not found.');
    if (target.data()!.role === 'owner') throw new functions.https.HttpsError('failed-precondition', 'Use transfer to change the owner.');
    await targetRef.update({ role });
    await writeWorkspaceActivity(wid, 'role_changed', uid, email, `Role changed to ${role}`);
    return { success: true };
  }

  if (action === 'remove') {
    const target = await targetRef.get();
    if (!target.exists) throw new functions.https.HttpsError('not-found', 'Member not found.');
    if (target.data()!.role === 'owner') throw new functions.https.HttpsError('failed-precondition', 'Cannot remove the owner.');
    const wsRef = db.collection('workspaces').doc(wid);
    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const ws = await t.get(wsRef);
      t.update(targetRef, { status: 'removed' });
      if (ws.exists) t.update(wsRef, { member_count: Math.max(1, (ws.data()!.member_count || 1) - 1) });
    });
    await writeWorkspaceActivity(wid, 'member_removed', uid, email, `Removed a member`);
    return { success: true };
  }

  throw new functions.https.HttpsError('invalid-argument', 'Unknown membership action.');
});

// ============================================================
// PHASE 6.2 — AGENCY CLIENT MANAGER (server-authoritative)
// Agencies contain clients; each client's analyses/notes/activity are isolated via the
// `client` visibility/scope. Agency members access a client only as owner/director or when
// assigned (client_assignments). Tokens belong to the agency owner's pooled wallet.
// ============================================================

const AGENCY_MONTHLY_TOKENS = 1500;  // simulated pooled Agency allowance (owner's wallet)
const AGENCY_CLIENT_LIMIT = 25;      // simulated client cap

const agencyCanManageClients = (role: string) => ['agency_owner', 'agency_director', 'account_manager'].includes(role);
const agencyCanManageMembersOrClients = (role: string) => ['agency_owner', 'agency_director'].includes(role);
// Roles invitable into an agency (never 'agency_owner').
const AGENCY_INVITE_ROLES = ['agency_director', 'account_manager', 'strategist', 'analyst', 'viewer'];

const getAgencyMemberDoc = async (aid: string, uid: string) => {
  const snap = await db.collection('agency_members').doc(`${aid}_${uid}`).get();
  return snap.exists ? (snap.data() as any) : null;
};
const writeClientActivity = async (
  clientId: string, agencyId: string, type: string, actorUid: string, actorName: string, summary: string
) => {
  await db.collection('client_activity').add({
    client_id: clientId, agency_id: agencyId, type, actor_uid: actorUid, actor_name: actorName,
    summary, created_at: new Date().toISOString(),
  });
};

export const manageAgency = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const uid = context.auth.uid;
  const email = context.auth.token.email || '';
  const action = data?.action as 'create' | 'update' | 'archive' | 'transfer';
  const payload = data?.payload || {};

  if (action === 'create') {
    const name = (payload.name || '').toString().trim();
    if (name.length < 2) throw new functions.https.HttpsError('invalid-argument', 'Agency name is required.');
    const userRef = db.collection('users').doc(uid);
    const agRef = db.collection('agencies').doc();
    const now = new Date();

    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User profile not found.');
      const userData = userDoc.data()!;
      if (userData.is_suspended) throw new functions.https.HttpsError('permission-denied', 'Account suspended.');

      // Simulated upgrade to Agency (from anything below).
      if (userData.tier !== 'agency' && userData.tier !== 'enterprise') {
        const renewsAt = new Date(now.getTime() + RENEWAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
        t.update(userRef, {
          tier: 'agency', subscription_status: 'active', plan_renews_at: renewsAt,
          subscription_started_at: userData.subscription_started_at || now.toISOString(),
          tokens: (userData.tokens || 0) + AGENCY_MONTHLY_TOKENS,
        });
        const payRef = db.collection('payments').doc();
        t.set(payRef, {
          uid, payment_reference: `sub_agency_${now.getTime()}`, amount_paid: 0,
          tokens_credited: AGENCY_MONTHLY_TOKENS, type: 'subscription', provider: 'stripe_simulated',
          status: 'completed', created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      t.set(agRef, {
        name, description: (payload.description || '').toString().slice(0, 1000), logo: payload.logo || null,
        owner_id: uid, status: 'active', client_count: 0, member_count: 1,
        created_at: now.toISOString(), updated_at: now.toISOString(),
      });
      t.set(db.collection('agency_members').doc(`${agRef.id}_${uid}`), {
        uid, container_id: agRef.id, name, email, role: 'agency_owner',
        status: 'active', joined_at: now.toISOString(),
      });
    });
    return { success: true, agencyId: agRef.id };
  }

  const aid = (payload.agencyId || '').toString();
  if (!aid) throw new functions.https.HttpsError('invalid-argument', 'agencyId required.');
  const member = await getAgencyMemberDoc(aid, uid);
  if (!member) throw new functions.https.HttpsError('permission-denied', 'Not a member of this agency.');
  const agRef = db.collection('agencies').doc(aid);

  if (action === 'update') {
    if (!agencyCanManageMembersOrClients(member.role)) throw new functions.https.HttpsError('permission-denied', 'Insufficient role.');
    const updates: any = { updated_at: new Date().toISOString() };
    if (typeof payload.name === 'string' && payload.name.trim().length >= 2) updates.name = payload.name.trim();
    if (typeof payload.description === 'string') updates.description = payload.description.slice(0, 1000);
    if ('logo' in payload) updates.logo = payload.logo || null;
    await agRef.update(updates);
    return { success: true };
  }
  if (action === 'archive') {
    if (member.role !== 'agency_owner') throw new functions.https.HttpsError('permission-denied', 'Only the owner can archive.');
    await agRef.update({ status: 'archived', updated_at: new Date().toISOString() });
    return { success: true };
  }
  if (action === 'transfer') {
    if (member.role !== 'agency_owner') throw new functions.https.HttpsError('permission-denied', 'Only the owner can transfer.');
    const targetUid = (payload.targetUid || '').toString();
    const targetMember = await getAgencyMemberDoc(aid, targetUid);
    if (!targetMember) throw new functions.https.HttpsError('not-found', 'Target is not a member.');
    const batch = db.batch();
    batch.update(agRef, { owner_id: targetUid, updated_at: new Date().toISOString() });
    batch.update(db.collection('agency_members').doc(`${aid}_${targetUid}`), { role: 'agency_owner' });
    batch.update(db.collection('agency_members').doc(`${aid}_${uid}`), { role: 'agency_director' });
    await batch.commit();
    return { success: true };
  }
  throw new functions.https.HttpsError('invalid-argument', 'Unknown agency action.');
});

export const manageClient = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const uid = context.auth.uid;
  const email = context.auth.token.email || '';
  const action = data?.action as 'create' | 'update' | 'archive' | 'assign' | 'unassign' | 'tag';
  const payload = data?.payload || {};
  const aid = (payload.agencyId || '').toString();
  if (!aid) throw new functions.https.HttpsError('invalid-argument', 'agencyId required.');

  const member = await getAgencyMemberDoc(aid, uid);
  if (!member) throw new functions.https.HttpsError('permission-denied', 'Not a member of this agency.');

  if (action === 'create') {
    if (!agencyCanManageClients(member.role)) throw new functions.https.HttpsError('permission-denied', 'Insufficient role.');
    const name = (payload.name || '').toString().trim();
    if (name.length < 2) throw new functions.https.HttpsError('invalid-argument', 'Client name is required.');
    const agRef = db.collection('agencies').doc(aid);
    const clientRef = db.collection('agency_clients').doc();
    const now = new Date().toISOString();
    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const ag = await t.get(agRef);
      const count = ag.exists ? (ag.data()!.client_count || 0) : 0;
      if (count >= AGENCY_CLIENT_LIMIT) throw new functions.https.HttpsError('resource-exhausted', `Client limit (${AGENCY_CLIENT_LIMIT}) reached.`);
      t.set(clientRef, {
        agency_id: aid, name,
        industry: (payload.industry || '').toString(), website: (payload.website || '').toString(),
        description: (payload.description || '').toString().slice(0, 1000),
        primary_contact: (payload.primary_contact || '').toString(), email: (payload.email || '').toString(),
        phone: (payload.phone || '').toString(),
        status: 'active', tags: Array.isArray(payload.tags) ? payload.tags : [],
        analysis_count: 0, created_at: now, updated_at: now,
      });
      if (ag.exists) t.update(agRef, { client_count: count + 1 });
    });
    await writeClientActivity(clientRef.id, aid, 'client_created', uid, email, `Client "${name}" added`);
    return { success: true, clientId: clientRef.id };
  }

  const clientId = (payload.clientId || '').toString();
  if (!clientId) throw new functions.https.HttpsError('invalid-argument', 'clientId required.');
  const clientRef = db.collection('agency_clients').doc(clientId);

  if (action === 'update' || action === 'tag') {
    if (!agencyCanManageClients(member.role)) throw new functions.https.HttpsError('permission-denied', 'Insufficient role.');
    const updates: any = { updated_at: new Date().toISOString() };
    if (action === 'tag') {
      updates.tags = Array.isArray(payload.tags) ? payload.tags : [];
    } else {
      ['name', 'industry', 'website', 'description', 'primary_contact', 'email', 'phone', 'status'].forEach(k => {
        if (k in payload) updates[k] = payload[k];
      });
    }
    await clientRef.update(updates);
    return { success: true };
  }

  if (action === 'archive') {
    if (!agencyCanManageMembersOrClients(member.role)) throw new functions.https.HttpsError('permission-denied', 'Insufficient role.');
    await clientRef.update({ status: 'archived', updated_at: new Date().toISOString() });
    return { success: true };
  }

  if (action === 'assign' || action === 'unassign') {
    if (!agencyCanManageMembersOrClients(member.role)) throw new functions.https.HttpsError('permission-denied', 'Only owner/director can assign.');
    const targetUid = (payload.targetUid || '').toString();
    if (!targetUid) throw new functions.https.HttpsError('invalid-argument', 'targetUid required.');
    const assignRef = db.collection('client_assignments').doc(`${clientId}_${targetUid}`);
    if (action === 'assign') {
      const targetMember = await getAgencyMemberDoc(aid, targetUid);
      if (!targetMember) throw new functions.https.HttpsError('failed-precondition', 'Target must be an agency member.');
      await assignRef.set({
        client_id: clientId, agency_id: aid, uid: targetUid, email: targetMember.email || '',
        assignment_role: payload.assignment_role || 'analyst', created_at: new Date().toISOString(),
      });
      await writeClientActivity(clientId, aid, 'member_assigned', uid, email, `Assigned ${targetMember.email} to client`);
    } else {
      await assignRef.delete();
    }
    return { success: true };
  }

  throw new functions.https.HttpsError('invalid-argument', 'Unknown client action.');
});

export const manageAgencyMember = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const uid = context.auth.uid;
  const email = (context.auth.token.email || '').toLowerCase();
  const action = data?.action as 'invite' | 'accept' | 'updateRole' | 'remove' | 'revoke';
  const payload = data?.payload || {};
  const aid = (payload.agencyId || '').toString();
  if (!aid) throw new functions.https.HttpsError('invalid-argument', 'agencyId required.');

  if (action === 'accept') {
    const inviteId = (payload.invitationId || '').toString();
    const invRef = db.collection('agency_invitations').doc(inviteId);
    const agRef = db.collection('agencies').doc(aid);
    let agName = 'Agency';
    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const inv = await t.get(invRef);
      if (!inv.exists) throw new functions.https.HttpsError('not-found', 'Invitation not found.');
      const invData = inv.data()!;
      if (invData.status !== 'pending') throw new functions.https.HttpsError('failed-precondition', 'Invitation no longer valid.');
      if ((invData.email || '').toLowerCase() !== email) throw new functions.https.HttpsError('permission-denied', 'Invitation is for a different account.');
      const ag = await t.get(agRef);
      agName = ag.exists ? (ag.data()!.name || 'Agency') : 'Agency';
      const safeRole = AGENCY_INVITE_ROLES.includes(invData.role) ? invData.role : 'analyst';
      t.set(db.collection('agency_members').doc(`${aid}_${uid}`), {
        uid, container_id: aid, name: agName, email, role: safeRole,
        status: 'active', joined_at: new Date().toISOString(),
      });
      t.update(invRef, { status: 'accepted' });
      if (ag.exists) t.update(agRef, { member_count: (ag.data()!.member_count || 1) + 1 });
    });
    return { success: true };
  }

  const caller = await getAgencyMemberDoc(aid, uid);
  if (!caller || !agencyCanManageMembersOrClients(caller.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Insufficient role to manage agency members.');
  }

  if (action === 'invite') {
    const inviteEmail = (payload.email || '').toString().toLowerCase().trim();
    const role = (payload.role || 'analyst') as string;
    if (!inviteEmail || !inviteEmail.includes('@')) throw new functions.https.HttpsError('invalid-argument', 'Valid email required.');
    if (!AGENCY_INVITE_ROLES.includes(role)) throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');
    const ag = await db.collection('agencies').doc(aid).get();
    await db.collection('agency_invitations').add({
      agency_id: aid, agency_name: ag.exists ? ag.data()!.name : 'Agency',
      email: inviteEmail, role, invited_by: uid, status: 'pending', created_at: new Date().toISOString(),
    });
    return { success: true };
  }
  if (action === 'revoke') {
    await db.collection('agency_invitations').doc((payload.invitationId || '').toString()).update({ status: 'revoked' });
    return { success: true };
  }

  const targetUid = (payload.targetUid || '').toString();
  if (!targetUid) throw new functions.https.HttpsError('invalid-argument', 'targetUid required.');
  const targetRef = db.collection('agency_members').doc(`${aid}_${targetUid}`);

  if (action === 'updateRole') {
    const role = (payload.role || '').toString();
    if (!['agency_director', 'account_manager', 'strategist', 'analyst', 'viewer'].includes(role)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid role (use transfer to change owner).');
    }
    const target = await targetRef.get();
    if (!target.exists) throw new functions.https.HttpsError('not-found', 'Member not found.');
    if (target.data()!.role === 'agency_owner') throw new functions.https.HttpsError('failed-precondition', 'Use transfer to change the owner.');
    await targetRef.update({ role });
    return { success: true };
  }
  if (action === 'remove') {
    const target = await targetRef.get();
    if (!target.exists) throw new functions.https.HttpsError('not-found', 'Member not found.');
    if (target.data()!.role === 'agency_owner') throw new functions.https.HttpsError('failed-precondition', 'Cannot remove the owner.');
    const agRef = db.collection('agencies').doc(aid);
    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const ag = await t.get(agRef);
      t.update(targetRef, { status: 'removed' });
      if (ag.exists) t.update(agRef, { member_count: Math.max(1, (ag.data()!.member_count || 1) - 1) });
    });
    return { success: true };
  }
  throw new functions.https.HttpsError('invalid-argument', 'Unknown agency membership action.');
});

// ============================================================
// PHASE 6.3 — ENTERPRISE ANALYTICS SUITE (server-authoritative + read-only aggregation)
// The Enterprise NEVER mutates underlying analyses. The aggregation engine (Admin SDK)
// reads across the enterprise's linked containers and writes summary/health/forecast docs;
// the AI briefing engine synthesizes those into an executive briefing.
// ============================================================

const ENTERPRISE_MONTHLY_TOKENS = 5000;  // simulated pooled Enterprise allowance

const entCanManage = (role: string) => ['enterprise_owner', 'executive_admin'].includes(role);
const entCanManageDepts = (role: string) => ['enterprise_owner', 'executive_admin', 'department_director'].includes(role);
// Roles invitable into an enterprise (never 'enterprise_owner').
const ENTERPRISE_INVITE_ROLES = ['executive_admin', 'department_director', 'department_manager', 'executive_viewer'];
const getEntMemberDoc = async (eid: string, uid: string) => {
  const s = await db.collection('enterprise_members').doc(`${eid}_${uid}`).get();
  return s.exists ? (s.data() as any) : null;
};
const healthBand = (score: number) =>
  score <= 20 ? 'critical' : score <= 40 ? 'weak' : score <= 60 ? 'stable' : score <= 80 ? 'strong' : 'excellent';

export const manageEnterprise = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const uid = context.auth.uid;
  const email = context.auth.token.email || '';
  const action = data?.action as 'create' | 'update' | 'archive' | 'transfer' | 'link';
  const payload = data?.payload || {};

  if (action === 'create') {
    const name = (payload.name || '').toString().trim();
    if (name.length < 2) throw new functions.https.HttpsError('invalid-argument', 'Enterprise name is required.');
    const userRef = db.collection('users').doc(uid);
    const entRef = db.collection('enterprises').doc();
    const now = new Date();
    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User profile not found.');
      const userData = userDoc.data()!;
      if (userData.is_suspended) throw new functions.https.HttpsError('permission-denied', 'Account suspended.');
      if (userData.tier !== 'enterprise') {
        const renewsAt = new Date(now.getTime() + RENEWAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
        t.update(userRef, {
          tier: 'enterprise', subscription_status: 'active', plan_renews_at: renewsAt,
          subscription_started_at: userData.subscription_started_at || now.toISOString(),
          tokens: (userData.tokens || 0) + ENTERPRISE_MONTHLY_TOKENS,
        });
        const payRef = db.collection('payments').doc();
        t.set(payRef, { uid, payment_reference: `sub_enterprise_${now.getTime()}`, amount_paid: 0, tokens_credited: ENTERPRISE_MONTHLY_TOKENS, type: 'subscription', provider: 'stripe_simulated', status: 'completed', created_at: admin.firestore.FieldValue.serverTimestamp() });
      }
      t.set(entRef, {
        name, description: (payload.description || '').toString().slice(0, 1000), logo: payload.logo || null,
        owner_id: uid, status: 'active', member_count: 1, department_count: 0, brand_count: 0,
        linked_workspaces: [], linked_agencies: [], created_at: now.toISOString(), updated_at: now.toISOString(),
      });
      t.set(db.collection('enterprise_members').doc(`${entRef.id}_${uid}`), {
        uid, container_id: entRef.id, name, email, role: 'enterprise_owner', status: 'active', joined_at: now.toISOString(),
      });
    });
    return { success: true, enterpriseId: entRef.id };
  }

  const eid = (payload.enterpriseId || '').toString();
  if (!eid) throw new functions.https.HttpsError('invalid-argument', 'enterpriseId required.');
  const member = await getEntMemberDoc(eid, uid);
  if (!member) throw new functions.https.HttpsError('permission-denied', 'Not a member of this enterprise.');
  const entRef = db.collection('enterprises').doc(eid);

  if (action === 'update') {
    if (!entCanManage(member.role)) throw new functions.https.HttpsError('permission-denied', 'Insufficient role.');
    const updates: any = { updated_at: new Date().toISOString() };
    if (typeof payload.name === 'string' && payload.name.trim().length >= 2) updates.name = payload.name.trim();
    if (typeof payload.description === 'string') updates.description = payload.description.slice(0, 1000);
    await entRef.update(updates);
    return { success: true };
  }
  if (action === 'link') {
    if (!entCanManage(member.role)) throw new functions.https.HttpsError('permission-denied', 'Insufficient role.');
    const updates: any = { updated_at: new Date().toISOString() };
    // IDOR guard: the linker must actually hold authority over each container they expose to
    // the enterprise (owner/admin of a workspace; owner/director of an agency). Reject the
    // whole call on any unauthorized id so a member can't aggregate another tenant's data.
    if (Array.isArray(payload.linked_workspaces)) {
      for (const wid of payload.linked_workspaces) {
        const m = await getWorkspaceMemberDoc(String(wid), uid);
        if (!m || (m.role !== 'owner' && m.role !== 'admin')) {
          throw new functions.https.HttpsError('permission-denied', `Not authorized to link workspace ${wid}.`);
        }
      }
      updates.linked_workspaces = payload.linked_workspaces;
    }
    if (Array.isArray(payload.linked_agencies)) {
      for (const aId of payload.linked_agencies) {
        const m = await getAgencyMemberDoc(String(aId), uid);
        if (!m || (m.role !== 'agency_owner' && m.role !== 'agency_director')) {
          throw new functions.https.HttpsError('permission-denied', `Not authorized to link agency ${aId}.`);
        }
      }
      updates.linked_agencies = payload.linked_agencies;
    }
    await entRef.update(updates);
    return { success: true };
  }
  if (action === 'archive') {
    if (member.role !== 'enterprise_owner') throw new functions.https.HttpsError('permission-denied', 'Only the owner can archive.');
    await entRef.update({ status: 'archived', updated_at: new Date().toISOString() });
    return { success: true };
  }
  if (action === 'transfer') {
    if (member.role !== 'enterprise_owner') throw new functions.https.HttpsError('permission-denied', 'Only the owner can transfer.');
    const targetUid = (payload.targetUid || '').toString();
    const tm = await getEntMemberDoc(eid, targetUid);
    if (!tm) throw new functions.https.HttpsError('not-found', 'Target is not a member.');
    const batch = db.batch();
    batch.update(entRef, { owner_id: targetUid, updated_at: new Date().toISOString() });
    batch.update(db.collection('enterprise_members').doc(`${eid}_${targetUid}`), { role: 'enterprise_owner' });
    batch.update(db.collection('enterprise_members').doc(`${eid}_${uid}`), { role: 'executive_admin' });
    await batch.commit();
    return { success: true };
  }
  throw new functions.https.HttpsError('invalid-argument', 'Unknown enterprise action.');
});

const entStructureHandler = (kind: 'department' | 'brand') =>
  functions.https.onCall(async (data: any, context: any) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    const uid = context.auth.uid;
    const action = data?.action as 'create' | 'update' | 'delete';
    const payload = data?.payload || {};
    const eid = (payload.enterpriseId || '').toString();
    if (!eid) throw new functions.https.HttpsError('invalid-argument', 'enterpriseId required.');
    const member = await getEntMemberDoc(eid, uid);
    if (!member || !entCanManageDepts(member.role)) throw new functions.https.HttpsError('permission-denied', 'Insufficient role.');

    const coll = kind === 'department' ? 'enterprise_departments' : 'enterprise_brands';
    const countField = kind === 'department' ? 'department_count' : 'brand_count';
    const entRef = db.collection('enterprises').doc(eid);

    if (action === 'create') {
      const name = (payload.name || '').toString().trim();
      if (name.length < 2) throw new functions.https.HttpsError('invalid-argument', 'Name is required.');
      const ref = db.collection(coll).doc();
      await ref.set({
        enterprise_id: eid, name,
        ...(kind === 'department' ? { type: (payload.type || '').toString() } : { description: (payload.description || '').toString() }),
        linked_workspaces: Array.isArray(payload.linked_workspaces) ? payload.linked_workspaces : [],
        linked_agencies: Array.isArray(payload.linked_agencies) ? payload.linked_agencies : [],
        created_at: new Date().toISOString(),
      });
      await entRef.update({ [countField]: admin.firestore.FieldValue.increment(1) });
      return { success: true, id: ref.id };
    }
    const id = (payload.id || '').toString();
    if (!id) throw new functions.https.HttpsError('invalid-argument', 'id required.');
    if (action === 'update') {
      const updates: any = {};
      ['name', 'type', 'description', 'linked_workspaces', 'linked_agencies'].forEach(k => { if (k in payload) updates[k] = payload[k]; });
      await db.collection(coll).doc(id).update(updates);
      return { success: true };
    }
    if (action === 'delete') {
      await db.collection(coll).doc(id).delete();
      await entRef.update({ [countField]: admin.firestore.FieldValue.increment(-1) });
      return { success: true };
    }
    throw new functions.https.HttpsError('invalid-argument', 'Unknown action.');
  });

export const manageDepartment = entStructureHandler('department');
export const manageBrand = entStructureHandler('brand');

export const manageEnterpriseMember = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const uid = context.auth.uid;
  const email = (context.auth.token.email || '').toLowerCase();
  const action = data?.action as 'invite' | 'accept' | 'updateRole' | 'remove' | 'revoke';
  const payload = data?.payload || {};
  const eid = (payload.enterpriseId || '').toString();
  if (!eid) throw new functions.https.HttpsError('invalid-argument', 'enterpriseId required.');

  if (action === 'accept') {
    const inviteId = (payload.invitationId || '').toString();
    const invRef = db.collection('enterprise_invitations').doc(inviteId);
    const entRef = db.collection('enterprises').doc(eid);
    let entName = 'Enterprise';
    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const inv = await t.get(invRef);
      if (!inv.exists) throw new functions.https.HttpsError('not-found', 'Invitation not found.');
      const invData = inv.data()!;
      if (invData.status !== 'pending') throw new functions.https.HttpsError('failed-precondition', 'Invitation no longer valid.');
      if ((invData.email || '').toLowerCase() !== email) throw new functions.https.HttpsError('permission-denied', 'Invitation is for a different account.');
      const ent = await t.get(entRef);
      entName = ent.exists ? (ent.data()!.name || 'Enterprise') : 'Enterprise';
      const safeRole = ENTERPRISE_INVITE_ROLES.includes(invData.role) ? invData.role : 'executive_viewer';
      t.set(db.collection('enterprise_members').doc(`${eid}_${uid}`), { uid, container_id: eid, name: entName, email, role: safeRole, status: 'active', joined_at: new Date().toISOString() });
      t.update(invRef, { status: 'accepted' });
      if (ent.exists) t.update(entRef, { member_count: (ent.data()!.member_count || 1) + 1 });
    });
    return { success: true };
  }

  const caller = await getEntMemberDoc(eid, uid);
  if (!caller || !entCanManage(caller.role)) throw new functions.https.HttpsError('permission-denied', 'Insufficient role.');

  if (action === 'invite') {
    const inviteEmail = (payload.email || '').toString().toLowerCase().trim();
    const role = (payload.role || 'executive_viewer') as string;
    if (!inviteEmail || !inviteEmail.includes('@')) throw new functions.https.HttpsError('invalid-argument', 'Valid email required.');
    if (!ENTERPRISE_INVITE_ROLES.includes(role)) throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');
    const ent = await db.collection('enterprises').doc(eid).get();
    await db.collection('enterprise_invitations').add({ enterprise_id: eid, enterprise_name: ent.exists ? ent.data()!.name : 'Enterprise', email: inviteEmail, role, invited_by: uid, status: 'pending', created_at: new Date().toISOString() });
    return { success: true };
  }
  if (action === 'revoke') { await db.collection('enterprise_invitations').doc((payload.invitationId || '').toString()).update({ status: 'revoked' }); return { success: true }; }

  const targetUid = (payload.targetUid || '').toString();
  if (!targetUid) throw new functions.https.HttpsError('invalid-argument', 'targetUid required.');
  const targetRef = db.collection('enterprise_members').doc(`${eid}_${targetUid}`);
  if (action === 'updateRole') {
    const role = (payload.role || '').toString();
    if (!['executive_admin', 'department_director', 'department_manager', 'executive_viewer'].includes(role)) throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');
    const target = await targetRef.get();
    if (!target.exists) throw new functions.https.HttpsError('not-found', 'Member not found.');
    if (target.data()!.role === 'enterprise_owner') throw new functions.https.HttpsError('failed-precondition', 'Use transfer to change the owner.');
    await targetRef.update({ role });
    return { success: true };
  }
  if (action === 'remove') {
    const target = await targetRef.get();
    if (!target.exists) throw new functions.https.HttpsError('not-found', 'Member not found.');
    if (target.data()!.role === 'enterprise_owner') throw new functions.https.HttpsError('failed-precondition', 'Cannot remove the owner.');
    const entRef = db.collection('enterprises').doc(eid);
    await db.runTransaction(async (t: admin.firestore.Transaction) => {
      const ent = await t.get(entRef);
      t.update(targetRef, { status: 'removed' });
      if (ent.exists) t.update(entRef, { member_count: Math.max(1, (ent.data()!.member_count || 1) - 1) });
    });
    return { success: true };
  }
  throw new functions.https.HttpsError('invalid-argument', 'Unknown enterprise membership action.');
});

// --- ENTERPRISE ANALYTICS ENGINE (read-only aggregation) ---
// Rolls up action_logs across the enterprise's linked workspaces + enterprise-visibility
// analyses into a health score + analytics snapshot + forecasts. Never mutates source data.
export const runEnterpriseAggregation = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const uid = context.auth.uid;
  const eid = (data?.enterpriseId || '').toString();
  if (!eid) throw new functions.https.HttpsError('invalid-argument', 'enterpriseId required.');
  const member = await getEntMemberDoc(eid, uid);
  if (!member) throw new functions.https.HttpsError('permission-denied', 'Not a member of this enterprise.');

  const entSnap = await db.collection('enterprises').doc(eid).get();
  if (!entSnap.exists) throw new functions.https.HttpsError('not-found', 'Enterprise not found.');
  const ent = entSnap.data()!;
  const ownerId = ent.owner_id;
  const linkedWorkspaces: string[] = ent.linked_workspaces || [];

  // Aggregate recent action_logs for the linked workspaces.
  const byModule: Record<string, number> = {};
  const users = new Set<string>();
  let totalAnalyses = 0;
  for (const wid of linkedWorkspaces.slice(0, 50)) {
    // Re-verify linkage authority at read time: the enterprise owner must still hold
    // owner/admin membership of the workspace. A revoked link stops contributing data.
    const ownerMember = await getWorkspaceMemberDoc(wid, ownerId);
    if (!ownerMember || (ownerMember.role !== 'owner' && ownerMember.role !== 'admin')) continue;
    const logs = await db.collection('action_logs').where('workspace_id', '==', wid).limit(500).get();
    logs.forEach((d: any) => {
      const x = d.data();
      if (x.status && x.status !== 'success') return;
      totalAnalyses++;
      if (x.module) byModule[x.module] = (byModule[x.module] || 0) + 1;
      if (x.uid) users.add(x.uid);
    });
  }
  // Enterprise-visibility analyses (explicitly shared to the enterprise).
  const entAnalyses = await db.collection('tool_analysis_results').where('enterprise_id', '==', eid).limit(500).get();
  totalAnalyses += entAnalyses.size;

  const reports = await db.collection('reports').where('enterprise_id', '==', eid).limit(500).get();

  const now = new Date().toISOString();
  const by_module = Object.entries(byModule).map(([module, count]) => ({ module, count })).sort((a, b) => b.count - a.count);

  // Health score (0–100) from activity signals.
  const volumeScore = Math.min(40, totalAnalyses);                       // up to 40
  const breadthScore = Math.min(20, by_module.length * 3);              // up to 20
  const engagementScore = Math.min(20, users.size * 4);                 // up to 20
  const structureScore = Math.min(20, ((ent.department_count || 0) + (ent.brand_count || 0)) * 4); // up to 20
  const score = Math.round(volumeScore + breadthScore + engagementScore + structureScore);

  await db.collection('enterprise_health_scores').add({
    enterprise_id: eid, score, band: healthBand(score),
    signals: [
      { label: 'Analysis volume', value: totalAnalyses },
      { label: 'Tool breadth', value: by_module.length },
      { label: 'Active users', value: users.size },
      { label: 'Org structure', value: (ent.department_count || 0) + (ent.brand_count || 0) },
    ],
    computed_at: now,
  });
  await db.collection('enterprise_analytics').add({
    enterprise_id: eid, total_analyses: totalAnalyses, total_reports: reports.size,
    active_users: users.size, by_module, computed_at: now,
  });
  // Lightweight forecasts derived from current signals (placeholder projections).
  const forecasts = [
    { type: 'growth', label: 'Analysis growth', projection: totalAnalyses > 20 ? 'Accelerating usage across teams' : 'Early-stage adoption', trend: totalAnalyses > 20 ? 'up' : 'flat' },
    { type: 'activity', label: 'Team engagement', projection: users.size > 5 ? 'Broadening participation' : 'Concentrated in a few users', trend: users.size > 5 ? 'up' : 'flat' },
  ];
  for (const f of forecasts) await db.collection('enterprise_forecasts').add({ enterprise_id: eid, ...f, computed_at: now });

  return { success: true, score, totalAnalyses, activeUsers: users.size };
});

// --- AI EXECUTIVE INSIGHTS / BRIEFINGS ---
// Synthesizes the latest aggregates into an executive briefing via Gemini.
export const generateExecutiveBriefing = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const uid = context.auth.uid;
  const eid = (data?.enterpriseId || '').toString();
  const period = (data?.period || 'monthly') as string;
  if (!eid) throw new functions.https.HttpsError('invalid-argument', 'enterpriseId required.');
  const member = await getEntMemberDoc(eid, uid);
  if (!member) throw new functions.https.HttpsError('permission-denied', 'Not a member of this enterprise.');

  const entSnap = await db.collection('enterprises').doc(eid).get();
  const entName = entSnap.exists ? entSnap.data()!.name : 'the organization';

  // Pull the latest analytics snapshot + a sample of enterprise analyses for context.
  const analyticsSnap = await db.collection('enterprise_analytics').where('enterprise_id', '==', eid).limit(20).get();
  const latest = analyticsSnap.docs.map((d: any) => d.data()).sort((a: any, b: any) => new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime())[0];
  const sampleAnalyses = await db.collection('tool_analysis_results').where('enterprise_id', '==', eid).limit(15).get();
  const summaries = sampleAnalyses.docs.map((d: any) => d.data()?.result?.summary).filter(Boolean).slice(0, 15);

  const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview', systemInstruction });
  const prompt = [
    `Produce a ${period} EXECUTIVE BRIEFING for "${entName}" leadership.`,
    `Aggregated metrics: ${latest ? JSON.stringify({ total_analyses: latest.total_analyses, total_reports: latest.total_reports, active_users: latest.active_users, top_tools: (latest.by_module || []).slice(0, 5) }) : 'limited data available'}.`,
    summaries.length ? `Representative analysis summaries: ${summaries.join(' | ').slice(0, 3000)}` : '',
    `Return STRICT JSON: { "title": string, "summary": string, "wins": string[], "risks": string[], "opportunities": string[], "recommendations": string[] }. 3-6 concise, executive-level bullets per array.`,
  ].filter(Boolean).join(' ');

  let parsed: any;
  try {
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } });
    parsed = cleanJSON(result.response.text());
  } catch (e: any) {
    throw new functions.https.HttpsError('internal', 'Briefing generation failed: ' + (e.message || 'AI error'));
  }

  const briefing = {
    enterprise_id: eid, period,
    title: parsed.title || `${period[0].toUpperCase() + period.slice(1)} Executive Briefing`,
    summary: parsed.summary || '', wins: parsed.wins || [], risks: parsed.risks || [],
    opportunities: parsed.opportunities || [], recommendations: parsed.recommendations || [],
    created_at: new Date().toISOString(), created_by: context.auth.token.email || uid,
  };
  const ref = await db.collection('enterprise_briefings').add(briefing);
  return { success: true, id: ref.id, briefing };
});
