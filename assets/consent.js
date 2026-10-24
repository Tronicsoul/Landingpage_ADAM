(function () {
  "use strict";

  var CONFIG = {
    gtmId: "GTM-KSDQNDDV",

    umamiSrc: "",
    umamiWebsiteId: "",

    umamiNeedsConsent: false,

    goatcounterEndpoint: "https://adam-landingpage.goatcounter.com/count",
  };

  var scriptBase = (function () {
    var current = document.currentScript;
    return current && current.src ? current.src.replace(/[^/]*$/, "") : "assets/";
  })();

  var STORAGE_KEY = "adam-consent";
  var CONSENT_VERSION = 1;
  var MAX_AGE_DAYS = 180;

  var gtmLoaded = false;
  var umamiLoaded = false;
  var banner = null;
  var lastFocus = null;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });

  function readStored() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var state = JSON.parse(raw);
      if (!state || state.v !== CONSENT_VERSION) return null;
      var ageDays = (Date.now() - new Date(state.ts).getTime()) / 86400000;
      if (!(ageDays >= 0 && ageDays < MAX_AGE_DAYS)) return null;
      return { statistik: state.statistik === true, marketing: state.marketing === true };
    } catch (e) {
      return null;
    }
  }

  function store(state) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          v: CONSENT_VERSION,
          statistik: state.statistik,
          marketing: state.marketing,
          ts: new Date().toISOString(),
        })
      );
    } catch (e) {
    }
  }

  function loadScript(src, attributes) {
    var script = document.createElement("script");
    script.async = true;
    script.src = src;
    Object.keys(attributes || {}).forEach(function (name) {
      script.setAttribute(name, attributes[name]);
    });
    document.head.appendChild(script);
  }

  function currentVariant() {
    try {
      if (typeof window.getVariant === "function") return window.getVariant();
    } catch (e) {
    }
    return "direkt";
  }

  function loadGtm() {
    if (gtmLoaded || !CONFIG.gtmId) return;
    gtmLoaded = true;

    var variante = currentVariant();
    window.dataLayer.push({ variante: variante });
    gtag("set", { variante: variante });
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    loadScript("https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(CONFIG.gtmId));
  }

  function goatPath() {
    var keep = [];
    try {
      var params = new URLSearchParams(window.location.search);
      var variant = params.get("v");
      if (variant === "a" || variant === "b") keep.push("v=" + variant);
      var zg = params.get("zielgruppe");
      if (zg === "patient" || zg === "aerzte") keep.push("zielgruppe=" + zg);
    } catch (e) {
    }
    return window.location.pathname + (keep.length ? "?" + keep.join("&") : "");
  }

  function loadGoatCounter() {
    if (!CONFIG.goatcounterEndpoint || document.querySelector("script[data-goatcounter]")) return;
    window.goatcounter = window.goatcounter || {};
    window.goatcounter.path = goatPath;
    loadScript(scriptBase + "goatcounter.js", { "data-goatcounter": CONFIG.goatcounterEndpoint });
  }

  function loadUmami() {
    if (umamiLoaded || !CONFIG.umamiSrc || !CONFIG.umamiWebsiteId) return;
    umamiLoaded = true;
    loadScript(CONFIG.umamiSrc, { "data-website-id": CONFIG.umamiWebsiteId });
  }

  function apply(state) {
    gtag("consent", "update", {
      ad_storage: state.marketing ? "granted" : "denied",
      ad_user_data: state.marketing ? "granted" : "denied",
      ad_personalization: state.marketing ? "granted" : "denied",
      analytics_storage: state.statistik ? "granted" : "denied",
    });
    if (state.statistik || state.marketing) loadGtm();
    if (!CONFIG.umamiNeedsConsent || state.statistik) loadUmami();
  }

  function el(tag, attributes, children) {
    var node = document.createElement(tag);
    Object.keys(attributes || {}).forEach(function (name) {
      if (name === "text") node.textContent = attributes[name];
      else node.setAttribute(name, attributes[name]);
    });
    (children || []).forEach(function (child) {
      node.appendChild(child);
    });
    return node;
  }

  function option(name, title, description, locked) {
    var input = el("input", { type: "checkbox", name: name });
    if (locked) {
      input.checked = true;
      input.disabled = true;
    }
    return el("label", { class: "consent__option" }, [
      input,
      el("span", {}, [el("strong", { text: title }), el("span", { text: description })]),
    ]);
  }

  function buildBanner() {
    var text = el("p", { id: "consent-text" });
    text.appendChild(
      document.createTextNode(
        "Mit Ihrer Zustimmung nutzen wir Dienste für Statistik und Marketing. Sie können ablehnen und Ihre Auswahl jederzeit ändern. Mehr in der "
      )
    );
    text.appendChild(el("a", { href: "datenschutz.html", text: "Datenschutzerklärung" }));
    text.appendChild(document.createTextNode("."));

    var options = el("div", { class: "consent__options", hidden: "" }, [
      option("notwendig", "Notwendig", "Speichert nur Ihre Auswahl hier und das Farbschema.", true),
      option("statistik", "Statistik", "Zeigt uns, wie die Seite genutzt wird."),
      option("marketing", "Marketing", "Zeigt uns, ob unsere Anzeigen zu Anmeldungen führen."),
    ]);

    var accept = el("button", { type: "button", class: "btn consent__btn", text: "Alle akzeptieren" });
    var reject = el("button", { type: "button", class: "btn consent__btn", text: "Nur notwendige" });
    var save = el("button", { type: "button", class: "btn consent__btn", text: "Auswahl speichern", hidden: "" });
    var settings = el("button", { type: "button", class: "consent__link", text: "Einstellungen", "aria-expanded": "false" });

    var node = el(
      "div",
      { class: "consent", role: "dialog", "aria-modal": "false", "aria-labelledby": "consent-title", "aria-describedby": "consent-text" },
      [
        el("div", { class: "consent__inner" }, [
          el("div", { class: "consent__copy" }, [el("h2", { id: "consent-title", text: "Cookies und Datenschutz" }), text, options]),
          el("div", { class: "consent__actions" }, [accept, reject, save, settings]),
        ]),
      ]
    );

    function choose(state) {
      var before = readStored();
      store(state);
      apply(state);
      close();

      var withdrawn = before && ((before.statistik && !state.statistik) || (before.marketing && !state.marketing));
      if (withdrawn && gtmLoaded) window.location.reload();
    }

    accept.addEventListener("click", function () {
      choose({ statistik: true, marketing: true });
    });
    reject.addEventListener("click", function () {
      choose({ statistik: false, marketing: false });
    });
    save.addEventListener("click", function () {
      choose({
        statistik: options.querySelector('[name="statistik"]').checked,
        marketing: options.querySelector('[name="marketing"]').checked,
      });
    });
    settings.addEventListener("click", function () {
      var open = options.hasAttribute("hidden");
      if (open) {
        options.removeAttribute("hidden");
        save.removeAttribute("hidden");
      } else {
        options.setAttribute("hidden", "");
        save.setAttribute("hidden", "");
      }
      settings.setAttribute("aria-expanded", String(open));
    });

    node.setOptions = function (state, expanded) {
      options.querySelector('[name="statistik"]').checked = !!(state && state.statistik);
      options.querySelector('[name="marketing"]').checked = !!(state && state.marketing);
      if (expanded) {
        options.removeAttribute("hidden");
        save.removeAttribute("hidden");
        settings.setAttribute("aria-expanded", "true");
      }
    };
    node.firstButton = accept;
    return node;
  }

  function open(moveFocus) {
    if (!banner) banner = buildBanner();
    banner.setOptions(readStored(), !!moveFocus);
    if (!banner.isConnected) document.body.appendChild(banner);
    if (moveFocus) {
      lastFocus = document.activeElement;
      banner.firstButton.focus();
    }
  }

  function close() {
    if (banner && banner.isConnected) banner.remove();
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    lastFocus = null;
  }

  window.adamConsent = {
    open: function () {
      open(true);
    },
    get: readStored,
  };

  function init() {
    loadGoatCounter();
    var stored = readStored();
    if (stored) apply(stored);
    else {
      if (!CONFIG.umamiNeedsConsent) loadUmami();
      open(false);
    }
    document.querySelectorAll("[data-consent-open]").forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        open(true);
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
