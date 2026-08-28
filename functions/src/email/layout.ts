// Branded, email-client-safe HTML layout + reusable content components. Every template renders
// through renderEmail() so the header/hero/footer/button system stays consistent across all emails.
// Styles are inlined (email clients strip <style>); layout uses simple blocks + tables.

export const SITE_URL = 'https://www.marketbrainos.app';
export const RED = '#FF0000';
export const DARK = '#0B0B0B';

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const url = (path: string) => (path.startsWith('http') ? path : `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`);

// --- Content components (return HTML strings) ---------------------------------------------------

export const button = (label: string, href: string, sub?: string): string => `
  <div style="margin:8px 0 4px;">
    <a href="${esc(href)}" style="display:inline-block;background:${RED};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:15px 32px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${esc(label)}</a>
  </div>
  ${sub ? `<p style="font-size:12px;color:#9a9a9a;margin:10px 0 0;">${esc(sub)}</p>` : ''}`;

export const sectionHeading = (text: string): string => `
  <h3 style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.16em;color:${DARK};margin:30px 0 4px;">${esc(text)}</h3>
  <span style="display:inline-block;width:26px;height:2px;background:${RED};border-radius:2px;margin-bottom:14px;"></span>`;

export const paragraph = (html: string): string =>
  `<p style="font-size:15px;line-height:1.65;color:#4b4b4b;margin:0 0 16px;">${html}</p>`;

export const featureRows = (items: { icon: string; title: string; desc: string }[]): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
    ${items.map((it) => `
    <tr>
      <td style="padding:11px 0;vertical-align:top;border-bottom:1px solid #f2f2f2;width:46px;">
        <span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:9px;background:#FFECEC;color:${RED};font-size:16px;">${it.icon}</span>
      </td>
      <td style="padding:11px 0;vertical-align:top;border-bottom:1px solid #f2f2f2;">
        <p style="font-size:14px;font-weight:700;color:${DARK};margin:0 0 2px;">${esc(it.title)}</p>
        <p style="font-size:13px;color:#7a7a7a;margin:0;line-height:1.5;">${esc(it.desc)}</p>
      </td>
    </tr>`).join('')}
  </table>`;

export const steps = (items: string[]): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
    ${items.map((s, i) => `
    <tr>
      <td style="padding:8px 0;vertical-align:top;width:34px;">
        <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:${DARK};color:#fff;font-size:12px;font-weight:800;">${i + 1}</span>
      </td>
      <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#3a3a3a;line-height:1.5;">${s}</td>
    </tr>`).join('')}
  </table>`;

export const checklist = (items: string[]): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
    ${items.map((it) => `
    <tr>
      <td style="padding:7px 0;vertical-align:top;width:26px;color:${RED};font-weight:800;font-size:15px;">&#10003;</td>
      <td style="padding:7px 0;vertical-align:top;font-size:14px;color:#3a3a3a;line-height:1.5;">${esc(it)}</td>
    </tr>`).join('')}
  </table>`;

export const callout = (html: string, title = 'Tip'): string => `
  <div style="background:#FFF6F6;border:1px solid #ffe0e0;border-left:3px solid ${RED};border-radius:10px;padding:14px 16px;margin:20px 0;">
    <p style="font-size:13px;color:#5a5a5a;margin:0;line-height:1.55;"><b style="color:${DARK};">${esc(title)}:</b> ${html}</p>
  </div>`;

export const metaTable = (rows: { k: string; v: string; total?: boolean }[]): string => `
  <div style="background:#FAFAFA;border:1px solid #f0f0f0;border-radius:12px;padding:6px 18px;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${rows.map((r, i) => `
      <tr>
        <td style="font-size:${r.total ? '15px' : '13px'};color:${r.total ? DARK : '#8a8a8a'};font-weight:${r.total ? '800' : '400'};padding:9px 0;${i < rows.length - 1 ? 'border-bottom:1px solid #f1f1f1;' : ''}">${esc(r.k)}</td>
        <td style="font-size:${r.total ? '15px' : '13px'};color:${DARK};font-weight:${r.total ? '800' : '700'};text-align:right;padding:9px 0;${i < rows.length - 1 ? 'border-bottom:1px solid #f1f1f1;' : ''}">${esc(r.v)}</td>
      </tr>`).join('')}
    </table>
  </div>`;

export const balanceCard = (label: string, value: string): string => `
  <div style="background:${DARK};border-radius:12px;padding:16px 20px;margin:16px 0 4px;">
    <p style="font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#8a8a8a;margin:0;">${esc(label)}</p>
    <p style="font-size:22px;font-weight:800;color:#fff;margin:2px 0 0;">${esc(value)}</p>
  </div>`;

export const codeBlock = (value: string): string => `
  <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:700;color:${DARK};background:#F4F4F5;border:1px dashed #d4d4d8;border-radius:10px;padding:14px 16px;text-align:center;letter-spacing:.08em;margin:6px 0 4px;">${esc(value)}</div>`;

export const divider = (): string => `<hr style="height:1px;background:#eee;margin:28px 0;border:0;" />`;

// --- Full email shell ---------------------------------------------------------------------------

export interface EmailLayout {
  preheader: string;      // hidden inbox-preview text
  tag: string;            // small pill label (Welcome, Receipt, Invitation…)
  heading: string;        // hero headline (may contain safe inline HTML like a colored span)
  heroSubtext: string;    // hero paragraph
  body: string;           // composed component HTML
  footerLinks?: { label: string; href: string }[];
  footerNote?: string;    // small print under the links
}

export const renderEmail = (o: EmailLayout): string => {
  const links = (o.footerLinks || [])
    .map((l) => `<a href="${esc(l.href)}" style="font-size:12px;font-weight:700;color:${DARK};text-decoration:none;margin-right:18px;">${esc(l.label)}</a>`)
    .join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f1f1f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f1f3;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:${DARK};padding:24px 34px;">
    <span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:9px;background:${RED};color:#fff;font-weight:800;font-size:16px;vertical-align:middle;">M</span>
    <span style="color:#fff;font-size:13px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;vertical-align:middle;margin-left:12px;">MarketBrain&nbsp;OS</span>
  </td></tr>
  <tr><td style="background:${DARK};padding:6px 34px 30px;">
    <span style="display:inline-block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;padding:5px 11px;border-radius:999px;background:rgba(255,0,0,.16);color:#ff5a5a;">${esc(o.tag)}</span>
    <h1 style="font-size:25px;line-height:1.22;font-weight:800;color:#ffffff;margin:16px 0 10px;">${o.heading}</h1>
    <p style="font-size:15px;line-height:1.6;color:#b8b8b8;margin:0;">${esc(o.heroSubtext)}</p>
  </td></tr>
  <tr><td style="padding:30px 34px 6px;">${o.body}</td></tr>
  <tr><td style="padding:26px 34px 32px;background:#FAFAFA;border-top:1px solid #f0f0f0;">
    <div style="margin-bottom:12px;">
      <span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;border-radius:5px;background:${RED};color:#fff;font-size:11px;font-weight:800;vertical-align:middle;">M</span>
      <span style="font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:${DARK};vertical-align:middle;margin-left:8px;">MarketBrain&nbsp;OS</span>
    </div>
    ${links ? `<div style="margin-bottom:14px;">${links}</div>` : ''}
    ${o.footerNote ? `<p style="font-size:11px;line-height:1.6;color:#9a9a9a;margin:0 0 6px;">${o.footerNote}</p>` : ''}
    <p style="font-size:11px;line-height:1.6;color:#9a9a9a;margin:0;">Questions? Just reply — a real person reads it. &middot; <a href="${SITE_URL}/settings" style="color:#9a9a9a;">Email preferences</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
};

export const FOOTER_LINKS = [
  { label: 'Dashboard', href: SITE_URL },
  { label: 'Documentation', href: `${SITE_URL}/documentation` },
  { label: 'Pricing', href: `${SITE_URL}/pricing` },
  { label: 'Support', href: `${SITE_URL}/support` },
];
