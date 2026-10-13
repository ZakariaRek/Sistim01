// Lighthouse for a single path: node scripts/lh-one.mjs /ar/consultation/ [--desktop]
import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
const path = process.argv[2] || '/ar/consultation/';
const base = 'http://localhost:4321';
const config = process.argv.includes('--desktop') ? (await import('lighthouse/core/config/desktop-config.js')).default : undefined;
const browser = await chromium.launch({ args: ['--remote-debugging-port=9224'] });
const { lhr } = await lighthouse(base + path, { port: 9224, output: 'json', logLevel: 'error' }, config);
const a = lhr.audits;
console.log(path, Object.values(lhr.categories).map((c) => `${c.id}:${Math.round(c.score * 100)}`).join(' '), '| LCP', a['largest-contentful-paint'].displayValue, '| CLS', a['cumulative-layout-shift'].displayValue, '| TBT', a['total-blocking-time'].displayValue);
console.log('long tasks:', (a['long-tasks'].details?.items || []).slice(0, 4).map((i) => `${Math.round(i.duration)}ms@${Math.round(i.startTime)} ${i.url.split('/').pop()}`).join(' | '));
await browser.close();
