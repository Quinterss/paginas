/* forklift.js — montacargas contrabalanceado SV-250, armado con geometría suave
 * (bordes redondeados, cilindros de alta densidad) y materiales PBR: chapa pintada
 * con barniz, goma, acero, cromado y vidrio. Reemplaza al .glb poligonal.
 *
 * Unidades: metros. Largo sobre X (uñas hacia +X), alto en Y, ancho en Z.
 * Medidas de referencia de un equipo de 2,5 t: 3,7 m con uñas, 1,2 m de ancho,
 * 2,3 m de mástil y 2,15 m hasta el techo de la cabina protectora.
 */

import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* Caja con aristas redondeadas: se proyectan los vértices sobre el borde de un
 * radio r (SDF) y se sueldan para que la luz corra sin facetas. */
function rounded(w, h, d, r = 0.03, seg = 6) {
  const box = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  box.deleteAttribute("normal");
  box.deleteAttribute("uv");
  const geo = mergeVertices(box, 1e-4);
  const pos = geo.attributes.position;
  const hx = Math.max(0.0001, w / 2 - r);
  const hy = Math.max(0.0001, h / 2 - r);
  const hz = Math.max(0.0001, d / 2 - r);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const qx = clamp(v.x, -hx, hx);
    const qy = clamp(v.y, -hy, hy);
    const qz = clamp(v.z, -hz, hz);
    const dx = v.x - qx, dy = v.y - qy, dz = v.z - qz;
    const len = Math.hypot(dx, dy, dz) || 1;
    pos.setXYZ(i, qx + (dx / len) * r, qy + (dy / len) * r, qz + (dz / len) * r);
  }
  geo.computeVertexNormals();
  return geo;
}

const cyl = (rTop, rBot, h, seg = 40) => new THREE.CylinderGeometry(rTop, rBot, h, seg, 1);

/* Ruido suave para el mapa de rugosidad: la pintura deja de verse "plástico plano". */
function noiseTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 150 + Math.random() * 70;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

/* Calcomanía con el nombre de la marca. */
function brandTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 50px 'Segoe UI', system-ui, sans-serif";
  const text = "SANTA VICTORIA";
  const track = 6;
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + track * (text.length - 1);
  let x = 256 - total / 2;
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x + widths[i] / 2, 66);
    x += widths[i] + track;
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createForklift() {
  const root = new THREE.Group();
  root.name = "SV-250";

  /* ---------------------------- materiales ---------------------------- */
  const grain = noiseTexture();
  const paint = new THREE.MeshPhysicalMaterial({
    color: 0xab332e, metalness: 0.3, roughness: 0.52,
    roughnessMap: grain, clearcoat: 0.85, clearcoatRoughness: 0.24, envMapIntensity: 1.1
  });
  const paintDark = new THREE.MeshPhysicalMaterial({
    color: 0x83241f, metalness: 0.32, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.25
  });
  const frame = new THREE.MeshStandardMaterial({ color: 0x24282e, metalness: 0.6, roughness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xa4abb2, metalness: 0.88, roughness: 0.36 });
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x4a5158, metalness: 0.8, roughness: 0.45 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd9dee4, metalness: 1, roughness: 0.12 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141519, metalness: 0, roughness: 0.96 });
  const vinyl = new THREE.MeshStandardMaterial({ color: 0x1c1f23, metalness: 0.04, roughness: 0.8 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x0e1013, metalness: 0.12, roughness: 0.5 });
  const lens = new THREE.MeshStandardMaterial({ color: 0xf7f3e0, emissive: 0xfff2cc, emissiveIntensity: 0.8, roughness: 0.2 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x5c0f0f, emissive: 0xc02018, emissiveIntensity: 0.8, roughness: 0.3 });

  /* ---------------------------- helpers ---------------------------- */
  const put = (geo, mat, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };

  /* ============================ ruedas ============================ */
  const wheel = (x, z, radius, width) => {
    const g = new THREE.Group();
    g.position.set(x, radius, z);
    const flip = [Math.PI / 2, 0, 0]; // eje del cilindro → Z

    const tire = new THREE.Mesh(cyl(radius, radius, width, 64), rubber);
    tire.rotation.set(...flip);
    g.add(tire);

    // hombros redondeados
    [-1, 1].forEach((side) => {
      const shoulder = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.9, radius * 0.11, 12, 56), rubber);
      shoulder.position.z = side * (width / 2 - radius * 0.03);
      g.add(shoulder);
    });

    // banda de rodadura
    const blocks = 30;
    const tread = new THREE.BoxGeometry(0.042, (2 * Math.PI * radius) / blocks - 0.022, width * 0.84);
    for (let i = 0; i < blocks; i++) {
      const a = (i / blocks) * Math.PI * 2;
      const b = new THREE.Mesh(tread, rubber);
      b.position.set(Math.cos(a) * (radius - 0.004), Math.sin(a) * (radius - 0.004), 0);
      b.rotation.z = a;
      g.add(b);
    }

    // llanta, buje y tuercas
    const rim = new THREE.Mesh(cyl(radius * 0.55, radius * 0.55, width * 0.88, 48), steelDark);
    rim.rotation.set(...flip);
    g.add(rim);
    const face = new THREE.Mesh(cyl(radius * 0.5, radius * 0.5, width * 0.92, 48), steel);
    face.rotation.set(...flip);
    g.add(face);
    const hub = new THREE.Mesh(cyl(radius * 0.24, radius * 0.24, width * 0.98, 28), plastic);
    hub.rotation.set(...flip);
    g.add(hub);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const nut = new THREE.Mesh(cyl(0.015, 0.015, width * 1.01, 10), chrome);
      nut.rotation.set(...flip);
      nut.position.set(Math.cos(a) * radius * 0.36, Math.sin(a) * radius * 0.36, 0);
      g.add(nut);
    }
    g.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    root.add(g);
  };

  const FRONT = { x: 0.76, z: 0.47, r: 0.33, w: 0.25 };
  const REAR = { x: -0.9, z: 0.42, r: 0.25, w: 0.18 };
  wheel(FRONT.x, FRONT.z, FRONT.r, FRONT.w);
  wheel(FRONT.x, -FRONT.z, FRONT.r, FRONT.w);
  wheel(REAR.x, REAR.z, REAR.r, REAR.w);
  wheel(REAR.x, -REAR.z, REAR.r, REAR.w);

  /* ============================ chasis ============================ */
  put(rounded(1.6, 0.15, 0.88, 0.02), frame, [0.04, 0.53, 0]);
  put(rounded(0.72, 0.08, 0.96, 0.015), steelDark, [0.58, 0.66, 0]);       // piso del operador
  put(rounded(0.22, 0.2, 0.86, 0.02), frame, [0.95, 0.6, 0]);              // travesaño del mástil

  // cuerpo: paneles planos con filo apenas redondeado (nada de formas infladas)
  put(rounded(1.4, 0.44, 1.0, 0.032, 7), paint, [0.16, 0.86, 0]);
  put(rounded(0.62, 0.24, 0.16, 0.03), paint, [0.72, 0.63, 0.51]);         // guardabarros
  put(rounded(0.62, 0.24, 0.16, 0.03), paint, [0.72, 0.63, -0.51]);
  put(rounded(0.46, 0.07, 0.9, 0.02), paintDark, [0.3, 1.07, 0]);          // junta de chapa
  put(rounded(0.03, 0.3, 0.9, 0.012), frame, [0.86, 0.9, 0]);              // moldura frontal

  // contrapeso
  put(rounded(0.78, 0.8, 1.12, 0.06, 7), paint, [-0.9, 0.66, 0]);
  put(rounded(0.6, 0.18, 1.0, 0.05, 7), paint, [-0.96, 1.12, 0]);
  put(rounded(0.22, 0.34, 0.88, 0.04), paintDark, [-1.3, 0.52, 0]);        // zócalo
  put(rounded(0.06, 0.2, 0.24, 0.02), steel, [-1.35, 0.62, 0]);            // placa de tiro

  // rejillas del contrapeso
  for (let i = 0; i < 4; i++) {
    put(rounded(0.02, 0.028, 0.46, 0.006), frame, [-1.33, 0.76 + i * 0.075, 0]);
  }

  /* ============================ puesto de mando ============================ */
  put(rounded(0.62, 0.17, 0.86, 0.03, 7), paint, [-0.03, 1.16, 0]);        // tapa de la batería
  put(rounded(0.54, 0.18, 0.46, 0.03), frame, [-0.16, 1.28, 0]);
  put(rounded(0.5, 0.12, 0.46, 0.045), vinyl, [-0.16, 1.41, 0]);           // almohadón
  put(rounded(0.14, 0.52, 0.46, 0.045), vinyl, [-0.42, 1.66, 0], [0, 0, 0.16]); // respaldo
  put(rounded(0.1, 0.16, 0.3, 0.04), vinyl, [-0.46, 1.94, 0], [0, 0, 0.16]);    // apoyacabezas

  // cinturón
  put(rounded(0.02, 0.34, 0.07, 0.008), frame, [-0.34, 1.5, 0.16], [0, 0, -0.32]);
  put(rounded(0.02, 0.34, 0.07, 0.008), frame, [0.02, 1.5, 0.2], [0, 0, 0.28]);

  // columna y volante
  put(cyl(0.042, 0.048, 0.34, 24), plastic, [0.3, 1.25, 0], [0, 0, -0.62]);
  const wheelGroup = new THREE.Group();
  wheelGroup.add(new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.019, 12, 56), plastic));
  const spoke = cyl(0.011, 0.011, 0.29, 10);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(spoke, plastic);
    s.rotation.z = (i / 3) * Math.PI * 2;
    wheelGroup.add(s);
  }
  const hubW = new THREE.Mesh(cyl(0.042, 0.042, 0.05, 20), frame);
  hubW.rotation.x = Math.PI / 2;
  wheelGroup.add(hubW);
  wheelGroup.position.set(0.19, 1.42, 0);
  wheelGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0.85, -0.53, 0).normalize());
  wheelGroup.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  root.add(wheelGroup);

  // tablero con pantalla
  put(rounded(0.15, 0.26, 0.4, 0.025), plastic, [0.44, 1.21, 0], [0, 0, -0.22]);
  put(new THREE.PlaneGeometry(0.1, 0.055), new THREE.MeshStandardMaterial({
    color: 0x0b1a22, emissive: 0x1a6f7a, emissiveIntensity: 0.6, roughness: 0.3
  }), [0.512, 1.27, 0], [0, Math.PI / 2, -0.22]);

  // palancas
  [-0.16, 0.02, 0.17].forEach((z, i) => {
    put(cyl(0.012, 0.012, 0.24, 10), chrome, [0.08, 1.3 + i * 0.01, z], [0.12, 0, 0.12]);
    put(new THREE.SphereGeometry(0.026, 14, 10), plastic, [0.09, 1.43 + i * 0.01, z]);
  });

  // pedales
  put(rounded(0.15, 0.02, 0.08, 0.008), steelDark, [0.8, 0.71, 0.12], [0, 0, -0.3]);
  put(rounded(0.15, 0.02, 0.08, 0.008), steelDark, [0.8, 0.71, -0.12], [0, 0, -0.3]);

  /* ============================ cabina protectora ============================ */
  const postGeo = rounded(0.07, 0.94, 0.07, 0.012);
  [[0.48, 0.5], [0.48, -0.5], [-0.78, 0.5], [-0.78, -0.5]].forEach(([x, z]) => {
    put(postGeo, frame, [x, 1.61, z]);
  });
  put(rounded(1.4, 0.07, 0.08, 0.012), frame, [-0.15, 2.12, 0.5]);
  put(rounded(1.4, 0.07, 0.08, 0.012), frame, [-0.15, 2.12, -0.5]);
  put(rounded(0.08, 0.07, 1.08, 0.012), frame, [0.48, 2.12, 0]);
  put(rounded(0.08, 0.07, 1.08, 0.012), frame, [-0.78, 2.12, 0]);
  [-0.3, -0.02, 0.26].forEach((x) => {
    put(rounded(0.045, 0.04, 0.96, 0.01), frame, [x, 2.13, 0]);
  });

  // faros y pilotos
  [0.32, -0.32].forEach((z) => {
    put(cyl(0.048, 0.048, 0.07, 20), plastic, [0.5, 2.0, z], [0, 0, Math.PI / 2]);
    put(cyl(0.04, 0.04, 0.02, 20), lens, [0.54, 2.0, z], [0, 0, Math.PI / 2]);
  });
  [0.4, -0.4].forEach((z) => {
    put(rounded(0.03, 0.085, 0.13, 0.01), tail, [-1.3, 0.94, z]);
  });

  /* ============================ mástil ============================ */
  const mastX = 1.08;
  put(rounded(0.32, 0.13, 0.74, 0.02), frame, [mastX - 0.03, 0.37, 0]);    // base

  // largueros exteriores: perfil en C (alma + dos alas) pintado del color del equipo
  const channel = (x, y, h, z, mat, web = 0.03, wing = 0.11, depth = 0.14) => {
    put(rounded(web, h, depth, 0.008), mat, [x, y, z]);
    put(rounded(wing, h, 0.022, 0.008), mat, [x + web / 2 - wing / 2, y, z + depth / 2 - 0.011]);
    put(rounded(wing, h, 0.022, 0.008), mat, [x + web / 2 - wing / 2, y, z - depth / 2 + 0.011]);
  };
  [0.29, -0.29].forEach((z) => channel(mastX - 0.02, 1.36, 1.92, z, paint, 0.03, 0.13, 0.16));
  [0.2, -0.2].forEach((z) => channel(mastX + 0.11, 1.24, 1.68, z, steel, 0.025, 0.09, 0.11));

  put(rounded(0.14, 0.1, 0.68, 0.015), paint, [mastX, 2.3, 0]);            // travesaño superior
  put(rounded(0.14, 0.1, 0.68, 0.015), paint, [mastX, 0.44, 0]);

  // cilindros de elevación (camisa + vástago cromado)
  [0.1, -0.1].forEach((z) => {
    put(cyl(0.048, 0.048, 0.9, 20), frame, [mastX + 0.04, 0.9, z]);
    put(cyl(0.03, 0.03, 1.32, 20), chrome, [mastX + 0.04, 1.34, z]);
  });

  // cadenas de elevación
  [0.23, -0.23].forEach((z) => {
    put(rounded(0.022, 1.5, 0.012, 0.005), steelDark, [mastX + 0.16, 1.3, z]);
  });

  // carro portaúñas + desplazamiento lateral
  put(rounded(0.06, 0.42, 0.76, 0.015), steelDark, [mastX + 0.21, 0.66, 0]);
  put(rounded(0.13, 0.2, 0.54, 0.02), frame, [mastX + 0.29, 0.7, 0]);
  [0.28, -0.28].forEach((z) => {
    put(cyl(0.028, 0.028, 0.05, 14), steel, [mastX + 0.2, 0.84, z], [0, 0, Math.PI / 2]);
  });

  // respaldo de carga: rejilla vertical arriba del carro
  put(rounded(0.03, 0.04, 0.7, 0.01), steelDark, [mastX + 0.23, 1.31, 0]);
  put(rounded(0.03, 0.04, 0.7, 0.01), steelDark, [mastX + 0.23, 0.9, 0]);
  [0.33, -0.33].forEach((z) => put(rounded(0.03, 0.45, 0.04, 0.008), steelDark, [mastX + 0.23, 1.1, z]));
  for (let i = -2; i <= 2; i++) {
    put(rounded(0.026, 0.42, 0.026, 0.008), steelDark, [mastX + 0.23, 1.1, i * 0.135]);
  }

  // uñas, apoyadas sobre el carro
  [0.19, -0.19].forEach((z) => {
    put(rounded(0.065, 0.54, 0.115, 0.014), steelDark, [mastX + 0.3, 0.4, z]);
    put(rounded(1.02, 0.048, 0.115, 0.014), steel, [mastX + 0.81, 0.11, z]);
    put(rounded(0.11, 0.06, 0.115, 0.012), steelDark, [mastX + 0.35, 0.15, z]);
  });

  // mangueras hidráulicas
  const hose = new THREE.CatmullRomCurve3([
    new THREE.Vector3(mastX - 0.16, 0.6, 0.2),
    new THREE.Vector3(mastX - 0.04, 0.76, 0.22),
    new THREE.Vector3(mastX + 0.1, 1.04, 0.2),
    new THREE.Vector3(mastX + 0.17, 0.88, 0.18)
  ]);
  put(new THREE.TubeGeometry(hose, 36, 0.016, 8, false), rubber, [0, 0, 0]);

  /* ============================ calcomanías ============================ */
  const decalMat = new THREE.MeshBasicMaterial({
    map: brandTexture(), transparent: true, depthWrite: false, toneMapped: false
  });
  [0.566, -0.566].forEach((z, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.13), decalMat);
    m.position.set(-0.9, 0.8, z);
    m.rotation.y = i === 0 ? 0 : Math.PI;
    root.add(m);
  });

  // placa de datos y número de unidad en el mástil
  const plate = document.createElement("canvas");
  plate.width = 256;
  plate.height = 160;
  const pctx = plate.getContext("2d");
  pctx.fillStyle = "#d7dade";
  pctx.fillRect(0, 0, 256, 160);
  pctx.fillStyle = "#2b3037";
  pctx.font = "700 22px 'Segoe UI', sans-serif";
  pctx.fillText("SV-250", 16, 34);
  pctx.font = "12px 'Segoe UI', sans-serif";
  ["CAPACIDAD 2.500 kg", "ALTURA 4.500 mm", "SERIE 2026-0418", "PESO 3.640 kg"].forEach((line, i) => {
    pctx.fillText(line, 16, 62 + i * 20);
  });
  const plateTex = new THREE.CanvasTexture(plate);
  plateTex.colorSpace = THREE.SRGBColorSpace;
  const plateMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.17, 0.106),
    new THREE.MeshStandardMaterial({ map: plateTex, metalness: 0.4, roughness: 0.55 })
  );
  plateMesh.position.set(mastX + 0.075, 0.66, 0.3);
  plateMesh.rotation.y = Math.PI / 2;
  root.add(plateMesh);

  root.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  return root;
}
