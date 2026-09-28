"""Demo-request notify and confirmation emails."""

from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.identity.email_demo_request import (  # noqa: E402
    demo_notify_emails,
    send_demo_request_emails,
)


class DemoNotifyListTests(unittest.TestCase):
    def test_default_inbox(self) -> None:
        with patch("app.identity.email_demo_request.os.environ.get", return_value=""):
            self.assertEqual(demo_notify_emails(), ["hello@tradeal.in"])

    def test_comma_separated(self) -> None:
        with patch("app.identity.email_demo_request.os.environ.get", return_value="a@x.com, b@y.com"):
            self.assertEqual(demo_notify_emails(), ["a@x.com", "b@y.com"])


class SendDemoRequestEmailsTests(unittest.TestCase):
    def test_skips_when_resend_missing(self) -> None:
        with patch("app.identity.email_demo_request.email_configured", return_value=False):
            with patch("app.identity.email_demo_request.send_email") as send:
                ok = send_demo_request_emails(
                    name="Asha",
                    company="Kubera",
                    phone="999",
                    email="asha@example.com",
                    message="Lifts",
                )
                self.assertFalse(ok)
                send.assert_not_called()

    def test_notifies_team_and_confirms_requester(self) -> None:
        with patch("app.identity.email_demo_request.email_configured", return_value=True):
            with patch("app.identity.email_demo_request.demo_notify_emails", return_value=["hello@tradeal.in"]):
                with patch("app.identity.email_demo_request.send_email", return_value=True) as send:
                    ok = send_demo_request_emails(
                        name="Asha",
                        company="Kubera Oils",
                        phone="999",
                        email="asha@kubera.test",
                        message="Remaining-to-lift",
                    )
                    self.assertTrue(ok)
                    self.assertEqual(send.call_count, 2)
                    notify = send.call_args_list[0].kwargs
                    confirm = send.call_args_list[1].kwargs
                    self.assertEqual(notify["to"], ["hello@tradeal.in"])
                    self.assertEqual(notify["reply_to"], "asha@kubera.test")
                    self.assertIn("Kubera Oils", notify["subject"])
                    self.assertEqual(confirm["to"], "asha@kubera.test")
                    self.assertIn("Remaining-to-lift", notify["text"])

    def test_phone_only_skips_confirmation(self) -> None:
        with patch("app.identity.email_demo_request.email_configured", return_value=True):
            with patch("app.identity.email_demo_request.demo_notify_emails", return_value=["hello@tradeal.in"]):
                with patch("app.identity.email_demo_request.send_email", return_value=True) as send:
                    send_demo_request_emails(
                        name="Asha",
                        company="Kubera",
                        phone="999",
                        email="",
                        message="",
                    )
                    self.assertEqual(send.call_count, 1)
                    self.assertIsNone(send.call_args.kwargs.get("reply_to"))


if __name__ == "__main__":
    unittest.main()
