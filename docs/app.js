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

