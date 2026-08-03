from __future__ import annotations

from http.client import HTTPSConnection
from pathlib import Path
from typing import Final
from urllib.parse import urlparse
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest

import json
import subprocess
import boto3


PROMPT: Final = "Use the policy documents to answer briefly: what loan information should an underwriter review?"
MODEL: Final = "openai/gpt-oss-120b"
TIMEOUT_SECONDS: Final = 300
# Matches backend/ingest/test_ingest.py, so the vectors it wrote are searchable here.
TEST_USER_ID: Final = "user_test_underwriter"


def post_chat(prompt: str) -> None:
    """POST to the copilot /chat Function URL with SigV4 and print the SSE stream."""
    terraform_dir = Path(__file__).resolve().parents[2] / "terraform" / "3_copilot"
    result = subprocess.run(
        ["terraform", "output", "-raw", "copilot_url"],
        cwd=terraform_dir,
        capture_output=True,
        text=True,
        check=False,
    )
    url = result.stdout.strip()
    if result.returncode != 0 or not url or url.startswith("Not created yet"):
        raise SystemExit("Deploy copilot first with `python backend/copilot/deploy.py`.")

    parsed = urlparse(url.rstrip("/"))
    if parsed.scheme != "https" or not parsed.netloc:
        raise SystemExit("Use the deployed HTTPS copilot URL from Terraform output `copilot_url`.")

    path = f"{parsed.path.rstrip('/')}/chat"
    body = json.dumps({
        "prompt": prompt,
        "clerk_user_id": TEST_USER_ID,
        "ai_config": {"preferredModel": MODEL},
    }).encode()

    # The Function URL is AWS_IAM-authenticated: sign these exact bytes, send them unchanged.
    session = boto3.Session()
    signed = AWSRequest(
        method="POST",
        url=f"https://{parsed.netloc}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    SigV4Auth(session.get_credentials(), "lambda", session.region_name).add_auth(signed)

    connection = HTTPSConnection(parsed.netloc, timeout=TIMEOUT_SECONDS)
    try:
        connection.request("POST", path, body=body, headers=dict(signed.headers))
        response = connection.getresponse()
        if response.status >= 400:
            raise SystemExit(response.read().decode())
        while line := response.readline():
            text = line.decode().strip()
            if text:
                print(text)
    finally:
        connection.close()


if __name__ == "__main__":
    post_chat(PROMPT)
