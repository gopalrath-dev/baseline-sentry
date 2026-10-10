const siteHost = document.querySelector("#site-host");
const siteUrl = document.querySelector("#site-url");
const scoreEl = document.querySelector("#score");
const scoreOrbit = document.querySelector("#score-orbit");
const badgeEl = document.querySelector("#risk-badge");
const timelineEl = document.querySelector("#timeline");
const errorEl = document.querySelector("#error");
const baselineStatus = document.querySelector("#baseline-status");
const trustButton = document.querySelector("#trust-button");
const refreshButton = document.querySelector("#refresh-button");
const apiButton = document.querySelector("#api-button");
const apiResult = document.querySelector("#api-result");
const API_BASE_URL = "https://baselinesentry-api.onrender.com";
const API_CLASSIFY_URL = API_BASE_URL + "/classify";

let currentReport = null;

function domainKey(hostname) {
  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  return labels.length > 2 ? labels.slice(-2).join(".") : hostname.toLowerCase();
}

function riskLevel(score) {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "CAUTION";
  return "LOW";
}

function formProfile(report) {
  return {
    sensitiveFormCount: report.forms.filter((form) => form.sensitive).length,
    formActionOrigins: report.forms.map((form) => form.actionOrigin).sort(),
    crossOriginSensitiveForm: report.forms.some((form) => form.sensitive && form.crossOrigin),
    resourceOrigins: report.resourceOrigins,
    redirectCount: report.redirectCount,
    savedAt: new Date().toISOString()
  };
}

function sameArray(first, second) {
  return first.length === second.length && first.every((item, index) => item === second[index]);
}

async function getProfiles() {
  const data = await chrome.storage.local.get("trustProfiles");
  return data.trustProfiles || {};
}

async function applyBaseline(report) {
  const profiles = await getProfiles();
  const key = domainKey(report.hostname);
  const baseline = profiles[key];
  report.baselineFound = Boolean(baseline);

  if (!baseline) {
    baselineStatus.textContent = "No baseline saved for this site.";
    trustButton.textContent = "Trust current structure";
    return report;
  }

  const current = formProfile(report);
  const additions = [];
  const adaptiveFeatures = {
    form_destination_changed: false,
    new_sensitive_form: false,
    redirect_to_new_domain: false,
    new_third_party_origins: 0
  };

  if (baseline.sensitiveFormCount === 0 && current.sensitiveFormCount > 0) {
    adaptiveFeatures.new_sensitive_form = true;
    additions.push({
      title: "New credential collection structure",
      detail: "This trusted site's current structure now includes a sensitive form.",
      points: 28,
      finding: true
    });
  }

  if (!sameArray(baseline.formActionOrigins, current.formActionOrigins)) {
    adaptiveFeatures.form_destination_changed = true;
    additions.push({
      title: "Form destination changed",
      detail: "A form now submits to a different origin than the local trusted baseline.",
      points: 30,
      finding: true
    });
  }

  if (Array.isArray(baseline.resourceOrigins)) {
    const unfamiliarOrigins = current.resourceOrigins.filter((origin) => !baseline.resourceOrigins.includes(origin));
    if (unfamiliarOrigins.length >= 3) {
      adaptiveFeatures.new_third_party_origins = unfamiliarOrigins.length;
      additions.push({
        title: "New third-party resource origins",
        detail: unfamiliarOrigins.length + " unfamiliar external origins appeared since this site's trusted baseline.",
        points: 12,
        finding: true
      });
    }
  }

  if (typeof baseline.redirectCount === "number" && baseline.redirectCount === 0 && current.redirectCount >= 2) {
    adaptiveFeatures.redirect_to_new_domain = true;
    additions.push({
      title: "Redirect behaviour changed",
      detail: "This visit passed through " + current.redirectCount + " redirects, unlike the trusted baseline.",
      points: 15,
      finding: true
    });
  }

  if (additions.length) {
    report.score = Math.min(100, report.score + additions.reduce((total, item) => total + item.points, 0));
    report.timeline.push.apply(report.timeline, additions);
    baselineStatus.textContent = "Meaningful change detected from your local baseline.";
  } else {
    baselineStatus.textContent = "Current structure matches the local baseline.";
  }

  trustButton.textContent = "Update trusted structure";
  report.adaptiveFeatures = adaptiveFeatures;
  return report;
}

function apiFeatureVector(report) {
  const adaptive = report.adaptiveFeatures || {};
  return {
    has_sensitive_form: report.forms.some((form) => form.sensitive),
    cross_origin_sensitive_form: report.forms.some((form) => form.sensitive && form.crossOrigin),
    form_destination_changed: Boolean(adaptive.form_destination_changed),
    new_sensitive_form: Boolean(adaptive.new_sensitive_form),
    deceptive_brand_domain: Boolean(report.deceptiveBrandDomain),
    punycode_or_ip_host: Boolean(report.punycodeOrIpHost),
    redirect_to_new_domain: Boolean(adaptive.redirect_to_new_domain),
    new_third_party_origins: Number(adaptive.new_third_party_origins || 0),
    excessive_hostname_hyphens: Number(report.hostnameHyphenCount >= 3 ? report.hostnameHyphenCount : 0)
  };
}

async function requestApiSecondOpinion() {
  if (!currentReport) return;

  apiButton.disabled = true;
  apiButton.textContent = "Checking…";
  apiResult.className = "api-result";
  apiResult.textContent = "Sending only the selected structural signal vector…";

  try {
    const response = await fetch(API_CLASSIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiFeatureVector(currentReport))
    });
    if (!response.ok) throw new Error("API returned " + response.status);

    const result = await response.json();
    const strongest = result.contributions[0];
    const reason = strongest ? strongest.explanation : "No elevated structural signal was present.";
    apiResult.textContent = "API: " + result.classification + " · " + result.score + "/100. " + reason;
  } catch {
    apiResult.className = "api-result error";
    apiResult.textContent = "The online API is temporarily unavailable. Your local analysis still remains active.";
  } finally {
    apiButton.disabled = false;
    apiButton.textContent = "Ask API";
  }
}

function render(report) {
  currentReport = report;
  apiResult.textContent = "";
  siteHost.textContent = report.hostname;
  siteUrl.textContent = report.url;
  scoreEl.textContent = String(report.score);

  const level = riskLevel(report.score);
  badgeEl.textContent = level;
  badgeEl.className = "risk-badge " + level.toLowerCase();
  scoreOrbit.className = "score-orbit " + level.toLowerCase();
  scoreOrbit.style.setProperty("--risk-angle", (report.score * 3.6) + "deg");

  timelineEl.replaceChildren();
  report.timeline.forEach((event) => {
    const item = document.createElement("li");
    if (event.finding) item.classList.add("finding");

    const title = document.createElement("span");
    title.className = "event-title";
    title.textContent = event.title;

    const detail = document.createElement("span");
    detail.textContent = event.detail + (event.points ? " (+" + event.points + ")" : "");

    item.append(title, detail);
    timelineEl.append(item);
  });
}

async function scan() {
  errorEl.textContent = "";
  scoreEl.textContent = "…";
  badgeEl.textContent = "SCANNING";
  badgeEl.className = "risk-badge";

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.id) throw new Error("No active browser tab was found.");

    const report = await chrome.tabs.sendMessage(tab.id, { type: "BASELINE_SENTRY_SCAN" });
    render(await applyBaseline(report));
  } catch (error) {
    errorEl.textContent = "Open a normal website and try again. Chrome internal pages cannot be scanned.";
    siteHost.textContent = "Unavailable";
    siteUrl.textContent = "";
    scoreEl.textContent = "—";
    badgeEl.textContent = "UNAVAILABLE";
  }
}

trustButton.addEventListener("click", async () => {
  if (!currentReport) return;

  const profiles = await getProfiles();
  const key = domainKey(currentReport.hostname);
  profiles[key] = formProfile(currentReport);
  await chrome.storage.local.set({ trustProfiles: profiles });

  baselineStatus.textContent = "Current structure saved locally as trusted.";
  trustButton.textContent = "Update trusted structure";
});

refreshButton.addEventListener("click", scan);
apiButton.addEventListener("click", requestApiSecondOpinion);
scan();
