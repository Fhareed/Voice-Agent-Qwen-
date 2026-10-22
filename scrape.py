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
from bs4 import BeautifulSoup

_COMMON_PATHS = ["", "about", "about-us", "services", "menu", "pricing", "contact", "faq"]
_TIMEOUT = 8            # seconds per page
_MAX_PAGES = 5          # stop after this many good pages
_MAX_CHARS = 12000      # plenty for a small-business KB; keeps prompts lean
_HEADERS = {"User-Agent": "AnswerlyBot/1.0 (+business onboarding)"}


def _is_public_host(host: str) -> bool:
    """True only if every address the host resolves to is a public IP."""
    try:
        infos = socket.getaddrinfo(host, None)
    except Exception:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified):
            return False
    return True


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

    seen, parts, pages = set(), [], 0
    for path in _COMMON_PATHS:
        if pages >= _MAX_PAGES:
            break
        target = urljoin(origin + "/", path)
        if target in seen:
            continue
        seen.add(target)
        try:
            r = requests.get(target, timeout=_TIMEOUT, headers=_HEADERS, allow_redirects=True)
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
