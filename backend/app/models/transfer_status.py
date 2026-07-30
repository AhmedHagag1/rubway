from enum import StrEnum


class TransferStatus(StrEnum):
    PENDING_PAYMENT = "pending_payment"
    PAYMENT_PROOF_UPLOADED = "payment_proof_uploaded"
    PAYMENT_CONFIRMED = "payment_confirmed"
    WAITING_RECIPIENT = "waiting_recipient"
    READY_TO_SEND = "ready_to_send"
    RUB_SENT = "rub_sent"
    COMPLETED = "completed"
    REJECTED = "rejected"