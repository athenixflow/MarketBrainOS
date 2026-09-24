// Transactional email templates. Each returns { subject, html } for a typed data object and renders
// through the shared branded layout. Dispatched by key via EMAIL_TEMPLATES (see send.ts / triggers).

import {
  renderEmail, button, sectionHeading, paragraph, featureRows, steps, checklist, callout,
  metaTable, balanceCard, codeBlock, divider, FOOTER_LINKS, SITE_URL, RED, esc,
} from './layout';

export interface RenderedEmail { subject: string; html: string; }
const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
const span = (t: string) => `<span style="color:#ff5a5a;">${esc(t)}</span>`;

/** The footer every lifecycle email carries. One place, so none of them can forget it. */
const lifecycleFooter = (d: { unsubUrl?: string }) => ({
  footerLinks: d.unsubUrl ? [...FOOTER_LINKS, { label: 'Unsubscribe', href: d.unsubUrl }] : FOOTER_LINKS,
  footerNote: "You're receiving this because you created an account at marketbrainos.app. "
    + 'One click unsubscribes you from onboarding and tips; receipts and security emails keep coming.',
});

// ---- TIER 1 -----------------------------------------------------------------------------------

const welcome = (d: { firstName?: string; verifyUrl?: string; monthlyTokens?: number }): RenderedEmail => ({
  subject: 'Welcome to MarketBrain OS',
  html: renderEmail({
    preheader: `Welcome to MarketBrain OS — you've got ${d.monthlyTokens ?? 20} tokens to validate your first idea.`,
    tag: 'Welcome',
    heading: `Welcome aboard${d.firstName ? `, ${esc(d.firstName)}` : ''}.`,
    heroSubtext: "You just added an always-on strategic intelligence layer to your marketing. Let's turn your first idea into a scored, validated decision.",
    body:
      paragraph(`MarketBrain OS reviews your marketing <em>before</em> you spend — scoring angles, auditing funnels from a live URL, and comparing your variants against conversion-copywriting principles. Your account starts with <strong>${d.monthlyTokens ?? 20} free tokens</strong> to try every tool. Upgrade or top up when you need more.`) +
      (d.verifyUrl ? callout(`Please confirm your email to secure your account. <a href="${d.verifyUrl}" style="color:${RED};font-weight:700;">Verify your email &rarr;</a>`, 'One quick thing') : '') +
      button('Run your first analysis →', `${SITE_URL}/strategy-lab`, 'Takes ~60 seconds · costs 3–6 tokens per run') +
      sectionHeading('What you can do today') +
      featureRows([
        { icon: '🎯', title: 'Validate strategy', desc: 'Pressure-test any idea, offer, or expansion and get a 0–100 verdict before you commit.' },
        { icon: '🩺', title: 'Audit funnels', desc: 'Diagnose a landing page or funnel for the exact friction costing you conversions.' },
        { icon: '⚡', title: 'Compare variants', desc: 'Put 2–5 headlines or ads side by side and see which is strongest, and why, before a dollar of spend.' },
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
      callout(`<b>New to MarketBrain OS?</b> It's the pre-spend review for marketing decisions: it scores ideas, copy, funnels and campaigns and returns ranked fixes, before you spend. <a href="${SITE_URL}/documentation" style="color:${RED};">Take the quick tour</a>.`, 'First time here?') +
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

// Token alerts must not promise a refill the account will never get: the Free allowance is ONE-TIME
// (monthlyTokenRefresh skips free tiers), while paid plans do reset each cycle. Callers should pass
// `replenishes: tier !== 'free'`. sendTemplate's data is typed `any`, so that cannot be enforced by
// the compiler — when the flag is omitted the copy stays deliberately plan-neutral and true either way.
const lowBalance = (d: { balance: number; replenishes?: boolean }): RenderedEmail => ({
  subject: 'Your token balance is running low',
  html: renderEmail({
    preheader: `Only ${d.balance} tokens left.`,
    tag: 'Token alert',
    heading: 'Your tokens are running low.',
    heroSubtext: `You have ${d.balance} tokens left. Top up so your analyses never get interrupted.`,
    body:
      balanceCard('Remaining balance', `${d.balance} tokens`) +
      paragraph('Purchased token packs never expire and stack on top of your plan allowance.') +
      (d.replenishes === false
        ? paragraph('Your Free allowance is a one-time grant, so it will not refill on its own. Top up or upgrade to keep going.')
        : d.replenishes === true
          ? paragraph('Your plan allowance refreshes at the start of your next billing cycle.')
          : '') +
      button('Buy more tokens →', `${SITE_URL}/store`),
    footerLinks: [{ label: 'Token store', href: `${SITE_URL}/store` }, { label: 'Pricing', href: `${SITE_URL}/pricing` }],
    footerNote: 'You can turn off token alerts in Settings → Notifications.',
  }),
});

const outOfTokens = (d: { balance: number; replenishes?: boolean }): RenderedEmail => ({
  subject: "You're out of tokens",
  html: renderEmail({
    preheader: 'Top up to keep running analyses.',
    tag: 'Token alert',
    heading: "You're out of tokens.",
    heroSubtext: d.replenishes === false
      ? 'Your balance has reached zero, so new analyses are paused until you top up or upgrade.'
      : d.replenishes === true
        ? 'Your balance has reached zero, so new analyses are paused until you top up or your plan allowance resets.'
        : 'Your balance has reached zero, so new analyses are paused until you add more tokens.',
    body:
      paragraph('Grab a token pack (they never expire) or upgrade your plan for a larger monthly allowance.') +
      button('Top up now →', `${SITE_URL}/store`) +
      (d.replenishes === false
        ? callout('The Free allowance is one-time and does not refresh. Upgrading to Pro adds tokens every month.')
        : d.replenishes === true
          ? callout('Monthly tokens refresh automatically at the start of each billing cycle.')
          : ''),
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

// Sent by deleteAccount to the address on the token, just before the Auth user is removed (after that
// there is no address left to send to). No sign-in CTA: the account no longer exists.
const accountDeleted = (d: { firstName?: string }): RenderedEmail => ({
  subject: 'Your MarketBrain OS account has been deleted',
  html: renderEmail({
    preheader: 'Your account and its data have been deleted, as you requested.',
    tag: 'Account',
    heading: `Your account has been deleted${d.firstName ? `, ${esc(d.firstName)}` : ''}.`,
    heroSubtext: 'As you requested, your MarketBrain OS account has been closed and the data it held has been removed.',
    body:
      sectionHeading('What was deleted') +
      checklist([
        'Your profile and sign-in — you can no longer sign in with this account.',
        'Every analysis and report you created, including ones shared with a team, client or enterprise library.',
        'Your history, notifications, workspace seats and open invitations.',
        'Unused tokens, which are forfeited and not refunded.',
      ]) +
      sectionHeading('What was kept, and why') +
      paragraph('Payment records and security logs are retained for as long as the law and our accountants require (Privacy Policy §6). Your name and email address have been removed from them; only an internal reference remains.') +
      callout(`If you did not do this, contact <a href="mailto:support@marketbrainos.app" style="color:${RED};font-weight:700;">support@marketbrainos.app</a> immediately.`, 'Didn’t request this?') +
      paragraph('<span style="font-size:13px;color:#8a8a8a;">You are welcome back any time — signing up again creates a brand-new account; nothing from this one is restored.</span>'),
    footerLinks: [{ label: 'Privacy Policy', href: `${SITE_URL}/privacy` }, { label: 'Support', href: 'mailto:support@marketbrainos.app' }],
    footerNote: 'This is the last email you will receive from MarketBrain OS about this account.',
  }),
});

// ---- Dispatch table ---------------------------------------------------------------------------


/**
 * ONB-D3 — "Why not just ask ChatGPT?" (GTM part 12).
 *
 * THE OBJECTION EVERY BUYER HAS, ANSWERED HONESTLY. The product runs on the same class of
 * model somebody can use for free in a chat window, and pretending otherwise fails the
 * moment they try it. So the email concedes the point in its first line and argues the
 * real difference — structure, a live page fetch, history, and the same format for
 * everybody on a team — which are things a chat window genuinely does not do.
 *
 * The playbook's draft of this email listed "multi-variant prediction" as a
 * differentiator. It is not one, because the product does not predict; the line here
 * claims the comparison it actually performs.
 */
const onboardingWhyNotChatgpt = (d: { firstName?: string; unsubUrl?: string }): RenderedEmail => ({
  subject: 'Honest answer to "why not just use ChatGPT?"',
  html: renderEmail({
    preheader: 'Same model family. Different output: scored, sectioned, saved, comparable.',
    tag: 'Getting started',
    heading: 'Why not just ask ChatGPT?',
    heroSubtext: "Fair question, and worth answering straight rather than dodging.",
    body:
      paragraph(`Hi${d.firstName ? ` ${esc(d.firstName)}` : ''} — MarketBrain OS runs on the same class of model you can use directly. We are not smarter than it.`) +
      paragraph('What differs is everything around the model:') +
      featureRows([
        { icon: '📐', title: 'Structure', desc: 'Every run returns the same sections — score, findings, why it matters, do this. Tuesday and Thursday are comparable.' },
        { icon: '🔗', title: 'Live page audits', desc: 'Conversion Doctor fetches the actual URL and reads what is there. No pasting, no guessing.' },
        { icon: '🗂️', title: 'Memory', desc: 'History keeps every result and Reports group them. Nothing is lost in a scrolling chat.' },
        { icon: '👥', title: 'One format for a team', desc: 'Everybody asking the same question gets the same shape of answer.' },
      ]) +
      button('Compare two headlines →', `${SITE_URL}/test-lab`, 'One run, 5 tokens') +
      paragraph('If two headlines are being argued about right now, that is the fastest way to feel the difference.'),
    ...lifecycleFooter(d),
  }),
});

/**
 * ONB-D7 — one week in (GTM part 12).
 *
 * CARRIES THEIR ACTUAL NUMBERS. A week-one email that says "here is what you could do"
 * to somebody who has run nothing is noise; one that names their balance and what they
 * have saved is about them. The dispatcher supplies both, and the copy branches on
 * whether anything was actually run.
 */
const onboardingWeekOne = (d: {
  firstName?: string; balance?: number; analysisCount?: number; unsubUrl?: string;
}): RenderedEmail => {
  const ran = (d.analysisCount ?? 0) > 0;
  return {
    subject: ran
      ? `${d.balance ?? 0} tokens left — the chain that uses them best`
      : 'One week in — the 60-second version',
    html: renderEmail({
      preheader: ran
        ? 'Chain a saved result into the next tool, and save what you want to keep.'
        : 'Pick one page you already have. That is the whole first run.',
      tag: 'Getting started',
      heading: ran ? 'A week in' : 'Still worth two minutes',
      heroSubtext: ran
        ? `You have ${d.balance ?? 0} tokens and ${d.analysisCount} saved result${d.analysisCount === 1 ? '' : 's'}.`
        : 'Nothing run yet — which usually means the first step looked bigger than it is.',
      body: ran
        ? paragraph('Two things most people find in week two:') +
          sectionHeading('Chaining') +
          paragraph('Feed a saved Audience Intelligence result into Messaging Analyzer and the copy scoring is grounded in the personas you already generated — rather than in a generic reader.') +
          sectionHeading('Reports') +
          paragraph('Open any result in History and save it as a report to group related runs. On paid plans a report exports as a PDF for a client or a manager.') +
          button('Open your history →', `${SITE_URL}/history`)
        : paragraph(`Hi${d.firstName ? ` ${esc(d.firstName)}` : ''} — the quickest first run is a page you already have: paste the URL into Conversion Doctor, say who it is for and what you want them to do, and read the three things it finds.`) +
          paragraph('It costs 4 tokens and takes about a minute.') +
          button('Audit a page →', `${SITE_URL}/conversion-doctor`, 'Roughly 60 seconds'),
      ...lifecycleFooter(d),
    }),
  };
};


/* ==============================================================================================
   LIFECYCLE — the onboarding sequence and the activation nudges (GTM part 12 §2.1–2.2)

   These are MARKETING mail: nobody asked for any individual one of them. Every template here
   takes `unsubUrl` and puts it in the footer, `MARKETING_KEYS` lists them, and `sendTemplate`
   refuses to send one without a working link. The transactional templates above deliberately
   do not carry it — an unsubscribe control on a receipt teaches people that unsubscribing
   stops their receipts.
   ============================================================================================== */


/**
 * ONB-D1 — how to read a report.
 *
 * Branches on whether they have run anything, because the same email is either "here is what
 * your result means" or "here is what will come back" — and sending the first to somebody
 * with no results is how a sequence tells its reader it is not paying attention.
 */
const onboardingHowToRead = (d: {
  firstName?: string; analysisCount?: number; unsubUrl?: string;
}): RenderedEmail => {
  const ran = (d.analysisCount ?? 0) > 0;
  return {
    subject: ran ? 'Your result, explained' : 'The three parts of every MarketBrain OS report',
    html: renderEmail({
      preheader: 'Why "why it matters" and "do this" are the parts to act on, not the score.',
      tag: 'Getting started',
      heading: ran ? 'How to read what came back' : 'What a report looks like',
      heroSubtext: ran
        ? 'You have a result. The score is the least useful part of it.'
        : 'Before your first run, here is what comes back — so you know what to look for.',
      body:
        paragraph(`Hi${d.firstName ? ` ${esc(d.firstName)}` : ''} — every report has three layers, and they are worth different amounts.`) +
        steps([
          '<b>The score or verdict</b> — a 0–100 number. Useful for comparing two versions of the same thing. Not useful on its own, and not a forecast.',
          '<b>The findings, each with why it matters</b> — the reasoning. This is where you decide whether you agree.',
          '<b>"Do this" per finding</b> — the concrete change. Copy it into your task list.',
        ]) +
        callout('Run it, change one thing, run it again. Same input, same structure, comparable score — that repeatability is the thing an open chat window cannot give you.', 'The habit that makes it pay') +
        button(ran ? 'Open your results →' : 'Run your first analysis →', `${SITE_URL}${ran ? '/history' : '/conversion-doctor'}`),
      ...lifecycleFooter(d),
    }),
  };
};

/**
 * ONB-D14 — a question from the founder.
 *
 * DELIBERATELY PLAIN. No hero art, no button, no tracked CTA: the ask is a reply, and an
 * email that looks like a campaign does not get one. The spec calls this Mode A with the
 * founder on reply-to; the layout's reply-to is already a monitored address.
 */
const onboardingFounderQuestion = (d: {
  firstName?: string; analysisCount?: number; unsubUrl?: string;
}): RenderedEmail => {
  const n = d.analysisCount ?? 0;
  return {
    subject: 'What were you trying to decide?',
    html: renderEmail({
      preheader: 'One question, no survey. A sentence is plenty.',
      tag: 'From the founder',
      heading: 'One question',
      heroSubtext: 'I read every reply to this one.',
      body:
        paragraph(`Hi${d.firstName ? ` ${esc(d.firstName)}` : ''} — two weeks ago you signed up${n > 0 ? ` and ran ${n} analys${n === 1 ? 'is' : 'es'}` : ''}.`) +
        paragraph('What decision were you trying to make? A launch, a page rewrite, a pitch, a client deliverable — whatever it was.') +
        paragraph('I ask because the tools are only as good as the decisions they are pointed at, and your answer tells me what to build next. Just hit reply.') +
        paragraph('— Founder, MarketBrain OS'),
      ...lifecycleFooter(d),
    }),
  };
};

/**
 * ONB-D30 — where you are, and what is next.
 *
 * THEIR NUMBERS, NOT OUR PITCH. Three lines of account summary and one next step chosen by
 * what those lines say: somebody who has run nothing needs a different sentence from somebody
 * who has run eleven times, and a single generic "upgrade?" serves neither.
 */
const onboardingMonthOne = (d: {
  firstName?: string; balance?: number; analysisCount?: number; tier?: string; unsubUrl?: string;
}): RenderedEmail => {
  const n = d.analysisCount ?? 0;
  const balance = d.balance ?? 0;
  const paid = String(d.tier || 'free') !== 'free';
  const next = n === 0
    ? paragraph('You have not run anything yet, which usually means the first step felt like work. It does not have to be: paste one URL into Conversion Doctor and the tool does the rest.')
      + button('Audit a page →', `${SITE_URL}/conversion-doctor`, '4 tokens · about a minute')
    : paid
      ? paragraph('If somebody else is reading your exports — a client, a manager, a colleague — Team gives them their own login and a shared library of everything you have run.')
        + button('See what Team adds →', `${SITE_URL}/pricing`)
      : paragraph(`You have ${balance} token${balance === 1 ? '' : 's'} left. They do not refill, but they do not expire either. The highest-value run is usually the one you are avoiding: the page or offer you already suspect is weak.`)
        + button('Pick a tool →', `${SITE_URL}/`);
  return {
    subject: 'One month in — your numbers',
    html: renderEmail({
      preheader: 'A short account summary, and the one next step that fits it.',
      tag: 'Month one',
      heading: 'Thirty days in',
      heroSubtext: 'Your account in two lines, and what to do with it.',
      body:
        paragraph(`Hi${d.firstName ? ` ${esc(d.firstName)}` : ''} — here is where you are:`) +
        metaTable([
          { k: 'Analyses run', v: String(n) },
          { k: 'Tokens remaining', v: String(balance) },
        ]) +
        next,
      ...lifecycleFooter(d),
    }),
  };
};

/**
 * ACT-1 — signed up, ran nothing (48h).
 *
 * The spec's diagnosis is the whole email: people do not start because the first step LOOKS
 * like it needs a brief. So the body is three inputs that need no preparation at all, with
 * their costs, rather than encouragement.
 */
const activationNoRun = (d: { firstName?: string; balance?: number; unsubUrl?: string }): RenderedEmail => ({
  subject: `Your ${d.balance ?? 20} tokens are still untouched`,
  html: renderEmail({
    preheader: 'No brief to write. Paste a URL, get a scored audit.',
    tag: 'Getting started',
    heading: 'One URL is all you need',
    heroSubtext: 'The first step looks like it needs preparation. It does not.',
    body:
      paragraph(`Hi${d.firstName ? ` ${esc(d.firstName)}` : ''} — three inputs that work with zero preparation:`) +
      steps([
        '<b>Your homepage URL</b> → Conversion Doctor (4 tokens). The page is fetched and read for you.',
        "<b>A competitor's page URL</b> → Conversion Doctor again. Compare the two scores.",
        "<b>Two headlines you cannot choose between</b> → TestLab Pro (5 tokens). Paste both.",
      ]) +
      paragraph(`Any one of them takes about a minute and leaves you with most of your ${d.balance ?? 20} tokens.`) +
      button('Paste a URL →', `${SITE_URL}/conversion-doctor`),
    ...lifecycleFooter(d),
  }),
});

/**
 * ACT-2 — one run, no second (72h after the first).
 *
 * THE SECOND RUN IS ACTIVATION (part 03 §6.2), so this is the single highest-leverage email
 * in the sequence. It names the tool they used and the one that pairs with it, because "come
 * back and run something" is advice nobody acts on.
 */
const PAIRINGS: Record<string, string> = {
  ConversionDoctor_Audit: 'Apply one of the rewrites it gave you, then put the old headline against the new one in <b>TestLab Pro</b> (5 tokens).',
  TestLab_Simulation: 'Put the winning variant on the page and run <b>Conversion Doctor</b> on the live URL (4 tokens).',
  AngleMiner_Generate: 'Take your top two angles into <b>TestLab Pro</b> and let it rank them (5 tokens).',
  StrategyLab_Analyze: '<b>Growth Analyzer</b> answers the follow-up: where this grows fastest (5 tokens).',
  AudienceIntel_Analyze: 'Feed the personas into <b>Messaging Analyzer</b> and score your copy against them (3 tokens).',
  OfferAnalyzer_Analyze: 'Run <b>Conversion Doctor</b> on the page that sells the offer — the two findings usually disagree, and that gap is the work.',
};

const activationSecondRun = (d: {
  firstName?: string; lastTool?: string; lastToolLabel?: string; lastScore?: number | null; unsubUrl?: string;
}): RenderedEmail => {
  const pairing = PAIRINGS[String(d.lastTool)] || 'Run the same tool on a competitor and compare the two scores.';
  const label = d.lastToolLabel || 'your first analysis';
  return {
    subject: 'One result is a data point. Two is a direction.',
    html: renderEmail({
      preheader: 'Same input, one change, comparable score. That is the whole method.',
      tag: 'Next step',
      heading: 'The natural next step',
      heroSubtext: `You ran ${esc(label)}${typeof d.lastScore === 'number' ? ` and scored ${d.lastScore}/100` : ''}.`,
      body:
        paragraph(`Hi${d.firstName ? ` ${esc(d.firstName)}` : ''} — one result tells you where you stand. The second tells you whether a change helped, which is the only question that matters.`) +
        callout(pairing, 'From where you are') +
        button('Open your last result →', `${SITE_URL}/history`),
      ...lifecycleFooter(d),
    }),
  };
};


/**
 * ACT-3P — paying for export, never exported.
 *
 * The free-tier twin (ACT-3F) is a pitch to upgrade and is deliberately NOT here: it asks
 * somebody to buy something that cannot be bought yet. It belongs with the rest of the
 * billing-gated mail.
 */
const activationNeverExported = (d: {
  firstName?: string; analysisCount?: number; planName?: string; unsubUrl?: string;
}): RenderedEmail => ({
  subject: 'Your results can leave the app',
  html: renderEmail({
    preheader: 'Turn a saved result into something you can hand to a client or a manager.',
    tag: 'Your plan',
    heading: 'The export button you have not pressed',
    heroSubtext: `${d.analysisCount ?? 0} analyses run, none exported yet.`,
    body:
      paragraph(`Hi${d.firstName ? ` ${esc(d.firstName)}` : ''} — export is the part of ${esc(d.planName || 'your plan')} that turns a result into a deliverable. Three formats, all from the same result:`) +
      featureRows([
        { icon: '📄', title: 'PDF', desc: 'The full report — score, findings, actions — plain enough to forward to a client.' },
        { icon: '📊', title: 'CSV', desc: 'Findings as rows, for a sheet or a task tracker.' },
        { icon: '📝', title: 'TXT', desc: 'Clean text for pasting into a doc or a deck.' },
      ]) +
      paragraph('Open any result in History, or group several with <strong>Save as report</strong> first and export the set together.') +
      button('Export a result →', `${SITE_URL}/history`),
    ...lifecycleFooter(d),
  }),
});

/**
 * INV-1 — the first day inside somebody else's workspace.
 *
 * A member did not choose this product; their employer did. The three things below are the
 * three that cause support questions, in the order they cause them — whose tokens am I
 * spending, where does my work end up, and what am I allowed to do.
 */
const memberFirstSteps = (d: {
  firstName?: string; containerName?: string; containerType?: string; roleLabel?: string; unsubUrl?: string;
}): RenderedEmail => {
  const where = d.containerType === 'agency' ? '/agency' : d.containerType === 'enterprise' ? '/enterprise' : '/team';
  const name = d.containerName || 'your workspace';
  return {
    subject: `You're in ${name} — three things to know`,
    html: renderEmail({
      preheader: 'Where results go, whose tokens you are using, and what your role can do.',
      tag: 'Getting started',
      heading: `Your first day in ${esc(name)}`,
      heroSubtext: d.roleLabel ? `You are a ${esc(d.roleLabel)} here.` : 'Three things that save confusion later.',
      body:
        paragraph(`Hi${d.firstName ? ` ${esc(d.firstName)}` : ''} — three things that save confusion later:`) +
        steps([
          `<b>Whose tokens.</b> Analyses you run inside ${esc(name)} draw on its shared balance, not a personal plan. You never need to buy anything.`,
          `<b>Where results go.</b> Anything you run with the scope switcher set to ${esc(name)} is visible to the rest of the team. Set it to <b>Personal</b> for scratch work.`,
          '<b>What your role can do.</b> Roles decide who can invite people, change budgets and remove members. If something is greyed out, that is why.',
        ]) +
        button(`Open ${name} →`, `${SITE_URL}${where}`),
      ...lifecycleFooter(d),
    }),
  };
};

/** INV-2 — three days in, nothing run. The easiest start is to copy a colleague. */
const memberFirstRun = (d: {
  firstName?: string; containerName?: string; containerType?: string; unsubUrl?: string;
}): RenderedEmail => {
  const where = d.containerType === 'agency' ? '/agency' : d.containerType === 'enterprise' ? '/enterprise' : '/team';
  const name = d.containerName || 'your workspace';
  return {
    subject: `Your first run in ${name}`,
    html: renderEmail({
      preheader: 'Follow a teammate: same tool, your own input, directly comparable.',
      tag: 'Getting started',
      heading: 'The easiest start is somebody else’s',
      heroSubtext: `Three days in ${esc(name)} and nothing run yet.`,
      body:
        paragraph(`Hi${d.firstName ? ` ${esc(d.firstName)}` : ''} — open the shared library, find the most recent result somebody ran, and run the same tool on your own page, offer or copy.`) +
        paragraph('Same structure means the two are directly comparable, which is most of the point of doing this in a team rather than in separate chat windows.') +
        paragraph('It costs a few tokens from the shared pool. Nobody is watching the meter that closely.') +
        button('Open the shared library →', `${SITE_URL}${where}`),
      ...lifecycleFooter(d),
    }),
  };
};

/**
 * WB-30 — a month quiet.
 *
 * NO CHANGELOG BULLETS. The spec fills this with "what shipped while you were away", from a
 * list somebody maintains by hand in admin settings. A list nobody updates becomes an email
 * that says "Since then:" followed by nothing, which is worse than not mentioning it.
 */
const winBack30 = (d: {
  firstName?: string; balance?: number; analysisCount?: number; paid?: boolean; planName?: string; unsubUrl?: string;
}): RenderedEmail => {
  const balance = d.balance ?? 0;
  return {
    subject: d.paid
      ? `You have ${balance} tokens you have not touched`
      : 'Your results are still here',
    html: renderEmail({
      preheader: 'The fastest way back in is the thing you changed most recently.',
      tag: 'A month on',
      heading: 'It has been a month',
      heroSubtext: d.paid
        ? `${esc(d.planName || 'Your plan')} has been adding tokens the whole time — ${balance} are waiting.`
        : `Your ${balance} tokens and ${d.analysisCount ?? 0} saved result${(d.analysisCount ?? 0) === 1 ? '' : 's'} are where you left them.`,
      body:
        paragraph(`Hi${d.firstName ? ` ${esc(d.firstName)}` : ''} — no pitch. If you are back, the fastest re-entry is whatever you have changed most recently: a page, an offer, a pitch. Paste it in and see where it scores.`) +
        button('Open your history →', `${SITE_URL}/history`),
      ...lifecycleFooter(d),
    }),
  };
};

/** WB-60 — one concrete thing to run, not a "we miss you". */
const winBack60 = (d: { firstName?: string; balance?: number; unsubUrl?: string }): RenderedEmail => {
  const balance = d.balance ?? 0;
  return {
    subject: 'One page. Four tokens. Two minutes.',
    html: renderEmail({
      preheader: 'Not a "we miss you" — one specific audit to run on something you already have.',
      tag: 'A suggestion',
      heading: 'One specific thing',
      heroSubtext: 'No "we miss you". A suggestion instead.',
      body:
        paragraph(`Hi${d.firstName ? ` ${esc(d.firstName)}` : ''} — take the page you are most uneasy about. The one where traffic arrives and nothing happens.`) +
        paragraph(`Run Conversion Doctor on the live URL. It costs 4 tokens${balance > 0 ? ` and you have ${balance}` : ''}, and you get the blockers ranked with a rewrite for each.`) +
        (balance > 0
          ? button('Audit that page →', `${SITE_URL}/conversion-doctor`)
          /* At zero there is nothing honest to offer yet: buying is not live. Say so rather
             than sending somebody to a button that cannot complete. */
          : paragraph('Your balance is at zero, so this one is on hold until top-ups open. Nothing you saved has gone anywhere in the meantime.')) +
        paragraph('If the result is not worth two minutes, reply and say so. I would rather hear that than nothing.'),
      ...lifecycleFooter(d),
    }),
  };
};

/**
 * WB-90 — the last one.
 *
 * It says it is the last one, so it has to BE the last one: the dispatcher records a
 * dormant pause after this send and nothing further goes out until they sign in again. An
 * email that promises silence and then keeps mailing is the one that earns a complaint.
 */
const winBack90 = (d: { firstName?: string; unsubUrl?: string }): RenderedEmail => ({
  subject: 'Should I stop emailing?',
  html: renderEmail({
    preheader: 'After this we go quiet. Your account and results stay.',
    tag: 'Last one',
    heading: 'Closing the loop',
    heroSubtext: 'Three months without a run, so this is the last one.',
    body:
      paragraph(`Hi${d.firstName ? ` ${esc(d.firstName)}` : ''} — I will assume this was not the right fit, and this is the last of these you will get.`) +
      paragraph('Your account and every saved result stay exactly where they are. Sign in whenever and things pick up again.') +
      paragraph('If you have thirty seconds: was it the tools, the price, the timing, or something else? Two words help more than you would think — just reply.') +
      paragraph('— Founder, MarketBrain OS'),
    ...lifecycleFooter(d),
  }),
});

/**
 * NPS-1 — one number.
 *
 * ELEVEN LINKS, NOT A FORM. The score is captured by the click itself, because a survey
 * that needs a page to load before it records anything measures who has patience, not who
 * would recommend. Each link carries the same signed token the unsubscribe link uses.
 */
const npsAsk = (d: { firstName?: string; npsUrls?: string[]; unsubUrl?: string }): RenderedEmail => {
  const urls = Array.isArray(d.npsUrls) ? d.npsUrls : [];
  const scale = urls.length === 11
    ? `<p style="font-size:18px;line-height:2;margin:0 0 8px;">${urls
        .map((u, n) => `<a href="${esc(u)}" style="color:${RED};font-weight:700;text-decoration:none;padding:0 6px;">${n}</a>`)
        .join('·')}</p><p style="font-size:12px;color:#9a9a9a;margin:0;">Click a number — that is the whole survey.</p>`
    : '';
  return {
    subject: 'One number, 0 to 10',
    html: renderEmail({
      preheader: 'One click. A comment is optional and read by the founder.',
      tag: 'One question',
      heading: 'How likely are you to recommend us?',
      heroSubtext: 'To somebody who makes marketing decisions.',
      body:
        paragraph(`Hi${d.firstName ? ` ${esc(d.firstName)}` : ''} — one number, nothing else:`) +
        scale +
        paragraph('If you want to say why, there is a box on the next page. I read every one.') +
        paragraph('— Founder, MarketBrain OS'),
      ...lifecycleFooter(d),
    }),
  };
};

export const EMAIL_TEMPLATES = {
  welcome, verifyEmail, passwordReset, passwordChanged, memberInvite, memberAdded,
  tokenReceipt, subscriptionUpgraded, paymentReceipt,
  lowBalance, outOfTokens, renewalReminder, subscriptionRenewed, paymentFailed,
  subscriptionCancelled, expansionPurchased, refundIssued, newSignIn,
  memberBudgetExhausted, ownershipTransferred, briefingReady, accountSuspended, accountReinstated,
  accountDeleted,
  onboardingWhyNotChatgpt, onboardingWeekOne,
  onboardingHowToRead, onboardingFounderQuestion, onboardingMonthOne,
  activationNoRun, activationSecondRun, activationNeverExported,
  memberFirstSteps, memberFirstRun,
  winBack30, winBack60, winBack90, npsAsk,
} as const;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;

/**
 * WHICH KEYS ARE MARKETING MAIL. `sendTemplate` refuses to send any of these without a
 * working unsubscribe link, so this set is the one place that decides which mail is
 * subject to that rule — and anything not listed here is transactional by default, which
 * is the right default: an unsubscribe control on a receipt is worse than none.
 */
export const MARKETING_KEYS: ReadonlySet<EmailTemplateKey> = new Set<EmailTemplateKey>([
  'onboardingWhyNotChatgpt', 'onboardingWeekOne',
  'onboardingHowToRead', 'onboardingFounderQuestion', 'onboardingMonthOne',
  'activationNoRun', 'activationSecondRun', 'activationNeverExported',
  'memberFirstSteps', 'memberFirstRun',
  'winBack30', 'winBack60', 'winBack90', 'npsAsk',
]);
