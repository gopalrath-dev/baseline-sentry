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

  if (baseline.sensitiveFormCount === 0 && current.sensitiveFormCount > 0) {
    additions.push({
      title: "New credential collection structure",
      detail: "This trusted site's current structure now includes a sensitive form.",
      points: 28,
      finding: true
    });
  }

  if (!sameArray(baseline.formActionOrigins, current.formActionOrigins)) {
    additions.push({
      title: "Form destination changed",
      detail: "A form now submits to a different origin than the local trusted baseline.",
      points: 30,
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
  return report;
}

function render(report) {
  currentReport = report;
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
scan();
