// Fetches a user-supplied page so Conversion Doctor can audit what is actually on it.
//
// Until now nothing here fetched anything: the audit prompt received the URL *string* as if it were
// the page copy, so the model invented an audit and the UI stamped the real URL on it. This module is
// what makes the claim true.
//
// Fetching user-supplied URLs re-introduces SSRF, which a security review had previously confirmed
// this codebase was free of precisely because it made no outbound requests. The guard below is
// therefore the important half of this file, not the fetching.
//
// Node 22 runtime: global fetch, dns/promises and AbortSignal.timeout are built in, so no new
// dependency is added for any of this.

import { promises as dns } from 'node:dns';

export const MAX_PAGE_CHARS = 16_000;
const MAX_BYTES = 2 * 1024 * 1024;   // 2MB
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
/** Below this much visible copy we cannot honestly audit the page (usually an unrendered SPA shell). */
export const MIN_USEFUL_CHARS = 200;

const UA = 'MarketBrainOS-ConversionDoctor/1.0 (+https://www.marketbrainos.app; page audit requested by a signed-in user)';

/** Reasons are surfaced to the user verbatim, so they must read as plain English. */
export class PageFetchError extends Error {
  constructor(message: string, readonly kind: 'blocked' | 'unreachable' | 'unusable') {
    super(message);
    this.name = 'PageFetchError';
  }
}

// ---------------------------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------------------------

const ipv4ToInt = (ip: string): number | null => {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
};

const V4_BLOCKS: Array<[string, number, string]> = [
  ['0.0.0.0', 8, 'unspecified'],
  ['10.0.0.0', 8, 'private'],
  ['100.64.0.0', 10, 'carrier-grade NAT'],
  ['127.0.0.0', 8, 'loopback'],
  ['169.254.0.0', 16, 'link-local (cloud metadata)'],
  ['172.16.0.0', 12, 'private'],
  ['192.0.0.0', 24, 'reserved'],
  ['192.168.0.0', 16, 'private'],
  ['198.18.0.0', 15, 'benchmarking'],
  ['224.0.0.0', 4, 'multicast'],
  ['240.0.0.0', 4, 'reserved'],
];

/**
 * Expands any IPv6 text form (RFC 4291 s2.2, including `::` compression, an embedded dotted IPv4
 * tail and a zone id) to eight hextets. Returns null for anything that is not a valid literal.
 *
 * A parser rather than string matching, because WHATWG URL re-serialises IPv6 hosts before this
 * code sees them: `http://[::ffff:169.254.169.254]/` arrives as `[::ffff:a9fe:a9fe]`, which the
 * previous dotted-quad regex could not recognise as the cloud metadata address. That was a bypass.
 */
const parseIpv6 = (addr: string): number[] | null => {
  let text = addr.toLowerCase().replace(/%.*$/, '');
  const v4 = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = ipv4ToInt(v4[2]);
    if (n === null) return null;
    text = `${v4[1]}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const hextets = [...head, ...Array(Math.max(fill, 0)).fill('0'), ...tail];
  if (hextets.length !== 8) return null;
  const out: number[] = [];
  for (const h of hextets) {
    if (!/^[0-9a-f]{1,4}$/.test(h)) return null;
    out.push(parseInt(h, 16));
  }
  return out;
};

const dotted = (hi: number, lo: number): string => `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;

/**
 * The IPv4 address an IPv6 literal really points at, for the transition forms that route to IPv4:
 * IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible (::a.b.c.d), SIIT (::ffff:0:a.b.c.d), NAT64
 * (64:ff9b::a.b.c.d) and 6to4 (2002:AABB:CCDD::). Null when the address is native IPv6.
 */
const embeddedIpv4 = (h: number[]): string | null => {
  const zeroThrough = (n: number) => h.slice(0, n).every((x) => x === 0);
  if (zeroThrough(5) && h[5] === 0xffff) return dotted(h[6], h[7]);                 // ::ffff:a.b.c.d
  if (zeroThrough(4) && h[4] === 0xffff && h[5] === 0) return dotted(h[6], h[7]);   // ::ffff:0:a.b.c.d
  if (zeroThrough(6) && (h[6] !== 0 || h[7] !== 0)) return dotted(h[6], h[7]);      // ::a.b.c.d (not :: / ::1)
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) return dotted(h[6], h[7]); // 64:ff9b::/96 (NAT64)
  if (h[0] === 0x2002) return dotted(h[1], h[2]);                                    // 2002::/16
  return null;
};

/**
 * True when an IP literal points somewhere we must never fetch. 169.254.169.254 (the cloud metadata
 * endpoint) is the one that matters most: reaching it from a server would expose instance credentials.
 */
export const isBlockedIp = (ip: string): { blocked: boolean; reason?: string } => {
  const addr = ip.trim().replace(/^\[|\]$/g, '');

  if (addr.includes(':')) {
    const h = parseIpv6(addr);
    if (!h) return { blocked: true, reason: 'unparseable address' };
    if (h.every((x) => x === 0)) return { blocked: true, reason: 'unspecified' };
    if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return { blocked: true, reason: 'loopback' };
    // Anything that is really an IPv4 destination is judged as that IPv4 address.
    const v4 = embeddedIpv4(h);
    if (v4) {
      const inner = isBlockedIp(v4);
      return inner.blocked ? { blocked: true, reason: `${inner.reason} (embedded IPv4 ${v4})` } : { blocked: false };
    }
    if ((h[0] & 0xfe00) === 0xfc00) return { blocked: true, reason: 'unique local' };   // fc00::/7
    if ((h[0] & 0xffc0) === 0xfe80) return { blocked: true, reason: 'link-local' };     // fe80::/10
    if ((h[0] & 0xff00) === 0xff00) return { blocked: true, reason: 'multicast' };      // ff00::/8
    // Default deny outside global unicast (2000::/3): every other block is reserved or special.
    if ((h[0] & 0xe000) !== 0x2000) return { blocked: true, reason: 'reserved' };
    return { blocked: false };
  }

  const n = ipv4ToInt(addr);
  if (n === null) return { blocked: true, reason: 'unparseable address' };
  for (const [base, bits, reason] of V4_BLOCKS) {
    const b = ipv4ToInt(base)!;
    const mask = bits === 0 ? 0 : (-1 << (32 - bits)) >>> 0;
    if ((n & mask) >>> 0 === (b & mask) >>> 0) return { blocked: true, reason };
  }
  return { blocked: false };
};

/**
 * Validates a single URL: scheme, then every IP its hostname resolves to.
 *
 * Residual risk, stated rather than papered over: we validate the resolved address and then fetch by
 * hostname, so a DNS-rebinding attacker could return a public IP here and a private one to the actual
 * connection. Closing that fully means connecting to the pinned IP with a manual Host header, which
 * breaks TLS certificate validation. This covers the realistic attack surface, including the
 * public-hostname-resolving-to-private case, which the per-hop revalidation below also re-checks.
 */
export const assertSafeUrl = async (raw: string, resolver: (h: string) => Promise<string[]> = defaultResolve): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PageFetchError('That does not look like a valid URL.', 'blocked');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new PageFetchError(`Only http and https addresses can be audited (got "${url.protocol.replace(':', '')}").`, 'blocked');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');

  // A bare IP literal needs no DNS round trip.
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    const v = isBlockedIp(host);
    if (v.blocked) throw new PageFetchError(`That address is not publicly reachable (${v.reason}).`, 'blocked');
    return url;
  }
  if (host.toLowerCase() === 'localhost' || host.toLowerCase().endsWith('.localhost')) {
    throw new PageFetchError('That address is not publicly reachable (loopback).', 'blocked');
  }

  let ips: string[];
  try {
    ips = await resolver(host);
  } catch {
    throw new PageFetchError(`Could not find a server for "${host}".`, 'unreachable');
  }
  if (!ips.length) throw new PageFetchError(`Could not find a server for "${host}".`, 'unreachable');

  for (const ip of ips) {
    const v = isBlockedIp(ip);
    if (v.blocked) throw new PageFetchError(`"${host}" resolves to a private address (${v.reason}), which cannot be audited.`, 'blocked');
  }
  return url;
};

const defaultResolve = async (host: string): Promise<string[]> => {
  const records = await dns.lookup(host, { all: true, verbatim: true });
  return records.map((r) => r.address);
};

// ---------------------------------------------------------------------------------------------
// HTML -> readable text
// ---------------------------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '-', ndash: '-', hellip: '...', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', middot: '.',
};

const decode = (s: string): string =>
  s.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
   .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
   .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[String(name).toLowerCase()] ?? m);

/** Flattens a page to the copy a visitor would actually read, plus the title and meta description. */
export const htmlToText = (html: string): string => {
  // Comments come out FIRST. This project's own index.html carries a comment that mentions `<title>`,
  // and reading the title before stripping comments captured that commentary instead of the real
  // title - caught by fetching a live page rather than a fixture.
  const clean = html.replace(/<!--[\s\S]*?-->/g, ' ');

  const title = decode((clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')).trim();
  const desc = decode((clean.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)/i)?.[1] || '')).trim();

  let body = clean;
  // Prefer the main content region when the page marks one; it strips nav/footer boilerplate for free.
  const main = body.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i);
  if (main && main[2].length > 400) body = main[2];

  body = body
    .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|section|li|tr|h[1-6]|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const text = decode(body).replace(/[ \t\f\v]+/g, ' ').replace(/\n\s*\n\s*/g, '\n').trim();

  return [
    title && `Page title: ${title}`,
    desc && `Meta description: ${desc}`,
    text,
  ].filter(Boolean).join('\n\n').slice(0, MAX_PAGE_CHARS);
};

// ---------------------------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------------------------

export interface FetchedPage {
  /** The URL actually read, after redirects. The UI labels the report with this, not with raw input. */
  finalUrl: string;
  text: string;
}

/**
 * Fetches and flattens a page, revalidating the destination at every redirect hop.
 *
 * Redirects are followed manually rather than by fetch's own `redirect: 'follow'` because a public URL
 * redirecting to an internal address is the standard SSRF bypass - the guard has to run again on each
 * new location, which automatic following gives no opportunity to do.
 */
export const fetchPageText = async (raw: string): Promise<FetchedPage> => {
  let current = await assertSafeUrl(raw);
  // One deadline for the whole operation, not per hop: four hops at 15s each would otherwise let a
  // slow redirect chain eat a minute of the 300s function budget before Gemini is even called.
  const deadline = Date.now() + TIMEOUT_MS;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new PageFetchError('That page took too long to respond (15s).', 'unreachable');
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(remaining),
        headers: { 'User-Agent': UA, Accept: 'text/html,text/plain;q=0.9,*/*;q=0.1' },
      });
    } catch (e: any) {
      const timedOut = e?.name === 'TimeoutError' || /abort/i.test(String(e?.message));
      throw new PageFetchError(
        timedOut ? 'That page took too long to respond (15s).' : `Could not reach that page (${e?.message || 'network error'}).`,
        'unreachable');
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new PageFetchError(`That page returned a ${res.status} with no destination.`, 'unreachable');
      if (hop === MAX_REDIRECTS) throw new PageFetchError('That page redirected too many times.', 'unreachable');
      current = await assertSafeUrl(new URL(loc, current).toString());
      continue;
    }

    if (!res.ok) {
      throw new PageFetchError(`That page returned ${res.status}${res.statusText ? ` ${res.statusText}` : ''}.`, 'unreachable');
    }

    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (!type.includes('text/html') && !type.includes('text/plain') && type !== '') {
      throw new PageFetchError(`That link is ${type.split(';')[0]}, not a web page.`, 'unusable');
    }

    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) throw new PageFetchError('That page is too large to audit (over 2MB).', 'unusable');

    // Read at most MAX_BYTES off the wire. `res.text()` buffered the whole body first - a chunked
    // response with no content-length could have filled the function's memory before the slice.
    const raw_html = await readCapped(res, MAX_BYTES);
    const text = htmlToText(raw_html);

    if (text.replace(/\s/g, '').length < MIN_USEFUL_CHARS) {
      throw new PageFetchError(
        'That page returned almost no readable text - either it is very short, or its content is ' +
        'rendered by JavaScript after load. Paste the page copy directly and the audit will run on that.',
        'unusable');
    }

    return { finalUrl: current.toString(), text };
  }

  throw new PageFetchError('That page redirected too many times.', 'unreachable');
};

/** Reads the body up to `max` bytes and stops pulling from the socket after that. */
const readCapped = async (res: Response, max: number): Promise<string> => {
  const reader = res.body?.getReader();
  if (!reader) return (await res.text()).slice(0, max);
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
    total += value.byteLength;
    if (total >= max) { await reader.cancel().catch(() => undefined); break; }
  }
  return Buffer.concat(chunks).subarray(0, max).toString('utf8');
};

/** Mirrors detectMode in pages/ConversionDoctor.tsx - a single token containing a dot is a URL. */
export const looksLikeUrl = (s: string): boolean => {
  const t = (s || '').trim();
  return !!t && !/\s/.test(t) && t.includes('.');
};
