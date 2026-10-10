import unittest
from unittest.mock import patch
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.reputation import ReputationError, normalize_url, query_openphish, query_reputation, validate_http_url


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

    def test_normalizes_default_port_and_fragment_for_feed_matching(self):
        self.assertEqual(
            normalize_url("HTTPS://Example.com:443/path#section"),
            "https://example.com/path",
        )

    @patch("app.reputation.get_openphish_urls", return_value={"https://example.test/login"})
    def test_openphish_flags_exact_url_from_cached_feed(self, _mock_feed):
        result = query_openphish("https://example.test/login#ignored")
        self.assertEqual(result["verdict"], "FLAGGED")

    @patch("app.reputation.query_openphish")
    def test_raises_when_all_providers_are_unavailable(self, mock_openphish):
        mock_openphish.side_effect = ReputationError("Feed unavailable")
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(ReputationError):
                query_reputation("https://example.com")


if __name__ == "__main__":
    unittest.main()
