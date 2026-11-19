// town.js v2 — one fixed "Blox Town" behind the whole page. Each section is a camera station;
// scrolling glides the camera between them. Original geometry only (no Roblox logos or avatars).
// The page's own <video> elements double as the YouTube billboard and Instagram tower screens.
import * as THREE from "three";
import { gsap } from "gsap";

const PAL = {
  walls: ["#11141c", "#151925", "#0f1219", "#191d29", "#131722", "#1a1720"],
  lit: ["#e9a35a", "#f2c088", "#e0954e", "#e9a35a", "#8fa0e0"],
  plate: "#14151d",
  street: "#0d0e14",
};

function studTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = PAL.plate; g.fillRect(0, 0, 64, 64);
  const grad = g.createRadialGradient(26, 26, 2, 32, 32, 18);
  grad.addColorStop(0, "#262a38"); grad.addColorStop(1, "#181a24");
  g.fillStyle = grad; g.beginPath(); g.arc(32, 32, 17, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = 2; g.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function windowTextures(seed) {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const e = document.createElement("canvas"); e.width = e.height = 64;
  const g = c.getContext("2d"), ge = e.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 64);
  ge.fillStyle = "#000"; ge.fillRect(0, 0, 64, 64);
  let r = seed; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let y = 6; y < 60; y += 14) for (let x = 6; x < 60; x += 14) {
    g.fillStyle = "#2c3142"; g.fillRect(x, y, 8, 9);
    if (rnd() < 0.17) { ge.fillStyle = PAL.lit[Math.floor(rnd() * PAL.lit.length)]; ge.fillRect(x, y, 8, 9); }
  }
  const mk = (cv) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t; };
  return { map: mk(c), emissive: mk(e) };
}
function scaleBoxUVs(geo, w, h, d) {
  const uv = geo.attributes.uv; const per = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * per[f][0] / 3.4, uv.getY(k) * per[f][1] / 3.4); }
  uv.needsUpdate = true;
}

export function initTown(canvas, { small, reduce, videos = {}, posters = {} }) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: false, powerPreference: "high-performance" }); }
  catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const HORIZON = "#2a1f33";
  scene.fog = new THREE.Fog(HORIZON, 20, 95);
  const camera = new THREE.PerspectiveCamera(small ? 58 : 42, 1, 0.1, 400);

  // sky dome in world space so the horizon always meets the fogged ground
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color("#05060a") }, mid: { value: new THREE.Color("#10131f") }, hor: { value: new THREE.Color(HORIZON) } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 top, mid, hor; varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(hor, mid, smoothstep(0.0, 0.14, h)); c = mix(c, top, smoothstep(0.14, 0.6, h)); gl_FragColor = vec4(c, 1.0); }",
  }));
  scene.add(skyDome);

  // sunset glow low on the horizon (the banner's orange)
  const glowC = document.createElement("canvas"); glowC.width = glowC.height = 128;
  const gg = glowC.getContext("2d"); const rg = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, "rgba(255,190,120,1)"); rg.addColorStop(.18, "rgba(255,150,80,.85)"); rg.addColorStop(.45, "rgba(255,110,70,.25)"); rg.addColorStop(1, "rgba(255,110,70,0)");
  gg.fillStyle = rg; gg.fillRect(0, 0, 128, 128);
  const sunTex = new THREE.CanvasTexture(glowC); sunTex.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false, transparent: true }));
  sun.scale.set(110, 110, 1); sun.position.set(-60, 2, -200); scene.add(sun);

  scene.add(new THREE.HemisphereLight("#6c78b0", "#140f18", 0.6));
  const key = new THREE.DirectionalLight("#ffa860", 2.2); key.position.set(-20, 9, -90); scene.add(key);
  const fill = new THREE.DirectionalLight("#7f8cff", 0.6); fill.position.set(10, 14, 30); scene.add(fill);

  const studs = studTexture(); studs.repeat.set(220, 220);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(440, 440), new THREE.MeshStandardMaterial({ map: studs, roughness: 0.8 }));
  plate.rotation.x = -Math.PI / 2; plate.position.z = -20; scene.add(plate);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 100), new THREE.MeshStandardMaterial({ color: PAL.street, roughness: 0.9 }));
  street.rotation.x = -Math.PI / 2; street.position.set(0, 0.02, -8); scene.add(street);
  const dashGeo = new THREE.BoxGeometry(0.16, 0.04, 1.4), dashMat = new THREE.MeshBasicMaterial({ color: "#3b3f52" });
  for (let z = 30; z > -36; z -= 3.2) { const d = new THREE.Mesh(dashGeo, dashMat); d.position.set(0, 0.04, z); scene.add(d); }

  // buildings
  const blocks = []; let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rows = small ? [-5.6, 5.6, -11.5, 11.5] : [-5.6, 5.6, -11.5, 11.5, -17.5, 17.5];
  for (const x0 of rows) {
    for (let z = 22; z > -44; z -= 4.6 + rnd() * 1.6) {
      const inner = Math.abs(x0) < 6;
      if (inner && z < -21 && z > -31) continue;            // square around the YouTube billboard
      if (inner && x0 < 0 && z < -3 && z > -14) continue;    // plaza for the Instagram tower
      const w = 3 + rnd() * 1.8, d = 3 + rnd() * 1.6;
      const h = (inner ? 3 : 7) + rnd() * (inner ? 8 : 14);
      const geo = new THREE.BoxGeometry(w, h, d); scaleBoxUVs(geo, w, h, d);
      const tex = windowTextures(Math.floor(rnd() * 99999) + 1);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: PAL.walls[Math.floor(rnd() * PAL.walls.length)], map: tex.map, emissive: "#ffffff", emissiveMap: tex.emissive, emissiveIntensity: 0.75, roughness: 0.85 }));
      m.position.set(x0 + (rnd() - 0.5) * 1.2, h / 2, z); m.userData.y = h / 2;
      if (rnd() < 0.45) {
        const rw = w * (0.4 + rnd() * 0.3), rh = 0.8 + rnd() * 1.6;
        const roof = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rw), new THREE.MeshStandardMaterial({ color: "#11131b", roughness: 0.9 }));
        roof.position.y = h / 2 + rh / 2; m.add(roof);
      }
      scene.add(m); blocks.push(m);
    }
  }
  // far skyline silhouettes
  {
    const n = small ? 50 : 110;
    const sil = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: "#0f111a", roughness: 1 }), n);
    const lights = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 0.6), new THREE.MeshBasicMaterial({ color: "#ffbe73", fog: false, transparent: true, opacity: 0.8 }), n * 3);
    const Mx = new THREE.Matrix4(); let li = 0;
    for (let i = 0; i < n; i++) {
      const x = (rnd() - 0.5) * 180, z = -64 - rnd() * 80, w = 3 + rnd() * 6, h = 5 + rnd() * 13, d = 3 + rnd() * 5;
      Mx.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d)); sil.setMatrixAt(i, Mx);
      for (let k = 0; k < 3; k++) if (rnd() < 0.6 && li < lights.count) { Mx.makeTranslation(x + (rnd() - 0.5) * (w - 1), 1 + rnd() * (h - 2), z + d / 2 + 0.02); lights.setMatrixAt(li++, Mx); }
    }
    lights.count = li; scene.add(sil, lights);
  }

  // screens: textures come from the page's <video> elements (posters until they play)
  function screenMaterial(video, poster) {
    const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false, fog: false });
    new THREE.TextureLoader().load(poster, (t) => { t.colorSpace = THREE.SRGBColorSpace; if (!mat.map) { mat.map = t; mat.needsUpdate = true; if (reduce) renderOnce(); } });
    if (video && !reduce) {
      const use = () => { const vt = new THREE.VideoTexture(video); vt.colorSpace = THREE.SRGBColorSpace; mat.map = vt; mat.needsUpdate = true; };
      video.readyState >= 2 && !video.paused ? use() : video.addEventListener("playing", use, { once: true });
    }
    return mat;
  }
  const bulbMat = new THREE.MeshBasicMaterial({ color: "#ffd59a", fog: false });
  function screen({ x, y, z, w, h, ry = 0, video, poster, frameColor, light }) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, h + 0.6, 0.5), new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.45, metalness: 0.3 }));
    frame.position.z = -0.3; g.add(frame);
    const legH = y - h / 2;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, legH, 0.5), frame.material);
    for (const lx of [-w * 0.3, w * 0.3]) { const l = leg.clone(); l.position.set(lx, -h / 2 - legH / 2, -0.3); g.add(l); }
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMaterial(video, poster)));
    const pl = new THREE.PointLight(light, 26, 20, 1.6); pl.position.set(0, 0, 3); g.add(pl);
    return g;
  }
  const BB = { x: 0, y: 6.6, z: -26, w: 4.6, h: 8.18 };
  const yt = screen({ ...BB, video: videos.yt, poster: posters.yt, frameColor: "#1b1d26", light: "#ffd2a0" });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 8, 6), bulbMat, 64);
  { const M = new THREE.Matrix4(); const hw = BB.w / 2 + 0.36, hh = BB.h / 2 + 0.36;
    for (let i = 0; i < 64; i++) { const per = 2 * (hw * 2 + hh * 2); let s = (i / 64) * per, px, py;
      if (s < hw * 2) { px = -hw + s; py = hh; } else if ((s -= hw * 2) < hh * 2) { px = hw; py = hh - s; } else if ((s -= hh * 2) < hw * 2) { px = hw - s; py = -hh; } else { s -= hw * 2; px = -hw; py = -hh + s; }
      M.makeTranslation(px, py, 0.05); bulbs.setMatrixAt(i, M); } }
  yt.add(bulbs);
  const IG = { x: -6.2, y: 6.2, z: -8.5, w: 3.9, h: 6.93, ry: 0.55 };
  screen({ ...IG, video: videos.ig, poster: posters.ig, frameColor: "#22161f", light: "#ff6fae" });

  // ---------- camera stations (one per section) ----------
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ST = small ? [
    [V(0, 28, 60), V(0, 3, -20)],
    [V(0, 14, 36), V(0, 4, -16)],
    [V(0, 7, 2), V(0, 6.6, -26)],
    [V(2, 7, 14), V(-6.2, 6.2, -8.5)],
    [V(3, 34, -14), V(1, 0, -40)],
    [V(-1.5, 1.8, 14), V(0.5, 3.5, -20)],
    [V(0, 44, 92), V(0, 4, -30)],
  ] : [
    [V(12, 26, 58), V(0, 3, -20)],
    [V(0, 13, 34), V(0, 4, -16)],
    [V(1.5, 7.5, 4), V(-2.8, 6.3, -26)],
    [V(6, 7.5, 16), V(-0.5, 6.1, -9)],
    [V(4, 30, -14), V(1, 0, -40)],
    [V(-2.5, 1.8, 12), V(1, 3.5, -20)],
    [V(0, 40, 85), V(0, 4, -30)],
  ];
  const ease = (t) => t * t * (3 - 2 * t);
  const want = { pos: ST[0][0].clone(), look: ST[0][1].clone() };
  const cur = { pos: ST[0][0].clone(), look: ST[0][1].clone() };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  if (!small && !reduce) addEventListener("pointermove", (e) => { pointer.x = e.clientX / innerWidth - 0.5; pointer.y = e.clientY / innerHeight - 0.5; });

  function apply(k) {
    cur.pos.lerp(want.pos, k); cur.look.lerp(want.look, k);
    pointer.sx += (pointer.x - pointer.sx) * 0.05; pointer.sy += (pointer.y - pointer.sy) * 0.05;
    camera.position.set(cur.pos.x + pointer.sx * 1.4, cur.pos.y - pointer.sy * 0.7, cur.pos.z);
    camera.lookAt(cur.look);
    skyDome.position.copy(camera.position);
  }
  function renderOnce() { apply(1); renderer.render(scene, camera); }

  function setStation(f) {
    f = Math.max(0, Math.min(ST.length - 1, f));
    if (reduce) { const k = Math.round(f); want.pos.copy(ST[k][0]); want.look.copy(ST[k][1]); renderOnce(); return; }
    const i = Math.min(ST.length - 2, Math.floor(f)), t = ease(f - i);
    want.pos.copy(ST[i][0]).lerp(ST[i + 1][0], t);
    want.look.copy(ST[i][1]).lerp(ST[i + 1][1], t);
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    if (reduce) renderOnce();
  }
  addEventListener("resize", resize); resize();

  if (reduce) { renderOnce(); return { setStation }; }

  // intro: every block drops into place (ease-out, never bouncy)
  blocks.forEach((b) => (b.position.y = b.userData.y + 30 + Math.random() * 12));
  gsap.to(blocks.map((b) => b.position), { y: (i) => blocks[i].userData.y, duration: 1.1, ease: "power3.out", stagger: { each: 0.018, from: "end" }, delay: 0.1 });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (document.hidden) return;
    const t = clock.getElapsedTime();
    bulbMat.color.setHSL(0.09, 1, 0.72 + Math.sin(t * 3) * 0.06);
    apply(0.065);
    renderer.render(scene, camera);
  });
  return { setStation };
}
