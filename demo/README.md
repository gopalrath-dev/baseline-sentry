# Safe Adaptive Trust Demo

These pages are harmless local fixtures for demonstrating BaselineSentry. They do not collect credentials and their forms do not send data to a real service.

## Run the demo

From the repository root, run:

\`\`\`powershell
cd demo
python -m http.server 8000
\`\`\`

Then follow this story:

1. Open \`http://localhost:8000/trusted-login.html\`.
2. Open the BaselineSentry popup and choose **Trust current structure**.
3. Open \`http://localhost:8000/changed-login.html\`.
4. Open the popup again. It should report a changed form destination and a higher risk score.
5. Submit the empty test form. BaselineSentry should display its cross-origin submission warning.

The changed page targets the reserved \`.invalid\` domain, so no real network destination exists.
