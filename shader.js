/*!
 * light-ripple — fondo animado WebGL (puerto vanilla de la skill .agents/skills/light-ripple)
 *
 * El shader es idéntico al de la skill (mismo GLSL, mismos uniforms). Se usa WebGL
 * directo en lugar de Three.js porque acá no hay build step ni gestor de paquetes:
 * un solo quad de pantalla completa no justifica 600 KB de dependencia.
 *
 * Uso:
 *   const bg = mountLightRipple(document.querySelector("#hero-bg"), {
 *     preset: "solar", speed: 1
 *   });
 */
(function (global) {
  "use strict";

  /** Presets de la skill, con la misma semántica de props. */
  var PRESETS = {
    spectrum: { dispersion: 0.01, tint: null },
    wideSpectrum: { dispersion: 0.02, tint: null },
    ice: { tint: [0.3, 0.8, 1.0], brightness: 1.1 },
    solar: { tint: [1.0, 0.7, 0.25] },
    crimson: { tint: [1.0, 0.22, 0.18] },
    plasma: { tint: [1.0, 0.3, 0.9] },
    matrix: { tint: [0.35, 1.0, 0.45] },
    noir: { tint: [0.85, 0.88, 1.0], brightness: 0.95 }
  };

  var SPEEDS = { calm: 0.5, balanced: 1, fast: 1.8 };

  var VERTEX_SHADER = [
    "attribute vec3 position;",
    "void main() { gl_Position = vec4(position, 1.0); }"
  ].join("\n");

  var FRAGMENT_SHADER = [
    "precision highp float;",
    "uniform vec2 resolution;",
    "uniform float time;",
    "uniform float uLineWidth;",
    "uniform float uGrid;",
    "uniform float uDispersion;",
    "uniform vec3 uTint;",
    "uniform float uUseTint;",
    "uniform float uBrightness;",
    "",
    "void main(void) {",
    "  vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);",
    "  float t = time * 0.05;",
    "  vec3 color = vec3(0.0);",
    "  for (int j = 0; j < 3; j++) {",
    "    for (int i = 0; i < 5; i++) {",
    "      color[j] += uLineWidth * float(i * i) /",
    "        abs(fract(t - uDispersion * float(j) + float(i) * 0.01) * 5.0",
    "            - length(uv) + mod(uv.x + uv.y, uGrid));",
    "    }",
    "  }",
    "  float mono = (color.r + color.g + color.b) / 3.0;",
    "  vec3 finalColor = mix(color, mono * uTint, uUseTint);",
    "  gl_FragColor = vec4(finalColor * uBrightness, 1.0);",
    "}"
  ].join("\n");

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error("No compiló el shader " + (type === gl.VERTEX_SHADER ? "de vértices" : "de fragmentos") + ": " + log);
    }
    return shader;
  }

  /**
   * Monta el fondo en `container`. Devuelve un handle con destroy()/setOptions().
   * Si el dispositivo no soporta WebGL, deja un fondo estático por CSS y no rompe.
   */
  function mountLightRipple(container, options) {
    var opts = options || {};
    var params = {
      speed: typeof opts.speed === "number" ? opts.speed : SPEEDS[opts.energy] || SPEEDS.balanced,
      lineWidth: typeof opts.lineWidth === "number" ? opts.lineWidth : 0.002,
      grid: typeof opts.grid === "number" ? opts.grid : 0.2,
      dispersion: typeof opts.dispersion === "number" ? opts.dispersion : 0.01,
      tint: opts.tint || null,
      brightness: typeof opts.brightness === "number" ? opts.brightness : 1
    };

    var preset = PRESETS[opts.preset];
    if (preset) {
      if (preset.tint) params.tint = preset.tint;
      if (typeof preset.dispersion === "number") params.dispersion = preset.dispersion;
      if (typeof preset.brightness === "number") params.brightness = preset.brightness;
    }

    var canvas = document.createElement("canvas");
    canvas.className = "light-ripple__canvas";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    var gl = canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) {
      container.classList.add("light-ripple--fallback");
      return { destroy: function () { canvas.remove(); }, setOptions: function () {} };
    }

    var program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("No linkeó el programa: " + gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);
    var position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    var uniforms = {
      resolution: gl.getUniformLocation(program, "resolution"),
      time: gl.getUniformLocation(program, "time"),
      uLineWidth: gl.getUniformLocation(program, "uLineWidth"),
      uGrid: gl.getUniformLocation(program, "uGrid"),
      uDispersion: gl.getUniformLocation(program, "uDispersion"),
      uTint: gl.getUniformLocation(program, "uTint"),
      uUseTint: gl.getUniformLocation(program, "uUseTint"),
      uBrightness: gl.getUniformLocation(program, "uBrightness")
    };

    function applyUniforms() {
      gl.uniform1f(uniforms.uLineWidth, params.lineWidth);
      gl.uniform1f(uniforms.uGrid, params.grid);
      gl.uniform1f(uniforms.uDispersion, params.dispersion);
      gl.uniform3fv(uniforms.uTint, params.tint || [1, 1, 1]);
      gl.uniform1f(uniforms.uUseTint, params.tint ? 1.0 : 0.0);
      gl.uniform1f(uniforms.uBrightness, params.brightness);
    }
    applyUniforms();

    // El contenedor puede no tener layout todavía: una resolución 0 haría
    // dividir por cero dentro del shader.
    function resize() {
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      var width = container.clientWidth || global.innerWidth;
      var height = container.clientHeight || global.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    }
    resize();

    // Accesibilidad: con prefers-reduced-motion se congela en un cuadro fijo.
    var motionQuery = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var effectiveSpeed = motionQuery && motionQuery.matches ? 0 : params.speed;

    function onMotionChange(event) {
      effectiveSpeed = event.matches ? 0 : params.speed;
    }
    function onResize() {
      resize();
    }

    if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener("change", onMotionChange);
    global.addEventListener("resize", onResize);

    // El evento resize de window no cubre todos los casos (rotación de pantalla,
    // barra del navegador móvil, paneles que cambian de ancho): el observer mide
    // el contenedor directamente.
    var resizeObserver = null;
    if (global.ResizeObserver) {
      resizeObserver = new global.ResizeObserver(function () { resize(); });
      resizeObserver.observe(container);
    }

    // Solo se anima cuando el fondo está a la vista (ahorra batería).
    var visible = true;
    var observer = null;
    if (global.IntersectionObserver) {
      observer = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
      }, { threshold: 0 });
      observer.observe(container);
    }

    var animationId = 0;
    var time = 1.0;
    function animate() {
      animationId = global.requestAnimationFrame(animate);
      if (!visible) return;
      time += 0.05 * effectiveSpeed;
      gl.uniform1f(uniforms.time, time);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    animate();

    return {
      canvas: canvas,
      setOptions: function (next) {
        var merged = next || {};
        if (typeof merged.speed === "number") { params.speed = merged.speed; if (!motionQuery || !motionQuery.matches) effectiveSpeed = merged.speed; }
        if (typeof merged.lineWidth === "number") params.lineWidth = merged.lineWidth;
        if (typeof merged.grid === "number") params.grid = merged.grid;
        if (typeof merged.dispersion === "number") params.dispersion = merged.dispersion;
        if (typeof merged.brightness === "number") params.brightness = merged.brightness;
        if ("tint" in merged) params.tint = merged.tint;
        applyUniforms();
      },
      destroy: function () {
        global.cancelAnimationFrame(animationId);
        global.removeEventListener("resize", onResize);
        if (motionQuery && motionQuery.removeEventListener) motionQuery.removeEventListener("change", onMotionChange);
        if (observer) observer.disconnect();
        if (resizeObserver) resizeObserver.disconnect();
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        if (canvas.parentNode === container) container.removeChild(canvas);
      }
    };
  }

  global.LightRipple = { mount: mountLightRipple, presets: PRESETS, speeds: SPEEDS };
})(window);
