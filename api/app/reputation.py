"""Opt-in URLhaus malware reputation lookup.

The submitted URL is forwarded only to URLhaus after the user explicitly requests
a blacklist lookup. BaselineSentry does not persist the submitted URL.
"""

from __future__ import annotations

import base64
import json
import os
from time import monotonic
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

URLHAUS_LOOKUP_URL = "https://urlhaus-api.abuse.ch/v1/url/"
VIRUSTOTAL_URL_PREFIX = "https://www.virustotal.com/api/v3/urls/"
OPENPHISH_FEED_URL = "https://openphish.com/feed.txt"
OPENPHISH_CACHE_SECONDS = 12 * 60 * 60
_openphish_urls: set[str] = set()
_openphish_cache_updated_at = 0.0


class ReputationError(Exception):
    """Safe, user-facing reputation lookup error."""


def validate_http_url(value: str) -> str:
    parsed = urlparse(value.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ReputationError("Only complete http or https URLs can be checked.")
    if len(value) > 2048:
        raise ReputationError("The submitted URL is too long.")
    return value.strip()


def normalize_url(value: str) -> str:
    """Normalize only what is needed for exact threat-feed matching."""

    parsed = urlparse(value.strip())
    hostname = (parsed.hostname or "").lower()
    port = parsed.port
    netloc = hostname
    if port and not ((parsed.scheme == "http" and port == 80) or (parsed.scheme == "https" and port == 443)):
        netloc += f":{port}"
    path = parsed.path or "/"
    return f"{parsed.scheme.lower()}://{netloc}{path}" + (f"?{parsed.query}" if parsed.query else "")


def get_openphish_urls() -> set[str]:
    """Fetch the limited Community Feed at most once every 12 hours."""

    global _openphish_cache_updated_at, _openphish_urls
    now = monotonic()
    if _openphish_urls and now - _openphish_cache_updated_at < OPENPHISH_CACHE_SECONDS:
        return _openphish_urls

    request = Request(
        OPENPHISH_FEED_URL,
        headers={"User-Agent": "BaselineSentry/0.1 (+https://gopalrath-dev.github.io/baseline-sentry/)"},
        method="GET",
    )
    try:
        with urlopen(request, timeout=10) as response:  # nosec B310: fixed OpenPhish community feed endpoint
            lines = response.read().decode("utf-8", errors="replace").splitlines()
    except Exception as error:
        raise ReputationError("OpenPhish community feed could not be reached.") from error

    fetched_urls = {normalize_url(line) for line in lines if line.strip().startswith(("http://", "https://"))}
    if not fetched_urls:
        raise ReputationError("OpenPhish community feed returned no usable URLs.")
    _openphish_urls = fetched_urls
    _openphish_cache_updated_at = now
    return _openphish_urls


def query_openphish(url: str) -> dict[str, str]:
    """Check the submitted URL against the free, cached OpenPhish Community Feed."""

    if normalize_url(url) in get_openphish_urls():
        return {
            "provider": "OpenPhish Community Feed",
            "verdict": "FLAGGED",
            "message": "This exact URL appears in the OpenPhish Community phishing feed.",
        }
    return {
        "provider": "OpenPhish Community Feed",
        "verdict": "NOT_LISTED",
        "message": "Not present in the cached OpenPhish Community feed. This is not a guarantee that the URL is safe.",
    }


def query_urlhaus(url: str) -> dict[str, Any]:
    auth_key = os.getenv("URLHAUS_AUTH_KEY")
    if not auth_key:
        raise ReputationError("Blacklist lookup is not configured yet.")

    request = Request(
        URLHAUS_LOOKUP_URL,
        data=urlencode({"url": url}).encode("utf-8"),
        headers={
            "Auth-Key": auth_key,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "BaselineSentry/0.1 (+https://gopalrath-dev.github.io/baseline-sentry/)",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=8) as response:  # nosec B310: fixed official intelligence endpoint
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as error:
        raise ReputationError("The blacklist provider could not be reached.") from error

    query_status = payload.get("query_status")
    if query_status == "ok":
        return {
            "verdict": "BLACKLISTED",
            "source": "URLhaus (abuse.ch)",
            "message": "This exact URL is listed by URLhaus as a malware-distribution URL.",
            "reference": payload.get("urlhaus_reference"),
            "threat": payload.get("threat"),
            "tags": payload.get("tags", [])[:8],
        }
    if query_status == "no_results":
        return {
            "verdict": "NOT_LISTED",
            "source": "URLhaus (abuse.ch)",
            "message": "Not listed in this malware-URL dataset. This is not a guarantee that the URL is safe.",
            "reference": None,
            "threat": None,
            "tags": [],
        }
    raise ReputationError("The blacklist provider returned an unexpected response.")


def query_virustotal(url: str) -> dict[str, str]:
    """Read an existing VirusTotal URL report; never submit a URL for scanning."""

    api_key = os.getenv("VIRUSTOTAL_API_KEY")
    if not api_key:
        raise ReputationError("VirusTotal is not configured.")

    url_id = base64.urlsafe_b64encode(url.encode("utf-8")).decode("ascii").rstrip("=")
    request = Request(
        VIRUSTOTAL_URL_PREFIX + url_id,
        headers={
            "x-apikey": api_key,
            "Accept": "application/json",
            "User-Agent": "BaselineSentry/0.1 (+https://gopalrath-dev.github.io/baseline-sentry/)",
        },
        method="GET",
    )

    try:
        with urlopen(request, timeout=8) as response:  # nosec B310: fixed official intelligence endpoint
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        if error.code == 404:
            return {
                "provider": "VirusTotal",
                "verdict": "NOT_LISTED",
                "message": "No existing VirusTotal URL report was found. This is not a guarantee that the URL is safe.",
            }
        raise ReputationError("VirusTotal could not complete this lookup.") from error
    except Exception as error:
        raise ReputationError("VirusTotal could not be reached.") from error

    attributes = payload.get("data", {}).get("attributes", {})
    stats = attributes.get("last_analysis_stats", {})
    malicious = int(stats.get("malicious", 0))
    suspicious = int(stats.get("suspicious", 0))
    if malicious or suspicious:
        return {
            "provider": "VirusTotal",
            "verdict": "FLAGGED",
            "message": f"VirusTotal reports {malicious} malicious and {suspicious} suspicious engine verdict(s).",
        }
    return {
        "provider": "VirusTotal",
        "verdict": "NOT_LISTED",
        "message": "No malicious or suspicious engine verdict was returned. This is not a guarantee that the URL is safe.",
    }


def query_reputation(url: str) -> dict[str, Any]:
    """Combine configured opt-in providers without treating an unlisted URL as safe."""

    providers: list[dict[str, str]] = []
    try:
        providers.append(query_openphish(url))
    except ReputationError as error:
        providers.append({"provider": "OpenPhish Community Feed", "verdict": "UNAVAILABLE", "message": str(error)})
    if os.getenv("URLHAUS_AUTH_KEY"):
        try:
            result = query_urlhaus(url)
            providers.append({
                "provider": result["source"],
                "verdict": result["verdict"],
                "message": result["message"],
            })
        except ReputationError as error:
            providers.append({"provider": "URLhaus (abuse.ch)", "verdict": "UNAVAILABLE", "message": str(error)})

    if os.getenv("VIRUSTOTAL_API_KEY"):
        try:
            providers.append(query_virustotal(url))
        except ReputationError as error:
            providers.append({"provider": "VirusTotal", "verdict": "UNAVAILABLE", "message": str(error)})

    usable = [item for item in providers if item["verdict"] != "UNAVAILABLE"]
    if not usable:
        raise ReputationError("No threat-reputation provider is currently available. Try again later.")

    flagged = [item for item in usable if item["verdict"] in {"BLACKLISTED", "FLAGGED"}]
    return {
        "verdict": "BLACKLISTED" if flagged else "NOT_LISTED",
        "source": " + ".join(item["provider"] for item in usable),
        "message": flagged[0]["message"] if flagged else "No configured provider flagged this URL. This is not a guarantee that the URL is safe.",
        "reference": None,
        "threat": None,
        "tags": [],
        "providers": providers,
    }
