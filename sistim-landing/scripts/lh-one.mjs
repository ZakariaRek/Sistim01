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
const shifts = a['layout-shifts']?.details?.items || [];
if (shifts.length) console.log('layout shifts:', shifts.slice(0, 4).map((i) => `${i.score?.toFixed(3)} ${i.node?.selector || i.node?.snippet?.slice(0, 60)}`).join(' | '));
const seo = Object.entries(a).filter(([, v]) => v.score !== null && v.score < 1 && lhr.categories.seo.auditRefs.some((r) => r.id === v.id)).map(([k]) => k);
if (seo.length) console.log('seo audits not passing:', seo.join(', '));
await browser.close();
