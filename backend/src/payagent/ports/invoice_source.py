from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol


class SourceType(StrEnum):
    UPLOAD = "UPLOAD"
    TEXT = "TEXT"
    EMAIL = "EMAIL"
    INBOX = "INBOX"


@dataclass(frozen=True)
class EmailOrigin:
    """What we need to answer the sender in the same thread (RF-07.2)."""

    message_id: str
    sender: str
    subject: str


@dataclass(frozen=True)
class IncomingDocument:
    source_type: SourceType
    source_ref: str
    filename: str
    content_type: str
    content: bytes
    email: EmailOrigin | None = None


class InvoiceSource(Protocol):
    def poll(self, handle: Callable[[IncomingDocument], None]) -> int:
        """Hand every new document to `handle`; return how many were handled."""
        ...
