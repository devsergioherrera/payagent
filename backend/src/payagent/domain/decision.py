from enum import StrEnum


class Outcome(StrEnum):
    PAY = "PAY"
    HOLD = "HOLD"
    ESCALATE = "ESCALATE"
