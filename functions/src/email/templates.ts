// Transactional email templates. Each returns { subject, html } for a typed data object and renders
// through the shared branded layout. Dispatched by key via EMAIL_TEMPLATES (see send.ts / triggers).

import {
  renderEmail, button, sectionHeading, paragraph, featureRows, steps, checklist, callout,
  metaTable, balanceCard, codeBlock, divider, FOOTER_LINKS, SITE_URL, RED, esc,
} from './layout';

export interface RenderedEmail { subject: string; html: string; }
const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
const span = (t: string) => `<span style="color:#ff5a5a;">${esc(t)}</span>`;

// ---- TIER 1 -----------------------------------------------------------------------------------

const welcome = (d: { firstName?: string; verifyUrl?: string; monthlyTokens?: number }): RenderedEmail => ({
  subject: 'Welcome to MarketBrain OS',
  html: renderEmail({
    preheader: `Welcome to MarketBrain OS — you've got ${d.monthlyTokens ?? 20} tokens to validate your first idea.`,
    tag: 'Welcome',
    heading: `Welcome aboard${d.firstName ? `, ${esc(d.firstName)}` : ''}.`,
    heroSubtext: "You just added an always-on strategic intelligence layer to your marketing. Let's turn your first idea into a scored, validated decision.",
    body:
      paragraph(`MarketBrain OS pressure-tests your marketing <em>before</em> you spend — scoring angles, auditing funnels, and simulating campaigns against high-conversion benchmarks. Your account starts with <strong>${d.monthlyTokens ?? 20} free tokens</strong> to try every tool. Upgrade or top up when you need more.`) +
      (d.verifyUrl ? callout(`Please confirm your email to secure your account. <a href="${d.verifyUrl}" style="color:${RED};font-weight:700;">Verify your email &rarr;</a>`, 'One quick thing') : '') +
      button('Run your first analysis →', `${SITE_URL}/strategy-lab`, 'Takes ~60 seconds · costs 3–6 tokens per run') +
      sectionHeading('What you can do today') +
      featureRows([
        { icon: '🎯', title: 'Validate strategy', desc: 'Pressure-test any idea, offer, or expansion and get a 0–100 verdict before you commit.' },
        { icon: '🩺', title: 'Audit funnels', desc: 'Diagnose a landing page or funnel for the exact friction costing you conversions.' },
        { icon: '⚡', title: 'Simulate campaigns', desc: 'Predict which angle or ad wins before a dollar of spend hits the platform.' },
      ]) +
      sectionHeading('Get started in 3 steps') +
      steps([
        '<b>Pick a tool</b> — Strategy Lab is the fastest way to see the full result format.',
        '<b>Describe your idea</b> — the more context you give, the sharper the intelligence.',
        '<b>Read &amp; act</b> — get an executive summary, findings, risks, and a concrete action plan.',
      ]) +
      callout('Chain tools together — feed a saved Audience Intelligence result into Messaging Analyzer to write copy grounded in real personas.'),
    footerLinks: FOOTER_LINKS,
    footerNote: "You're receiving this because you created an account at marketbrainos.app.",
  }),
});

const verifyEmail = (d: { verifyUrl: string }): RenderedEmail => ({
  subject: 'Confirm your email address',
  html: renderEmail({
    preheader: 'Confirm your email to secure your MarketBrain OS account.',
    tag: 'Verify email',
    heading: 'Confirm your email address.',
    heroSubtext: 'One click secures your account and unlocks everything MarketBrain OS can do.',
    body:
      paragraph('Please confirm this is your email address. This link is valid for a limited time and can only be used once.') +
      button('Verify my email →', d.verifyUrl) +
      divider() +
      paragraph(`<span style="font-size:13px;color:#8a8a8a;">If the button doesn't work, copy this link:<br><span style="color:${RED};">${esc(d.verifyUrl)}</span></span>`) +
      paragraph('<span style="font-size:13px;color:#8a8a8a;">If you didn\'t create a MarketBrain OS account, you can safely ignore this email.</span>'),
    footerNote: 'Security is important to us — we never ask for your password by email.',
  }),
});

const passwordReset = (d: { resetUrl: string }): RenderedEmail => ({
  subject: 'Reset your MarketBrain OS password',
  html: renderEmail({
    preheader: 'Reset your password — this link expires soon.',
    tag: 'Password reset',
    heading: 'Reset your password.',
    heroSubtext: 'We received a request to reset the password on your account.',
    body:
      paragraph('Click below to choose a new password. For your security, this link expires in one hour and can only be used once.') +
      button('Reset my password →', d.resetUrl) +
      divider() +
      paragraph(`<span style="font-size:13px;color:#8a8a8a;">If the button doesn't work, copy this link:<br><span style="color:${RED};">${esc(d.resetUrl)}</span></span>`) +
      callout("If you didn't request this, no action is needed — your password stays the same. Consider reviewing your account security if you're concerned.", 'Didn’t request this?'),
    footerNote: 'We will never ask for your password or payment details by email.',
  }),
});

const passwordChanged = (d: { firstName?: string }): RenderedEmail => ({
  subject: 'Your password was changed',
  html: renderEmail({
    preheader: 'Your MarketBrain OS password was just changed.',
    tag: 'Security',
    heading: 'Your password was changed.',
    heroSubtext: `This is a confirmation that the password on your account was updated${d.firstName ? `, ${d.firstName}` : ''}.`,
    body:
      paragraph('If this was you, no further action is needed.') +
      callout(`If you did <b>not</b> make this change, reset your password immediately and contact us. <a href="${SITE_URL}/support" style="color:${RED};font-weight:700;">Get help &rarr;</a>`, 'Wasn’t you?') +
      button('Go to your account →', `${SITE_URL}/settings`),
    footerNote: 'You received this security notification to help keep your account safe.',
  }),
});

const memberInvite = (d: { inviterEmail: string; containerName: string; containerType: string; roleLabel: string; acceptUrl: string; capabilities?: string[] }): RenderedEmail => ({
  subject: `You're invited to join ${d.containerName} on MarketBrain OS`,
  html: renderEmail({
    preheader: `${d.inviterEmail} invited you to ${d.containerName} on MarketBrain OS.`,
    tag: 'Invitation',
    heading: `You're invited to join ${span(d.containerName)}.`,
    heroSubtext: `${d.inviterEmail} has invited you to collaborate as a ${d.roleLabel}.`,
    body:
      paragraph(`${esc(d.containerName)} runs its marketing intelligence on MarketBrain OS — shared analyses, ${d.containerType === 'agency' ? 'client workspaces' : 'reports'}, and a pooled token budget, all in one place.`) +
      button('Accept invitation →', d.acceptUrl, 'This invitation expires in 7 days.') +
      sectionHeading(`As a ${d.roleLabel}, you'll be able to`) +
      checklist(d.capabilities && d.capabilities.length ? d.capabilities : [
        'Run analyses within the shared workspace',
        'Access shared reports and the intelligence library',
        'Draw from your allocated token budget — no personal billing required',
      ]) +
      callout(`<b>New to MarketBrain OS?</b> It's a predictive marketing-intelligence platform that scores and validates ideas, copy, funnels, and campaigns before you spend. <a href="${SITE_URL}/documentation" style="color:${RED};">Take the quick tour</a>.`, 'First time here?') +
      divider() +
      paragraph("<span style='font-size:13px;color:#8a8a8a;'>If you weren't expecting this, you can safely ignore it — no account is created until you accept.</span>"),
    footerNote: `If the button doesn't work, paste this link: ${esc(d.acceptUrl)}`,
  }),
});

const memberAdded = (d: { containerName: string; tempPassword: string; roleLabel: string; email: string }): RenderedEmail => ({
  subject: `You've been added to ${d.containerName} on MarketBrain OS`,
  html: renderEmail({
    preheader: `An account was created for you on ${d.containerName}.`,
    tag: 'Account created',
    heading: `You've been added to ${span(d.containerName)}.`,
    heroSubtext: `An account was created for you as a ${d.roleLabel}. Sign in with the temporary password below, then change it right away.`,
    body:
      paragraph(`<b>Sign-in email:</b> ${esc(d.email)}`) +
      paragraph('<b>Temporary password:</b>') +
      codeBlock(d.tempPassword) +
      button('Sign in →', `${SITE_URL}/auth`) +
      callout('For your security, change this password immediately after your first sign-in, from Settings → Security.', 'Important') +
      sectionHeading("What you'll have access to") +
      checklist([
        `Your role: ${d.roleLabel}`,
        'The workspace’s shared analyses and reports',
        'The tools your team owner has enabled for you',
      ]),
    footerNote: "You received this because an owner added you to their workspace on MarketBrain OS.",
  }),
});

const tokenReceipt = (d: { packLabel: string; tokens: number; amount: number; newBalance: number; reference: string; date: string }): RenderedEmail => ({
  subject: `Receipt — ${d.tokens} tokens added to MarketBrain OS`,
  html: renderEmail({
    preheader: `Receipt — ${d.tokens} tokens added, new balance ${d.newBalance}.`,
    tag: 'Receipt',
    heading: `${d.tokens} tokens added. You're topped up.`,
    heroSubtext: 'Thanks for your purchase — your tokens are available now and never expire.',
    body:
      sectionHeading('Order summary') +
      metaTable([
        { k: 'Pack', v: d.packLabel },
        { k: 'Tokens added', v: `+${d.tokens}` },
        { k: 'Date', v: d.date },
        { k: 'Reference', v: d.reference },
        { k: 'Amount paid', v: money(d.amount), total: true },
      ]) +
      balanceCard('New token balance', `${d.newBalance} tokens`) +
      sectionHeading('What your tokens unlock') +
      featureRows([
        { icon: '🧭', title: 'Strategy & growth analyses', desc: '5 tokens each — pressure-test ideas and find your fastest path to growth.' },
        { icon: '✍️', title: 'Messaging & angles', desc: '3 tokens each — generate hooks and score copy for clarity and persuasion.' },
        { icon: '🩺', title: 'Conversion audits', desc: '4 tokens each — diagnose funnels and landing pages for friction.' },
      ]) +
      button('View billing & invoices →', `${SITE_URL}/billing`),
    footerLinks: [{ label: 'Billing', href: `${SITE_URL}/billing` }, { label: 'Token store', href: `${SITE_URL}/store` }, { label: 'Support', href: `${SITE_URL}/support` }],
    footerNote: 'Keep this receipt for your records.',
  }),
});

const subscriptionUpgraded = (d: { planName: string; monthlyTokens: number; price: number; features?: string[] }): RenderedEmail => ({
  subject: `You're now on ${d.planName}`,
  html: renderEmail({
    preheader: `Welcome to ${d.planName} — ${d.monthlyTokens} tokens/month and more.`,
    tag: 'Subscription',
    heading: `You're now on ${span(d.planName)}.`,
    heroSubtext: `Your plan is active. You now get ${d.monthlyTokens} tokens every month, plus everything ${d.planName} unlocks.`,
    body:
      metaTable([
        { k: 'Plan', v: d.planName },
        { k: 'Monthly tokens', v: String(d.monthlyTokens) },
        { k: 'Price', v: `${money(d.price)}/mo`, total: true },
      ]) +
      sectionHeading("What's included") +
      checklist(d.features && d.features.length ? d.features : ['Full access to the intelligence suite', 'Unlimited analysis history', 'Advanced reports & exports']) +
      button('Explore your new plan →', `${SITE_URL}/`),
    footerLinks: [{ label: 'Billing', href: `${SITE_URL}/billing` }, { label: 'Pricing', href: `${SITE_URL}/pricing` }, { label: 'Support', href: `${SITE_URL}/support` }],
  }),
});

const paymentReceipt = (d: { description: string; amount: number; reference: string; date: string }): RenderedEmail => ({
  subject: 'Your MarketBrain OS receipt',
  html: renderEmail({
    preheader: `Receipt — ${money(d.amount)} for ${d.description}.`,
    tag: 'Receipt',
    heading: 'Thanks — here’s your receipt.',
    heroSubtext: 'A confirmation of your recent payment on MarketBrain OS.',
    body:
      metaTable([
        { k: 'Item', v: d.description },
        { k: 'Date', v: d.date },
        { k: 'Reference', v: d.reference },
        { k: 'Amount paid', v: money(d.amount), total: true },
      ]) +
      button('View billing →', `${SITE_URL}/billing`),
    footerLinks: [{ label: 'Billing', href: `${SITE_URL}/billing` }, { label: 'Support', href: `${SITE_URL}/support` }],
    footerNote: 'Keep this receipt for your records.',
  }),
});

// ---- TIER 2 -----------------------------------------------------------------------------------

const lowBalance = (d: { balance: number }): RenderedEmail => ({
  subject: 'Your token balance is running low',
  html: renderEmail({
    preheader: `Only ${d.balance} tokens left this cycle.`,
    tag: 'Token alert',
    heading: 'Your tokens are running low.',
    heroSubtext: `You have ${d.balance} tokens left. Top up so your analyses never get interrupted.`,
    body:
      balanceCard('Remaining this cycle', `${d.balance} tokens`) +
      paragraph('Purchased token packs never expire and stack on top of your monthly allowance.') +
      button('Buy more tokens →', `${SITE_URL}/store`),
    footerLinks: [{ label: 'Token store', href: `${SITE_URL}/store` }, { label: 'Pricing', href: `${SITE_URL}/pricing` }],
    footerNote: 'You can turn off token alerts in Settings → Notifications.',
  }),
});

const outOfTokens = (d: { balance: number }): RenderedEmail => ({
  subject: "You're out of tokens",
  html: renderEmail({
    preheader: 'Top up to keep running analyses.',
    tag: 'Token alert',
    heading: "You're out of tokens.",
    heroSubtext: 'Your balance has reached zero, so new analyses are paused until you top up or your monthly allowance resets.',
    body:
      paragraph('Grab a token pack (they never expire) or upgrade your plan for a larger monthly allowance.') +
      button('Top up now →', `${SITE_URL}/store`) +
      callout('Monthly tokens refresh automatically at the start of each billing cycle.'),
    footerLinks: [{ label: 'Token store', href: `${SITE_URL}/store` }, { label: 'Pricing', href: `${SITE_URL}/pricing` }],
    footerNote: 'You can turn off token alerts in Settings → Notifications.',
  }),
});

const renewalReminder = (d: { planName: string; renewsAt: string; price: number }): RenderedEmail => ({
  subject: `Your ${d.planName} plan renews soon`,
  html: renderEmail({
    preheader: `${d.planName} renews on ${d.renewsAt}.`,
    tag: 'Billing',
    heading: `Your ${span(d.planName)} plan renews soon.`,
    heroSubtext: `Your plan renews on ${d.renewsAt} for ${money(d.price)}. No action needed — this is just a heads-up.`,
    body:
      metaTable([{ k: 'Plan', v: d.planName }, { k: 'Renews on', v: d.renewsAt }, { k: 'Amount', v: `${money(d.price)}/mo`, total: true }]) +
      button('Manage subscription →', `${SITE_URL}/billing`),
    footerLinks: [{ label: 'Billing', href: `${SITE_URL}/billing` }, { label: 'Support', href: `${SITE_URL}/support` }],
  }),
});

const subscriptionRenewed = (d: { planName: string; monthlyTokens: number; amount: number; date: string }): RenderedEmail => ({
  subject: `Your ${d.planName} plan renewed`,
  html: renderEmail({
    preheader: `${d.planName} renewed — ${d.monthlyTokens} tokens refreshed.`,
    tag: 'Receipt',
    heading: `Your ${span(d.planName)} plan renewed.`,
    heroSubtext: `Your monthly tokens have been refreshed to ${d.monthlyTokens}. Here's your receipt.`,
    body:
      metaTable([{ k: 'Plan', v: d.planName }, { k: 'Date', v: d.date }, { k: 'Tokens refreshed', v: String(d.monthlyTokens) }, { k: 'Amount', v: money(d.amount), total: true }]) +
      button('View billing →', `${SITE_URL}/billing`),
    footerLinks: [{ label: 'Billing', href: `${SITE_URL}/billing` }, { label: 'Support', href: `${SITE_URL}/support` }],
  }),
});

const paymentFailed = (d: { planName: string; amount: number }): RenderedEmail => ({
  subject: 'Action needed: your payment failed',
  html: renderEmail({
    preheader: 'We couldn’t process your payment.',
    tag: 'Billing',
    heading: 'We couldn’t process your payment.',
    heroSubtext: `Your ${d.planName} payment of ${money(d.amount)} didn't go through. Update your payment method to avoid losing access.`,
    body:
      paragraph('This can happen if a card expired or a bank declined the charge. Updating your details usually fixes it in seconds.') +
      button('Update payment method →', `${SITE_URL}/billing`) +
      callout("We'll retry automatically, but access to paid features may pause until the payment succeeds.", 'Heads up'),
    footerLinks: [{ label: 'Billing', href: `${SITE_URL}/billing` }, { label: 'Support', href: `${SITE_URL}/support` }],
  }),
});

const subscriptionCancelled = (d: { planName: string; accessUntil?: string }): RenderedEmail => ({
  subject: `Your ${d.planName} plan was cancelled`,
  html: renderEmail({
    preheader: 'Your subscription has been cancelled.',
    tag: 'Subscription',
    heading: `Your ${span(d.planName)} plan was cancelled.`,
    heroSubtext: d.accessUntil ? `You'll keep access until ${d.accessUntil}, then move to the Free plan.` : "You've been moved to the Free plan.",
    body:
      paragraph('We’re sorry to see you scale back. Your data and analysis history stay safe, and you can upgrade again anytime.') +
      button('Reactivate a plan →', `${SITE_URL}/pricing`) +
      callout("Mind sharing what we could do better? Just reply to this email — we read every response.", 'One favor'),
    footerLinks: [{ label: 'Pricing', href: `${SITE_URL}/pricing` }, { label: 'Support', href: `${SITE_URL}/support` }],
  }),
});

const expansionPurchased = (d: { typeLabel: string; containerName: string; price: number }): RenderedEmail => ({
  subject: `Capacity added: ${d.typeLabel}`,
  html: renderEmail({
    preheader: `${d.typeLabel} added to ${d.containerName}.`,
    tag: 'Receipt',
    heading: 'Capacity added.',
    heroSubtext: `You added ${d.typeLabel} to ${d.containerName}. It's active immediately.`,
    body:
      metaTable([{ k: 'Add-on', v: d.typeLabel }, { k: 'Applied to', v: d.containerName }, { k: 'Amount', v: `${money(d.price)}/mo`, total: true }]) +
      button('Manage capacity →', `${SITE_URL}/billing`),
    footerLinks: [{ label: 'Billing', href: `${SITE_URL}/billing` }, { label: 'Support', href: `${SITE_URL}/support` }],
  }),
});

const refundIssued = (d: { amount: number; reference: string; date: string }): RenderedEmail => ({
  subject: 'Your refund has been issued',
  html: renderEmail({
    preheader: `A refund of ${money(d.amount)} was issued.`,
    tag: 'Refund',
    heading: 'Your refund has been issued.',
    heroSubtext: `We've issued a refund of ${money(d.amount)}. It may take a few business days to appear, depending on your bank.`,
    body:
      metaTable([{ k: 'Date', v: d.date }, { k: 'Reference', v: d.reference }, { k: 'Amount refunded', v: money(d.amount), total: true }]) +
      button('View billing →', `${SITE_URL}/billing`),
    footerLinks: [{ label: 'Billing', href: `${SITE_URL}/billing` }, { label: 'Support', href: `${SITE_URL}/support` }],
  }),
});

const newSignIn = (d: { device?: string; location?: string; time?: string }): RenderedEmail => ({
  subject: 'New sign-in to your MarketBrain OS account',
  html: renderEmail({
    preheader: 'A new sign-in was detected on your account.',
    tag: 'Security',
    heading: 'New sign-in detected.',
    heroSubtext: 'We noticed a sign-in to your account. If this was you, no action is needed.',
    body:
      metaTable([{ k: 'Device', v: d.device || 'Unknown' }, { k: 'Location', v: d.location || 'Unknown' }, { k: 'Time', v: d.time || 'Just now' }]) +
      callout(`If this wasn't you, reset your password now and review your account. <a href="${SITE_URL}/settings" style="color:${RED};font-weight:700;">Secure my account &rarr;</a>`, "Wasn't you?"),
    footerNote: 'You received this security notification to help keep your account safe.',
  }),
});

const memberBudgetExhausted = (d: { containerName: string }): RenderedEmail => ({
  subject: 'Your token budget is used up',
  html: renderEmail({
    preheader: `Your budget in ${d.containerName} is used up for this cycle.`,
    tag: 'Token alert',
    heading: 'Your token budget is used up.',
    heroSubtext: `You've spent your allocated tokens in ${d.containerName} for this cycle. Ask the owner to allocate more to keep running analyses.`,
    body:
      paragraph('Your budget resets at the start of the next billing cycle. In the meantime, an owner or director can increase your allocation.') +
      button('Open your workspace →', `${SITE_URL}/`),
    footerNote: 'You can turn off token alerts in Settings → Notifications.',
  }),
});

const ownershipTransferred = (d: { containerName: string; counterpartEmail: string; isNewOwner: boolean }): RenderedEmail => ({
  subject: `Ownership of ${d.containerName} was transferred`,
  html: renderEmail({
    preheader: `Ownership of ${d.containerName} changed.`,
    tag: 'Ownership',
    heading: d.isNewOwner ? `You're now the owner of ${span(d.containerName)}.` : `Ownership of ${span(d.containerName)} was transferred.`,
    heroSubtext: d.isNewOwner
      ? `${d.counterpartEmail} transferred ownership to you. You now control members, billing, and settings.`
      : `You transferred ownership to ${d.counterpartEmail}. You remain a member with admin access.`,
    body:
      paragraph(d.isNewOwner ? 'With ownership you can manage members, allocate budgets, buy capacity, and change plan settings.' : 'If this wasn’t intended, contact the new owner or reach our support team.') +
      button('Open workspace →', `${SITE_URL}/`),
    footerLinks: [{ label: 'Support', href: `${SITE_URL}/support` }],
  }),
});

const briefingReady = (d: { enterpriseName: string }): RenderedEmail => ({
  subject: `Your executive briefing for ${d.enterpriseName} is ready`,
  html: renderEmail({
    preheader: `A new executive briefing is ready for ${d.enterpriseName}.`,
    tag: 'Intelligence',
    heading: 'Your executive briefing is ready.',
    heroSubtext: `A fresh AI-generated briefing for ${d.enterpriseName} — wins, risks, opportunities, and recommendations — is waiting for you.`,
    body:
      paragraph('Get the strategic picture across your organization at a glance, aggregated over your linked teams and agencies.') +
      button('Read the briefing →', `${SITE_URL}/enterprise`),
    footerNote: 'You can turn off these alerts in Settings → Notifications.',
  }),
});

const accountSuspended = (d: { reason?: string }): RenderedEmail => ({
  subject: 'Your MarketBrain OS account has been suspended',
  html: renderEmail({
    preheader: 'Your account access has been suspended.',
    tag: 'Account',
    heading: 'Your account has been suspended.',
    heroSubtext: 'Access to your MarketBrain OS account has been temporarily suspended by an administrator.',
    body:
      paragraph(d.reason ? `Reason: ${esc(d.reason)}` : 'This is usually related to a billing issue or a review of activity on the account.') +
      paragraph('If you believe this is a mistake, please get in touch and we’ll help sort it out.') +
      button('Contact support →', `${SITE_URL}/support`),
    footerLinks: [{ label: 'Support', href: `${SITE_URL}/support` }],
  }),
});

const accountReinstated = (): RenderedEmail => ({
  subject: 'Your MarketBrain OS account has been reinstated',
  html: renderEmail({
    preheader: 'Your account access has been restored.',
    tag: 'Account',
    heading: "You're back in.",
    heroSubtext: 'Your account has been reinstated and full access is restored.',
    body:
      paragraph('Everything is right where you left it — your analyses, reports, and settings are intact.') +
      button('Return to your dashboard →', `${SITE_URL}/`),
    footerLinks: FOOTER_LINKS,
  }),
});

// ---- Dispatch table ---------------------------------------------------------------------------

export const EMAIL_TEMPLATES = {
  welcome, verifyEmail, passwordReset, passwordChanged, memberInvite, memberAdded,
  tokenReceipt, subscriptionUpgraded, paymentReceipt,
  lowBalance, outOfTokens, renewalReminder, subscriptionRenewed, paymentFailed,
  subscriptionCancelled, expansionPurchased, refundIssued, newSignIn,
  memberBudgetExhausted, ownershipTransferred, briefingReady, accountSuspended, accountReinstated,
} as const;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;
