// A/B-Kampagnen
//
// Kampagnenlinks (der Anzeigen- bzw. Mailtext soll zur Überschrift der Variante passen):
//   Patient:innen  ?v=a                 Beschwerden klar ausdrücken, gehört werden
//                  ?v=b                 Arztbrief und Diagnose verstehen
//   Ärzt:innen     ?zielgruppe=aerzte&v=a
//                  ?zielgruppe=aerzte&v=b
// Ohne v= zeigt die Seite Variante a, zählt aber als "direkt" und nicht zum Test.
// utm_source / utm_medium / utm_campaign dürfen angehängt werden; GoatCounter und GA4 lesen
// die Kampagne daraus selbst.
//
// Gemessen wird je Zielgruppe und Variante:
//   - Brevo: das Formular sendet ADAM_ZIELGRUPPE (patient/aerzte) und ADAM_VARIANTE (a/b/direkt).
//   - GoatCounter (cookiefrei): Seitenpfad "/?v=a&zielgruppe=patient" usw. (consent.js) und die
//     Schritte als Ereignis, z. B. "waitlist_submit-patient-b". Ärzt:innen behalten die Namen
//     aus der ersten Kampagne ("waitlist_submit-b"), damit die Zahlen vergleichbar bleiben.
//   - Tag Manager / GA4 (nach Zustimmung): variante und zielgruppe an jedem Ereignis.

function getVariant() {
  const body = document.body;
  return body.getAttribute("data-variant-source") === "link" ? body.getAttribute("data-variant") : "direkt";
}

function getAudience() {
  return document.body.getAttribute("data-audience") || "patient";
}

function track(eventName, data) {
  try {
    if (window.umami && typeof window.umami.track === "function") {
      window.umami.track(eventName, data);
    }

    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(Object.assign({ event: eventName }, data));
    }
  } catch (e) {
  }
}

const GOAT_STEPS = {
  cta_click: "Klick auf Anmelde-Button",
  form_start: "Formular begonnen",
  waitlist_submit: "Anmeldung abgeschickt",
};

function countGoat(step, data) {
  try {
    const counter = window.goatcounter;
    if (!GOAT_STEPS[step] || !counter || typeof counter.count !== "function") return;
    const audience = (data && data.zielgruppe) || getAudience();
    const variant = (data && data.variante) || getVariant();
    const suffix = audience === "patient" ? "patient-" + variant : variant;
    counter.count({
      path: step + "-" + suffix,
      title: GOAT_STEPS[step] + " (" + suffix + ")",
      event: true,
    });
  } catch (e) {
  }
}

function eventData(extra) {
  const data = { zielgruppe: getAudience(), variante: getVariant() };
  return Object.assign(data, extra || {});
}

document.querySelectorAll("[data-track]").forEach((link) => {
  link.addEventListener("click", () => {
    const data = eventData({ position: link.dataset.track });
    track("cta_click", data);
    countGoat("cta_click", data);
  });
});

document.querySelectorAll("[data-variant-field]").forEach((field) => {
  field.value = getVariant();
});

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

    { rootMargin: `-${headerHeight}px 0px 0px 0px` }
  );
  heroButtons.forEach((button) => observer.observe(button));
}

initHeaderCta();

// Brevo-Formulare je Zielgruppe: eigene Liste und eigene Bestätigungsmail.
//   patient: "ADAM Patientinnen Rückmeldungen" (Kampagne 2)
//   aerzte:  "ADAM Ärzte Rückmeldungen" (Kampagne 1)
const WAITLIST_ENDPOINTS = {
  patient:
    "https://0eee4b39.sibforms.com/serve/MUIFAC3FbafVx0LnMshMgCP5WCk0WIkRB4wa0Rk9WdSBROKX0KjY0OAfY25L6FJTwqJ9QOaZkwSXhKNN6Hbh-EAVtk9f-KAGscLmpXU_9VIIH8dS0oa0TRwJ5lSTQofbfjRNXr3oqC3ff8y7aBAtYTG2EF4HzHZRA23HBtF9U9cbdD9cYA-LXA54zOA0lmVvBUCrN3FjvEnK9TJrnw==",
  aerzte:
    "https://0eee4b39.sibforms.com/serve/MUIFAMAV63XGUizP_lbC2z-7-SYASOjPZdoKuuKZN4fHZTaU1fJe3NR2cv3AD26OnwJ54QDOKg1OvNJ5D3XXCi05I930aNyGd1N_bD9YsLG6CMUMaU5rDIiqAzlYmR9K1HrcgTSpCJc2oRZCg2oLjhdhniFoWePJNU5AfeDDvQr_LM-mOfsBWMdnpEhoxohfiGQOP4Ws2Lw9mvHBDA==",
};

function toBrevoFields(payload) {
  const fields = {
    EMAIL: (payload.email || "").trim(),
    ADAM_NAME: (payload.name || "").trim(),
    ADAM_BERUF: payload.beruf || "",
    ADAM_PROBLEM: payload.problem || "",
    ADAM_EINWILLIGUNG: payload.consent ? "ja, " + new Date().toISOString() : "",
    ADAM_VARIANTE: payload.variante || "",
    ADAM_ZIELGRUPPE: payload.zielgruppe || "",
  };
  const body = new URLSearchParams();
  Object.keys(fields).forEach((key) => {
    if (fields[key]) body.append(key, fields[key].slice(0, 200));
  });

  body.append("email_address_check", "");
  body.append("locale", "de");
  body.append("html_type", "simple");
  return body;
}

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

    const du = getAudience() === "patient";

    form.querySelectorAll("[required]").forEach((field) => {
      const errorEl = form.querySelector(`[data-error-for="${field.name}"]`);
      let message = "";

      if (field.type === "checkbox") {
        if (!field.checked) {
          message = field.dataset.errorMessage || (du ? "Bitte bestätige diesen Punkt." : "Bitte bestätigen Sie diesen Punkt.");
        }
      } else if (field.tagName === "SELECT") {
        if (!field.value) {
          message = field.dataset.errorMessage || (du ? "Bitte wähle eine Option aus." : "Bitte wählen Sie eine Option aus.");
        }
      } else if (field.type === "email") {
        if (!field.value.trim() || !isValidEmail(field.value.trim())) {
          message = du
            ? "Bitte gib eine gültige E-Mail-Adresse ein."
            : "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
        }
      } else if (!field.value.trim()) {
        message = field.dataset.errorMessage || (du ? "Bitte füll dieses Feld aus." : "Bitte füllen Sie dieses Feld aus.");
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
    const endpoint = WAITLIST_ENDPOINTS[submittedAudience];

    try {
      if (endpoint) {
        const response = await fetch(endpoint + "?isAjax=1", {
          method: "POST",
          body: toBrevoFields(payload),
        });
        let result = null;
        try {
          result = await response.json();
        } catch (e) {
          result = null;
        }
        if (!response.ok || (result && result.success === false)) {
          const failure = new Error("Anmeldung fehlgeschlagen: " + response.status);
          failure.emailRejected = Boolean(result && result.errors && result.errors.EMAIL);
          throw failure;
        }
      } else {
        console.warn("ADAM-Warteliste: kein Brevo-Formular für \"" + submittedAudience + "\", die Anmeldung wurde nicht gespeichert.");
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const submitData = { zielgruppe: submittedAudience };
      if (payload.variante) submitData.variante = payload.variante;

      if (payload.beruf) submitData.beruf = payload.beruf;
      if (payload.problem) submitData.wunsch = payload.problem;
      track("waitlist_submit", submitData);
      countGoat("waitlist_submit", submitData);

      const leadEl = successEl.querySelector("[data-success-lead]");
      const sentTo = (payload.email || "").trim();
      if (leadEl && sentTo) {
        const address = document.createElement("strong");
        address.textContent = sentTo;
        leadEl.textContent = "";
        leadEl.append("Wir haben eine E-Mail an ", address, " geschickt.");
      }

      form.classList.add("is-submitted");
      successEl.classList.add("is-visible");
      successEl.setAttribute("role", "status");

      successEl.focus({ preventScroll: true });
      successEl.scrollIntoView({ block: "center" });
      form.reset();
      if (variantField) variantField.value = getVariant();
    } catch (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;

      const emailField = form.querySelector('[name="email"]');
      if (error && error.emailRejected && emailField) {
        setFieldError(
          emailField,
          form.querySelector('[data-error-for="email"]'),
          du
            ? "Diese E-Mail-Adresse wurde nicht angenommen. Bitte prüf die Schreibweise."
            : "Diese E-Mail-Adresse wurde nicht angenommen. Bitte prüfen Sie die Schreibweise."
        );
        emailField.focus();
        return;
      }
      if (submitErrorEl) {
        submitErrorEl.textContent = du
          ? "Das hat leider nicht geklappt. Bitte versuch es noch einmal oder schreib uns eine Mail."
          : "Das hat leider nicht geklappt. Bitte versuchen Sie es noch einmal oder schreiben Sie uns eine Mail.";
      }
    }
  });
}

document.querySelectorAll(".waitlist-form").forEach(initWaitlistForm);

const PAGE_TITLES = {
  patient: "ADAM – Deine Gesundheit einfach im Überblick",
  aerzte: "ADAM für Gesundheitsberufe – Patient:innen kommen vorbereitet zum Termin",
};

function initAudienceTabs() {
  const tabs = document.querySelectorAll(".audience-tab");
  if (!tabs.length) return;

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

  window.matchMedia("(min-width: 860px)").addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
}

initMobileMenu();

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
    }
  });
}

initThemeToggle();

function initAnswerOrder() {
  [
    ["problem-aerzte", "effektivitaet", "effizienz"],
    ["nutzen-patient", "gehoer", "verstehen"],
  ].forEach(([id, a, b]) => {
    const select = document.getElementById(id);
    if (!select) return;
    const first = select.querySelector('option[value="' + a + '"]');
    const second = select.querySelector('option[value="' + b + '"]');
    if (first && second && Math.random() < 0.5) select.insertBefore(second, first);
  });
}

initAnswerOrder();

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

function initHowto() {
  const box = document.querySelector(".howto");
  if (!box) return;
  const panels = Array.from(box.querySelectorAll(".howto__panel"));
  const current = box.querySelector("[data-howto-current]");
  const prev = box.querySelector("[data-howto-prev]");
  const next = box.querySelector("[data-howto-next]");
  const scenes = Array.from(box.querySelectorAll(".demo-scene"));
  const live = box.querySelector("[data-howto-live]");
  if (!panels.length || !prev || !next) return;

  const reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let step = 1;
  const resetTimers = [];

  function show(target, byUser) {
    step = Math.max(1, Math.min(panels.length, target));
    box.setAttribute("data-step", String(step));
    panels.forEach((panel, index) => panel.classList.toggle("is-active", index === step - 1));
    if (current) {
      current.textContent = String(step);
      if (byUser && !reduce) {
        current.classList.remove("is-roll");
        void current.offsetWidth;
        current.classList.add("is-roll");
      }
    }
    prev.setAttribute("aria-disabled", step === 1 ? "true" : "false");
    next.setAttribute("aria-disabled", step === panels.length ? "true" : "false");

    const scene = scenes[step - 1];
    scenes.forEach((other, index) => {
      if (other === scene) return;
      clearTimeout(resetTimers[index]);
      resetTimers[index] = setTimeout(() => other.classList.remove("is-run"), 900);
    });
    if (scene) {
      clearTimeout(resetTimers[step - 1]);
      scene.classList.remove("is-run");
      if (byUser && !reduce) {
        void scene.offsetWidth;
        scene.classList.add("is-run");
      }
    }

    if (byUser && live) {
      const panel = panels[step - 1];
      const title = panel.querySelector(".howto__title");
      const desc = panel.querySelector(".howto__desc");
      const sichtbar = (el) => (el ? (el.innerText || el.textContent || "").trim() : "");
      live.textContent =
        "Schritt " + step + " von " + panels.length + ": " +
        sichtbar(title) + ". " + sichtbar(desc);
    }
  }

  function go(delta) {
    const target = step + delta;
    if (target < 1 || target > panels.length) return;
    show(target, true);
  }

  prev.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  [prev, next].forEach((button) => {
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "ArrowRight") go(1);
      else return;
      event.preventDefault();
    });
  });

  box.classList.add("is-interactive");

  const phone = box.querySelector(".demo-phone");
  function fitPhone() {
    if (!phone) return;
    if (window.innerWidth < 900) {
      const zoom = Math.min(1.7, box.clientWidth / 260);
      phone.style.zoom = zoom.toFixed(3);
    } else {
      phone.style.zoom = "";
    }
  }
  fitPhone();
  window.addEventListener("resize", fitPhone);

  show(1, false);
}

initHowto();

function initCompare() {
  const box = document.querySelector(".cmp");
  const range = box ? box.querySelector(".cmp__range") : null;
  if (!box || !range) return;

  const reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  document.querySelectorAll('a[href$="#vergleich"]').forEach((link) => {
    link.addEventListener("click", () => play(inView ? START_MS : 1100));
  });

  if ("IntersectionObserver" in window && !reduce) {
    const control = box.querySelector(".cmp__control");
    const phone = window.matchMedia("(max-width: 599px)");
    let observer = null;

    function watch() {
      if (observer) observer.disconnect();
      if (phone.matches && control) {
        const headerHeight = document.querySelector(".site-header")?.offsetHeight || 76;
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              inView = entry.intersectionRatio >= 0.99;
              if (inView && !played) play(START_MS);
            });
          },
          { rootMargin: `-${headerHeight}px 0px -33% 0px`, threshold: [0, 0.99] }
        );
        observer.observe(control);
      } else {
        observer = new IntersectionObserver(
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

    watch();
    if (phone.addEventListener) phone.addEventListener("change", watch);
  }
}

initCompare();

function initStepToggles() {
  const list = document.querySelector(".steps");
  const steps = list ? Array.from(list.querySelectorAll(".step")) : [];
  if (!steps.length || !window.matchMedia) return;
  const narrow = window.matchMedia("(max-width: 759px)");

  function apply() {
    list.classList.toggle("is-collapsible", narrow.matches);
    steps.forEach((step, index) => {
      const heading = step.querySelector("h3");
      const text = step.querySelector("p");
      if (!heading || !text) return;
      const existing = heading.querySelector("button");

      if (narrow.matches && !existing) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "step__toggle";
        button.textContent = heading.textContent;
        if (!text.id) text.id = "schritt-text-" + (index + 1);
        button.setAttribute("aria-controls", text.id);
        button.setAttribute("aria-expanded", "false");
        button.addEventListener("click", () => {
          const open = button.getAttribute("aria-expanded") !== "true";
          button.setAttribute("aria-expanded", String(open));
          text.hidden = !open;
        });
        heading.textContent = "";
        heading.appendChild(button);
        text.hidden = true;
        step.classList.add("is-collapsible");
      } else if (!narrow.matches && existing) {
        heading.textContent = existing.textContent;
        text.hidden = false;
        step.classList.remove("is-collapsible");
      }
    });
  }

  apply();
  if (narrow.addEventListener) narrow.addEventListener("change", apply);
}

initStepToggles();

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

function initMotion() {
  const reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) return;

  document.documentElement.classList.add("js-motion");

  const scrollTimeline = !!(window.CSS && CSS.supports && CSS.supports("animation-timeline: view()"));

  const revealSelector =
    ".service, .step, .trust-card, .problem .section-header, .problem .cmp" +
    (scrollTimeline ? "" : ", .howto__demo");

  const cardSelector = ".step, .trust-card, .service";
  function expand(el) {
    if (!el.matches(cardSelector) && el.querySelector(cardSelector)) {
      return Array.from(el.children).flatMap(expand);
    }
    return [el];
  }
  const targets = Array.from(
    new Set(Array.from(document.querySelectorAll(revealSelector)).flatMap(expand))
  );

  const root = document.documentElement;
  root.classList.add("no-reveal-transition");
  targets.forEach((el) => {
    el.classList.add("reveal");
    const siblings = el.parentElement ? Array.from(el.parentElement.children).filter((n) => n.classList.contains("reveal")) : [];
    const index = Math.max(0, siblings.indexOf(el));
    el.style.setProperty("--reveal-delay", Math.min(index, 5) * 110 + "ms");
  });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -12% 0px" }
  );
  targets.forEach((el) => io.observe(el));
  void root.offsetWidth;
  window.requestAnimationFrame(() => root.classList.remove("no-reveal-transition"));

  const pulseObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => entry.target.classList.toggle("is-in", entry.isIntersecting));
    },
    { threshold: 0, rootMargin: "0px 0px -12% 0px" }
  );
  document.querySelectorAll(".footer-pulse").forEach((el) => pulseObserver.observe(el));

  const items = Array.from(document.querySelectorAll("[data-parallax]")).map((el) => ({
    el,
    speed: parseFloat(el.getAttribute("data-parallax")) || 0,
    rot: parseFloat(el.style.getPropertyValue("--rot")) || 0,
    host: el.closest("section, footer") || el.parentElement,
    top: 0,
    bottom: 0,
    base: 0,
  }));
  const photo = document.querySelector(".hero__photo img");
  const heroEl = document.querySelector(".hero");
  const cssScroll = !!(window.CSS && CSS.supports && CSS.supports("animation-timeline: view()"));
  let vh = window.innerHeight;
  let photoScale = 1.1;
  let ticking = false;

  function measure() {
    vh = window.innerHeight;
    photoScale = window.innerWidth >= 1100 ? 1.22 : 1.1;
    const y = window.scrollY;
    items.forEach((item) => {
      const rect = item.host.getBoundingClientRect();
      item.top = rect.top + y;
      item.bottom = rect.bottom + y;
      item.base = (item.top + item.bottom) / 2;
    });
    update();
  }

  function update() {
    ticking = false;
    const y = window.scrollY;
    const wide = window.innerWidth >= 1100;
    if (!cssScroll) {
      items.forEach((item) => {
        if (y + vh < item.top - 200 || y > item.bottom + 200) return;
        const shift = (item.base - (y + vh / 2)) * item.speed;
        item.el.style.transform = "translate3d(0," + shift.toFixed(1) + "px,0)";
      });
    }
    if (photo && !cssScroll && y < vh * 1.5) {
      photo.style.transform = "translate3d(0," + (wide ? (y * 0.12).toFixed(1) : 0) + "px,0) scale(" + photoScale + ")";
    }
    if (heroEl && !wide) {
      const dim = wide ? 0 : Math.min(0.88, Math.max(0, (y - vh * 0.08) / (vh * 0.55)) * 0.88);
      heroEl.style.setProperty("--hero-dim", dim.toFixed(3));
    }
  }

  function onScroll() {
    if (cssScroll && window.innerWidth >= 1100) return;
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", measure);
  window.addEventListener("load", measure);
  setTimeout(measure, 1200);
  measure();
}

initMotion();

(function initLoader() {
  const root = document.documentElement;
  if (!root.classList.contains("js-loading")) return;
  const started = Date.now();
  let done = false;
  function finish() {
    if (done) return;
    done = true;
    const wait = Math.max(0, 700 - (Date.now() - started));
    setTimeout(() => {
      root.classList.add("is-loaded");
      setTimeout(() => root.classList.remove("js-loading", "is-loaded"), 800);
    }, wait);
  }
  if (document.readyState === "complete") finish();
  else window.addEventListener("load", finish);
})();

function initCustomSelects() {
  document.querySelectorAll(".form-field select").forEach((select) => {
    if (select.dataset.csReady) return;
    select.dataset.csReady = "1";

    const wrap = document.createElement("div");
    wrap.className = "cs";
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add("cs__native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const label = document.querySelector('label[for="' + select.id + '"]');
    if (label && !label.id) label.id = select.id + "-label";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cs__btn";
    button.id = select.id + "-btn";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    if (label) button.setAttribute("aria-labelledby", label.id + " " + button.id);

    const text = document.createElement("span");
    text.className = "cs__text";
    const chevron = document.createElement("span");
    chevron.className = "cs__chevron";
    chevron.setAttribute("aria-hidden", "true");
    button.append(text, chevron);

    const list = document.createElement("ul");
    list.className = "cs__list";
    list.id = select.id + "-list";
    list.setAttribute("role", "listbox");
    list.tabIndex = -1;
    list.hidden = true;
    if (label) list.setAttribute("aria-labelledby", label.id);
    button.setAttribute("aria-controls", list.id);

    const items = [];
    Array.from(select.options).forEach((option, index) => {
      if (option.disabled) return;
      const item = document.createElement("li");
      item.className = "cs__option";
      item.setAttribute("role", "option");
      item.id = select.id + "-opt-" + index;
      item.dataset.value = option.value;
      item.textContent = option.textContent;
      items.push(item);
      list.appendChild(item);
    });

    wrap.append(button, list);

    let active = -1;

    function selectedIndex() {
      return items.findIndex((item) => item.dataset.value === select.value);
    }

    function sync() {
      const option = select.options[select.selectedIndex];
      text.textContent = option ? option.textContent : "";
      text.classList.toggle("is-placeholder", !select.value);
      const current = selectedIndex();
      items.forEach((item, index) => item.setAttribute("aria-selected", String(index === current)));
      const invalid = select.getAttribute("aria-invalid");
      if (invalid) button.setAttribute("aria-invalid", invalid);
      else button.removeAttribute("aria-invalid");
    }

    function setActive(index) {
      if (!items.length) return;
      active = Math.max(0, Math.min(items.length - 1, index));
      items.forEach((item, i) => item.classList.toggle("is-active", i === active));
      button.setAttribute("aria-activedescendant", items[active].id);
      items[active].scrollIntoView({ block: "nearest" });
    }

    function open() {
      if (!list.hidden) return;
      list.hidden = false;
      wrap.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
      setActive(selectedIndex() >= 0 ? selectedIndex() : 0);
    }

    function close() {
      if (list.hidden) return;
      list.hidden = true;
      wrap.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
      button.removeAttribute("aria-activedescendant");
    }

    function choose(index) {
      const item = items[index];
      if (!item) return;
      select.value = item.dataset.value;
      if (select.value && select.getAttribute("aria-invalid")) {
        select.removeAttribute("aria-invalid");
        const error = select.closest(".form-field").querySelector(".form-error");
        if (error) error.textContent = "";
      }
      select.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
      close();
      button.focus();
    }

    button.addEventListener("click", () => (list.hidden ? open() : close()));

    button.addEventListener("keydown", (event) => {
      const isOpen = !list.hidden;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (!isOpen) open();
          else setActive(active + 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          if (!isOpen) open();
          else setActive(active - 1);
          break;
        case "Home":
          if (isOpen) { event.preventDefault(); setActive(0); }
          break;
        case "End":
          if (isOpen) { event.preventDefault(); setActive(items.length - 1); }
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          if (isOpen) choose(active);
          else open();
          break;
        case "Escape":
          if (isOpen) { event.preventDefault(); close(); }
          break;
        case "Tab":
          close();
          break;
        default:
          if (event.key.length === 1 && /\S/.test(event.key)) {
            const letter = event.key.toLowerCase();
            const start = (isOpen ? active : selectedIndex()) + 1;
            const order = items.slice(start).concat(items.slice(0, start));
            const hit = order.find((item) => item.textContent.trim().toLowerCase().startsWith(letter));
            if (hit) {
              if (!isOpen) open();
              setActive(items.indexOf(hit));
            }
          }
      }
    });

    list.addEventListener("mousedown", (event) => event.preventDefault());
    list.addEventListener("click", (event) => {
      const item = event.target.closest(".cs__option");
      if (item) choose(items.indexOf(item));
    });
    list.addEventListener("mousemove", (event) => {
      const item = event.target.closest(".cs__option");
      if (item) {
        const index = items.indexOf(item);
        if (index !== active) setActive(index);
      }
    });

    document.addEventListener("click", (event) => {
      if (!wrap.contains(event.target)) close();
    });
    button.addEventListener("blur", () => setTimeout(() => {
      if (!wrap.contains(document.activeElement)) close();
    }, 0));

    select.addEventListener("focus", () => button.focus());
    new MutationObserver(sync).observe(select, { attributes: true, attributeFilter: ["aria-invalid"] });
    const form = select.closest("form");
    if (form) form.addEventListener("reset", () => setTimeout(sync, 0));

    sync();
  });
}

initCustomSelects();

function trackingAllowed() {
  try {
    const state = window.adamConsent && window.adamConsent.get();
    return !!(state && state.statistik);
  } catch (e) {
    return false;
  }
}

function initScrollDepth() {
  const marks = [25, 50, 75, 90];
  const sent = [];
  let ticking = false;

  function check() {
    ticking = false;
    if (sent.length === marks.length) return;
    const full = document.documentElement.scrollHeight;
    if (full <= window.innerHeight) return;
    const depth = ((window.scrollY + window.innerHeight) / full) * 100;
    marks.forEach((mark) => {
      if (depth < mark || sent.indexOf(mark) !== -1 || !trackingAllowed()) return;
      sent.push(mark);
      track("scroll_depth", { tiefe: mark });
    });
  }

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(check);
    },
    { passive: true }
  );
}

initScrollDepth();

function initFormStart() {
  const forms = document.querySelectorAll(".waitlist-form");
  if (!forms.length) return;
  let counted = false;
  let started = false;

  function start() {
    if (!counted) {
      counted = true;
      countGoat("form_start", eventData());
    }
    if (started || !trackingAllowed()) return;
    started = true;
    track("form_start", eventData());
  }

  forms.forEach((form) => {
    form.addEventListener("focusin", start);
    form.addEventListener("input", start);
  });
}

initFormStart();

function initSectionView() {
  if (!("IntersectionObserver" in window)) return;
  const sections = ["vergleich", "leistungen", "ablauf", "sicherheit", "warteliste"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (!sections.length) return;

  const steps = [];
  for (let i = 0; i <= 10; i++) steps.push(i / 10);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const visible = entry.intersectionRect.height;
        const needed = Math.min(entry.boundingClientRect.height, window.innerHeight) / 2;
        if (!needed || visible < needed || !trackingAllowed()) return;
        observer.unobserve(entry.target);
        track("section_view", { abschnitt: entry.target.id });
      });
    },
    { threshold: steps }
  );

  sections.forEach((section) => observer.observe(section));
}

initSectionView();
