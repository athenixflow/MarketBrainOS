// Guards the URL fetcher that Conversion Doctor uses to read a page before auditing it.
//
// Fetching user-supplied URLs re-introduced SSRF into a codebase a security review had confirmed was
// free of it (precisely because it made no outbound requests). These assertions are the compensating
// control, so they matter more than the fetching itself.
//
//   npx tsx scripts/fetchpage.test.ts
//
// Wired into `npm run build`.

import { isBlockedIp, assertSafeUrl, htmlToText, looksLikeUrl, PageFetchError, MIN_USEFUL_CHARS }
  from '../functions/src/fetchPage';

let fail = 0;
const ok = (cond: boolean, name: string, detail = '') => {
  if (!cond) { fail++; console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
  else console.log(`PASS  ${name}`);
};

// A resolver stub keeps these assertions offline and deterministic: no test should depend on DNS.
const stubResolver = (map: Record<string, string[]>) => async (host: string) => {
  if (!(host in map)) throw new Error('NXDOMAIN');
  return map[host];
};

console.log('\nBLOCKED IP RANGES (must all be refused):');
for (const [ip, why] of [
  ['127.0.0.1', 'loopback'],
  ['0.0.0.0', 'unspecified'],
  ['10.1.2.3', 'private'],
  ['172.16.5.4', 'private'],
  ['172.31.255.255', 'private (upper bound of /12)'],
  ['192.168.1.1', 'private'],
  ['169.254.169.254', 'CLOUD METADATA — the one that leaks instance credentials'],
  ['100.64.0.1', 'carrier-grade NAT'],
  ['::1', 'IPv6 loopback'],
  ['fd00::1', 'IPv6 unique-local'],
  ['fe80::1', 'IPv6 link-local'],
  ['::ffff:127.0.0.1', 'IPv4-mapped loopback (the sneaky one)'],
  ['::ffff:169.254.169.254', 'IPv4-mapped metadata'],
] as const) {
  ok(isBlockedIp(ip).blocked, `blocks ${ip} (${why})`);
}

console.log('\nPUBLIC IPs (must be allowed, or the tool is useless):');
for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '2606:4700::1111']) {
  ok(!isBlockedIp(ip).blocked, `allows ${ip}`, isBlockedIp(ip).reason);
}

console.log('\nURL VALIDATION:');
const publicDns = stubResolver({ 'example.com': ['93.184.216.34'], 'evil.test': ['169.254.169.254'] });

const mustReject = async (url: string, name: string) => {
  try { await assertSafeUrl(url, publicDns); ok(false, name, 'was ACCEPTED'); }
  catch (e) { ok(e instanceof PageFetchError, name, e instanceof Error ? '' : String(e)); }
};
await mustReject('file:///etc/passwd', 'rejects file:// scheme');
await mustReject('gopher://x/', 'rejects gopher:// scheme');
await mustReject('ftp://example.com/', 'rejects ftp:// scheme');
await mustReject('http://localhost/', 'rejects localhost by name');
await mustReject('http://foo.localhost/', 'rejects *.localhost');
await mustReject('http://127.0.0.1/', 'rejects loopback literal');
await mustReject('http://169.254.169.254/latest/meta-data/', 'rejects cloud metadata literal');
await mustReject('http://[::1]/', 'rejects IPv6 loopback literal');
await mustReject('http://evil.test/', 'rejects a PUBLIC hostname resolving to a private IP');
await mustReject('not a url', 'rejects unparseable input');

// Security audit, Sep 2026: 8 of these 18 literals were ACCEPTED by the first version of the guard.
// WHATWG URL re-serialises IPv6 hosts (`[::ffff:169.254.169.254]` becomes `[::ffff:a9fe:a9fe]`), so a
// dotted-quad regex never saw the mapped form, and the NAT64 / 6to4 / IPv4-compatible transition
// forms were not handled at all. Every one of these routes to a private or special destination.
console.log('\nIPV6 AND ODD-LITERAL BYPASSES (all must be rejected):');
for (const [u, why] of [
  ['http://[::1]/', 'IPv6 loopback'],
  ['http://[0:0:0:0:0:0:0:1]/', 'loopback, uncompressed'],
  ['http://[0000:0000:0000:0000:0000:0000:0000:0001]/', 'loopback, zero-padded'],
  ['http://[::ffff:127.0.0.1]/', 'IPv4-mapped loopback, dotted'],
  ['http://[::ffff:7f00:1]/', 'IPv4-mapped loopback, hex (what URL serialises the dotted form to)'],
  ['http://[::7f00:1]/', 'IPv4-compatible loopback'],
  ['http://[::127.0.0.1]/', 'IPv4-compatible loopback, dotted'],
  ['http://[::ffff:0:7f00:1]/', 'SIIT loopback'],
  ['http://[64:ff9b::7f00:1]/', 'NAT64 loopback'],
  ['http://[2002:7f00:1::]/', '6to4 loopback'],
  ['http://[::ffff:a9fe:a9fe]/', 'IPv4-mapped cloud metadata, hex'],
  ['http://[::ffff:169.254.169.254]/', 'IPv4-mapped cloud metadata, dotted'],
  ['http://[64:ff9b::a9fe:a9fe]/', 'NAT64 cloud metadata'],
  ['http://[2002:a9fe:a9fe::]/', '6to4 cloud metadata'],
  ['http://[::ffff:0a00:1]/', 'IPv4-mapped 10.0.0.1'],
  ['http://[fe80::1]/', 'link-local'],
  ['http://[fd00::1]/', 'unique local'],
  ['http://[ff02::1]/', 'multicast'],
  ['http://[::]/', 'unspecified'],
  ['http://[fe80::1%25eth0]/', 'link-local with zone id'],
  ['http://0x7f000001/', 'hex IPv4 (URL normalises to 127.0.0.1)'],
  ['http://0177.0.0.1/', 'octal IPv4'],
  ['http://2130706433/', 'decimal IPv4'],
  ['http://127.1/', 'short IPv4'],
] as const) {
  await mustReject(u, `rejects ${why} — ${u}`);
}
for (const u of ['http://[2606:4700:4700::1111]/', 'http://[2a00:1450:4009:81f::200e]/']) {
  try { await assertSafeUrl(u, publicDns); ok(true, `accepts a global-unicast IPv6 literal — ${u}`); }
  catch (e: any) { ok(false, `accepts a global-unicast IPv6 literal — ${u}`, e.message); }
}

try { await assertSafeUrl('https://example.com/pricing', publicDns); ok(true, 'accepts an ordinary public URL'); }
catch (e: any) { ok(false, 'accepts an ordinary public URL', e.message); }

console.log('\nHTML EXTRACTION:');
const html = `<!doctype html><html><head><title>Acme Pricing</title>
<meta name="description" content="Simple plans">
<style>.x{color:red}</style><script>var a=1;</script></head>
<body><nav>Home About</nav><main><h1>Pricing that scales</h1>
<p>Start free &amp; upgrade when you&rsquo;re ready.</p><p>No card required.</p>
<p>Every plan includes unlimited projects, priority support and a full data export whenever you want it.</p></main>
<footer>&copy; Acme</footer></body></html>`;
const text = htmlToText(html);
ok(text.includes('Acme Pricing'), 'keeps the <title>');
ok(text.includes('Simple plans'), 'keeps the meta description');
ok(text.includes('Pricing that scales'), 'keeps heading copy');
ok(text.includes("upgrade when you're ready"), 'decodes entities (&amp; and &rsquo;)');
ok(!text.includes('var a=1'), 'strips <script> contents');
ok(!text.includes('color:red'), 'strips <style> contents');
ok(!/<[a-z]/i.test(text), 'leaves no raw tags');

// Regression: found by fetching a real page, not a fixture. This project's own index.html contains a
// comment mentioning `<title>`, and reading the title before stripping comments captured the
// commentary. Both assertions below fail if the comment strip moves back after title extraction.
const commented = htmlToText(`<!doctype html><html><head>
<!-- helmet REPLACES <title> but APPENDS <meta> and <link>, so a static tag survives in front -->
<title>Pricing &amp; Plans | Acme</title></head><body><main><h1>Real heading</h1>
<p>${'Body copy that comfortably clears the useful-content threshold. '.repeat(6)}</p></main></body></html>`);
ok(commented.startsWith('Page title: Pricing & Plans | Acme'), 'reads the real <title>, not one quoted inside a comment');
ok(!commented.includes('APPENDS'), 'drops comment text entirely');
ok(!commented.includes('&amp;'), 'decodes entities in the <title>');

console.log('\nEMPTY SPA SHELL DETECTION:');
const shell = htmlToText('<!doctype html><html><head><title>App</title></head><body><div id="root"></div><script src="/a.js"></script></body></html>');
ok(shell.replace(/\s/g, '').length < MIN_USEFUL_CHARS, 'an unrendered SPA shell falls under the useful-content threshold');
ok(text.replace(/\s/g, '').length >= MIN_USEFUL_CHARS, 'a real page clears the threshold');

console.log('\nURL DETECTION (mirrors the client):');
ok(looksLikeUrl('https://example.com'), 'detects a URL');
ok(looksLikeUrl('example.com/pricing'), 'detects a bare domain');
ok(!looksLikeUrl('Our headline is great. Buy now.'), 'prose with a full stop is not a URL');
ok(!looksLikeUrl(''), 'empty is not a URL');

console.log(fail ? `\n${fail} FAILED\n` : '\nPASS — SSRF guard, extraction and shell detection all behave.\n');
process.exit(fail ? 1 : 0);
