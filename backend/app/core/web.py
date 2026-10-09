"""HTTP hardening for every response and request: security headers, and a same-origin check on writes.

SameSite=Strict on the cookie already keeps other sites' requests from carrying the session; the Origin check is a second
lock for the same hole (CSRF), and the headers stop framing, MIME sniffing and scripts from other hosts.
"""
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from . import config

# Styles are inline (React style props, CSS variables) and fonts come from Google Fonts; scripts only from this origin.
CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; "
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
)
HEADERS = {
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}
WRITES = {"POST", "PUT", "PATCH", "DELETE"}


def install(app: FastAPI) -> None:
    @app.middleware("http")
    async def harden(request: Request, call_next):  # noqa: ANN001, ANN202
        origin = request.headers.get("origin")
        if request.method in WRITES and origin and origin not in config.ALLOWED_ORIGINS and urlsplit(origin).netloc != request.headers.get("host"):
            return JSONResponse({"detail": "cross-origin request refused"}, 403, headers=HEADERS)
        response = await call_next(request)
        response.headers.update(HEADERS)
        if config.SECURE_COOKIES:  # served over https: tell browsers to keep it that way
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response
