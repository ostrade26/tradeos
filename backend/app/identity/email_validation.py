"""Login email checks — syntax plus a domain that can actually receive mail."""

from __future__ import annotations

import random
import re
import socket
import struct

from fastapi import HTTPException

_EMAIL_RE = re.compile(
    r"^(?=.{3,254}$)"
    r"[a-z0-9](?:[a-z0-9._%+\-]{0,62}[a-z0-9])?"
    r"@"
    r"(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+"
    r"[a-z]{2,63}$",
    re.IGNORECASE,
)

_BLOCKED_DOMAINS = frozenset(
    {
        "example.com",
        "example.net",
        "example.org",
        "test.com",
        "test.net",
        "test.org",
        "localhost",
        "invalid",
        "mailinator.com",
        "guerrillamail.com",
        "10minutemail.com",
        "tempmail.com",
        "yopmail.com",
        "trashmail.com",
    }
)

_BLOCKED_TLDS = frozenset({"test", "invalid", "localhost", "example", "local", "onion"})


def optional_contact_email(value: str) -> str:
    """Format-only contact email. Empty is allowed; mailbox existence is not checked."""
    email = (value or "").strip().lower()
    if not email:
        return ""
    if not _EMAIL_RE.fullmatch(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    return email


def require_real_email(value: str, *, field: str = "email") -> str:
    """Return a normalised login email, or raise 400 if it is not a real inbox."""
    email = (value or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail=f"{field} is required")
    if not _EMAIL_RE.fullmatch(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    domain = email.rsplit("@", 1)[1]
    tld = domain.rsplit(".", 1)[-1]
    if domain in _BLOCKED_DOMAINS or tld in _BLOCKED_TLDS:
        raise HTTPException(
            status_code=400,
            detail="Use a real inbox — test and disposable addresses are not allowed.",
        )
    if not _domain_can_receive_mail(domain):
        raise HTTPException(
            status_code=400,
            detail="That email domain cannot receive mail. Use a real inbox.",
        )
    return email


def _ascii_domain(domain: str) -> str:
    return domain.encode("idna").decode("ascii").rstrip(".")


def _nameservers() -> list[str]:
    servers: list[str] = []
    try:
        with open("/etc/resolv.conf", encoding="utf-8") as fh:
            for line in fh:
                parts = line.split()
                if len(parts) >= 2 and parts[0] == "nameserver" and ":" not in parts[1]:
                    servers.append(parts[1])
    except OSError:
        pass
    for fallback in ("1.1.1.1", "8.8.8.8"):
        if fallback not in servers:
            servers.append(fallback)
    return servers


def _dns_query(domain: str, qtype: int, nameserver: str, timeout: float = 2.0) -> tuple[int, int] | None:
    """Return (rcode, ancount) or None if the query failed."""
    labels = domain.split(".")
    if any(not label or len(label) > 63 for label in labels):
        return None
    tid = random.randint(0, 65535)
    header = struct.pack("!HHHHHH", tid, 0x0100, 1, 0, 0, 0)
    qname = b"".join(bytes([len(label)]) + label.encode("ascii") for label in labels) + b"\x00"
    packet = header + qname + struct.pack("!HH", qtype, 1)
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.settimeout(timeout)
            sock.sendto(packet, (nameserver, 53))
            data, _ = sock.recvfrom(1024)
    except OSError:
        return None
    if len(data) < 12:
        return None
    rtid, flags, _qd, ancount = struct.unpack("!HHHH", data[:8])
    if rtid != tid:
        return None
    return flags & 0xF, ancount


def _has_mx(domain: str) -> bool | None:
    """True if MX exists, False if the name does not exist, None if unknown."""
    nxdomain = False
    for nameserver in _nameservers()[:3]:
        result = _dns_query(domain, 15, nameserver)
        if result is None:
            continue
        rcode, ancount = result
        if rcode == 3:
            nxdomain = True
            continue
        if rcode == 0 and ancount > 0:
            return True
        if rcode == 0 and ancount == 0:
            return None
    if nxdomain:
        return False
    return None


def _domain_can_receive_mail(domain: str) -> bool:
    try:
        ascii_domain = _ascii_domain(domain)
    except UnicodeError:
        return False
    mx = _has_mx(ascii_domain)
    if mx is True:
        return True
    if mx is False:
        return False
    previous = socket.getdefaulttimeout()
    try:
        socket.setdefaulttimeout(2.5)
        socket.getaddrinfo(ascii_domain, None)
        return True
    except OSError:
        return False
    finally:
        socket.setdefaulttimeout(previous)
