"""BaselineSentry threat-classification API.

The API accepts structural boolean/count signals only. It must not receive passwords,
form values, page HTML, screenshots, or a full browsing history.
"""

from fastapi import FastAPI
from pydantic import BaseModel, Field

from .model import classify, load_weights

app = FastAPI(
    title="BaselineSentry Threat Classification API",
    version="0.1.0",
    description="Explainable, privacy-minimized risk classification for website trust signals.",
)


class ThreatFeatures(BaseModel):
    has_sensitive_form: bool = False
    cross_origin_sensitive_form: bool = False
    form_destination_changed: bool = False
    new_sensitive_form: bool = False
    deceptive_brand_domain: bool = False
    punycode_or_ip_host: bool = False
    redirect_to_new_domain: bool = False
    new_third_party_origins: int = Field(default=0, ge=0, le=50)
    excessive_hostname_hyphens: int = Field(default=0, ge=0, le=20)


class Contribution(BaseModel):
    feature: str
    value: float
    weight: float
    contribution: float
    explanation: str


class ClassificationResponse(BaseModel):
    score: int
    probability: float
    classification: str
    model_version: str
    contributions: list[Contribution]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model_version": load_weights()["model_version"]}


@app.post("/classify", response_model=ClassificationResponse)
def classify_threat(features: ThreatFeatures) -> ClassificationResponse:
    prediction = classify(features.model_dump())
    return ClassificationResponse(**prediction.__dict__)

