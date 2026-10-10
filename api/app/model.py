"""Transparent prototype classifier for BaselineSentry.

The weights are deliberately versioned JSON rather than an opaque serialized model.
They can be inspected, tested, and tuned without handling browsing data.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

WEIGHTS_PATH = Path(__file__).with_name("model_weights.json")


@dataclass(frozen=True)
class Prediction:
    probability: float
    score: int
    classification: str
    model_version: str
    contributions: list[dict[str, Any]]


def load_weights() -> dict[str, Any]:
    with WEIGHTS_PATH.open(encoding="utf-8") as source:
        return json.load(source)


def classify(features: dict[str, int | bool]) -> Prediction:
    """Return a risk result from a minimized, value-free feature vector."""

    weights = load_weights()
    logit = float(weights["intercept"])
    contributions: list[dict[str, Any]] = []

    for feature, coefficient in weights["coefficients"].items():
        raw_value = features.get(feature, 0)
        value = int(raw_value) if isinstance(raw_value, bool) else float(raw_value)
        contribution = float(coefficient) * value
        logit += contribution

        if value:
            contributions.append(
                {
                    "feature": feature,
                    "value": value,
                    "weight": coefficient,
                    "contribution": round(contribution, 3),
                    "explanation": weights["feature_notes"][feature],
                }
            )

    probability = 1 / (1 + math.exp(-logit))
    score = max(0, min(100, round(probability * 100)))

    if score >= 80:
        classification = "CRITICAL"
    elif score >= 60:
        classification = "HIGH"
    elif score >= 30:
        classification = "CAUTION"
    else:
        classification = "LOW"

    contributions.sort(key=lambda item: item["contribution"], reverse=True)
    return Prediction(
        probability=round(probability, 4),
        score=score,
        classification=classification,
        model_version=weights["model_version"],
        contributions=contributions,
    )

