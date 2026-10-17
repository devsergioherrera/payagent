from typing import Protocol

from payagent.ports.invoice_source import EmailOrigin


class Notifier(Protocol):
    def reply_to_sender(self, origin: EmailOrigin, body: str) -> None: ...

    def notify_escalation(self, subject: str, body: str) -> None: ...
