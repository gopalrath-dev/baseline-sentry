# BaselineSentry: Website Trust Monitor

BaselineSentry is a privacy-first Chrome extension that detects phishing signals and warns when a website's structure changes after the user has marked it as trusted.

## First prototype

This first working extension provides:

- Current-page URL and form analysis
- Deceptive-domain indicators
- Cross-origin sensitive-form warnings
- Local trusted-site baselines
- Redirect and third-party resource drift monitoring
- An explainable evidence timeline
- A user-triggered API second opinion that receives only minimized structural signals
- A user-triggered threat-reputation check for the current page URL
- Optional automatic local scanning with a bottom-right caution/high-risk warning

All current analysis happens inside Chrome. The extension never reads or stores form values or passwords. Automatic scanning is enabled by default, can be turned off in the popup, and never performs an external reputation lookup without a button click.

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

- The public landing page is in \`docs/\` and can be served by GitHub Pages.
- The optional FastAPI classifier has a Render deployment blueprint in \`render.yaml\`.
- The deployed prototype classifier is available at \`https://baselinesentry-api.onrender.com/health\`.
- An optional, user-triggered threat-reputation lookup uses the keyless OpenPhish Community Feed, URLhaus, and, when configured, VirusTotal. The required secrets (\`URLHAUS_AUTH_KEY\` and \`VIRUSTOTAL_API_KEY\`) stay only in Render; an unlisted result is never treated as safe.
