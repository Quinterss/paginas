/* model.js — Montacargas 3D: el scroll lleva la cámara por cuatro zonas de la máquina
 * (zoom + rotación) y cada zona muestra un dato. El mouse suma un parallax suave.
 *
 * Modelo: "Forklift" de KolosStudios vía Poly Pizza (Creative Commons Attribution).
 * Three.js r160 local: el sitio no pide nada a terceros.
 *
 * El modelo se orienta solo (largo sobre X, uñas hacia +X), así que las zonas de KEYS
 * se definen en coordenadas del equipo y sirven aunque cambies el .glb por otro.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL = "assets/model/forklift.glb";

/* ============================ AJUSTES ============================
 * FLIP_FRONT  → true si las uñas quedan del lado contrario al esperado.
 * az          → giro de la cámara alrededor del equipo (0 = de frente a las uñas,
 *               π/2 = de costado, π = por atrás). Crece siempre: la cámara da una vuelta.
 * el          → altura de la cámara (radianes).
 * zoom        → 1 = máquina completa; mayor = más cerca.
 * at          → punto que se mira: [largo -1..1 (+1 = punta de las uñas), alto 0..1, ancho -1..1]. */
const FLIP_FRONT = false;
const KEYS = [
  { tag: "Vista general",       az: -0.75, el: 0.22, zoom: 1.0, at: [0.0, 0.45, 0] },
  { tag: "Mástil y uñas",       az: -0.25, el: 0.10, zoom: 2.2, at: [0.72, 0.42, 0] },
  { tag: "Cabina y controles",  az: 1.45,  el: 0.40, zoom: 1.9, at: [-0.05, 0.62, 0] },
  { tag: "Batería y contrapeso", az: 2.65, el: 0.16, zoom: 2.0, at: [-0.78, 0.38, 0] },
  { tag: "Radio de giro",       az: 3.95,  el: 0.06, zoom: 2.3, at: [-0.6, 0.12, 0] }
];

const stage = document.getElementById("stage");
const canvas = document.getElementById("model-canvas");
const section = document.getElementById("flota");
const datums = Array.from(document.querySelectorAll(".datum"));
const ticks = Array.from(document.querySelectorAll("#ticks li"));
const stepOut = document.getElementById("model-step");
const cue = document.getElementById("cue");
const hotspot = document.getElementById("hotspot");
const hotspotLabel = document.getElementById("hotspot-label");

if (stage && canvas && section) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10); // smootherstep: frena y arranca en cada zona
  const pad = (n) => String(n).padStart(2, "0");

  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (error) {
    renderer = null;
  }
  if (!renderer) section.classList.add("showcase--fallback");

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 80);
  const scene = new THREE.Scene();
  const rig = new THREE.Group(); // las luces viajan con la cámara: el producto siempre queda bien iluminado
  scene.add(rig);
  const holder = new THREE.Group();
  scene.add(holder);

  // Medidas reales del modelo una vez cargado y orientado.
  const dims = { L: 2, H: 1, W: 1, fit: 4.5 };
  let modelReady = false;

  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    /* Entorno de estudio generado en código: softbox arriba, tiras laterales y una tira roja
       de marca. Es lo que le da reflejos creíbles a la pintura y al acero. */
    const studio = (() => {
      const env = new THREE.Scene();
      env.add(new THREE.Mesh(new THREE.BoxGeometry(12, 7, 12), new THREE.MeshBasicMaterial({ color: 0x15171d, side: THREE.BackSide })));
      const panel = (w, h, color, power, pos) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
        m.position.set(...pos);
        m.lookAt(0, 0, 0);
        env.add(m);
      };
      panel(6, 2.4, 0xffffff, 7, [0, 3.2, 0]);
      panel(1.6, 3.4, 0xffffff, 4, [-5, 1, 2.5]);
      panel(1.4, 3.4, 0xff2a38, 5, [5, 0.8, -3]);
      panel(7, 0.7, 0xffffff, 1.4, [0, -3.2, 0]);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const target = pmrem.fromScene(env, 0.035);
      pmrem.dispose();
      return target.texture;
    })();
    scene.environment = studio;

    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(4, 5.5, -3); // adelante-derecha de la cámara
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 16 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    const fill = new THREE.DirectionalLight(0x9dbcff, 0.55);
    fill.position.set(3, 1.2, 3);
    const rim = new THREE.DirectionalLight(0xff2a38, 2.6); // contraluz rojo
    rim.position.set(-4, 1.8, 2.5);
    rig.add(key, fill, rim, new THREE.HemisphereLight(0xffffff, 0x20232b, 0.35));

    // Suelo: sombra real + halo rojo debajo de la máquina.
    const floorShadow = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.5 }));
    floorShadow.rotation.x = -Math.PI / 2;
    floorShadow.position.y = 0.002;
    floorShadow.receiveShadow = true;
    scene.add(floorShadow);

    const haloTex = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const ctx = c.getContext("2d");
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, "rgba(255,42,56,.55)");
      g.addColorStop(0.5, "rgba(196,22,31,.18)");
      g.addColorStop(1, "rgba(196,22,31,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const halo = new THREE.Mesh(new THREE.CircleGeometry(2.6, 64), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.001;
    scene.add(halo);

    /* Materiales: según el color de origen se reparte goma, pintura (con barniz) o acero. */
    const upgrade = (src) => {
      const color = src.color ? src.color.clone() : new THREE.Color(0x888888);
      const hsl = {};
      color.getHSL(hsl);
      const lum = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
      let look;
      if (src.map) look = { metalness: 0.2, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.25 };
      else if (lum < 0.035) look = { metalness: 0, roughness: 0.9 };                                          // neumáticos
      else if (hsl.s > 0.35) look = { metalness: 0.25, roughness: 0.34, clearcoat: 0.9, clearcoatRoughness: 0.16 }; // pintura
      else look = { metalness: 0.8, roughness: 0.38 };                                                          // acero
      const mat = new THREE.MeshPhysicalMaterial({
        color, map: src.map || null, normalMap: src.normalMap || null, aoMap: src.aoMap || null,
        vertexColors: !!src.vertexColors, side: src.side, transparent: src.transparent, opacity: src.opacity,
        envMapIntensity: 1.15, ...look
      });
      if (mat.map) { mat.map.colorSpace = THREE.SRGBColorSpace; mat.map.anisotropy = renderer.capabilities.getMaxAnisotropy(); }
      return mat;
    };

    /* Orienta y centra el modelo sin conocer su exportación: escala, apoya el largo sobre X y
       decide cuál extremo son las uñas (el que, en su último 10%, es más bajo que el opuesto). */
    const orient = (object) => {
      const raw = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
      object.scale.multiplyScalar(2 / (Math.max(raw.x, raw.y, raw.z) || 1));
      holder.add(object);
      holder.updateMatrixWorld(true);

      let size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
      if (size.z > size.x) holder.rotation.y = Math.PI / 2; // largo → X
      holder.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(holder);
      size = box.getSize(new THREE.Vector3());
      const band = size.x * 0.1;
      let topFront = -Infinity, topRear = -Infinity;
      const v = new THREE.Vector3();
      object.traverse((node) => {
        if (!node.isMesh) return;
        const pos = node.geometry.attributes.position;
        const step = Math.max(1, Math.floor(pos.count / 4000));
        for (let i = 0; i < pos.count; i += step) {
          v.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld);
          if (v.x > box.max.x - band) topFront = Math.max(topFront, v.y);
          if (v.x < box.min.x + band) topRear = Math.max(topRear, v.y);
        }
      });
      const forksPlusX = topFront < topRear; // las uñas son la punta baja y fina
      if (forksPlusX === FLIP_FRONT) holder.rotation.y += Math.PI;
      holder.updateMatrixWorld(true);

      const fixed = new THREE.Box3().setFromObject(holder);
      const c = fixed.getCenter(new THREE.Vector3());
      holder.position.set(-c.x, -fixed.min.y, -c.z);
      holder.updateMatrixWorld(true);
      const final = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
      dims.L = final.x; dims.H = final.y; dims.W = final.z;
    };

    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        const object = gltf.scene;
        object.traverse((node) => {
          if (!node.isMesh) return;
          node.material = Array.isArray(node.material) ? node.material.map(upgrade) : upgrade(node.material);
          node.castShadow = true;
          node.receiveShadow = true;
        });
        orient(object);
        modelReady = true;
        section.classList.add("showcase--ready");
        resize();
      },
      undefined,
      () => {
        section.classList.add("showcase--fallback");
        canvas.hidden = true;
      }
    );
  }

  /* ============================ tamaño y encuadre ============================ */
  function resize() {
    const w = stage.clientWidth || window.innerWidth;
    const h = stage.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    const wide = w >= 820;
    // Desplaza la imagen para dejar sitio al texto: a la derecha en escritorio, arriba en móvil.
    camera.setViewOffset(w, h, wide ? -w * 0.14 : 0, wide ? 0 : h * 0.16, w, h);
    camera.updateProjectionMatrix();
    if (renderer) renderer.setSize(w, h, false);
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
    // Distancia que deja la máquina completa dentro del cuadro (más aire en escritorio por el desplazamiento).
    dims.fit = Math.max((dims.H * 0.5) / t, (Math.max(dims.L, dims.W) * 0.5) / (t * camera.aspect)) * (wide ? 1.7 : 1.3);
  }

  /* ============================ scroll + mouse → cámara ============================ */
  let visible = true;
  let prog = 0;
  let step = -1;
  const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  const tgt = new THREE.Vector3();
  const proj = new THREE.Vector3();

  const readProgress = () => {
    const travel = section.offsetHeight - stage.offsetHeight;
    return travel > 0 ? clamp(-section.getBoundingClientRect().top / travel, 0, 1) : 0;
  };

  function setStep(i) {
    if (i === step) return;
    step = i;
    datums.forEach((el, k) => el.classList.toggle("is-active", k === i));
    ticks.forEach((el, k) => el.classList.toggle("on", k === i));
    if (stepOut) stepOut.textContent = pad(i + 1) + "/" + pad(KEYS.length);
    if (hotspotLabel) hotspotLabel.textContent = KEYS[i].tag;
  }

  function tick(time) {
    requestAnimationFrame(tick);
    if (!visible) return;

    prog += (readProgress() - prog) * 0.075; // lerp: el giro se siente "líquido", no a saltos
    const u = prog * (KEYS.length - 1);
    const i = Math.min(KEYS.length - 2, Math.floor(u));
    const f = smooth(u - i);
    const a = KEYS[i], b = KEYS[i + 1];

    ptr.sx += (ptr.x - ptr.sx) * 0.06;
    ptr.sy += (ptr.y - ptr.sy) * 0.06;
    const alive = reduce ? 0 : 1;

    const az = lerp(a.az, b.az, f) + alive * (ptr.sx * 0.24 + Math.sin(time * 0.0004) * 0.025);
    const el = lerp(a.el, b.el, f) + alive * (-ptr.sy * 0.1);
    const dist = dims.fit / Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), f)); // zoom suave en escala logarítmica

    tgt.set(
      lerp(a.at[0], b.at[0], f) * dims.L * 0.5,
      lerp(a.at[1], b.at[1], f) * dims.H,
      lerp(a.at[2], b.at[2], f) * dims.W * 0.5
    );
    camera.position.set(
      tgt.x + dist * Math.cos(el) * Math.cos(az),
      Math.max(0.08, tgt.y + dist * Math.sin(el)),
      tgt.z + dist * Math.cos(el) * Math.sin(az)
    );
    camera.lookAt(tgt);
    camera.updateMatrixWorld();
    rig.rotation.y = -az; // luces siguiendo a la cámara

    const idx = Math.round(u);
    setStep(idx);
    if (cue) cue.classList.toggle("off", prog > 0.03);
    stage.style.setProperty("--px", ptr.sx.toFixed(3));
    stage.style.setProperty("--py", ptr.sy.toFixed(3));

    // El marcador rojo se queda sobre la zona que explica el dato.
    if (hotspot) {
      proj.copy(tgt).project(camera);
      const x = (proj.x * 0.5 + 0.5) * stage.clientWidth;
      const y = (-proj.y * 0.5 + 0.5) * stage.clientHeight;
      hotspot.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
      hotspot.classList.toggle("on", modelReady && idx > 0 && Math.abs(u - idx) < 0.3);
    }

    if (renderer && modelReady) renderer.render(scene, camera);
  }

  /* ============================ eventos ============================ */
  if (window.IntersectionObserver) {
    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: 0 }).observe(section);
  }
  window.addEventListener("resize", resize, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType && e.pointerType !== "mouse") return;
    ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
    ptr.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  resize();
  prog = readProgress();
  setStep(0);
  requestAnimationFrame(tick);

  // Expuesto para pruebas automatizadas.
  window.__modelo = { get ready() { return modelReady; }, get step() { return step; }, get progress() { return prog; }, dims };
}
