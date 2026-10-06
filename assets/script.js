// A/B-Kampagne für Ärzt:innen
//
// Kampagnenlinks (je Anzeige ein Link, der Anzeigentext soll zur Überschrift der Variante passen):
//   ?v=a   Effizienz: "Mehr Zeit für das ärztliche Gespräch"
//   ?v=b   Effektivität: "Klare Angaben für ärztliche Entscheidungen"
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
  aerzte: "ADAM für Gesundheitsberufe – Patient:innen kommen vorbereitet zum Termin",
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

// ELGA-Kasten ("Was ADAM über ELGA hinaus leistet"): das bewegte Bild im Handy spielt nacheinander vier Szenen durch
// (Sprachniveau wählen, Arztbrief hochladen, Diagnose erklären lassen, digitaler Checkup).
// Links daneben steht jeweils nur der Schritt zur Szene, vier Balken zeigen den Fortschritt;
// ein Klick auf einen Balken springt zu diesem Schritt.
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
  const steps = Array.from(box.querySelectorAll(".elga__step"));
  const bars = Array.from(box.querySelectorAll(".elga__progress button"));

  // Dauer je Szene in Millisekunden. Szene 3 (die Erklärung) bleibt am längsten stehen,
  // damit der Text gelesen werden kann.
  const SCENE_MS = [3600, 3600, 6200, 3400];
  let timer = null;
  let current = 0;
  let inView = false;

  function show(step) {
    const previous = current;
    current = step;
    box.setAttribute("data-step", String(step));
    box.style.setProperty("--scene-ms", (SCENE_MS[step - 1] || 4000) + "ms");
    scenes.forEach((scene) => scene.classList.remove("is-live"));
    bars.forEach((bar, index) => {
      bar.classList.remove("is-active");
      bar.classList.toggle("is-done", index < step - 1);
      if (index === step - 1) bar.setAttribute("aria-current", "step");
      else bar.removeAttribute("aria-current");
    });
    // Links steht nur der Schritt zur Szene: der bisherige geht ("is-leaving"), der neue kommt.
    steps.forEach((item, index) => {
      item.classList.toggle("is-leaving", index === previous - 1 && previous !== step);
      item.classList.toggle("is-current", index === step - 1);
    });
    // Layout einmal abfragen, damit die Bewegungen auch dann neu starten, wenn dieselbe Szene
    // zweimal hintereinander gezeigt wird.
    void box.offsetWidth;
    scenes[step - 1].classList.add("is-live");
    if (bars[step - 1]) bars[step - 1].classList.add("is-active");
    // Weiter geht es von selbst nur, solange der Kasten im Bild ist.
    window.clearTimeout(timer);
    timer = inView
      ? window.setTimeout(() => show((step % scenes.length) + 1), SCENE_MS[step - 1] || 4000)
      : null;
  }

  function start() {
    inView = true;
    if (timer) return;
    box.classList.add("is-playing");
    show(1);
  }

  function stop() {
    inView = false;
    window.clearTimeout(timer);
    timer = null;
  }

  // Klick auf einen Balken: zu diesem Schritt springen, danach läuft es von dort weiter.
  bars.forEach((bar, index) => {
    bar.addEventListener("click", () => show(index + 1));
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? start() : stop()));
    },
    { threshold: 0.4 }
  );
  observer.observe(box);
}

initElgaDemo();

// Vergleich "Derselbe Termin, zwei Ausgangslagen": Der Regler stellt --p an der Karte von 0
// (ohne ADAM) bis 1 (mit ADAM), die Darstellung dazu steht in styles.css. Ein Klick auf
// "Ohne ADAM" oder "Mit ADAM" fährt dorthin. Kommt die Karte ins Bild, wird der Wechsel einmal
// vorgeführt, solange niemand den Regler berührt hat (nicht bei "Bewegung reduzieren").

function initCompare() {
  const box = document.querySelector(".cmp");
  const range = box ? box.querySelector(".cmp__range") : null;
  if (!box || !range) return;

  const reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Vorführung: kurz "Ohne ADAM" zeigen, zu "Mit ADAM" laufen, dort stehen bleiben und wieder
  // zurück. Danach steht der Regler und gehört den Besucher:innen. Die Vorführung läuft einmal,
  // wenn der Vergleich ins Bild kommt, und jedes Mal neu, wenn jemand im Menü auf "Vergleich"
  // klickt. Wer den Regler selbst bedient, beendet sie sofort.
  const START_MS = 600;
  const FORWARD_MS = 2400;
  const HOLD_ON_MS = 3000;
  const BACK_MS = 1100;

  let frame = null;
  let timer = null;
  let inView = false;
  let played = false;

  function setValue(value) {
    const v = Math.max(0, Math.min(100, value));
    box.style.setProperty("--p", (v / 100).toFixed(3));
    range.value = String(Math.round(v));
    range.setAttribute(
      "aria-valuetext",
      v < 34 ? "Ohne ADAM" : v > 66 ? "Mit ADAM" : "Zwischen ohne und mit ADAM"
    );
  }

  function animateTo(target, duration, done) {
    window.cancelAnimationFrame(frame);
    if (reduce) {
      setValue(target);
      return;
    }
    const from = Number(range.value);
    const startedAt = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setValue(from + (target - from) * eased);
      if (t < 1) frame = window.requestAnimationFrame(step);
      else if (done) done();
    };
    frame = window.requestAnimationFrame(step);
  }

  function halt() {
    window.cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    timer = null;
  }

  function play(delay) {
    if (reduce) return;
    halt();
    played = true;
    setValue(0);
    timer = window.setTimeout(() => {
      animateTo(100, FORWARD_MS, () => {
        timer = window.setTimeout(() => animateTo(0, BACK_MS), HOLD_ON_MS);
      });
    }, delay);
  }

  box.classList.add("is-interactive");
  setValue(0);

  range.addEventListener("pointerdown", halt);

  range.addEventListener("input", () => {
    halt();
    played = true;
    setValue(Number(range.value));
  });

  box.querySelectorAll("[data-cmp-to]").forEach((button) => {
    button.addEventListener("click", () => {
      halt();
      played = true;
      animateTo(Number(button.getAttribute("data-cmp-to")), 700);
    });
  });

  // Klick auf "Vergleich" im Menü: von vorn. Die Seite scrollt erst zum Abschnitt, deshalb
  // beginnt die Vorführung etwas später als beim Hineinscrollen.
  document.querySelectorAll('a[href$="#problem"]').forEach((link) => {
    link.addEventListener("click", () => play(inView ? START_MS : 1100));
  });

  if ("IntersectionObserver" in window && !reduce) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          inView = entry.intersectionRatio >= 0.6;
          if (inView && !played) play(START_MS);
        });
      },
      { threshold: [0, 0.6] }
    );
    observer.observe(box);
  }
}

initCompare();

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
