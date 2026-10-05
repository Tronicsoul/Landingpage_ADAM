// Warteliste: Client-seitige Validierung und optimistische Erfolgsanzeige.
//
// Hinweis für die Weiterentwicklung: Es ist noch kein Backend/E-Mail-Dienst angebunden.
// Sobald ein Endpunkt existiert (eigene API, Newsletter-Anbieter mit Double-Opt-in),
// den Platzhalter unten in initWaitlistForm() durch einen echten Request ersetzen.
// Jedes Formular sendet ein verstecktes "zielgruppe"-Feld (patient/aerzte) mit.

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

    try {
      // Platzhalter für die echte Anbindung, siehe Hinweis oben.
      await new Promise((resolve) => setTimeout(resolve, 500));

      form.classList.add("is-submitted");
      successEl.classList.add("is-visible");
      successEl.setAttribute("role", "status");
      successEl.focus();
      form.reset();
    } catch (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

document.querySelectorAll(".waitlist-form").forEach(initWaitlistForm);

// Zielgruppen-Umschalter (Patient:innen / Ärzt:innen & Fachpersonal)
//
// Der tatsächliche Startzustand (data-audience, ggf. data-variant/data-campaign aus
// ?zielgruppe=/?variante=/?campaign=) wird bereits von einem Inline-Script im <head>
// gesetzt, bevor die Seite zeichnet (siehe index.html) – das verhindert ein kurzes
// Aufblitzen der falschen Zielgruppe bei einem Anzeigenklick. Hier wird nur noch der
// Klick auf die Umschalter-Buttons behandelt und ihr aria-pressed synchronisiert.

function initAudienceTabs() {
  const tabs = document.querySelectorAll(".audience-tab");
  if (!tabs.length) return;

  function setAudience(audience, updateUrl) {
    document.documentElement.setAttribute("data-audience", audience);
    tabs.forEach((tab) => {
      tab.setAttribute("aria-pressed", String(tab.dataset.audience === audience));
    });
    if (updateUrl) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("zielgruppe", audience);
        window.history.replaceState({}, "", url);
      } catch (e) {
        /* URL-API evtl. eingeschränkt – kein kritischer Fehler */
      }
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setAudience(tab.dataset.audience, true));
  });

  // Tab-Buttons mit dem bereits gesetzten Startzustand synchronisieren.
  const current = document.documentElement.getAttribute("data-audience") === "aerzte" ? "aerzte" : "patient";
  tabs.forEach((tab) => {
    tab.setAttribute("aria-pressed", String(tab.dataset.audience === current));
  });
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

// Manueller Hell-/Dunkel-Modus-Umschalter (überschreibt die Systemeinstellung, per localStorage gemerkt)

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
      localStorage.setItem("adam-theme", next);
    } catch (e) {
      /* localStorage evtl. nicht verfügbar (z. B. privates Fenster) – Umschalten funktioniert trotzdem für die Sitzung */
    }
  });
}

initThemeToggle();
