from __future__ import annotations

from pathlib import Path

import os
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
    terraform_dir = repo_root / "terraform" / "3_copilot"
    ecr_url = os.getenv("COPILOT_ECR_REPOSITORY_URL") or terraform_output(terraform_dir, "ecr_repository_url")
    if not ecr_url:
        print("Run terraform apply in terraform/3_copilot first, or set COPILOT_ECR_REPOSITORY_URL.")
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

    run(["docker", "build", "--platform", "linux/amd64", "-t", image_uri, "."], cwd=repo_root / "backend" / "copilot")
    run(["docker", "push", image_uri])

    if not (terraform_dir / ".terraform").exists():
        run(["terraform", "init"], cwd=terraform_dir)
    run(["terraform", "apply", "-auto-approve", "-var", f"copilot_image_uri={image_uri}"], cwd=terraform_dir)

    copilot_url = terraform_output(terraform_dir, "copilot_url")
    print(f"Pushed image: {image_uri}")
    if copilot_url:
        print(f"Copilot URL: {copilot_url}")
        print(f"Health check: curl {copilot_url.rstrip('/')}/health")
    return 0


if __name__ == "__main__":
    sys.exit(main())
