/* Montacargas del Plata — contacto, fondo animado y reacciones al mouse. */
(function () {
  "use strict";

  var WHATSAPP_NUMBER = "5491140000000"; // ← reemplazar por el número real (formato internacional, sin +)
  var MENSAJE = "Hola, quiero cotizar un alquiler de montacargas.";

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var hasIO = "IntersectionObserver" in window;

  /* ============================ CONTACTO ============================ */
  // Un solo número para todos los botones "Cotizar".
  var quoteUrl = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(MENSAJE);
  $$("[data-quote]").forEach(function (a) { a.href = quoteUrl; a.target = "_blank"; a.rel = "noopener"; });

  /* ============================ FONDO ANIMADO (rojo) ============================ */
  var glow = $("#hero-glow");
  if (glow && window.LightRipple) {
    try {
      window.LightRipple.mount(glow, { preset: "crimson", energy: "balanced", lineWidth: 0.0035, brightness: 0.95 });
    } catch (error) {
      if (window.console) console.warn("El fondo animado no se pudo iniciar:", error.message);
    }
  }

  /* ============================ APARICIÓN AL HACER SCROLL ============================ */
  var rv = $$(".rv");
  rv.forEach(function (el) {
    // Escalonado entre hermanos para que los bloques entren en cascada.
    var i = $$(".rv", el.parentNode).indexOf(el);
    el.style.setProperty("--d", Math.max(0, i) * 0.09 + "s");
  });
  if (hasIO && !reduce) {
    var ioRv = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        ioRv.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    rv.forEach(function (el) { ioRv.observe(el); });
  } else {
    rv.forEach(function (el) { el.classList.add("in"); });
  }

  /* ============================ CONTADORES ============================ */
  var counters = $$("[data-to]");
  function countUp(el) {
    var to = parseFloat(el.getAttribute("data-to")) || 0;
    var suffix = el.getAttribute("data-suffix") || "";
    var t0 = null;
    function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / 1100);
      var eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * eased) + suffix;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (hasIO && !reduce) {
    var ioCount = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        countUp(e.target);
        ioCount.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { ioCount.observe(el); });
  }

  /* ============================ BARRA DE PROGRESO ============================ */
  var progress = $("#progress");
  var ticking = false;
  function updateProgress() {
    ticking = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = "scaleX(" + (max > 0 ? Math.min(1, window.scrollY / max) : 0).toFixed(4) + ")";
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  updateProgress();

  /* ============================ REACCIONES AL MOUSE ============================ */
  if (fine && !reduce) {
    var hero = $(".hero");
    var photo = $(".hero__photo");
    var em = $("#hero-em");
    var finalSection = $("#cotizar");
    var cursor = $("#cursor");
    var heroVisible = true;
    var finalVisible = false;
    var p = { x: window.innerWidth / 2, y: window.innerHeight / 2, sx: window.innerWidth / 2, sy: window.innerHeight / 2 };
    var running = false;

    if (hasIO) {
      new IntersectionObserver(function (en) { heroVisible = en[0].isIntersecting; }).observe(hero);
      new IntersectionObserver(function (en) { finalVisible = en[0].isIntersecting; }).observe(finalSection);
    }

    function loop() {
      // Seguimiento suave: el cursor "persigue" al puntero en vez de pegarse a él.
      p.sx += (p.x - p.sx) * 0.16;
      p.sy += (p.y - p.sy) * 0.16;
      cursor.style.transform = "translate3d(" + p.sx.toFixed(1) + "px," + p.sy.toFixed(1) + "px,0)";

      if (heroVisible) {
        var r = hero.getBoundingClientRect();
        var nx = (p.sx - r.left) / r.width - 0.5;
        var ny = (p.sy - r.top) / r.height - 0.5;
        hero.style.setProperty("--mx", (p.sx - r.left).toFixed(0) + "px");
        hero.style.setProperty("--my", (p.sy - r.top).toFixed(0) + "px");
        photo.style.transform = "translate3d(" + (-nx * 26).toFixed(1) + "px," + (-ny * 16).toFixed(1) + "px,0) scale(1.06)";
        var er = em.getBoundingClientRect();
        em.style.setProperty("--ex", (p.sx - er.left).toFixed(0) + "px");
        em.style.setProperty("--ey", (p.sy - er.top).toFixed(0) + "px");
      }
      if (finalVisible) finalSection.style.setProperty("--fx", (p.sx / window.innerWidth * 100).toFixed(1) + "%");

      if (Math.abs(p.x - p.sx) + Math.abs(p.y - p.sy) > 0.15) requestAnimationFrame(loop);
      else running = false;
    }

    window.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      p.x = e.clientX; p.y = e.clientY;
      cursor.classList.add("on");
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", function () { cursor.classList.remove("on"); });

    // El anillo crece sobre todo lo que se puede tocar.
    document.addEventListener("pointerover", function (e) {
      cursor.classList.toggle("is-hot", !!(e.target.closest && e.target.closest("a, button, .rows__item, .reach__zones li")));
    });

    // Botones magnéticos: se inclinan hacia el puntero y vuelven al soltarlo.
    $$(".mag").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var b = el.getBoundingClientRect();
        var dx = e.clientX - (b.left + b.width / 2);
        var dy = e.clientY - (b.top + b.height / 2);
        el.style.transform = "translate(" + (dx * 0.22).toFixed(1) + "px," + (dy * 0.32).toFixed(1) + "px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });

    // Las filas iluminan en rojo justo donde está el puntero.
    $$(".rows__item").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        el.style.setProperty("--rx", (e.clientX - el.getBoundingClientRect().left) + "px");
      });
    });
  }

  /* ============================ AÑO ============================ */
  var year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
