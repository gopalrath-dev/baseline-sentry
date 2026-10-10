# BaselineSentry API

This is an opt-in, explainable prototype API. It accepts only a minimized structural feature vector. It must never receive passwords, form values, page HTML, screenshots, or a user's full browsing history.

## Run locally

\`\`\`powershell
cd api
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
\`\`\`

Then open \`http://127.0.0.1:8000/docs\` for the interactive API documentation.

## Example request

\`\`\`json
{
  "has_sensitive_form": true,
  "cross_origin_sensitive_form": true,
  "form_destination_changed": true
}
\`\`\`

## Model weights

The versioned coefficients are intentionally human-readable in \`app/model_weights.json\`. They are calibrated prototype weights, not a claim of a production-trained model.

## Deploy on Render

The repository includes a root \`render.yaml\` blueprint with the correct API root directory, build command, start command, health check, and pinned Python version.

1. Push the latest repository changes to GitHub.
2. In Render, create a **New Blueprint Instance** and connect the BaselineSentry repository.
3. Review the generated service named \`baselinesentry-api\`, then apply the blueprint.
4. When deployment completes, open \`https://YOUR-SERVICE.onrender.com/health\`. It should return an \`ok\` status and model version.

No API secret is required for this prototype. Before production use, add authentication, rate limiting, and monitoring.
