// The 3D "س": one real-time Three.js scene built from the traced badge (src/assets/logo-s.svg).
// Loaded lazily, only on /consultation pages (see src/components/consultation/Logo3D.tsx).
import {
  ACESFilmicToneMapping, AdditiveBlending, Box3, CanvasTexture, DirectionalLight, ExtrudeGeometry, Group, Mesh,
  MeshPhysicalMaterial, MeshStandardMaterial, PerspectiveCamera, PMREMGenerator, Scene, ShapeUtils, SRGBColorSpace,
  Sprite, SpriteMaterial, WebGLRenderer, type Shape,
} from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import * as C from '../../config/logo3d';
import logoSvg from '../../assets/logo-s.svg?raw';

const TAU = Math.PI * 2;
const rad = (deg: number) => (deg * Math.PI) / 180;
const EMERALD = 0x16ab79;

export interface LogoOptions {
  lowPower: boolean;
  maxDpr: number;
  pointer: boolean;
  onFirstFrame: () => void;
  onContextLost: () => void;
}

export interface LogoController {
  /** One spin: direction 1 = forward, -1 = reverse. Ignored while another spin is running. */
  spin(direction: 1 | -1, turns?: number): void;
  /** The "sent" moment: ~2 turns, decelerating onto the front pose, dot glows once. */
  celebrate(): void;
  resize(): void;
  degrade(): void;
  info(): { geometries: number; textures: number; programs: number; calls: number; pixelRatio: number; lowQuality: boolean };
  /** QA helper: hold the letter at a fixed angle in degrees (null releases it). */
  freeze(deg: number | null): void;
  dispose(): void;
}

/** Stroke width of a stroked glyph, estimated as 2 x area / perimeter. */
function strokeWidth(shapes: Shape[]) {
  let area = 0, perimeter = 0;
  for (const s of shapes) {
    const pts = s.extractPoints(6).shape;
    area += Math.abs(ShapeUtils.area(pts));
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      perimeter += Math.hypot(a.x - b.x, a.y - b.y);
    }
  }
  return (2 * area) / perimeter;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(60,203,152,0.95)');
  grad.addColorStop(0.35, 'rgba(22,171,121,0.45)');
  grad.addColorStop(1, 'rgba(22,171,121,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function createLogoScene(canvas: HTMLCanvasElement, opts: LogoOptions): LogoController {
  let lowQuality = opts.lowPower;
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new Scene();
  const camera = new PerspectiveCamera(28, 4 / 3, 0.1, 60);

  // --- image-based light from a built-in room (no external HDR file) + key + emerald rim
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTarget = pmrem.fromScene(room, 0.04);
  scene.environment = envTarget.texture;
  room.dispose();
  pmrem.dispose();

  const key = new DirectionalLight(0xffffff, 1.5);
  key.position.set(-2.4, 3.2, 5);
  const rim = new DirectionalLight(EMERALD, 3.4);
  rim.position.set(3.2, 1.4, -4);
  scene.add(key, rim);

  // --- geometry from the traced SVG
  const data = new SVGLoader().parse(logoSvg);
  const find = (id: string) => data.paths.find((p) => (p.userData?.node as Element | undefined)?.id === id)!;
  const letterShapes = SVGLoader.createShapes(find('letter'));
  const dotShapes = SVGLoader.createShapes(find('dot'));

  const stroke = strokeWidth(letterShapes);
  const dotRadius = strokeWidth(dotShapes); // a disc: 2A/P = r
  const bevelSegments = lowQuality ? 3 : 8;
  const curveSegments = lowQuality ? 2 : 4;
  const depth = stroke * 0.35;
  const bevelThickness = stroke * 0.3;

  const extrude = (shapes: Shape[], bevelSize: number) =>
    new ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness, bevelSize, bevelOffset: -bevelSize, bevelSegments, curveSegments, steps: 1 });

  const letterGeo = extrude(letterShapes, stroke * 0.3);
  const dotGeo = extrude(dotShapes, Math.min(dotRadius * 0.9, stroke * 0.3));

  // centre on the letter's bounding box and normalise to 3 units wide
  letterGeo.computeBoundingBox();
  const lb = letterGeo.boundingBox!;
  const cx = (lb.min.x + lb.max.x) / 2, cy = (lb.min.y + lb.max.y) / 2, cz = (lb.min.z + lb.max.z) / 2;
  const s = 3 / (lb.max.x - lb.min.x);
  for (const g of [letterGeo, dotGeo]) { g.translate(-cx, -cy, -cz); g.scale(s, s, s); }
  dotGeo.computeBoundingBox();
  const db = dotGeo.boundingBox!;
  const dotCx = (db.min.x + db.max.x) / 2, dotCy = (db.min.y + db.max.y) / 2, dotW = db.max.x - db.min.x;

  const letterMat = new MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0, clearcoat: lowQuality ? 0 : 0.6, clearcoatRoughness: 0.12, envMapIntensity: 0.95 });
  const dotMat = new MeshStandardMaterial({ color: EMERALD, roughness: 0.35, metalness: 0, emissive: EMERALD, emissiveIntensity: 0.6 });

  const logo = new Group();
  logo.rotation.x = Math.PI; // SVG is y-down: a proper rotation (not a mirror), so the letter keeps its true shape
  logo.add(new Mesh(letterGeo, letterMat), new Mesh(dotGeo, dotMat));

  const glowTex = glowTexture();
  const glowMat = new SpriteMaterial({ map: glowTex, color: 0xffffff, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 });
  const glow = new Sprite(glowMat);
  const glowBase = dotW * 3.2;
  glow.scale.setScalar(glowBase);
  glow.position.set(dotCx, -dotCy, 0);

  const root = new Group();
  root.add(logo, glow);
  scene.add(root);

  // bounds for camera fit: letter + dot, spinning about Y
  const box = new Box3().setFromObject(root);
  const halfX = Math.max(Math.abs(box.min.x), Math.abs(box.max.x));
  const halfY = Math.max(Math.abs(box.min.y), Math.abs(box.max.y));
  const halfZ = Math.max(Math.abs(box.min.z), Math.abs(box.max.z));
  const reachX = Math.hypot(halfX, halfZ) * 1.04;
  const reachY = halfY * 1.1 + Math.sin(rad(C.POINTER_TILT_DEG)) * halfZ + C.IDLE_FLOAT;

  // --- sizing: container-driven, pixel ratio capped
  let pixelRatio = Math.min(window.devicePixelRatio || 1, lowQuality ? Math.min(opts.maxDpr, 1.25) : opts.maxDpr);
  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const t = Math.tan(rad(camera.fov / 2));
    const dist = Math.max(reachY / t, reachX / (t * camera.aspect)) * 1.03;
    camera.position.set(0, dist * 0.1, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // --- animation state (GSAP tweens these numbers; the render loop applies them)
  const state = { spin: 0, pulse: 1, dot: 0 };
  let busy = false;
  let lastSpinAt = performance.now();
  let inputFocused = false;
  let frozen: number | null = null;
  const pointer = { tx: 0, ty: 0, x: 0, y: 0 };

  const peak = (ease: string) => C.EASE_PEAK_FACTOR[ease] ?? 3;
  /** Enforce the safety rules: at least MIN_SPIN_MS and never faster than MAX_TURNS_PER_SECOND at the peak. */
  const safeMs = (turns: number, ms: number, ease: string) =>
    Math.max(ms, C.MIN_SPIN_MS, ((turns * peak(ease)) / C.MAX_TURNS_PER_SECOND) * 1000);

  function runSpin(direction: 1 | -1, turns: number, ms: number, ease: string, flashAtEnd: boolean) {
    busy = true;
    lastSpinAt = performance.now();
    const duration = safeMs(turns, ms, ease) / 1000;
    const from = flashAtEnd ? Math.ceil(state.spin / TAU - 1e-6) * TAU : state.spin;
    gsap.to(state, {
      spin: from + direction * turns * TAU, duration, ease,
      onComplete() { busy = false; state.spin = ((state.spin % TAU) + TAU) % TAU; if (state.spin > TAU - 1e-4) state.spin = 0; lastSpinAt = performance.now(); },
    });
    // small scale pulse 1 -> 1.06 -> 1
    gsap.timeline().to(state, { pulse: 1.06, duration: duration / 2, ease: 'sine.out' }).to(state, { pulse: 1, duration: duration / 2, ease: 'sine.in' });
    // the dot flashes slightly brighter (brighter, once, at the end, for the celebration)
    if (flashAtEnd) gsap.timeline().to(state, { dot: 1, duration: 0.3, ease: 'sine.out', delay: duration * 0.82 }).to(state, { dot: 0, duration: 1.1, ease: 'sine.inOut' });
    else gsap.timeline().to(state, { dot: 0.5, duration: duration * 0.3, ease: 'sine.out' }).to(state, { dot: 0, duration: duration * 0.7, ease: 'sine.inOut' });
  }

  // --- render loop (runs only while on screen and the tab is visible)
  let tSec = 0;
  let first = true;
  const bench: number[] = [];
  let degraded = false;
  const frame = (_t: number, dtMs: number) => {
    const dt = Math.min(dtMs, 50) / 1000;
    tSec += dt;
    const k = 1 - Math.pow(1 - 0.08, dt * 60);
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;

    if (frozen === null && !busy && !inputFocused && performance.now() - lastSpinAt > C.IDLE_SPIN_EVERY_MS) runSpin(1, C.STEP_SPIN_TURNS, C.STEP_SPIN_MS, C.STEP_SPIN_EASE, false);

    if (frozen !== null) {
      root.rotation.set(0, rad(frozen), 0);
      root.position.y = 0;
      root.scale.setScalar(1);
    } else {
      const tilt = rad(C.POINTER_TILT_DEG);
      root.rotation.y = state.spin + Math.sin(tSec * 0.55) * rad(C.IDLE_SWAY_DEG) + pointer.x * tilt;
      root.rotation.x = -pointer.y * tilt * 0.8;
      root.position.y = Math.sin(tSec * 0.9) * C.IDLE_FLOAT;
      root.scale.setScalar(state.pulse);
    }
    const slow = Math.sin(tSec * 1.3);
    dotMat.emissiveIntensity = 0.6 + state.dot * 0.9 + slow * 0.06;
    glowMat.opacity = 0.34 + slow * 0.08 + state.dot * 0.4;
    glow.scale.setScalar(glowBase * (1 + slow * 0.06 + state.dot * 0.25));

    renderer.render(scene, camera);
    if (first) { first = false; opts.onFirstFrame(); }
    else if (!degraded && bench.length < 14) {
      bench.push(dtMs);
      if (bench.length === 14) {
        const sorted = [...bench].sort((a, b) => a - b);
        if (sorted[7] > 42 && !lowQuality) api.degrade(); // slow device: simplify
        degraded = true;
      }
    }
  };

  let visible = true;
  let ticking = false;
  const apply = () => {
    const on = visible && !document.hidden && !contextLost;
    if (on && !ticking) { gsap.ticker.add(frame); ticking = true; }
    else if (!on && ticking) { gsap.ticker.remove(frame); ticking = false; }
  };
  let contextLost = false;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; apply(); });
  io.observe(canvas);
  const onVis = () => apply();
  document.addEventListener('visibilitychange', onVis);

  const onFocusIn = (e: FocusEvent) => { if ((e.target as HTMLElement)?.matches?.('input, textarea, select')) inputFocused = true; };
  const onFocusOut = () => { inputFocused = false; lastSpinAt = performance.now(); };
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);

  const onPointer = (e: PointerEvent) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
  };
  if (opts.pointer && C.POINTER_TILT_DEG > 0) window.addEventListener('pointermove', onPointer, { passive: true });

  const onLost = (e: Event) => { e.preventDefault(); contextLost = true; apply(); opts.onContextLost(); };
  canvas.addEventListener('webglcontextlost', onLost);

  apply();

  const api: LogoController = {
    spin(direction, turns = C.STEP_SPIN_TURNS) {
      if (busy || frozen !== null) return; // coalesce: never stack spins
      runSpin(direction, turns, C.STEP_SPIN_MS, C.STEP_SPIN_EASE, false);
    },
    celebrate() {
      gsap.killTweensOf(state);
      busy = false;
      state.pulse = 1;
      runSpin(1, C.SUBMIT_SPIN_TURNS, C.SUBMIT_SPIN_MS, C.SUBMIT_SPIN_EASE, true);
    },
    resize,
    degrade() {
      if (lowQuality) return;
      lowQuality = true;
      letterMat.clearcoat = 0;
      letterMat.needsUpdate = true;
      pixelRatio = 1;
      resize();
    },
    info() {
      const i = renderer.info;
      return { geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length ?? 0, calls: i.render.calls, pixelRatio, lowQuality };
    },
    freeze(deg) { frozen = deg; if (deg !== null) { gsap.killTweensOf(state); busy = false; } },
    dispose() {
      if (ticking) { gsap.ticker.remove(frame); ticking = false; }
      gsap.killTweensOf(state);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('webglcontextlost', onLost);
      letterGeo.dispose(); dotGeo.dispose();
      letterMat.dispose(); dotMat.dispose(); glowMat.dispose(); glowTex.dispose();
      envTarget.dispose();
      scene.environment = null;
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
  return api;
}
