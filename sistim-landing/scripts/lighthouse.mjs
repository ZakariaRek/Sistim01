// Mobile Lighthouse for each locale, using Playwright's Chromium over the DevTools port.
// Usage: node scripts/lighthouse.mjs [baseUrl]   (build with SITE_URL=<baseUrl> first so canonicals match)
import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import { writeFileSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:4321';
const preset = process.argv.includes('--desktop') ? 'desktop' : 'mobile';
const browser = await chromium.launch({ args: ['--remote-debugging-port=9223'] });
for (const [loc, path] of [['ar', '/'], ['fr', '/fr/'], ['en', '/en/']]) {
  const config = preset === 'desktop' ? (await import('lighthouse/core/config/desktop-config.js')).default : undefined;
  const { lhr } = await lighthouse(base + path, { port: 9223, output: 'json', logLevel: 'error' }, config);
  writeFileSync(`qa/lh-${preset}-${loc}.json`, JSON.stringify(lhr));
  const a = lhr.audits;
  console.log(loc, preset, Object.values(lhr.categories).map((c) => `${c.id}:${Math.round(c.score * 100)}`).join(' '),
    '| LCP', a['largest-contentful-paint'].displayValue, '| CLS', a['cumulative-layout-shift'].displayValue, '| TBT', a['total-blocking-time'].displayValue);
  for (const [k, v] of Object.entries(a))
    if (v.score !== null && v.score < 0.9 && !['informative', 'notApplicable', 'manual'].includes(v.scoreDisplayMode)) console.log('   -', k, v.score, v.displayValue || '');
}
await browser.close();
