from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def run(command: list[str], *, cwd: Path | None = None) -> None:
    print(f"Running: {' '.join(command)}")
    result = subprocess.run(command, cwd=cwd, check=False)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def terraform_output(terraform_dir: Path, name: str) -> str:
    result = subprocess.run(
        ["terraform", "output", "-raw", name],
        cwd=terraform_dir,
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout.strip() if result.returncode == 0 else ""


def main() -> int:
    frontend_dir = Path(__file__).resolve().parent
    terraform_dir = frontend_dir.parent / "terraform" / "6_frontend"

    run(["npm", "run", "build"], cwd=frontend_dir)

    out_dir = frontend_dir / "out"
    if not out_dir.exists():
        print("frontend/out not produced — is next.config.mjs using output: 'export'?")
        return 1

    bucket = os.getenv("FRONTEND_BUCKET")
    if not bucket:
        if not (terraform_dir / ".terraform").exists():
            run(["terraform", "init"], cwd=terraform_dir)
        run(["terraform", "apply", "-auto-approve"], cwd=terraform_dir)
        bucket = terraform_output(terraform_dir, "s3_bucket")

    if not bucket:
        print("Could not resolve the S3 bucket name — set FRONTEND_BUCKET.")
        return 1

    region = os.getenv("DEFAULT_AWS_REGION") or os.getenv("AWS_REGION") or "ap-southeast-1"
    run(["aws", "s3", "sync", str(out_dir), f"s3://{bucket}", "--delete", "--region", region])

    cloudfront_url = terraform_output(terraform_dir, "cloudfront_url")
    if cloudfront_url:
        print(f"Frontend URL: {cloudfront_url}")
    print(f"Synced {out_dir} -> s3://{bucket}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
