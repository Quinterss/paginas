/* model.js — Montacargas estándar en 3D, gira con el scroll.
 *
 * Modelo: "Forklift" de KolosStudios vía Poly Pizza (Creative Commons Attribution).
 * Three.js r160 descargado localmente: el sitio sigue sin pedir nada a terceros.
 *
 * El scroll define el objetivo de rotación; un lerp por cuadro la acerca, así que
 * el giro queda suave y "pegado" a la velocidad del scroll en lugar de saltar.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL = "assets/model/forklift.glb";
const TAU = Math.PI * 2;
// Vista inicial en 3/4: sin este offset el modelo arranca de frente al botón,
// que es la vista menos legible de un montacargas.
const BASE_YAW = -0.62;

const section = document.getElementById("modelo-estandar");
const canvas = document.getElementById("model-canvas");
const degreesOut = document.getElementById("model-deg");
const stages = Array.from(document.querySelectorAll(".showcase__note"));
const stageOut = document.getElementById("model-stage");

if (section && canvas) {
  const stageBox = section.querySelector(".showcase__stage");

  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (error) {
    renderer = null;
  }

  if (!renderer) {
    // Sin WebGL: la sección no queda vacía, muestra la foto de respaldo.
    section.classList.add("showcase--fallback");
  } else {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 80);
    // Encuadre adaptativo: se calcula cuando carga el modelo, a partir de su
    // caja real. De acá salen el punto de mira y la distancia de la cámara.
    const framing = { center: new THREE.Vector3(0, 0.7, 0), distance: 4.2 };
    camera.position.set(0, 0.9, framing.distance);
    camera.lookAt(framing.center);

    // Luz tipo estudio: clave blanca, contraluz rojo de marca y relleno frío.
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(3, 5, 4);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xff2a38, 3.2);
    rim.position.set(-4, 1.6, -3);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0x8fb6ff, 0.9);
    fill.position.set(-2, 0.5, 3);
    scene.add(fill);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    // Suelo: degradado radial generado en canvas (sin texturas externas).
    const groundTexture = (() => {
      const size = 256;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d");
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, "rgba(200,200,200,0.28)");
      g.addColorStop(0.45, "rgba(160,160,160,0.12)");
      g.addColorStop(1, "rgba(120,120,120,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(c);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    })();

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(5.2, 5.2),
      new THREE.MeshBasicMaterial({ map: groundTexture, transparent: true, depthWrite: false, opacity: 0.42 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;   // el modelo se apoya sobre y=0
    scene.add(ground);

    const pivot = new THREE.Group();
    scene.add(pivot);

    /* -------------------- rotación ligada al progreso del scroll -------------------- */

    let visible = false;
    let modelReady = false;
    let frame = 0;

    let target = 0;  // 0..1 según scroll
    let current = 0; // suavizado con lerp
    let yaw = BASE_YAW;
    const LERP = 0.06; // muy fluido, sin brusquedad

    function readProgress() {
      const rect = section.getBoundingClientRect();
      const travel = section.offsetHeight - stageBox.offsetHeight;
      if (travel <= 0) return 0;
      const scrolled = -rect.top;
      return Math.min(1, Math.max(0, scrolled / travel));
    }

    function resize() {
      const w = stageBox.clientWidth || window.innerWidth;
      const h = stageBox.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function setStage(index) {
      stages.forEach((el, i) => el.classList.toggle("is-active", i === index));
      if (stageOut) stageOut.textContent = stages[index] ? stages[index].dataset.title : "";
    }

    function tick() {
      frame = requestAnimationFrame(tick);
      if (!visible) return;

      target = readProgress();
      current += (target - current) * LERP;

      yaw = BASE_YAW + current * TAU;
      pivot.rotation.y = yaw;

      camera.position.set(
        framing.center.x,
        framing.center.y + 0.22 + 0.28 * current,
        framing.distance - 0.55 * Math.sin(current * Math.PI)
      );
      camera.lookAt(framing.center);

      if (degreesOut) {
        const deg = Math.round((yaw / TAU * 360) % 360 + 360) % 360;
        degreesOut.textContent = String(deg).padStart(3, "0") + "°";
      }
      setStage(Math.min(stages.length - 1, Math.floor(current * stages.length + 0.0001)));

      renderer.render(scene, camera);
    }

    /* --------------------------- carga del modelo --------------------------- */

    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        const object = gltf.scene;

        // El GLB trae los vértices lejos del origen (el exportador de FBX
        // horneó la traslación), así que el orden importa: primero se escala,
        // recién ahí se mide y se centra. Si se centrara antes, el scale
        // multiplicaría ese desplazamiento y el modelo saldría del cuadro.
        const before = new THREE.Box3().setFromObject(object);
        const size0 = before.getSize(new THREE.Vector3());
        const maxDim = Math.max(size0.x, size0.y, size0.z) || 1;
        object.scale.setScalar(2 / maxDim);

        const scaled = new THREE.Box3().setFromObject(object);
        const center = scaled.getCenter(new THREE.Vector3());
        object.position.sub(center);            // centrar en X e Z
        object.position.y += center.y - scaled.min.y;  // apoyar sobre el suelo

        // Encuadre: distancia de cámara para que la caja llene el cuadro con
        // aire alrededor, mirando al centro real del modelo.
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const c = box.getCenter(new THREE.Vector3());
        const vFov = THREE.MathUtils.degToRad(camera.fov);
        const distPorAlto = (size.y * 0.5) / Math.tan(vFov * 0.5);
        const distPorAncho = (Math.max(size.x, size.z) * 0.5) /
          (Math.tan(vFov * 0.5) * camera.aspect);
        framing.center.set(c.x, c.y, c.z);
        framing.distance = Math.max(distPorAlto, distPorAncho) * 1.45;

        object.traverse((node) => {
          if (!node.isMesh) return;
          const mat = node.material.clone();
          mat.metalness = 0.58;
          mat.roughness = 0.28;
          mat.envMapIntensity = 1.2;
          if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
          if (mat.aoMap) mat.aoMap.colorSpace = THREE.LinearSRGBColorSpace;
          if (mat.normalMap) mat.normalMap.colorSpace = THREE.LinearSRGBColorSpace;
          node.material = mat;
        });

        pivot.add(object);
        modelReady = true;
        section.classList.add("showcase--ready");
        resize();
      },
      undefined,
      () => {
        // Si el modelo no carga, se muestra la foto de respaldo.
        section.classList.add("showcase--fallback");
        canvas.hidden = true;
      }
    );

    /* --------------------------- eventos --------------------------- */

    if (window.IntersectionObserver) {
      const io = new IntersectionObserver(
        (entries) => { visible = entries[0].isIntersecting; },
        { threshold: 0 }
      );
      io.observe(section);
    } else {
      visible = true;
    }

    window.addEventListener("resize", resize, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stageBox);

    resize();
    current = readProgress();
    tick();

    // Expuesto para pruebas automatizadas.
    window.__modelo = {
      get ready() { return modelReady; },
      get target() { return target; },
      get current() { return current; },
      get yaw() { return yaw; },
      draw() { renderer.render(scene, camera); },
      pivot
    };
  }
}
