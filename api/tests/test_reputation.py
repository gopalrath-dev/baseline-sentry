import unittest
from unittest.mock import patch
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.reputation import ReputationError, query_reputation, validate_http_url


class ReputationValidationTests(unittest.TestCase):
    def test_accepts_complete_https_url(self):
        self.assertEqual(
            validate_http_url("https://example.com/path?source=test"),
            "https://example.com/path?source=test",
        )

    def test_rejects_non_web_scheme(self):
        with self.assertRaises(ReputationError):
            validate_http_url("file:///C:/sensitive-file")

    def test_rejects_missing_host(self):
        with self.assertRaises(ReputationError):
            validate_http_url("https:///missing-host")

    def test_requires_at_least_one_configured_provider(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(ReputationError):
                query_reputation("https://example.com")


if __name__ == "__main__":
    unittest.main()
