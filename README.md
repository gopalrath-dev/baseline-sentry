# BaselineSentry: Website Trust Monitor

BaselineSentry is a privacy-first Chrome extension that detects phishing signals and warns when a website's structure changes after the user has marked it as trusted.

## Live demo

**Public website:** [baseline-sentry-docs.vercel.app](https://baseline-sentry-docs.vercel.app/#demo)

The responsive public website works on desktop and mobile browsers. It includes a local URL checker, interactive risk walkthrough, system architecture, and privacy information. The browser extension provides the full automatic in-page scanning and adaptive trust-monitoring experience on desktop Chromium browsers.

## Included features

### Browser extension

- **Real-time page analysis** of URL structure, login/payment forms, redirects, and third-party resources.
- **Visual domain-deception detection** for look-alike brand patterns, misleading hostname structure, punycode, and IP-address hosts.
- **Safe sensitive-form warnings**, especially where credentials could be submitted to another origin. Passwords and form values are never captured or stored.
- **Adaptive Website Trust Monitor:** save a trusted page structure locally and detect meaningful changes such as a new credential form, a changed form destination, or unfamiliar external origins.
- **Explainable risk scoring and evidence timeline** so each warning is supported by visible findings.
- **Automatic local scan** after a page loads, with a bottom-right warning for caution, high-risk, or critical results. It can be disabled in the popup.
- **Optional API second opinion** using only minimized structural signals.
- **Manual threat-reputation check** for the current URL using OpenPhish Community Feed, URLhaus when configured, and VirusTotal when configured.

### Public website

- Responsive landing page for desktop and mobile.
- **Paste a link to check** tool that analyses URL and domain-deception signals locally in the browser.
- Optional threat-reputation lookup that separates confirmed blacklist results from single-provider caution signals.
- Interactive trusted-versus-changed login scenario showing adaptive risk reassessment.
- Visual explanation of the detection pipeline, privacy guarantees, and project architecture.

### Privacy and safety

- Local analysis is the default; benign browsing history is not uploaded.
- Passwords, form values, page HTML, and screenshots are never stored or sent.
- External reputation checks only run after a user clicks the button. A URL that is not listed is **not** assumed safe.
- Provider keys remain server-side in Render and are never included in the public website or extension.

## Run locally in Chrome

1. Open Chrome and visit \`chrome://extensions\`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the \`extension\` folder in this repository.
5. Open a regular webpage, then click the BaselineSentry extension icon.

For the first test, open a normal site, choose **Trust current structure**, then open a test page with a password form posting to another origin. The risk score and evidence timeline should change.

## Project roadmap

1. Improve registrable-domain parsing with \`tldts\`.
2. Add redirect and resource-drift analysis.
3. Build the public landing page.
4. Add an opt-in FastAPI classifier API.
5. Add fixtures and automated tests.
6. Publish a public Chrome Web Store listing after security and privacy review.

## Deployment

- The public landing page is in \`docs/\` and is deployed on Vercel: [baseline-sentry-docs.vercel.app](https://baseline-sentry-docs.vercel.app/#demo).
- The optional FastAPI classifier has a Render deployment blueprint in \`render.yaml\`.
- The deployed prototype classifier is available at \`https://baselinesentry-api.onrender.com/health\`.
- An optional, user-triggered threat-reputation lookup uses the keyless OpenPhish Community Feed, URLhaus, and, when configured, VirusTotal. The required secrets (\`URLHAUS_AUTH_KEY\` and \`VIRUSTOTAL_API_KEY\`) stay only in Render; an unlisted result is never treated as safe.
