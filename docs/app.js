const scenarios = {
  trusted: {
    score: "12",
    level: "LOW RISK",
    summary: "Structure matches baseline",
    items: [
      ["✓", "Baseline found", "A trusted local structure is available.", "ok"],
      ["✓", "Credential form unchanged", "It posts to the same trusted origin.", "ok"],
      ["✓", "Risk remains low", "No meaningful behaviour change detected.", "ok"]
    ]
  },
  changed: {
    score: "67",
    level: "HIGH RISK",
    summary: "Changed form destination found",
    items: [
      ["✓", "Baseline found", "A trusted local structure is available.", "ok"],
      ["!", "Form destination changed", "The credential form now posts to a different origin.", "risk"],
      ["!", "Risk reassessed", "Sensitive cross-origin collection raised the risk score.", "risk"]
    ]
  }
};

const buttons = document.querySelectorAll(".scenario");
const score = document.querySelector("#demo-score");
const level = document.querySelector("#demo-level");
const summary = document.querySelector("#demo-summary");
const list = document.querySelector("#evidence-list");
const urlCheckForm = document.querySelector("#url-check-form");
const urlCheckInput = document.querySelector("#url-check-input");
const urlResult = document.querySelector("#url-result");

function renderScenario(name) {
  const scenario = scenarios[name];
  score.textContent = scenario.score;
  level.textContent = scenario.level;
  summary.textContent = scenario.summary;
  score.style.color = name === "changed" ? "#ffab7c" : "#75e2c8";
  level.style.color = name === "changed" ? "#ffba91" : "#7de8d0";

  list.replaceChildren();
  scenario.items.forEach(([icon, title, detail, kind]) => {
    const item = document.createElement("li");
    const marker = document.createElement("i");
    marker.textContent = icon;
    marker.style.background = kind === "risk" ? "#874a3e" : "#176b59";

    const text = document.createElement("span");
    const strong = document.createElement("b");
    strong.textContent = title;
    const small = document.createElement("small");
    small.textContent = detail;
    text.append(strong, small);
    item.append(marker, text);
    list.append(item);
  });
}

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    buttons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-selected", String(selected));
    });
    renderScenario(button.dataset.scenario);
  });
});

function displayHost(hostname) {
  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  return labels.length > 2 ? labels.slice(-2).join(".") : hostname.toLowerCase();
}

function isIpAddress(hostname) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":");
}

function inspectUrl(rawValue) {
  const safeValue = /^https?:\/\//i.test(rawValue.trim()) ? rawValue.trim() : "https://" + rawValue.trim();
  const parsed = new URL(safeValue);
  const hostname = parsed.hostname.toLowerCase();
  const signals = [];
  let score = 0;

  const brandDomains = {
    paypal: "paypal.com",
    google: "google.com",
    microsoft: "microsoft.com",
    apple: "apple.com",
    amazon: "amazon.com",
    netflix: "netflix.com"
  };

  if (parsed.protocol !== "https:") {
    score += 15;
    signals.push("Not using HTTPS");
  }
  if (hostname.startsWith("xn--")) {
    score += 20;
    signals.push("Punycode hostname");
  }
  if (isIpAddress(hostname)) {
    score += 20;
    signals.push("IP-address host");
  }
  if ((hostname.match(/-/g) || []).length >= 3) {
    score += 10;
    signals.push("Many hostname hyphens");
  }
  if (hostname.split(".").length >= 5) {
    score += 8;
    signals.push("Many subdomains");
  }
  if (parsed.username || parsed.password || rawValue.includes("@")) {
    score += 16;
    signals.push("Misleading @ URL syntax");
  }

  Object.entries(brandDomains).forEach(([brand, officialDomain]) => {
    if (hostname.includes(brand) && !hostname.endsWith(officialDomain)) {
      score += 24;
      signals.push("Looks like " + brand + ", controlled by " + displayHost(hostname));
    }
  });

  score = Math.min(score, 100);
  const level = score >= 45 ? "HIGH" : score >= 15 ? "CAUTION" : "LOW";
  return { hostname, domain: displayHost(hostname), score, level, signals };
}

function showUrlResult(result) {
  const levelClass = result.level.toLowerCase();
  const message = result.level === "LOW"
    ? "No strong URL-only deception signal was found."
    : result.level === "CAUTION"
      ? "Review this address carefully before entering information."
      : "Avoid entering credentials until you can verify this address.";

  urlResult.className = "url-result " + levelClass;
  urlResult.replaceChildren();

  const icon = document.createElement("div");
  icon.className = "url-result-icon";
  icon.textContent = result.level === "LOW" ? "✓" : "!";
  const content = document.createElement("div");
  const heading = document.createElement("b");
  heading.textContent = result.level + " URL RISK · " + result.score + "/100";
  const text = document.createElement("small");
  text.textContent = "Actual registrable domain: " + result.domain + ". " + message;
  content.append(heading, text);

  if (result.signals.length) {
    const signalList = document.createElement("ul");
    result.signals.forEach((signal) => {
      const item = document.createElement("li");
      item.textContent = signal;
      signalList.append(item);
    });
    content.append(signalList);
  }
  urlResult.append(icon, content);
}

urlCheckForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    showUrlResult(inspectUrl(urlCheckInput.value));
  } catch {
    urlResult.className = "url-result high";
    urlResult.replaceChildren();
    const icon = document.createElement("div");
    icon.className = "url-result-icon";
    icon.textContent = "!";
    const content = document.createElement("div");
    const heading = document.createElement("b");
    heading.textContent = "INVALID ADDRESS";
    const text = document.createElement("small");
    text.textContent = "Enter a complete domain such as example.com or https://example.com.";
    content.append(heading, text);
    urlResult.append(icon, content);
  }
});
