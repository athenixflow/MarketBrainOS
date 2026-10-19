import { DEFAULT_PRICING_CONFIG } from '../config/pricingConfig';
import { toMillis } from './time';

/**
 * ONE READER FOR A `payments` DOCUMENT.
 *
 * Two shapes live in the collection. Bachs writes what it charged in MINOR units with its currency
 * (`amount_minor`, `currency`, `kind`, `item`, `bachs_reference` or `bachs_invoice_id`), and so
 * does the admin refund. The retired provider wrote whole US dollars (`amount_paid`,
 * `payment_reference`, `type`). Every page used to read the old shape, so a ₦9,900 pass showed as
 * "Token top-up · Ref: N/A · $" and Bachs revenue summed to $0.
 *
 * So no page reads a payment's fields itself: paymentView reads the Bachs shape first and falls back
 * to the old one, and sums stay per currency — naira is never added to dollars
 * (scripts/grants.test.ts fails the build if a client file reads `amount_paid` or
 * `payment_reference` anywhere but here). Pure, no Firebase: scripts/bachs.test.ts loads it.
 */

export type PayCurrency = 'USD' | 'NGN';
export type PaymentKind = 'plan' | 'pass' | 'pack' | 'refund' | 'expansion';

export interface PaymentView {
  label: string;
  /** Signed: a refund is negative. Cents for USD, kobo for NGN. */
  amountMinor: number;
  currency: PayCurrency;
  /** "$19.00", "₦9,900", "−$19.00". */
  display: string;
  /** '' when the record carries none. */
  reference: string;
  date: Date | null;
  status: string;
  kind: PaymentKind;
}

export type CurrencySums = Record<PayCurrency, number>;

const title = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Minor units → display. Naira is whole (as Nigerians read prices) unless there are kobo. */
export const formatMinor = (minor: number, currency: PayCurrency): string => {
  const m = Math.round(Number(minor) || 0);
  const sign = m < 0 ? '−' : '';
  const abs = Math.abs(m);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const cents = String(abs % 100).padStart(2, '0');
  if (currency === 'NGN') return `${sign}₦${whole}${abs % 100 ? `.${cents}` : ''}`;
  return `${sign}$${whole}.${cents}`;
};

/** Minor units → an exact major decimal string ("9900.00", "-19.00"), for exports. */
export const majorString = (minor: number): string => {
  const m = Math.round(Number(minor) || 0);
  const abs = Math.abs(m);
  return `${m < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
};

/** A typed amount ("19.99", "9900") → minor units, exactly; anything else (three decimals, a sign, text) → null. */
export const parseMajor = (typed: string): number | null => {
  const m = String(typed).trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0'));
};

const toDate = (v: unknown): Date | null => {
  const ms = toMillis(v);
  return ms > 0 ? new Date(ms) : null;
};

/** "Starter Pack" — the pack's own name, else "Token pack: <id>". */
const packLabel = (item: string): string =>
  DEFAULT_PRICING_CONFIG.tokenPacks.find((p) => p.id === item)?.label || (item ? `Token pack: ${title(item)}` : 'Token pack');

export const paymentView = (doc: object): PaymentView => {
  const p = doc as Record<string, unknown>;
  const date = toDate(p.created_at);

  /* The Bachs shape: minor units, as charged, with the currency. */
  if (typeof p.amount_minor === 'number' && Number.isFinite(p.amount_minor)) {
    const currency: PayCurrency = text(p.currency).toUpperCase() === 'NGN' ? 'NGN' : 'USD';
    const kind: PaymentKind = (['plan', 'pass', 'pack', 'refund', 'expansion'] as const).find((k) => k === p.kind) ?? 'pack';
    const item = text(p.item);
    const label = kind === 'plan' ? `${title(item) || 'Subscription'} plan, monthly`
      : kind === 'pass' ? `${title(item) || 'Naira'} pass, 30 days`
        : kind === 'refund' ? 'Refund'
          : kind === 'expansion' ? `Expansion: ${text(p.expansion_type) || 'capacity'}`
            : packLabel(item);
    const amountMinor = Math.round(p.amount_minor);
    return {
      label, amountMinor, currency, display: formatMinor(amountMinor, currency),
      reference: text(p.bachs_reference) || text(p.bachs_invoice_id) || text(p.reference),
      date, status: text(p.status) || 'success', kind,
    };
  }

  /* The retired provider's shape: whole US dollars. */
  const type = text(p.type);
  const dollars = Number(p.amount_paid);
  const amountMinor = Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
  const kind: PaymentKind = type === 'refund' ? 'refund' : type === 'expansion' ? 'expansion' : type === 'subscription' ? 'plan' : 'pack';
  const label = type === 'refund' ? 'Refund'
    : type === 'expansion' ? `Expansion: ${text(p.expansion_type) || 'capacity'}`
      : type === 'subscription' ? 'Subscription'
        : type === 'token_pack' ? 'Token pack'
          : 'Token top-up';
  return {
    label, amountMinor, currency: 'USD', display: formatMinor(amountMinor, 'USD'),
    reference: text(p.payment_reference), date, status: text(p.status) || 'completed', kind,
  };
};

/** Per-currency totals in minor units. Never one number: ₦ and $ do not add. */
export const sumByCurrency = (views: PaymentView[]): CurrencySums =>
  views.reduce<CurrencySums>((s, v) => ({ ...s, [v.currency]: s[v.currency] + v.amountMinor }), { USD: 0, NGN: 0 });

/** "$19.00 · ₦9,900" — both currencies, side by side. */
export const formatSums = (s: CurrencySums): string => `${formatMinor(s.USD, 'USD')} · ${formatMinor(s.NGN, 'NGN')}`;

/** The old token top-up ACTION LOG (not a payment) carried its price in dollars. */
export const topUpLogPrice = (log: object, fallbackUsd: number): string => {
  const dollars = Number((log as Record<string, unknown>).amount_paid);
  return formatMinor(Math.round((Number.isFinite(dollars) ? dollars : fallbackUsd) * 100), 'USD');
};

/** Billing history as CSV rows: the amount in major units, converted exactly, beside its currency. */
export const paymentCsvRows = (records: object[]): (string | number)[][] => {
  const rows: (string | number)[][] = [['Date', 'Reference', 'Type', 'Amount', 'Currency', 'Tokens', 'Provider', 'Status']];
  records.forEach((doc) => {
    const p = doc as Record<string, unknown>;
    const v = paymentView(doc);
    const tokens = Number(p.tokens_credited);
    rows.push([
      v.date ? v.date.toISOString() : '',
      v.reference,
      v.kind,
      majorString(v.amountMinor),
      v.currency,
      Number.isFinite(tokens) ? tokens : '',
      text(p.provider),
      v.status,
    ]);
  });
  return rows;
};
