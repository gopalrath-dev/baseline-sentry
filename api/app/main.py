"""BaselineSentry threat-classification API.

The API accepts structural boolean/count signals only. It must not receive passwords,
form values, page HTML, screenshots, or a full browsing history.
"""

from collections import defaultdict, deque
import os
from time import monotonic

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .model import classify, load_weights
from .reputation import ReputationError, query_reputation, validate_http_url

app = FastAPI(
    title="BaselineSentry Threat Classification API",
    version="0.1.0",
    description="Explainable, privacy-minimized risk classification for website trust signals.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://gopalrath-dev.github.io",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

RATE_WINDOW_SECONDS = 600
RATE_LIMIT = 15
_lookup_times: dict[str, deque[float]] = defaultdict(deque)
VIRUSTOTAL_WINDOW_SECONDS = 60
VIRUSTOTAL_PUBLIC_RATE_LIMIT = 4
_virustotal_lookup_times: deque[float] = deque()


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

class ReputationRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)


class ReputationResponse(BaseModel):
    verdict: str
    source: str
    message: str
    reference: str | None
    threat: str | None
    tags: list[str]
    providers: list[dict[str, str]]


def enforce_reputation_rate_limit(request: Request) -> None:
    client = request.client.host if request.client else "unknown"
    now = monotonic()
    recent = _lookup_times[client]
    while recent and now - recent[0] > RATE_WINDOW_SECONDS:
        recent.popleft()
    if len(recent) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many blacklist checks. Try again later.")
    recent.append(now)

    # VirusTotal's community key is limited to four API calls per minute.
    # This is process-local, which is appropriate for the single-instance prototype.
    if os.getenv("VIRUSTOTAL_API_KEY"):
        while _virustotal_lookup_times and now - _virustotal_lookup_times[0] > VIRUSTOTAL_WINDOW_SECONDS:
            _virustotal_lookup_times.popleft()
        if len(_virustotal_lookup_times) >= VIRUSTOTAL_PUBLIC_RATE_LIMIT:
            raise HTTPException(status_code=429, detail="Threat-reputation service is busy. Try again in a minute.")
        _virustotal_lookup_times.append(now)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model_version": load_weights()["model_version"]}


@app.post("/classify", response_model=ClassificationResponse)
def classify_threat(features: ThreatFeatures) -> ClassificationResponse:
    prediction = classify(features.model_dump())
    return ClassificationResponse(**prediction.__dict__)


@app.post("/reputation", response_model=ReputationResponse)
def reputation_lookup(payload: ReputationRequest, request: Request) -> ReputationResponse:
    """Perform an explicitly user-triggered malware blacklist lookup."""

    enforce_reputation_rate_limit(request)
    try:
        result = query_reputation(validate_http_url(payload.url))
    except ReputationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return ReputationResponse(**result)
