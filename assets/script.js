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
