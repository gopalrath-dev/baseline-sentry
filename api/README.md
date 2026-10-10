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

