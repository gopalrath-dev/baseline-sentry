# BaselineSentry: Hackathon Implementation Guide

## Winning prototype in one sentence

**BaselineSentry is a privacy-first browser extension that explains phishing risk in real time and detects when a previously trusted website changes its behaviour.**

This makes the project different from a normal blacklist or URL classifier: the key innovation is a **local adaptive trust profile**. A legitimate site that later shows a new password form, changes a form destination, begins redirecting, or loads unfamiliar third-party resources is reassessed immediately.

## Scope to build (in order)

Build these four features as one cohesive extension. Do not start an Android or desktop app before the demo is stable.

1. **Adaptive Website Trust Monitor — signature feature**
   - On a user's explicit “Trust this site” action, store a minimal local baseline in \`chrome.storage.local\`.
   - Baseline fields: registrable domain, page path class, form count and types, credential-form presence, form action origins, redirect destination, a small hashed set of third-party origins, and a timestamp.
   - On later visits, compare the current scan to the baseline.
   - Flag meaningful deltas: a new credential form, a cross-origin or changed form action, a new redirect domain, or several new third-party origins.
   - Never store form values, passwords, typed text, full browsing history, page screenshots, or page HTML.

2. **Visual Domain Deception Detector**
   - Always show the actual registrable domain prominently, for example \`example.com\` rather than \`login.paypal.example.com\`.
   - Flag brand-like strings in a non-brand registrable domain, punycode (\`xn--\`), mixed scripts, excessive subdomains, IP-address hosts, and look-alike substitutions such as \`paypaI\` with capital \`I\`.
   - Explain the difference in plain language: “This page mentions PayPal, but it is controlled by \`example.com\`.”

3. **Safe Form-Submission Warning**
   - Detect password, email, payment, OTP, and login forms from field type, name, autocomplete, and labels.
   - At submit time, warn only if risk is significant or a sensitive form posts to a different origin. Allow the user to continue or go back.
   - The listener must never read or transmit input values. It uses element metadata and the form action only.

4. **Detection Evidence Timeline**
   - Every scan produces a concise ordered list: page loaded → URL signals → form analysis → origin mismatch → trust-profile comparison → final score.
   - The popup renders this evidence as a timeline. This is especially effective in a 2–3 minute hackathon demo.

## Recommended architecture

Use a TypeScript monorepo. Keep the security decision close to the browser and make the API optional.

\`\`\`text
baseline-sentry/
├── extension/                 # Chrome Manifest V3 extension
│   ├── src/background/        # Service worker, storage, message routing
│   ├── src/content/           # DOM/form scans and submit-warning UI
│   ├── src/popup/             # React popup: score, evidence, baseline controls
│   ├── src/shared/            # Types, scoring rules, domain utilities
│   └── public/manifest.json
├── api/                       # FastAPI risk-model API, optional at scan time
│   ├── app/main.py
│   ├── app/model.py
│   └── tests/
├── web/                       # Public React/Vite landing page and demo guide
├── tests/                     # Extension fixtures and security test pages
├── docs/                      # Architecture, privacy model, demo script
├── README.md
├── SECURITY.md
└── LICENSE
\`\`\`

### Extension data flow

\`\`\`text
Page DOM + URL
     ↓
Content script extracts metadata only
     ↓
Background service worker scores signals and checks local trust baseline
     ↓                         ↘ optional anonymous feature vector to API
Popup / non-blocking page warning  ← evidence timeline + score
\`\`\`

### Technology choices

| Part | Choose | Why |
|---|---|---|
| Extension | Manifest V3 + TypeScript + React + Vite | Fast to build, modern Chrome standard, polished popup UI |
| Domain parsing | \`tldts\` | Correct registrable-domain handling rather than fragile string splitting |
| Local persistence | \`chrome.storage.local\` | Baselines remain on the user's device |
| Backend | FastAPI + scikit-learn | Meets API/model deliverable and is easy to demo |
| Website | React/Vite, deployed to Vercel or Cloudflare Pages | Fast public landing page and docs |
| API host | Render or Railway | Straightforward Python deployment for a prototype |
| CI | GitHub Actions | Runs lint, unit tests, and extension build on every push |

## Explainable scoring design

Start with deterministic weighted rules. It is easier to explain, test, and tune in eight hours than a large opaque ML model. The backend can blend the rule score with an ML probability as a bonus, but never hide the evidence.

| Signal | Points | Notes |
|---|---:|---|
| Password/payment/OTP form | 12 | Normal on many legitimate sites; not decisive alone |
| Sensitive form posts cross-origin | 25 | High-confidence signal |
| Changed form destination since trusted baseline | 30 | Signature adaptive signal |
| New credential form since trusted baseline | 28 | Signature adaptive signal |
| Brand/domain mismatch | 20 | Only when a specific brand signal is credible |
| Punycode, mixed-script, or IP host | 18 | Explain exactly which pattern matched |
| Several redirects / unfamiliar redirect destination | 15 | Avoid penalizing known SSO flows too heavily |
| Many new third-party origins from baseline | 12 | Use a threshold, e.g. 3+ |
| URL entropy / misleading structure | 8 | Low weight to reduce false positives |

Risk levels: **0–29 Low**, **30–59 Caution**, **60–79 High**, **80–100 Critical**. Cap at 100. Show the contributing rules, not just the number.

False-positive controls:

- Do not score a login form highly by itself.
- Treat same-site subdomains carefully.
- Let the user mark a site as trusted, then make the baseline comparison the strongest signal.
- Distinguish an external payment or identity-provider action from an unknown external origin where possible.
- Use non-blocking warnings for Caution and a clear interstitial only for High/Critical sensitive-form submissions.

## Privacy contract

- Analysis runs locally by default.
- Trust profiles stay in \`chrome.storage.local\`.
- Passwords, form values, page HTML, screenshots, and benign browsing history are never collected.
- The optional API receives only a minimized feature vector and only after opt-in; it never receives the full URL by default.
- “Clear local data” erases all stored baselines.

## Build order for an 8-hour hackathon

| Time | Deliverable | Definition of done |
|---|---|---|
| 0:00–0:40 | Repository and extension shell | Popup opens, content script can send the page URL to background |
| 0:40–1:45 | URL/domain signals | Correct registrable domain, deception explanation, tested fixtures |
| 1:45–3:00 | DOM/form signals | Detect sensitive forms and cross-origin form actions |
| 3:00–4:30 | Trust monitor | “Trust this site,” local baseline, and meaningful-change finding work |
| 4:30–5:15 | Submit warning | High-risk sensitive cross-origin post produces a safe warning |
| 5:15–6:00 | Evidence timeline and popup polish | Timeline explains every score contribution |
| 6:00–6:45 | API + lightweight model | \`/health\` and \`/classify\` work with documented features |
| 6:45–7:30 | Landing page and deployment | Public README/site includes install and privacy instructions |
| 7:30–8:00 | Tests, demo rehearsal, video | Clean scan + adaptive change + warning are recorded |

## Demo flow that judges will remember

1. Open a harmless legitimate-looking demo login page. BaselineSentry says Low/Caution and shows why.
2. Click **Trust this site**. The extension saves only its structural fingerprint.
3. Open a changed version of the same demo page that now has a password form posting to \`collector.example\`.
4. Show the timeline: baseline found → new credential form → form action changed → risk re-evaluated to High/Critical.
5. Click submit. Show the warning without exposing or logging anything typed.
6. Contrast it with a deceptive URL such as \`paypal-login.demo.example\`; point to the actual registrable domain and the human explanation.

Create the two demo pages yourself under \`tests/fixtures/\` and host them only for the demo. Do not use a real brand's working login or collect real credentials.

## Security verification checklist

- URL parser identifies \`paypal-login.demo.example\` as controlled by \`demo.example\`.
- Punycode and IP hosts trigger an explanation, not a vague error.
- A standard same-origin password form is detected but not automatically classified as critical.
- A sensitive form with \`action="https://other.example/collect"\` raises risk and gives a submit warning.
- A trusted baseline followed by the same page has no meaningful-change alert.
- A new password form or changed action after baseline creates a high-priority adaptive finding.
- Test data contains no real credentials and no actual malicious links.
- Extension build passes with no broad host permission unless genuinely required.

## GitHub, explained for a beginner

Git runs on your computer and records snapshots called **commits**. GitHub is the online repository where those commits are stored. \`origin\` is simply the name Git gives to your GitHub repository.

### First-time setup

1. Create a GitHub account and enable two-factor authentication.
2. Install Git for Windows, then open PowerShell.
3. Set your public commit identity once:

\`\`\`powershell
git config --global user.name "Your Name"
git config --global user.email "your-github-email@example.com"
\`\`\`

4. On GitHub, select **New repository**, name it \`phishguard\`, choose Public (unless event rules say otherwise), and do **not** add a README/gitignore/license if this folder already contains the project.
5. Copy the HTTPS repository URL, which looks like \`https://github.com/YOUR-USERNAME/phishguard.git\`.

### Publish this project

Run these from the project folder after the starter files exist:

\`\`\`powershell
git init
git add .
git commit -m "feat: initialise BaselineSentry adaptive trust monitor"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/phishguard.git
git push -u origin main
\`\`\`

GitHub no longer accepts your account password for command-line Git over HTTPS. When prompted, use a personal access token or Git Credential Manager instead. GitHub's official documentation describes how \`origin\` points to the remote repository and the HTTPS authentication requirement.

### Normal daily workflow

\`\`\`powershell
git status
git add extension/src/shared/riskScore.ts
git commit -m "feat: detect changed credential form actions"
git push
\`\`\`

Use small commits with messages that explain the result: \`feat:\`, \`fix:\`, \`test:\`, \`docs:\`, or \`chore:\`. Never commit \`.env\`, API keys, model secrets, \`node_modules\`, or generated build folders. Add them to \`.gitignore\` first.

Before a public demo, run:

\`\`\`powershell
git status
git log --oneline -5
git remote -v
\`\`\`

## Readme outline

Your public \`README.md\` should contain:

1. A one-paragraph problem and solution statement.
2. Screenshot/GIF of the popup and warning.
3. Four differentiators: adaptive trust, visual domain deception, safe submit warning, evidence timeline.
4. Architecture diagram and privacy promise.
5. Local installation steps and demo fixture instructions.
6. API documentation for \`/health\` and \`/classify\`.
7. Test command and security limitations.
8. Hackathon team and license.

## Definition of a strong final submission

At the end, you should have a public GitHub repository, a loadable Chrome extension, an online landing page, a deployed API, automated tests for the adaptive scenarios, a short demo video, and a deck that repeatedly emphasizes: **“we detect behavioural drift on trusted websites without collecting browsing data.”**
