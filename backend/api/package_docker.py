from __future__ import annotations

from pathlib import Path

import os
import re
import subprocess
import sys
import time


def run(command: list[str], *, cwd: Path | None = None, capture: bool = False) -> str:
    print(f"Running: {' '.join(command)}")
    result = subprocess.run(command, cwd=cwd, capture_output=capture, text=True, check=False)
    if result.returncode != 0:
        print(result.stderr)
        raise SystemExit(result.returncode)
    return result.stdout.strip() if capture else ""


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
    repo_root = Path(__file__).resolve().parents[2]
    terraform_dir = repo_root / "terraform" / "5_api"

    ecr_url = os.getenv("API_ECR_REPOSITORY_URL") or terraform_output(terraform_dir, "ecr_repository_url")
    if not ecr_url:
        print("Run terraform apply in terraform/5_api first, or set API_ECR_REPOSITORY_URL.")
        return 1

    region = os.getenv("DEFAULT_AWS_REGION") or os.getenv("AWS_REGION")
    if not region and ".dkr.ecr." in ecr_url:
        region = ecr_url.split(".dkr.ecr.", 1)[1].split(".amazonaws.com", 1)[0]
    if not region:
        print("Set DEFAULT_AWS_REGION or AWS_REGION before deploying.")
        return 1

    image_uri = f"{ecr_url}:deploy-{int(time.time())}"
    password = run(["aws", "ecr", "get-login-password", "--region", region], capture=True)
    login = subprocess.run(
        ["docker", "login", "--username", "AWS", "--password-stdin", ecr_url],
        input=password,
        text=True,
        check=False,
    )
    if login.returncode != 0:
        return login.returncode

    _ = run(
        ["docker", "build", "--platform", "linux/amd64", "-f", "backend/api/Dockerfile", "-t", image_uri, "."],
        cwd=repo_root,
    )
    _ = run(["docker", "push", image_uri])

    if not (terraform_dir / ".terraform").exists():
        _ = run(["terraform", "init"], cwd=terraform_dir)

    # Pin the image in tfvars so a later plain apply does not destroy the Lambda.
    tfvars = terraform_dir / "terraform.tfvars"
    text = tfvars.read_text() if tfvars.exists() else ""
    pinned, found = re.subn(r'^api_image_uri\s*=.*$', f'api_image_uri = "{image_uri}"', text, count=1, flags=re.MULTILINE)
    tfvars.write_text(pinned if found else f'{text.rstrip()}\napi_image_uri = "{image_uri}"\n')

    _ = run(["terraform", "apply", "-auto-approve"], cwd=terraform_dir)
    api_function_url = terraform_output(terraform_dir, "api_function_url")
    if api_function_url:
        print(f"API Function URL: {api_function_url}")
        print(f"Health check: curl {api_function_url.rstrip('/')}/health")

    print(f"Pushed image: {image_uri}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
