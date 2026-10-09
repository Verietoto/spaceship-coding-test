"""Encryption for secrets kept in the database (the AI key set in the backoffice).

The key comes from SETTINGS_KEY, a Fernet key (python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())").
It is separate from SESSION_SECRET so that rotating the session secret does not make the stored key unreadable.
"""
from cryptography.fernet import Fernet, InvalidToken

from . import config


class SecretsUnavailable(RuntimeError):
    pass


def _fernet() -> Fernet:
    try:
        return Fernet(config.SETTINGS_KEY.encode())
    except (ValueError, TypeError) as e:  # empty, or not a 32-byte url-safe base64 key
        raise SecretsUnavailable("SETTINGS_KEY is not set (or is not a valid Fernet key)") from e


def available() -> bool:
    try:
        _fernet()
        return True
    except SecretsUnavailable:
        return False


def encrypt(text: str) -> str:
    return _fernet().encrypt(text.encode()).decode()


def decrypt(token: str) -> str | None:
    """None when the token was made with another key (the admin has to enter the key again)."""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return None
