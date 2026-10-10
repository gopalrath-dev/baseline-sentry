import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.model import classify


class ClassifierTests(unittest.TestCase):
    def test_benign_login_is_low_risk(self):
        prediction = classify({"has_sensitive_form": True})
        self.assertEqual(prediction.classification, "LOW")
        self.assertLess(prediction.score, 30)

    def test_changed_cross_origin_form_is_high_risk(self):
        prediction = classify(
            {
                "has_sensitive_form": True,
                "cross_origin_sensitive_form": True,
                "form_destination_changed": True,
            }
        )
        self.assertEqual(prediction.classification, "HIGH")
        self.assertGreaterEqual(prediction.score, 60)

    def test_new_credential_form_reassesses_risk(self):
        prediction = classify(
            {
                "has_sensitive_form": True,
                "new_sensitive_form": True,
                "deceptive_brand_domain": True,
            }
        )
        self.assertGreaterEqual(prediction.score, 30)
        self.assertTrue(any(item["feature"] == "new_sensitive_form" for item in prediction.contributions))


if __name__ == "__main__":
    unittest.main()
