import sharp from 'sharp';
const files = ['logo-badge','logo-wordmark-swoosh','logo-wordmark-circuit'];
for (const f of files) {
  const { data, info } = await sharp(`../brand/${f}.jpg`).raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map();
  for (let i = 0; i < data.length; i += info.channels * 7) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const key = `${r>>2},${g>>2},${b>>2}`;
    buckets.set(key, (buckets.get(key)||0)+1);
  }
  const top = [...buckets.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6)
    .map(([k,c]) => '#' + k.split(',').map(v=>((+v<<2)+2).toString(16).padStart(2,'0')).join('') + ' ' + c);
  // greens: g dominant
  let gs=[0,0,0,0];
  for (let i = 0; i < data.length; i += info.channels*3) { const r=data[i],g=data[i+1],b=data[i+2]; if (g>140 && r<60 && g-b>30) { gs[0]+=r;gs[1]+=g;gs[2]+=b;gs[3]++; } }
  const green = '#' + gs.slice(0,3).map(v=>Math.round(v/gs[3]).toString(16).padStart(2,'0')).join('');
  console.log(f, info.width+'x'+info.height, top.join(' | '), 'green avg', green, gs[3]);
}
