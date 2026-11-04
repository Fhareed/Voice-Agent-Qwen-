"""Scrape a business website into clean text for the knowledge base.

Powers the "paste your website" onboarding option: given a URL, fetch the
homepage plus a few common pages (about, services, menu, pricing, contact),
strip the HTML to readable text, and return it as one string to index.

SECURITY (SSRF): the URL is validated before any request — only public http(s)
hosts, never loopback / private / link-local / reserved addresses. This matters
because the public /demo/scrape endpoint fetches whatever URL a stranger types,
and without this check that could be pointed at internal services or cloud
metadata endpoints.
"""
import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import requests
import urllib3
from bs4 import BeautifulSoup
from requests.utils import select_proxy

_COMMON_PATHS = ["", "about", "about-us", "services", "menu", "pricing", "contact", "faq"]
_TIMEOUT = 8            # seconds per page
_MAX_PAGES = 5          # stop after this many good pages
_MAX_CHARS = 12000      # plenty for a small-business KB; keeps prompts lean
_HEADERS = {"User-Agent": "AnswerlyBot/1.0 (+business onboarding)"}


def _resolve_public_ip(host: str) -> str | None:
    """Resolve a hostname and return ONE of its addresses, but only if EVERY address
    it resolves to is a public IP; otherwise None. Returning the exact address lets
    the caller connect to that IP (see _PinnedIPAdapter), so the hostname can't be
    re-resolved to an internal address between this check and the actual request."""
    try:
        infos = socket.getaddrinfo(host, None)
    except Exception:
        return None
    first_ip = None
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified):
            return None
        if first_ip is None:
            first_ip = info[4][0]
    return first_ip


def _is_public_host(host: str) -> bool:
    """True only if every address the host resolves to is a public IP."""
    return _resolve_public_ip(host) is not None


class _PinnedIPAdapter(requests.adapters.HTTPAdapter):
    """Pin each request to an IP validated as public AT connection time, closing the
    DNS-rebinding TOCTOU.

    Without this, requests re-resolves the hostname when it connects, so a name that
    passed the earlier SSRF check could resolve a second time to an internal IP. Here
    the host is re-resolved and re-validated, then the connection is pinned to that
    exact address — there is no gap left to rebind in. Redirect hops to other hosts
    are validated the same way. TLS still uses the real hostname for SNI and
    certificate verification. Requests that go through a proxy are left untouched: the
    proxy resolves the name and governs egress.
    """

    def get_connection_with_tls_context(self, request, verify, proxies=None, cert=None):
        pool = super().get_connection_with_tls_context(
            request, verify, proxies=proxies, cert=cert
        )
        # Through a proxy we never open the socket ourselves, so there's nothing to pin.
        if select_proxy(request.url, proxies):
            return pool
        host = urlparse(request.url).hostname or ""
        ip = _resolve_public_ip(host)
        if ip is None:
            raise requests.exceptions.ConnectionError(
                f"Refusing to connect to non-public host: {host}"
            )
        pool.host = ip
        if isinstance(pool, urllib3.HTTPSConnectionPool):
            # Connect to the pinned IP but keep SNI + cert verification on the hostname.
            pool.assert_hostname = host
            pool.conn_kw["server_hostname"] = host
        return pool


def validate_url(url: str) -> str:
    """Normalize + SSRF-check a URL. Returns the cleaned URL or raises ValueError."""
    url = (url or "").strip()
    if not url:
        raise ValueError("Please enter your website address.")
    if not urlparse(url).scheme:
        url = "https://" + url
    p = urlparse(url)
    if p.scheme not in ("http", "https"):
        raise ValueError("Only http and https links are allowed.")
    if not p.hostname:
        raise ValueError("That doesn't look like a valid website address.")
    if not _is_public_host(p.hostname):
        raise ValueError("That address can't be reached.")
    return url


def clean_html(html: str) -> str:
    """Strip a page down to readable text (no scripts, nav, footer, forms)."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "header",
                     "footer", "nav", "form", "iframe"]):
        tag.decompose()
    return " ".join(soup.get_text(separator=" ", strip=True).split())


def scrape_site(url: str) -> dict:
    """Fetch a business site into text.

    Returns {"text": str, "pages": int, "chars": int}. Raises ValueError for a
    bad/unreachable URL or a site we couldn't read anything useful from.
    """
    base = validate_url(url)
    root = urlparse(base)
    origin = f"{root.scheme}://{root.netloc}"

    # Every request goes through the IP-pinning adapter, so the SSRF check and the
    # connection can't drift apart (DNS rebinding), including across redirects.
    adapter = _PinnedIPAdapter()
    seen, parts, pages = set(), [], 0
    with requests.Session() as session:
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        for path in _COMMON_PATHS:
            if pages >= _MAX_PAGES:
                break
            target = urljoin(origin + "/", path)
            if target in seen:
                continue
            seen.add(target)
            try:
                r = session.get(target, timeout=_TIMEOUT, headers=_HEADERS, allow_redirects=True)
            except requests.RequestException:
                continue
            if r.status_code != 200 or "text/html" not in r.headers.get("content-type", "").lower():
                continue
            text = clean_html(r.text)
            if len(text) > 200:          # skip near-empty pages
                parts.append(text)
                pages += 1

    combined = "\n\n".join(parts)[:_MAX_CHARS]
    if not combined.strip():
        raise ValueError(
            "I couldn't read anything from that site — try the guided setup instead."
        )
    return {"text": combined, "pages": pages, "chars": len(combined)}
