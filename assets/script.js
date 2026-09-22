// Warteliste: Client-seitige Validierung und optimistische Erfolgsanzeige.
//
// Hinweis für die Weiterentwicklung: Es ist noch kein Backend/E-Mail-Dienst angebunden.
// Sobald ein Endpunkt (z. B. eine eigene API oder ein Newsletter-Anbieter) existiert,
// den fetch()-Aufruf unten in handleSubmit() durch einen echten Request ersetzen.

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function setFieldError(field, errorEl, message) {
  if (message) {
    field.setAttribute("aria-invalid", "true");
    errorEl.textContent = message;
  } else {
    field.removeAttribute("aria-invalid");
    errorEl.textContent = "";
  }
}

function initWaitlistForm(form) {
  const nameField = form.querySelector('input[name="name"]');
  const emailField = form.querySelector('input[name="email"]');
  const nameError = form.querySelector('[data-error-for="name"]');
  const emailError = form.querySelector('[data-error-for="email"]');
  const successEl = form.querySelector(".form-success");
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    let hasError = false;

    if (!nameField.value.trim()) {
      setFieldError(nameField, nameError, "Bitte geben Sie Ihren Namen ein.");
      hasError = true;
    } else {
      setFieldError(nameField, nameError, "");
    }

    if (!emailField.value.trim() || !isValidEmail(emailField.value.trim())) {
      setFieldError(
        emailField,
        emailError,
        "Bitte geben Sie eine gültige E-Mail-Adresse ein."
      );
      hasError = true;
    } else {
      setFieldError(emailField, emailError, "");
    }

    if (hasError) {
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
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
      submitBtn.textContent = "Jetzt auf die Warteliste eintragen";
    }
  });
}

document.querySelectorAll(".waitlist-form").forEach(initWaitlistForm);

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
