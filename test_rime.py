#!/usr/bin/env python3
"""
Test script for your Rime TTS endpoint and API key.
Loads RIME_BASE_URL and RIME_API_KEY from .env.local (or env) and POSTs
a short synthesis request. Use this to verify the URL and key work before
running the full agent.

Usage (from project root):
  uv run python test_rime.py

If your self-hosted server uses a path (e.g. /v1/rime-tts), set in .env.local:
  RIME_BASE_URL=http://192.222.55.160:8010/v1/rime-tts
"""
from pathlib import Path

from dotenv import dotenv_values

# Load from script dir and cwd
def _load_env() -> dict[str, str]:
    import os
    out: dict[str, str] = {}
    for d in (Path(__file__).resolve().parent, Path.cwd()):
        for name in (".env.local", ".env"):
            p = d / name
            if p.exists():
                for k, v in (dotenv_values(p) or {}).items():
                    if k and v and k not in out:
                        out[k] = str(v).strip()
    for k, v in os.environ.items():
        if v and k not in out:
            out[k] = v.strip()
    return out


def main() -> None:
    import sys
    env = _load_env()
    base_url = (env.get("RIME_BASE_URL") or "").strip() or "http://192.222.55.160:8010"
    api_key = (env.get("RIME_API_KEY") or "").strip()

    if not api_key:
        print("RIME_API_KEY not found. Add it to .env.local next to this script.", file=sys.stderr)
        sys.exit(1)

    # Normalize URL: no trailing slash for POST
    base_url = base_url.rstrip("/")
    # If you use a path on your server (e.g. /v1/rime-tts), include it in RIME_BASE_URL
    print(f"Base URL: {base_url}")
    print("Sending short TTS request (mistv2, 'Hello')...")

    import urllib.request
    import json

    payload = {
        "speaker": "astra",
        "text": "Hello.",
        "modelId": "mistv2",
        "speedAlpha": 0.9,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        base_url,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "audio/pcm",
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read()
            ct = resp.headers.get("Content-Type", "")
            if resp.status == 200 and ("audio" in ct or len(body) > 0):
                print(f"OK: received audio ({len(body)} bytes). Rime URL and API key work.")
            else:
                print(f"Unexpected response: status={resp.status}, Content-Type={ct}")
                sys.exit(1)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        print(f"HTTP error {e.code}: {e.reason}")
        if body:
            print(body[:500])
        print("\nIf your server uses a path (e.g. /v1/rime-tts), set RIME_BASE_URL to include it.")
        sys.exit(1)
    except Exception as e:
        print(f"Request failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
