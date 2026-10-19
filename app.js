/* Montacargas del Plata — pestañas, fondo animado y formulario. */
(function () {
  "use strict";

  var WHATSAPP_NUMBER = "5491140000000"; // ← reemplazar por el número real (formato internacional, sin +)

  /* ============================ PESTAÑAS ============================ */

  var TABS = ["inicio", "servicios", "flota", "cobertura", "contacto"];
  // Enlaces viejos o atajos que deben abrir una pestaña concreta.
  var ALIAS = { faq: "contacto", cotizar: "contacto", contacto: "contacto", inicio: "inicio" };

  var tablist = document.querySelector('[role="tablist"]');
  var tabs = tablist ? Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]')) : [];
  var panels = tabs.map(function (tab) {
    return document.getElementById(tab.getAttribute("aria-controls"));
  });

  function indexOfTab(name) {
    return TABS.indexOf(name);
  }

  function activate(name, options) {
    var opts = options || {};
    var index = indexOfTab(name);
    if (index < 0) return;

    tabs.forEach(function (tab, i) {
      var selected = i === index;
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      tab.tabIndex = selected ? 0 : -1;
      if (panels[i]) panels[i].hidden = !selected;
    });

    // Las imágenes con loading="lazy" dentro de un panel que arranca en
    // display:none nunca empiezan a cargar cuando la pestaña se abre: el
    // heurístico de lazy-loading no las re-evalúa. Forzamos la carga al activar.
    var opened = panels[index];
    if (opened) {
      Array.prototype.forEach.call(opened.querySelectorAll("img"), function (img) {
        if (img.complete || img.currentSrc) return;
        img.loading = "eager";
        img.src = img.getAttribute("src");
      });
    }

    if (opts.focus) tabs[index].focus();
    if (opts.scroll !== false) window.scrollTo(0, 0);
    if (opts.hash !== false) {
      try {
        window.history.replaceState(null, "", "#" + name);
      } catch (error) {
        /* file:// o contextos sin history: no es crítico */
      }
    }
  }

  if (tablist && tabs.length) {
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        activate(TABS[i]);
      });

      // Navegación con teclado del patrón ARIA de tabs.
      tab.addEventListener("keydown", function (event) {
        var next = null;
        if (event.key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        if (next === null) return;
        event.preventDefault();
        activate(TABS[next], { focus: true });
      });
    });

    // Cualquier enlace con data-tab cambia de pestaña en lugar de saltar.
    document.addEventListener("click", function (event) {
      var trigger = event.target.closest ? event.target.closest("[data-tab]") : null;
      if (!trigger) return;
      var name = trigger.getAttribute("data-tab");
      if (indexOfTab(name) < 0) return;
      event.preventDefault();
      activate(name);
    });

    window.addEventListener("hashchange", function () {
      var name = (location.hash || "").replace("#", "");
      activate(ALIAS[name] || name, { scroll: false, hash: false });
    });

    var initial = (location.hash || "").replace("#", "");
    activate(ALIAS[initial] || (indexOfTab(initial) >= 0 ? initial : "inicio"), {
      scroll: false,
      hash: false
    });
  }

  /* ============================ FONDO ANIMADO ============================
     Preset "noir" (plata neutra): la página es monocroma, el shader suma luz
     blanca sobre la foto con mix-blend-mode: screen desde el CSS. */
  var heroGlow = document.getElementById("hero-glow");
  if (heroGlow && window.LightRipple) {
    try {
      window.LightRipple.mount(heroGlow, {
        preset: "noir",
        energy: "balanced",
        lineWidth: 0.0035,
        brightness: 1.1
      });
    } catch (error) {
      if (window.console) console.warn("El fondo animado no se pudo iniciar:", error.message);
    }
  }

  /* ============================ FICHA TÉCNICA ============================
     "Agregar al carrito" marca el equipo en el contador de arriba;
     "Cotizar" arma el mensaje con lo seleccionado. */

  var cart = [];
  var cartCount = document.getElementById("cart-count");
  var cartIndicator = document.getElementById("cart-indicator");
  var addButton = document.getElementById("add-to-cart");
  var quoteButton = document.getElementById("quote-selection");
  var topbarQuote = document.getElementById("topbar-quote");
  var fichaStatus = document.getElementById("ficha-status");
  var FICHA = {
    sku: "MDP-250-48V",
    nombre: "MDP-250 Eléctrico (2.500 kg, elevación 4,50 m)"
  };

  function renderCart() {
    if (cartCount) cartCount.textContent = String(cart.length);
    if (cartIndicator) cartIndicator.classList.toggle("is-on", cart.length > 0);
  }

  function quoteText() {
    var lineas = ["Hola, quiero cotizar un alquiler de montacargas.", ""];
    if (cart.length) {
      lineas.push("Equipos seleccionados:");
      cart.forEach(function (item) { lineas.push(" · " + item.nombre + " [" + item.sku + "]"); });
      lineas.push("");
    } else {
      lineas.push("Equipo: " + FICHA.nombre + " [" + FICHA.sku + "]");
      lineas.push("");
    }
    lineas.push("Plazo: Por hora o jornada (mínimo 4 h)");
    lineas.push("Detalle: ");
    return lineas.join("\n");
  }

  if (addButton) {
    addButton.addEventListener("click", function () {
      if (cart.some(function (item) { return item.sku === FICHA.sku; })) {
        if (fichaStatus) {
          fichaStatus.textContent = "Ya está en tu selección (" + cart.length + ").";
          fichaStatus.classList.add("is-ok");
        }
        return;
      }
      cart.push({ sku: FICHA.sku, nombre: FICHA.nombre });
      renderCart();
      if (fichaStatus) {
        fichaStatus.textContent = "Agregado a tu selección · " + cart.length + " equipo" + (cart.length === 1 ? "" : "s") + " marcado" + (cart.length === 1 ? "" : "s") + ".";
        fichaStatus.classList.add("is-ok");
      }
      if (addButton.firstChild) addButton.firstChild.textContent = "Agregado ";
    });
  }

  if (quoteButton) {
    quoteButton.addEventListener("click", function () {
      var url = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(quoteText());
      var opened = window.open(url, "_blank", "noopener");
      if (fichaStatus) {
        fichaStatus.textContent = opened ? "Abrimos WhatsApp con la ficha y tu selección." : "No pudimos abrir WhatsApp.";
        fichaStatus.classList.toggle("is-ok", !!opened);
      }
    });
  }

  if (topbarQuote) {
    topbarQuote.addEventListener("click", function (event) {
      if (!cart.length) return; // sin selección, el enlace normal de WhatsApp manda
      event.preventDefault();
      window.open("https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(quoteText()), "_blank", "noopener");
    });
  }

  renderCart();

  /* ============================ FORMULARIO → WHATSAPP ============================ */

  var form = document.getElementById("quote-form");
  var status = document.getElementById("form-status");

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var data = new FormData(form);
      var nombre = (data.get("nombre") || "").toString().trim();
      var telefono = (data.get("telefono") || "").toString().trim();

      var missing = [];
      if (!nombre) missing.push("nombre");
      if (!telefono) missing.push("teléfono");

      if (missing.length) {
        status.textContent = "Falta completar: " + missing.join(" y ") + ".";
        var firstEmpty = form.querySelector(missing[0] === "nombre" ? "#nombre" : "#telefono");
        if (firstEmpty) firstEmpty.focus();
        return;
      }

      var lineas = [
        "Hola, quiero cotizar un alquiler de montacargas.",
        "",
        "Nombre: " + nombre,
        "Empresa: " + ((data.get("empresa") || "").toString().trim() || "—"),
        "Teléfono: " + telefono,
        "Equipo: " + (data.get("equipo") || "—"),
        "Plazo: " + (data.get("plazo") || "—"),
        "Detalle: " + ((data.get("detalle") || "").toString().trim() || "—")
      ];

      var url = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(lineas.join("\n"));
      var opened = window.open(url, "_blank", "noopener");
      status.textContent = opened
        ? "Abrimos WhatsApp con tu consulta lista para enviar."
        : "No pudimos abrir WhatsApp: escribinos a wa.me/" + WHATSAPP_NUMBER;
    });
  }

  /* ============================ AÑO ============================ */

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
