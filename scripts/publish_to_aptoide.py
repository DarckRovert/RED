#!/usr/bin/env python3
"""
RED Sovereign Mesh OS - Aptoide Connect / Catappult Release Publisher
Synchronizes APK releases from GitHub Releases / CI/CD pipelines to Aptoide Connect.

API Specification:
- Endpoint: POST https://uploader.catappult.io/api
- Header: Api-Key: <CATAPPULT_API_KEY>
- Format: multipart/form-data
- Docs: https://docs.connect.aptoide.com/apis/android-app-version-submission-api
"""

import os
import sys
import uuid
import argparse
import mimetypes
import urllib.request
import urllib.error
import json
from typing import Dict, Optional, Tuple

DEFAULT_ENDPOINT = "https://uploader.catappult.io/api"
DEFAULT_LANG = "en_GB"


class MultipartFormBuilder:
    """Builds RFC 7578 compliant multipart/form-data payloads without external dependencies."""

    def __init__(self):
        self.boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
        self.parts = []

    def add_field(self, name: str, value: str):
        part = (
            f"--{self.boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
            f"{value}\r\n"
        ).encode("utf-8")
        self.parts.append(part)

    def add_file(self, name: str, filename: str, file_bytes: bytes, content_type: Optional[str] = None):
        if not content_type:
            content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        header = (
            f"--{self.boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"; filename="{os.path.basename(filename)}"\r\n'
            f"Content-Type: {content_type}\r\n\r\n"
        ).encode("utf-8")
        self.parts.append(header + file_bytes + b"\r\n")

    def build(self) -> Tuple[bytes, str]:
        body = b"".join(self.parts) + f"--{self.boundary}--\r\n".encode("utf-8")
        content_type = f"multipart/form-data; boundary={self.boundary}"
        return body, content_type


def publish_to_aptoide(
    api_key: str,
    apk_url: Optional[str] = None,
    apk_file: Optional[str] = None,
    release_notes: Optional[str] = None,
    release_mode: str = "IMMEDIATE",
    requires_approval: bool = False,
    dry_run: bool = False,
    endpoint: str = DEFAULT_ENDPOINT,
) -> bool:
    if not api_key:
        print("[ERROR] No API key provided. Set CATAPPULT_API_KEY environment variable or pass --api-key.", file=sys.stderr)
        return False

    if not apk_url and not apk_file:
        print("[ERROR] Either --apk-url or --apk-file must be provided.", file=sys.stderr)
        return False

    if apk_url and apk_file:
        print("[ERROR] Aptoide API does not allow mixing public URLs and file uploads. Specify only one.", file=sys.stderr)
        return False

    builder = MultipartFormBuilder()

    if apk_url:
        print(f"[*] Setting APK URL parameter: {apk_url}")
        builder.add_field("apk", apk_url)
    elif apk_file:
        if not os.path.isfile(apk_file):
            print(f"[ERROR] APK file not found at path: {apk_file}", file=sys.stderr)
            return False
        file_size_mb = os.path.getsize(apk_file) / (1024 * 1024)
        print(f"[*] Reading local APK file: {apk_file} ({file_size_mb:.2f} MB)...")
        with open(apk_file, "rb") as f:
            builder.add_file("apk", apk_file, f.read(), "application/vnd.android.package-archive")

    builder.add_field("releaseMode", release_mode)
    builder.add_field("requiresDeveloperApproval", "true" if requires_approval else "false")

    if release_notes:
        clean_notes = release_notes.strip()
        print(f"[*] Attaching release notes ({len(clean_notes)} characters)...")
        builder.add_field(f"locales[{DEFAULT_LANG}][news]", clean_notes)

    body, content_type = builder.build()
    print(f"[*] Payload assembled: {len(body)} bytes, boundary: {builder.boundary}")

    if dry_run:
        print("[INFO] DRY RUN enabled: No HTTP request will be sent.")
        print(f"[*] Target Endpoint: {endpoint}")
        masked_key = ('*' * (len(api_key) - 4) + api_key[-4:]) if len(api_key) >= 4 else "****"
        print(f"[*] Headers: Api-Key: {masked_key}, Content-Type: {content_type}")
        return True

    print(f"[*] Sending submission request to {endpoint}...")
    headers = {
        "Api-Key": api_key,
        "Content-Type": content_type,
        "Content-Length": str(len(body)),
        "User-Agent": "RED-OS-CI-Publisher/1.0",
    }

    req = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=300) as response:
            status = response.getcode()
            resp_body = response.read().decode("utf-8", errors="replace")
            print(f"[SUCCESS] HTTP {status} OK")
            print(f"[+] Response body:\n{resp_body}")
            return True
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"[ERROR] HTTP {e.code} - {e.reason}", file=sys.stderr)
        print(f"[-] Details: {err_body}", file=sys.stderr)

        if e.code == 400:
            print("[-] Diagnostic: Bad request. Verify parameter names and format.", file=sys.stderr)
        elif e.code == 401:
            print("[-] Diagnostic: Unauthorized. Verify CATAPPULT_API_KEY validity.", file=sys.stderr)
        elif e.code == 403:
            print("[-] Diagnostic: Forbidden. First version must be submitted in Console; ensure ownership is active.", file=sys.stderr)
        elif e.code == 409:
            print("[-] Diagnostic: Conflict. Version code may be equal/lower or APK already submitted.", file=sys.stderr)
        elif e.code == 422:
            print("[-] Diagnostic: Unprocessable Entity. Check APK signature integrity.", file=sys.stderr)
        return False
    except urllib.error.URLError as e:
        print(f"[ERROR] Connection failure: {e.reason}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"[ERROR] Unexpected exception: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description="Publish RED APK release to Aptoide Connect / Catappult")
    parser.add_argument("--api-key", help="Aptoide Connect API Key (defaults to CATAPPULT_API_KEY env var)")
    parser.add_argument("--apk-url", help="Public direct download URL to APK (e.g. GitHub Releases URL)")
    parser.add_argument("--apk-file", help="Local filesystem path to APK binary")
    parser.add_argument("--tag", help="Git tag or version (e.g. v96.0.0) to auto-derive GitHub release URL")
    parser.add_argument("--repo", default="DarckRovert/RED", help="GitHub repository name (default: DarckRovert/RED)")
    parser.add_argument("--notes", help="Release notes text for store listing")
    parser.add_argument("--notes-file", help="Path to text file containing release notes")
    parser.add_argument("--release-mode", default="IMMEDIATE", choices=["IMMEDIATE", "MANUAL", "SCHEDULED"])
    parser.add_argument("--requires-approval", action="store_true", help="Hold release for manual approval in console")
    parser.add_argument("--dry-run", action="store_true", help="Assemble payload without sending HTTP request")
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT, help=f"API Endpoint (default: {DEFAULT_ENDPOINT})")

    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("CATAPPULT_API_KEY")

    apk_url = args.apk_url
    if not apk_url and not args.apk_file and args.tag:
        clean_tag = args.tag if args.tag.startswith("v") else f"v{args.tag}"
        apk_url = f"https://github.com/{args.repo}/releases/download/{clean_tag}/red-{clean_tag}-release.apk"
        print(f"[*] Derived APK URL from tag {clean_tag}: {apk_url}")

    notes = args.notes
    if not notes and args.notes_file and os.path.isfile(args.notes_file):
        with open(args.notes_file, "r", encoding="utf-8") as f:
            notes = f.read()

    success = publish_to_aptoide(
        api_key=api_key or "",
        apk_url=apk_url,
        apk_file=args.apk_file,
        release_notes=notes,
        release_mode=args.release_mode,
        requires_approval=args.requires_approval,
        dry_run=args.dry_run,
        endpoint=args.endpoint,
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
