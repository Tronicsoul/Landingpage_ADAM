// Einwilligung (Cookie-Banner) und Laden von Tag Manager und Webanalyse
//
// Diese Datei wird auf allen Seiten im <head> geladen. Sie
//   1. setzt für Google-Dienste den Standard "alles abgelehnt" (Consent Mode v2),
//   2. zeigt beim ersten Besuch den Banner und merkt sich die Auswahl im Browser,
//   3. lädt den Google Tag Manager erst, nachdem Statistik oder Marketing erlaubt wurde.
//
// ZUM AKTIVIEREN die Werte in CONFIG eintragen. Solange gtmId leer ist, wird kein Tag Manager
// geladen und es werden keine Daten an Dritte übertragen, egal was im Banner gewählt wird.
// Welche Dienste dann tatsächlich laufen (z. B. Google Analytics, Google Ads, Meta Pixel),
// wird im Tag Manager eingestellt. Jeder dort aktivierte Dienst muss in datenschutz.html stehen.
// Im Tag Manager müssen die Tags an die Einwilligung gebunden sein (analytics_storage für
// Statistik, ad_storage/ad_user_data/ad_personalization für Marketing).

(function () {
  "use strict";

  var CONFIG = {
    // Google Tag Manager: Container-ID. Leer = wird nie geladen.
    // Im Container läuft Google Analytics 4 (Mess-ID G-PD2604L3NF), siehe datenschutz.html.
    gtmId: "GTM-KSDQNDDV",
    // Umami (cookiefreie Webanalyse): Adresse des Skripts und Website-ID. Leer = wird nicht geladen.
    umamiSrc: "",
    umamiWebsiteId: "",
    // Umami setzt keine Cookies und läuft laut Datenschutzerklärung auf Basis des berechtigten
    // Interesses. Auf true stellen, wenn es erst nach Zustimmung zu "Statistik" laden soll.
    umamiNeedsConsent: false,
  };

  var STORAGE_KEY = "adam-consent";
  var CONSENT_VERSION = 1; // erhöhen, wenn neue Dienste dazukommen: dann wird erneut gefragt
  var MAX_AGE_DAYS = 180;

  var gtmLoaded = false;
  var umamiLoaded = false;
  var banner = null;
  var lastFocus = null;

  // Google Consent Mode v2: Standard ist "abgelehnt", bis eine Auswahl vorliegt.
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
      /* Speicher nicht verfügbar (z. B. privates Fenster): Auswahl gilt nur für diesen Seitenaufruf */
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

  function loadGtm() {
    if (gtmLoaded || !CONFIG.gtmId) return;
    gtmLoaded = true;
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    loadScript("https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(CONFIG.gtmId));
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

  // Banner

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
      // Wurde eine Zustimmung zurückgenommen, laufen bereits geladene Dienste bis zum nächsten
      // Seitenaufruf weiter. Deshalb die Seite einmal neu laden.
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

  // Für den Link "Cookie-Einstellungen" im Fußbereich (data-consent-open).
  window.adamConsent = {
    open: function () {
      open(true);
    },
    get: readStored,
  };

  function init() {
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
