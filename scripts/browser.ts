// Launch headless Chrome for a build step. On Vercel/CI the build sandbox (Amazon Linux) has no usable
// Chromium and full puppeteer's download is not there either ("Could not find Chrome", which failed the
// first CSP-enforcing preview), so use @sparticuz/chromium (a self-contained Linux binary) via
// puppeteer-core. Locally, use full puppeteer's bundled Chromium. Same launch shape both ways.
// Every build step that needs a browser launches it here; scripts/deploy.test.mjs enforces that.
export async function launchBrowser(): Promise<any> {
  if (process.env.VERCEL || process.env.CI) {
    const chromium: any = (await import('@sparticuz/chromium')).default;
    const pc: any = await import('puppeteer-core');
    return pc.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage'],
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: { width: 1280, height: 800 },
    });
  }
  const puppeteer: any = (await import('puppeteer')).default;
  return puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
}
