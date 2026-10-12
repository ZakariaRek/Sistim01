const L = (hex) => { const c = hex.match(/\w\w/g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const bgs = { 'navy-950': '#171D29', 'navy-900': '#232B3B', 'navy-800': '#2C3548', 'navy-700': '#3A4559' };
const fgs = { white: '#FFFFFF', muted: '#AEB6C4', 'emerald-400': '#3CCB98', 'emerald-500': '#16AB79', mist: '#D3F2E6' };
for (const [bn, b] of Object.entries(bgs)) console.log(bn.padEnd(9), Object.entries(fgs).map(([fn, f]) => `${fn} ${ratio(f, b).toFixed(2)}`).join(' | '));
console.log('navy-950 on emerald-500', ratio('#171D29', '#16AB79').toFixed(2), '| white on emerald-600 #0E7F59', ratio('#FFFFFF', '#0E7F59').toFixed(2), '| navy-950 on emerald-400', ratio('#171D29', '#3CCB98').toFixed(2));
