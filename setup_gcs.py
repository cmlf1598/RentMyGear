# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "google-cloud-storage>=2.18",
#   "python-dotenv>=1.0",
# ]
# ///
"""
Provision and validate the Google Cloud Storage bucket used for AI-generated images.

Steps:
  1. Load configuration from .env.local / .env (python-dotenv).
  2. Authenticate with the service-account key.
  3. Create the bucket if missing (uniform bucket-level access).
  4. Allow public access and grant allUsers -> roles/storage.objectViewer.
  5. Configure CORS for GET/HEAD.
  6. Smoke test: upload a dummy file, verify its public URL, delete it.

Usage:
  uv run setup_gcs.py                  # full setup + smoke test
  uv run setup_gcs.py --smoke-only     # only run the IAM smoke test
  uv run setup_gcs.py --skip-create    # fail instead of creating a missing bucket
  uv run setup_gcs.py --location EU    # bucket location (default: $GCS_LOCATION or US)
"""

from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

from dotenv import load_dotenv
from google.api_core import exceptions as gexc
from google.cloud import storage

PUBLIC_ROLE = "roles/storage.objectViewer"
PUBLIC_MEMBER = "allUsers"
SMOKE_PREFIX = "smoke-test"


# --------------------------------------------------------------------------- output helpers


def ok(message: str) -> None:
    print(f"  ✅ {message}")


def info(message: str) -> None:
    print(f"  ·  {message}")


def fail(message: str, hint: str | None = None) -> None:
    print(f"  ❌ {message}")
    if hint:
        print(f"     ↳ {hint}")
    sys.exit(1)


def step(title: str) -> None:
    print(f"\n▸ {title}")


# --------------------------------------------------------------------------- configuration


def load_config() -> dict[str, str]:
    root = Path(__file__).resolve().parent
    for name in (".env.local", ".env"):
        load_dotenv(root / name, override=False)

    required = ("GCS_BUCKET_NAME", "GCS_PROJECT_ID", "GOOGLE_APPLICATION_CREDENTIALS")
    missing = [key for key in required if not os.getenv(key, "").strip()]
    if missing:
        fail(
            f"Missing environment variables: {', '.join(missing)}",
            "Copy .env.example to .env.local and fill in the values.",
        )

    credentials = Path(os.environ["GOOGLE_APPLICATION_CREDENTIALS"].strip())
    if not credentials.is_absolute():
        credentials = root / credentials
    if not credentials.is_file():
        fail(
            f"Credentials file not found: {credentials}",
            "Download a service-account JSON key: IAM & Admin → Service Accounts → Keys → Add key.",
        )

    return {
        "bucket": os.environ["GCS_BUCKET_NAME"].strip(),
        "project": os.environ["GCS_PROJECT_ID"].strip(),
        "credentials": str(credentials),
    }


# --------------------------------------------------------------------------- setup steps


def get_client(cfg: dict[str, str]) -> storage.Client:
    step("Authenticating")
    try:
        client = storage.Client.from_service_account_json(cfg["credentials"], project=cfg["project"])
    except (ValueError, OSError) as error:
        fail(f"Could not load service-account key: {error}", "Make sure the file is a valid JSON key.")
    ok(f"Service account: {client._credentials.service_account_email}")  # noqa: SLF001
    info(f"Project: {cfg['project']}")
    return client


def ensure_bucket(client: storage.Client, name: str, location: str, allow_create: bool) -> storage.Bucket:
    step(f"Bucket gs://{name}")
    try:
        bucket = client.lookup_bucket(name)
    except gexc.Forbidden as error:
        fail(
            f"Permission denied while looking up the bucket: {error.message}",
            "Grant the service account 'Storage Admin' (roles/storage.admin) on the project.",
        )

    if bucket is not None:
        ok(f"Bucket exists (location: {bucket.location})")
        return bucket

    if not allow_create:
        fail("Bucket does not exist and --skip-create was passed.")

    bucket = client.bucket(name)
    bucket.iam_configuration.uniform_bucket_level_access_enabled = True
    try:
        bucket = client.create_bucket(bucket, location=location)
    except gexc.Conflict:
        fail(
            "Bucket name is already taken by another project.",
            "Bucket names are globally unique — choose a different GCS_BUCKET_NAME.",
        )
    except gexc.Forbidden as error:
        fail(f"Not allowed to create buckets: {error.message}", "Grant the service account 'Storage Admin'.")
    ok(f"Bucket created in {location} with uniform bucket-level access")
    return bucket


def make_public(bucket: storage.Bucket) -> None:
    step("Public read access")
    bucket.reload()
    if not bucket.iam_configuration.uniform_bucket_level_access_enabled:
        bucket.iam_configuration.uniform_bucket_level_access_enabled = True
        bucket.patch()
        ok("Enabled uniform bucket-level access")

    if bucket.iam_configuration.public_access_prevention == "enforced":
        bucket.iam_configuration.public_access_prevention = "inherited"
        try:
            bucket.patch()
        except gexc.GoogleAPICallError as error:
            fail(f"Could not disable public access prevention: {error.message}")
        ok("Public access prevention set to 'inherited'")

    policy = bucket.get_iam_policy(requested_policy_version=3)
    already_public = any(
        binding["role"] == PUBLIC_ROLE and PUBLIC_MEMBER in binding["members"] for binding in policy.bindings
    )
    if already_public:
        ok(f"{PUBLIC_MEMBER} already has {PUBLIC_ROLE}")
        return

    policy.bindings.append({"role": PUBLIC_ROLE, "members": {PUBLIC_MEMBER}})
    try:
        bucket.set_iam_policy(policy)
    except gexc.PreconditionFailed as error:
        fail(
            f"Public access is blocked by policy: {error.message}",
            "Your organization enforces 'constraints/storage.publicAccessPrevention'. "
            "Ask an org admin to exempt this project or use a project outside the organization.",
        )
    except gexc.Forbidden as error:
        fail(
            f"Not allowed to change bucket IAM: {error.message}",
            "The service account needs 'storage.buckets.setIamPolicy' (e.g. Storage Admin).",
        )
    ok(f"Granted {PUBLIC_ROLE} to {PUBLIC_MEMBER}")


def configure_cors(bucket: storage.Bucket) -> None:
    step("CORS")
    bucket.cors = [
        {
            "origin": ["*"],
            "method": ["GET", "HEAD"],
            "responseHeader": ["Content-Type", "Cache-Control"],
            "maxAgeSeconds": 3600,
        }
    ]
    bucket.patch()
    ok("GET/HEAD allowed from any origin")


# --------------------------------------------------------------------------- smoke test


def fetch_public(url: str, attempts: int = 5) -> tuple[int, bytes]:
    """IAM changes can take a few seconds to propagate, so retry briefly."""
    last: tuple[int, bytes] = (0, b"")
    for attempt in range(1, attempts + 1):
        request = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            last = (error.code, error.read())
        except urllib.error.URLError as error:
            last = (0, str(error.reason).encode())
        if attempt < attempts:
            time.sleep(2 * attempt)
    return last


def smoke_test(bucket: storage.Bucket) -> None:
    step("Smoke test (upload → public read → delete)")
    name = f"{SMOKE_PREFIX}/{uuid.uuid4()}.txt"
    payload = f"rent-my-gear smoke test {uuid.uuid4()}".encode()
    blob = bucket.blob(name)
    blob.cache_control = "no-store"

    try:
        blob.upload_from_string(payload, content_type="text/plain")
    except gexc.Forbidden as error:
        fail(f"Upload denied: {error.message}", "Grant the service account 'Storage Object Admin' on the bucket.")
    ok(f"Uploaded gs://{bucket.name}/{name}")

    public_url = f"https://storage.googleapis.com/{bucket.name}/{name}"
    try:
        status, body = fetch_public(public_url)
        if status != 200:
            fail(
                f"Public URL returned HTTP {status}: {public_url}",
                "allUsers may lack roles/storage.objectViewer, or IAM is still propagating — re-run in a minute.",
            )
        if body != payload:
            fail("Public URL content does not match the uploaded payload.")
        ok(f"Public URL verified: {public_url}")
    finally:
        try:
            blob.delete()
        except gexc.NotFound:
            pass
        except gexc.Forbidden as error:
            fail(f"Delete denied: {error.message}", "The service account needs 'storage.objects.delete'.")

    if blob.exists():
        fail(f"Smoke-test object still exists after delete: {name}")
    ok("Dummy file deleted — IAM permissions are valid")


# --------------------------------------------------------------------------- entry point


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Provision the Rent my Gear GCS bucket.")
    parser.add_argument("--smoke-only", action="store_true", help="only run the smoke test")
    parser.add_argument("--skip-create", action="store_true", help="do not create the bucket if missing")
    parser.add_argument("--location", default=os.getenv("GCS_LOCATION", "US"), help="bucket location")
    args = parser.parse_args()

    print("Rent my Gear — Google Cloud Storage setup")
    cfg = load_config()
    client = get_client(cfg)

    if args.smoke_only:
        bucket = ensure_bucket(client, cfg["bucket"], args.location, allow_create=False)
    else:
        bucket = ensure_bucket(client, cfg["bucket"], args.location, allow_create=not args.skip_create)
        make_public(bucket)
        configure_cors(bucket)

    smoke_test(bucket)
    print(f"\n✔ All checks passed. Public base URL: https://storage.googleapis.com/{bucket.name}/\n")


if __name__ == "__main__":
    main()
