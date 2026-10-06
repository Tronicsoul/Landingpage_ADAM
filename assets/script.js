// A/B-Kampagne für Ärzt:innen
//
// Kampagnenlinks (je Anzeige ein Link, der Anzeigentext soll zur Überschrift der Variante passen):
//   ?v=a   Effektivität: "Mehr Überblick für ärztliche Entscheidungen"
//   ?v=b   Effizienz: "Mehr Zeit für das ärztliche Gespräch"
// Ohne Angabe öffnet sich ebenfalls die Ärzte-Ansicht: Sie zeigt Variante a, zählt aber nicht
// zum Test. Die Ärzte-Ansicht hat keinen Zielgruppen-Umschalter.
// Die Patienten-Ansicht mit Umschalter gibt es nur über ?zielgruppe=patient.
// Zielgruppe und Variante setzt das Inline-Skript am Anfang von <body> in index.html,
// die Varianten-Texte stehen dort im Hero (data-variant-content).
// Button, Angebot und alles unterhalb des Heros sind in beiden Varianten gleich.
//
// Gemessen wird je Variante:
//   - Anmeldungen: das Ärzte-Formular sendet das versteckte Feld "variante" mit
//     ("a", "b" oder "direkt").
//   - Klicks und Anmeldungen als Ereignisse "cta_click" und "waitlist_submit" an Umami und
//     an den Tag Manager, sobald diese in assets/consent.js aktiviert sind.

// Liefert "a" oder "b" nur, wenn die Seite über einen Varianten-Link geöffnet wurde. Alle
// anderen Besuche der Ärzte-Ansicht sehen zwar Variante a, werden aber als "direkt" gezählt,
// damit sie das Ergebnis von A nicht verfälschen.
function getVariant() {
  const body = document.body;
  return body.getAttribute("data-variant-source") === "link" ? body.getAttribute("data-variant") : "direkt";
}

function getAudience() {
  return document.body.getAttribute("data-audience") || "patient";
}

function track(eventName, data) {
  try {
    // Umami (cookiefrei), falls eingebunden
    if (window.umami && typeof window.umami.track === "function") {
      window.umami.track(eventName, data);
    }
    // Google Tag Manager: Die Ereignisse landen nur in der Liste dataLayer auf dieser Seite.
    // Verschickt wird erst etwas, wenn der Tag Manager nach Zustimmung geladen wurde (consent.js).
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(Object.assign({ event: eventName }, data));
    }
  } catch (e) {
    /* Analyse darf die Seite nie stören */
  }
}

function eventData(extra) {
  const data = { zielgruppe: getAudience() };
  if (data.zielgruppe === "aerzte") data.variante = getVariant();
  return Object.assign(data, extra || {});
}

document.querySelectorAll("[data-track]").forEach((link) => {
  link.addEventListener("click", () => {
    track("cta_click", eventData({ position: link.dataset.track }));
  });
});

document.querySelectorAll("[data-variant-field]").forEach((field) => {
  field.value = getVariant();
});

// Button in der Kopfleiste (Ärzte-Ansicht): Er ist immer sichtbar und wiederholt den Hero-Button.
// Solange der Hero-Button im Bild ist, trägt <body> die Klasse "hero-cta-in-view" und das CSS
// zeigt den Kopfleisten-Button nur als Umriss. Danach wird er gefüllt, sodass immer genau ein
// gefüllter Haupt-Button zu sehen ist.

function initHeaderCta() {
  const heroButtons = document.querySelectorAll('.hero [data-track="hero"]');
  if (!heroButtons.length || !("IntersectionObserver" in window)) {
    document.body.classList.remove("hero-cta-in-view");
    return;
  }

  const inView = new Set();
  const headerHeight = document.querySelector(".site-header")?.offsetHeight || 76;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) inView.add(entry.target);
        else inView.delete(entry.target);
      });
      document.body.classList.toggle("hero-cta-in-view", inView.size > 0);
    },
    // Unter der fixierten Kopfleiste gilt der Hero-Button als nicht mehr sichtbar.
    { rootMargin: `-${headerHeight}px 0px 0px 0px` }
  );
  heroButtons.forEach((button) => observer.observe(button));
}

initHeaderCta();

// Warteliste: Client-seitige Validierung und Versand.
//
// WICHTIG: Solange WAITLIST_ENDPOINT leer ist, wird NICHTS gespeichert und keine
// Bestätigungsmail verschickt. Die Seite zeigt dann trotzdem die Erfolgsmeldung
// (bisheriges Platzhalter-Verhalten). Vor dem Start der Kampagne hier die Adresse eines
// Endpunkts eintragen, der die Felder als JSON per POST annimmt und das Double-Opt-in
// auslöst (eigene API oder Newsletter-Anbieter). Felder: name, email, zielgruppe, consent
// sowie im Ärzte-Formular beruf, problem und variante.
const WAITLIST_ENDPOINT = "";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function setFieldError(field, errorEl, message) {
  if (message) {
    field.setAttribute("aria-invalid", "true");
    if (errorEl) errorEl.textContent = message;
  } else {
    field.removeAttribute("aria-invalid");
    if (errorEl) errorEl.textContent = "";
  }
}

function initWaitlistForm(form) {
  const successEl = form.querySelector(".form-success");
  const submitBtn = form.querySelector('button[type="submit"]');
  const submitErrorEl = form.querySelector("[data-submit-error]");
  const originalLabel = submitBtn.textContent;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    let hasError = false;
    let firstInvalid = null;

    form.querySelectorAll("[required]").forEach((field) => {
      const errorEl = form.querySelector(`[data-error-for="${field.name}"]`);
      let message = "";

      if (field.type === "checkbox") {
        if (!field.checked) {
          message = field.dataset.errorMessage || "Bitte bestätigen Sie diesen Punkt.";
        }
      } else if (field.tagName === "SELECT") {
        if (!field.value) {
          message = field.dataset.errorMessage || "Bitte wählen Sie eine Option aus.";
        }
      } else if (field.type === "email") {
        if (!field.value.trim() || !isValidEmail(field.value.trim())) {
          message = "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
        }
      } else if (!field.value.trim()) {
        message = field.dataset.errorMessage || "Bitte füllen Sie dieses Feld aus.";
      }

      setFieldError(field, errorEl, message);
      if (message) {
        hasError = true;
        if (!firstInvalid) firstInvalid = field;
      }
    });

    if (hasError) {
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Wird gesendet …";
    if (submitErrorEl) submitErrorEl.textContent = "";

    const variantField = form.querySelector("[data-variant-field]");
    if (variantField) variantField.value = getVariant();
    const payload = Object.fromEntries(new FormData(form).entries());
    const submittedAudience = payload.zielgruppe || getAudience();

    try {
      if (WAITLIST_ENDPOINT) {
        const response = await fetch(WAITLIST_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Anmeldung fehlgeschlagen: " + response.status);
      } else {
        // Platzhalter, siehe Hinweis bei WAITLIST_ENDPOINT: Es wird nichts gespeichert.
        console.warn("ADAM-Warteliste: WAITLIST_ENDPOINT ist leer, die Anmeldung wurde nicht gespeichert.");
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const submitData = { zielgruppe: submittedAudience };
      if (payload.variante) submitData.variante = payload.variante;
      // Die beiden Auswahlfelder des Ärzte-Formulars gehen als Kategorie mit in die Messung.
      // Name und Mailadresse werden nie an die Webanalyse gegeben.
      if (payload.beruf) submitData.beruf = payload.beruf;
      if (payload.problem) submitData.wunsch = payload.problem;
      track("waitlist_submit", submitData);

      form.classList.add("is-submitted");
      successEl.classList.add("is-visible");
      successEl.setAttribute("role", "status");
      successEl.focus();
      form.reset();
      if (variantField) variantField.value = getVariant();
    } catch (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
      if (submitErrorEl) {
        submitErrorEl.textContent =
          "Das hat leider nicht geklappt. Bitte versuchen Sie es noch einmal oder schreiben Sie uns eine Mail.";
      }
    }
  });
}

document.querySelectorAll(".waitlist-form").forEach(initWaitlistForm);

// Zielgruppen-Umschalter (Patient:innen / Ärzt:innen & Fachpersonal)
//
// Steuert body[data-audience], damit CSS die passenden Inhalte je Abschnitt ein-/ausblendet.
// Die Start-Zielgruppe setzt das Inline-Skript am Anfang von <body> aus ?zielgruppe= bzw. ?v=.

const PAGE_TITLES = {
  patient: "ADAM – Ihre Gesundheit einfach im Überblick",
  aerzte: "ADAM für Praxen – Patient:innen kommen vorbereitet zum Termin",
};

function initAudienceTabs() {
  const tabs = document.querySelectorAll(".audience-tab");
  if (!tabs.length) return;

  // Der Umschalter ist nur in der Patienten-Ansicht (?zielgruppe=patient) zu sehen. Er schreibt
  // die Zielgruppe bewusst nicht in die Adresse: Wer hier nur umgeschaltet hat, sieht nach dem
  // Neuladen wieder die Patienten-Ansicht mit Umschalter.
  function setAudience(audience) {
    document.body.setAttribute("data-audience", audience);
    document.title = PAGE_TITLES[audience] || PAGE_TITLES.patient;
    tabs.forEach((tab) => {
      tab.setAttribute("aria-pressed", String(tab.dataset.audience === audience));
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setAudience(tab.dataset.audience));
  });

  setAudience(getAudience() === "aerzte" ? "aerzte" : "patient");
}

initAudienceTabs();

// Mobile-Menü

function initMobileMenu() {
  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("mobileMenu");
  const iconPath = document.getElementById("navToggleIcon");
  if (!toggle || !menu) return;

  const closeIcon = 'M6 6l12 12M18 6L6 18';
  const openIcon = 'M4 7h16M4 12h16M4 17h16';

  function setOpen(isOpen) {
    menu.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    iconPath.querySelector("path").setAttribute("d", isOpen ? closeIcon : openIcon);
    // Verhindert Hintergrund-Scroll, solange das Menü als Overlay offen ist.
    document.documentElement.style.overflow = isOpen ? "hidden" : "";
  }

  toggle.addEventListener("click", () => {
    setOpen(!menu.classList.contains("is-open"));
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Beim Wechsel auf Desktop-Breite Overlay-Zustand zurücksetzen.
  window.matchMedia("(min-width: 860px)").addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
}

initMobileMenu();

// Manueller Hell-/Dunkel-Modus-Umschalter. Die Seite startet immer dunkel; wer auf hell umstellt,
// bekommt das per localStorage gemerkt (Schlüssel "adam-theme-v2", ältere Einträge zählen nicht mehr).

function initThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;

  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  toggle.setAttribute("aria-pressed", String(isDark()));

  toggle.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    toggle.setAttribute("aria-pressed", String(next === "dark"));
    try {
      localStorage.setItem("adam-theme-v2", next);
    } catch (e) {
      /* localStorage evtl. nicht verfügbar (z. B. privates Fenster) – Umschalten funktioniert trotzdem für die Sitzung */
    }
  });
}

initThemeToggle();

// Formularfrage zum A/B-Test ("Welches Problem wiegt für Sie schwerer?"): Die Reihenfolge der beiden
// Antworten wird je Seitenaufruf zufällig getauscht, damit nicht immer die obere bevorzugt wird.

function initAnswerOrder() {
  const select = document.getElementById("problem-aerzte");
  if (!select) return;
  const first = select.querySelector('option[value="effektivitaet"]');
  const second = select.querySelector('option[value="effizienz"]');
  if (first && second && Math.random() < 0.5) select.insertBefore(second, first);
}

initAnswerOrder();

// Leistungen der Ärzte-Ansicht: die drei Kästchen beim Scrollen einmalig sanft einblenden.
// Ohne JavaScript, ohne IntersectionObserver oder bei "Bewegung reduzieren" ist alles sofort sichtbar.

function initReveal() {
  const items = document.querySelectorAll(".service");
  if (!items.length || !("IntersectionObserver" in window)) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.documentElement.classList.add("js-reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.2 }
  );
  items.forEach((item) => observer.observe(item));
}

initReveal();

// Kasten "ADAM ergänzt ELGA": das bewegte Bild im Handy spielt nacheinander vier Szenen durch
// (Sprachniveau wählen, Arztbrief hochladen, Diagnose erklären lassen, digitaler Checkup).
// Je Szene setzt das Skript data-step am Kasten (welche Szene sichtbar ist, welche Nummer links
// hervorgehoben ist) und die Klasse "is-live" an der Szene (erst dann laufen ihre Bewegungen,
// siehe styles.css). Es läuft nur, solange der Kasten im Bild ist, und beginnt dann wieder bei
// Schritt 1. Ohne JavaScript, ohne IntersectionObserver oder bei "Bewegung reduzieren" bleibt
// die Szene stehen, die im HTML vorgegeben ist.

function initElgaDemo() {
  const box = document.querySelector(".elga[data-step]");
  if (!box || !("IntersectionObserver" in window)) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const scenes = Array.from(box.querySelectorAll(".demo-scene"));
  if (!scenes.length) return;

  // Dauer je Szene in Millisekunden. Szene 3 (die Erklärung) bleibt am längsten stehen,
  // damit der Text gelesen werden kann.
  const SCENE_MS = [5600, 5400, 9500, 5400];
  let timer = null;

  function show(step) {
    box.setAttribute("data-step", String(step));
    scenes.forEach((scene) => scene.classList.remove("is-live"));
    // Layout einmal abfragen, damit die Bewegungen auch dann neu starten, wenn dieselbe Szene
    // zweimal hintereinander gezeigt wird.
    void box.offsetWidth;
    scenes[step - 1].classList.add("is-live");
    timer = window.setTimeout(
      () => show((step % scenes.length) + 1),
      SCENE_MS[step - 1] || 5000
    );
  }

  function start() {
    if (timer) return;
    box.classList.add("is-playing");
    show(1);
  }

  function stop() {
    window.clearTimeout(timer);
    timer = null;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? start() : stop()));
    },
    { threshold: 0.4 }
  );
  observer.observe(box);
}

initElgaDemo();

// Ansicht beim Wechsel zwischen Startseite, Impressum und Datenschutz beibehalten: Wer über einen
// Kampagnenlink (?v=a, ?v=b) oder über ?zielgruppe=patient kam, behält diese Angabe in den Links
// zwischen den drei Seiten. So führt "Zurück zur Startseite" wieder in dieselbe Ansicht und, bei
// Kampagnenlinks, in dieselbe Variante. Andere Angaben in der Adresse werden nicht weitergegeben.

function initKeepView() {
  let query = "";
  try {
    const params = new URLSearchParams(window.location.search);
    const keep = new URLSearchParams();
    ["v", "zielgruppe"].forEach((key) => {
      const value = params.get(key);
      if (value) keep.set(key, value);
    });
    query = keep.toString();
  } catch (e) {
    return;
  }
  if (!query) return;

  document
    .querySelectorAll('a[href="index.html"], a[href="impressum.html"], a[href="datenschutz.html"]')
    .forEach((link) => {
      link.setAttribute("href", link.getAttribute("href") + "?" + query);
    });
}

initKeepView();
