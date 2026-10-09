"""Create or update the admin and visitor accounts from ADMIN_*/VISITOR_* env vars: python -m app.modules.auth.seed"""
from ...core.config import ACCOUNTS
from .repository import upsert_user


def seed_users() -> list[str]:
    done = []
    for role, email, password in ACCOUNTS:
        if email and password:
            upsert_user(email, password, role)
            done.append(role)
    return done


if __name__ == "__main__":
    print("seeded:", ", ".join(seed_users()) or "nothing (set ADMIN_EMAIL/ADMIN_PASSWORD, VISITOR_EMAIL/VISITOR_PASSWORD)")
