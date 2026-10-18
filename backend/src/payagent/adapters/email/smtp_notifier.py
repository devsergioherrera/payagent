import smtplib
from email.message import EmailMessage

from payagent.ports.invoice_source import EmailOrigin


class SmtpNotifier:
    def __init__(
        self,
        address: str,
        app_password: str,
        approver_email: str,
        host: str = "smtp.gmail.com",
        port: int = 465,
    ) -> None:
        self.address = address
        self.app_password = app_password
        self.approver_email = approver_email
        self.host = host
        self.port = port

    def reply_to_sender(self, origin: EmailOrigin, body: str, html: str | None = None) -> None:
        msg = EmailMessage()
        msg["From"] = self.address
        msg["To"] = origin.sender
        subject = origin.subject or "Invoice"
        msg["Subject"] = subject if subject.lower().startswith("re:") else f"Re: {subject}"
        if origin.message_id:
            msg["In-Reply-To"] = origin.message_id
            msg["References"] = origin.message_id
        msg.set_content(body)
        if html:
            msg.add_alternative(html, subtype="html")
        self._send(msg)

    def notify_escalation(self, subject: str, body: str, html: str | None = None) -> None:
        msg = EmailMessage()
        msg["From"] = self.address
        msg["To"] = self.approver_email
        msg["Subject"] = subject
        msg.set_content(body)
        if html:
            msg.add_alternative(html, subtype="html")
        self._send(msg)

    def _send(self, msg: EmailMessage) -> None:
        with smtplib.SMTP_SSL(self.host, self.port) as smtp:
            smtp.login(self.address, self.app_password)
            smtp.send_message(msg)
