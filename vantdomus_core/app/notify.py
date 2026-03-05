import os
import json
import smtplib
from email.mime.text import MIMEText
from typing import Optional, Dict, Any
import urllib.request
import urllib.parse

class Notifier:
    """Best-effort notification hub. Providers are optional and configured via env vars."""

    # --- Email (SMTP) ---
    def send_email(self, to_email: str, subject: str, body: str) -> Dict[str, Any]:
        host = os.getenv("SMTP_HOST", "")
        port = int(os.getenv("SMTP_PORT", "587"))
        user = os.getenv("SMTP_USER", "")
        password = os.getenv("SMTP_PASS", "")
        from_email = os.getenv("SMTP_FROM", user)

        if not host or not user or not password or not from_email:
            return {"ok": False, "provider": "smtp", "error": "SMTP not configured. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM."}

        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to_email

        try:
            with smtplib.SMTP(host, port, timeout=15) as s:
                s.starttls()
                s.login(user, password)
                s.sendmail(from_email, [to_email], msg.as_string())
            return {"ok": True, "provider": "smtp"}
        except Exception as e:
            return {"ok": False, "provider": "smtp", "error": str(e)}

    # --- WhatsApp (Twilio) ---
    def send_whatsapp(self, to_number_e164: str, body: str) -> Dict[str, Any]:
        # Twilio WhatsApp uses 'whatsapp:' prefix
        sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        token = os.getenv("TWILIO_AUTH_TOKEN", "")
        from_whatsapp = os.getenv("TWILIO_WHATSAPP_FROM", "")  # e.g. whatsapp:+14155238886 (sandbox)
        if not sid or not token or not from_whatsapp:
            return {"ok": False, "provider": "twilio_whatsapp", "error": "Twilio not configured. Set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_FROM."}

        url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
        data = urllib.parse.urlencode({
            "From": from_whatsapp,
            "To": f"whatsapp:{to_number_e164}" if not to_number_e164.startswith("whatsapp:") else to_number_e164,
            "Body": body
        }).encode("utf-8")

        req = urllib.request.Request(url, data=data, method="POST")
        # Basic Auth
        import base64
        auth = base64.b64encode(f"{sid}:{token}".encode("utf-8")).decode("utf-8")
        req.add_header("Authorization", f"Basic {auth}")

        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                out = resp.read().decode("utf-8")
            return {"ok": True, "provider": "twilio_whatsapp", "response": json.loads(out)}
        except Exception as e:
            return {"ok": False, "provider": "twilio_whatsapp", "error": str(e)}

    # --- Expo Push Notifications ---
    def send_expo_push(self, expo_token: str, title: str, body: str, data: Optional[dict] = None) -> Dict[str, Any]:
        payload = {
            "to": expo_token,
            "title": title,
            "body": body,
            "data": data or {}
        }
        req = urllib.request.Request(
            "https://exp.host/--/api/v2/push/send",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                out = resp.read().decode("utf-8")
            return {"ok": True, "provider": "expo", "response": json.loads(out)}
        except Exception as e:
            return {"ok": False, "provider": "expo", "error": str(e)}

notifier = Notifier()
