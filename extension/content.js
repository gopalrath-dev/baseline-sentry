(() => {
  const brandHosts = {
    paypal: "paypal.com",
    google: "google.com",
    microsoft: "microsoft.com",
    apple: "apple.com",
    amazon: "amazon.com",
    netflix: "netflix.com"
  };

  function isIpAddress(hostname) {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":");
  }

  function sensitiveInputs(form) {
    return Array.from(form.querySelectorAll("input, textarea, select")).filter((field) => {
      const text = [
        field.type,
        field.name,
        field.id,
        field.autocomplete,
        field.getAttribute("aria-label"),
        field.getAttribute("placeholder")
      ].filter(Boolean).join(" ").toLowerCase();

      return /password|current-password|new-password|email|username|login|otp|one-time-code|card|credit|cvv|payment|bank|account/.test(text);
    });
  }

  function formMetadata(form) {
    const actionUrl = new URL(form.getAttribute("action") || location.href, location.href);
    const fields = sensitiveInputs(form);
    return {
      sensitive: fields.length > 0,
      actionOrigin: actionUrl.origin,
      crossOrigin: actionUrl.origin !== location.origin,
      method: (form.getAttribute("method") || "get").toUpperCase(),
      sensitiveFieldCount: fields.length
    };
  }

  function deceptiveBrandFinding(hostname) {
    const normalised = hostname.toLowerCase();
    for (const [brand, officialHost] of Object.entries(brandHosts)) {
      const lookalike = brand === "paypal" ? /paypal|paypa[i1l]/ : new RegExp(brand);
      if (lookalike.test(normalised) && !normalised.endsWith(officialHost)) {
        return { brand, officialHost };
      }
    }
    return null;
  }

  function thirdPartyResourceOrigins() {
    const origins = new Set();

    performance.getEntriesByType("resource").forEach((entry) => {
      try {
        const resourceUrl = new URL(entry.name);
        if ((resourceUrl.protocol === "https:" || resourceUrl.protocol === "http:") && resourceUrl.origin !== location.origin) {
          origins.add(resourceUrl.origin);
        }
      } catch {
        // Ignore malformed or browser-internal resource entries.
      }
    });

    return Array.from(origins).sort().slice(0, 50);
  }

  function scanPage() {
    const parsedUrl = new URL(location.href);
    const hostname = parsedUrl.hostname;
    const forms = Array.from(document.forms).map(formMetadata);
    const resourceOrigins = thirdPartyResourceOrigins();
    const navigationEntry = performance.getEntriesByType("navigation")[0];
    const redirectCount = Number(navigationEntry?.redirectCount || 0);
    const timeline = [{
      title: "Page scanned locally",
      detail: "Analysed URL and form metadata without reading input values.",
      points: 0,
      finding: false
    }];
    let score = 0;

    if (hostname.startsWith("xn--")) {
      score += 18;
      timeline.push({ title: "Punycode domain", detail: "The hostname uses punycode, which can obscure look-alike characters.", points: 18, finding: true });
    }

    if (isIpAddress(hostname)) {
      score += 18;
      timeline.push({ title: "IP-address host", detail: "The page is addressed by an IP rather than a normal domain name.", points: 18, finding: true });
    }

    if ((hostname.match(/-/g) || []).length >= 3) {
      score += 8;
      timeline.push({ title: "Unusually structured hostname", detail: "The hostname contains several hyphens.", points: 8, finding: true });
    }

    const brand = deceptiveBrandFinding(hostname);
    if (brand) {
      score += 20;
      timeline.push({
        title: "Possible brand/domain mismatch",
        detail: "The hostname resembles " + brand.brand + " but is not controlled by " + brand.officialHost + ".",
        points: 20,
        finding: true
      });
    }

    const sensitiveForms = forms.filter((form) => form.sensitive);
    if (sensitiveForms.length) {
      score += 12;
      timeline.push({ title: "Sensitive form detected", detail: "The page includes a login, credential, payment, or OTP-style field.", points: 12, finding: true });
    }

    if (sensitiveForms.some((form) => form.crossOrigin)) {
      score += 25;
      timeline.push({ title: "Cross-origin form destination", detail: "A sensitive form submits to a different origin from the page.", points: 25, finding: true });
    }

    if (redirectCount >= 3) {
      score += 15;
      timeline.push({
        title: "Multiple redirects observed",
        detail: "The browser recorded " + redirectCount + " redirects before this page loaded.",
        points: 15,
        finding: true
      });
    }

    if (resourceOrigins.length >= 8) {
      score += 8;
      timeline.push({
        title: "Many external resource origins",
        detail: "This page loads resources from " + resourceOrigins.length + " third-party origins.",
        points: 8,
        finding: true
      });
    }

    if (!timeline.some((event) => event.finding)) {
      timeline.push({ title: "No high-confidence signal found", detail: "No risky URL or form pattern was detected in this initial scan.", points: 0, finding: false });
    }

    return {
      url: location.href,
      hostname,
      forms,
      resourceOrigins,
      redirectCount,
      score: Math.min(100, score),
      timeline
    };
  }

  function showSubmissionWarning(form) {
    if (document.getElementById("baseline-sentry-warning")) return;

    const warning = document.createElement("div");
    warning.id = "baseline-sentry-warning";
    warning.setAttribute("role", "dialog");
    warning.setAttribute("aria-modal", "true");
    warning.innerHTML =
      '<div class="bs-card">' +
      '<p class="bs-kicker">BASELINESENTRY WARNING</p>' +
      '<h2>Check this form before continuing</h2>' +
      '<p>This sensitive form will send data to a different website. BaselineSentry has not read or stored what you typed.</p>' +
      '<div class="bs-actions"><button class="bs-back">Go back</button><button class="bs-continue">Continue anyway</button></div>' +
      '</div>';

    const style = document.createElement("style");
    style.textContent =
      '#baseline-sentry-warning{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:20px;background:rgba(3,10,20,.72);font-family:Arial,sans-serif}' +
      '#baseline-sentry-warning .bs-card{max-width:430px;padding:24px;border:1px solid #355576;border-radius:16px;background:#0c1b2f;color:#ecf4ff;box-shadow:0 20px 70px #000}' +
      '#baseline-sentry-warning .bs-kicker{color:#81c4ff;font-size:11px;font-weight:bold;letter-spacing:.08em}' +
      '#baseline-sentry-warning h2{font-size:20px;margin:9px 0}' +
      '#baseline-sentry-warning p{line-height:1.45}' +
      '#baseline-sentry-warning .bs-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}' +
      '#baseline-sentry-warning button{border:0;border-radius:8px;padding:10px 12px;font-weight:bold;cursor:pointer}' +
      '#baseline-sentry-warning .bs-back{background:#dcecff;color:#10233a}' +
      '#baseline-sentry-warning .bs-continue{background:#b85053;color:#fff}';
    warning.append(style);

    warning.querySelector(".bs-back").addEventListener("click", () => warning.remove());
    warning.querySelector(".bs-continue").addEventListener("click", () => {
      warning.remove();
      form.dataset.baselineSentryApproved = "true";
      form.requestSubmit();
      window.setTimeout(() => delete form.dataset.baselineSentryApproved, 1000);
    });

    document.documentElement.append(warning);
  }

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.dataset.baselineSentryApproved === "true") return;

    const metadata = formMetadata(form);
    if (metadata.sensitive && metadata.crossOrigin) {
      event.preventDefault();
      showSubmissionWarning(form);
    }
  }, true);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === "BASELINE_SENTRY_SCAN") sendResponse(scanPage());
  });
})();
