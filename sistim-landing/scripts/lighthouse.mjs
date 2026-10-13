// Lighthouse for each landing and consultation page, using Playwright's Chromium over the DevTools port.
// Usage: node scripts/lighthouse.mjs [baseUrl] [--desktop]
// Build with SITE_URL=<baseUrl> first so canonical URLs match the audited host.
// ("/" is not audited: it forwards to a language page with JavaScript.)
import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import { writeFileSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:4321';
const preset = process.argv.includes('--desktop') ? 'desktop' : 'mobile';
const config = preset === 'desktop' ? (await import('lighthouse/core/config/desktop-config.js')).default : undefined;
const browser = await chromium.launch({ args: ['--remote-debugging-port=9223'] });
const pages = [['ar', '/ar/'], ['fr', '/fr/'], ['en', '/en/'], ['ar-consult', '/ar/consultation/'], ['fr-consult', '/fr/consultation/'], ['en-consult', '/en/consultation/']];
for (const [name, path] of pages) {
  const { lhr } = await lighthouse(base + path, { port: 9223, output: 'json', logLevel: 'error' }, config);
  writeFileSync(`qa/lh-${preset}-${name}.json`, JSON.stringify(lhr));
  const a = lhr.audits;
  console.log(name.padEnd(11), preset, Object.values(lhr.categories).map((c) => `${c.id}:${Math.round(c.score * 100)}`).join(' '),
    '| LCP', a['largest-contentful-paint'].displayValue, '| CLS', a['cumulative-layout-shift'].displayValue, '| TBT', a['total-blocking-time'].displayValue);
  for (const [k, v] of Object.entries(a))
    if (v.score !== null && v.score < 0.9 && !['informative', 'notApplicable', 'manual'].includes(v.scoreDisplayMode)) console.log('   -', k, v.score, v.displayValue || '');
}
await browser.close();
