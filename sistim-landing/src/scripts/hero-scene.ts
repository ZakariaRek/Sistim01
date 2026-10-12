// The single Three.js scene: a calm circuit network of emerald nodes, thin traces and a few
// signals travelling along them. Damped pointer lean (no OrbitControls). Loaded lazily.
import {
  WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute, Points, LineSegments,
  ShaderMaterial, LineBasicMaterial, AdditiveBlending, Group, Color,
} from 'three';

const NAVY = new Color('#232B3B');
const EMERALD = new Color('#16AB79');
const MIST = new Color('#D3F2E6');

export function createHeroScene(container: HTMLElement, canvas: HTMLCanvasElement, opts: { rtl: boolean; onFirstFrame: () => void }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(48, 1, 0.1, 80);
  camera.position.set(0, 0, 17);
  const group = new Group();
  group.position.x = opts.rtl ? -4.2 : 4.2; // keep the busy side away from the headline
  scene.add(group);

  // --- Nodes on a jittered lattice, edges only along circuit directions (0°, 45°, 90°)
  const STEP = 1.6;
  const nodes: number[][] = [];
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let gx = -8; gx <= 8; gx++)
    for (let gy = -5; gy <= 5; gy++)
      for (let gz = -3; gz <= 1; gz++)
        if (rnd() < 0.13) nodes.push([gx * STEP, gy * STEP, gz * STEP * 1.4]);

  const key = (p: number[]) => p.map((v) => Math.round(v / STEP)).join(',');
  const index = new Map(nodes.map((p, i) => [key(p), i]));
  const adjacency: number[][] = nodes.map(() => []);
  const edges: Array<[number, number]> = [];
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  nodes.forEach((p, i) => {
    for (const [dx, dy] of dirs) {
      for (let k = 1; k <= 2; k++) {
        const j = index.get(key([p[0] + dx * STEP * k, p[1] + dy * STEP * k, p[2]]));
        if (j !== undefined) {
          if (adjacency[i].length < 3 && adjacency[j].length < 3 && rnd() < 0.62) {
            edges.push([i, j]); adjacency[i].push(j); adjacency[j].push(i);
          }
          break;
        }
      }
    }
  });

  // Points: size + pulse phase per node
  const pos = new Float32Array(nodes.length * 3);
  const size = new Float32Array(nodes.length);
  const pulse = new Float32Array(nodes.length);
  nodes.forEach((p, i) => {
    pos.set(p, i * 3);
    const hub = adjacency[i].length >= 3;
    size[i] = hub ? 13 : 7 + rnd() * 3;
    pulse[i] = rnd() < 0.12 ? rnd() * 6.28 : -1;
  });
  const pGeo = new BufferGeometry();
  pGeo.setAttribute('position', new BufferAttribute(pos, 3));
  pGeo.setAttribute('aSize', new BufferAttribute(size, 1));
  pGeo.setAttribute('aPulse', new BufferAttribute(pulse, 1));

  const pointMat = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDpr: { value: dpr }, uColor: { value: EMERALD }, uMist: { value: MIST } },
    vertexShader: /* glsl */ `
      attribute float aSize; attribute float aPulse;
      uniform float uTime; uniform float uDpr;
      varying float vGlow; varying float vDepth;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float p = aPulse >= 0.0 ? pow(0.5 + 0.5 * sin(uTime * 1.3 + aPulse), 6.0) : 0.0;
        vGlow = p;
        vDepth = smoothstep(26.0, 12.0, -mv.z);
        gl_PointSize = aSize * (1.0 + p * 1.4) * uDpr * (17.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform vec3 uMist;
      varying float vGlow; varying float vDepth;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float core = smoothstep(0.22, 0.12, d);
        float halo = smoothstep(0.5, 0.0, d) * 0.35;
        vec3 col = mix(uColor, uMist, vGlow * 0.6 + core * 0.15);
        float a = (core + halo) * (0.45 + 0.75 * vDepth) * (1.0 + vGlow);
        if (a < 0.01) discard;
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  group.add(new Points(pGeo, pointMat));

  // Lines, darker with depth (baked into vertex colours)
  const lPos = new Float32Array(edges.length * 6);
  const lCol = new Float32Array(edges.length * 6);
  const tmp = new Color();
  edges.forEach(([a, b], e) => {
    lPos.set(nodes[a], e * 6); lPos.set(nodes[b], e * 6 + 3);
    [a, b].forEach((n, k) => {
      const depth = (nodes[n][2] + 4.5 * STEP) / (6 * STEP); // 0 far .. 1 near
      tmp.copy(NAVY).lerp(EMERALD, 0.08 + depth * 0.34);
      lCol.set([tmp.r, tmp.g, tmp.b], e * 6 + k * 3);
    });
  });
  const lGeo = new BufferGeometry();
  lGeo.setAttribute('position', new BufferAttribute(lPos, 3));
  lGeo.setAttribute('color', new BufferAttribute(lCol, 3));
  const lineMat = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
  group.add(new LineSegments(lGeo, lineMat));

  // Signals walking the graph
  const SIGNALS = Math.min(16, edges.length);
  const sState = Array.from({ length: SIGNALS }, () => {
    const [a, b] = edges[Math.floor(rnd() * edges.length)];
    return { a, b, t: rnd(), speed: 0.35 + rnd() * 0.45 };
  });
  const sPos = new Float32Array(SIGNALS * 3);
  const sGeo = new BufferGeometry();
  sGeo.setAttribute('position', new BufferAttribute(sPos, 3));
  sGeo.setAttribute('aSize', new BufferAttribute(new Float32Array(SIGNALS).fill(8), 1));
  sGeo.setAttribute('aPulse', new BufferAttribute(new Float32Array(SIGNALS).fill(-1), 1));
  const signalMat = pointMat.clone();
  signalMat.uniforms.uColor = { value: MIST };
  group.add(new Points(sGeo, signalMat));

  // --- Sizing (correct resolution on Retina)
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // --- Damped pointer lean
  const target = { x: 0, y: 0 }, smooth = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    target.x = (e.clientX / innerWidth) * 2 - 1;
    target.y = (e.clientY / innerHeight) * 2 - 1;
  };
  const onLeave = () => { target.x = 0; target.y = 0; };
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);

  // --- Loop: runs only while visible on screen and the tab is visible
  let raf = 0, last = 0, time = 0, first = true, inView = true;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - (last || now)) / 1000, 1 / 30);
    last = now;
    time += dt;

    const k = 1 - Math.pow(1 - 0.05, dt * 60);
    smooth.x += (target.x - smooth.x) * k;
    smooth.y += (target.y - smooth.y) * k;
    camera.position.x = smooth.x * 1.8;
    camera.position.y = -smooth.y * 1.1;
    camera.lookAt(group.position.x * 0.35, 0, 0);
    group.rotation.y = Math.sin(time * 0.08) * 0.12 + smooth.x * 0.08;
    group.rotation.x = Math.cos(time * 0.06) * 0.05 + smooth.y * 0.05;

    for (let i = 0; i < SIGNALS; i++) {
      const s = sState[i];
      s.t += dt * s.speed;
      if (s.t >= 1) {
        const next = adjacency[s.b].filter((n) => n !== s.a);
        const options = next.length ? next : adjacency[s.b];
        s.a = s.b; s.b = options[Math.floor(rnd() * options.length)]; s.t = 0;
      }
      const A = nodes[s.a], B = nodes[s.b];
      sPos[i * 3] = A[0] + (B[0] - A[0]) * s.t;
      sPos[i * 3 + 1] = A[1] + (B[1] - A[1]) * s.t;
      sPos[i * 3 + 2] = A[2] + (B[2] - A[2]) * s.t;
    }
    sGeo.attributes.position.needsUpdate = true;
    pointMat.uniforms.uTime.value = time;

    renderer.render(scene, camera);
    if (first) { first = false; opts.onFirstFrame(); }
  };
  const start = () => { if (!raf && inView && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; inView ? start() : stop(); });
  io.observe(container);
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);
  const onLost = (e: Event) => { e.preventDefault(); stop(); canvas.style.opacity = '0'; };
  canvas.addEventListener('webglcontextlost', onLost);
  start();

  return () => {
    stop();
    io.disconnect();
    ro.disconnect();
    window.removeEventListener('pointermove', onPointer);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('webglcontextlost', onLost);
    [pGeo, lGeo, sGeo].forEach((g) => g.dispose());
    [pointMat, lineMat, signalMat].forEach((m) => m.dispose());
    renderer.dispose();
  };
}
