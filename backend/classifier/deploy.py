from pathlib import Path

import json
import os
import subprocess
import sys
import time
import tempfile

# from dotenv import load_dotenv
# load_dotenv(override=True)


def run_command(cmd, cwd=None, capture_output=False):
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, capture_output=capture_output, text=True)
    if result.returncode != 0:
        print(result.stderr)
        sys.exit(result.returncode)
    return result.stdout.strip() if capture_output else ""


def terraform_output(terraform_dir, name):
    result = subprocess.run(
        ["terraform", "output", "-raw", name],
        cwd=terraform_dir,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip() if result.returncode == 0 else ""


def main():
    repo_root = Path(__file__).resolve().parents[2]
    terraform_dir = repo_root / "terraform" / "1_sagemaker"
    region = os.getenv("DEFAULT_AWS_REGION") or os.getenv("AWS_REGION")
    ecr_url = os.getenv("CLASSIFIER_ECR_REPOSITORY_URL") or terraform_output(
        terraform_dir, "classifier_ecr_repository_url"
    )
    if not region and ".dkr.ecr." in ecr_url:
        region = ecr_url.split(".dkr.ecr.", 1)[1].split(".amazonaws.com", 1)[0]

    if not region:
        print("Set DEFAULT_AWS_REGION or AWS_REGION before deploying")
        return 1
    if not ecr_url:
        print("Set CLASSIFIER_ECR_REPOSITORY_URL or add classifier_ecr_repository_url Terraform output")
        return 1

    image_tag = f"deploy-{int(time.time())}"
    local_image = f"aluci-classifier:{image_tag}"
    remote_image = f"{ecr_url}:{image_tag}"

    password = run_command(
        ["aws", "ecr", "get-login-password", "--region", region],
        capture_output=True,
    )
    login = subprocess.Popen(
        ["docker", "login", "--username", "AWS", "--password-stdin", ecr_url],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    _, stderr = login.communicate(input=password)
    if login.returncode != 0:
        print(stderr)
        return login.returncode

    run_command([
        "docker",
        "build",
        "--platform",
        "linux/amd64",
        "-f",
        "backend/classifier/Dockerfile",
        "-t",
        local_image,
        ".",
    ], cwd=repo_root)
    run_command(["docker", "tag", local_image, remote_image])
    run_command(["docker", "push", "--platform", "linux/amd64", remote_image])

    repository_name = ecr_url.split("/", 1)[1]
    raw_manifest = run_command([
        "aws",
        "ecr",
        "batch-get-image",
        "--repository-name",
        repository_name,
        "--image-ids",
        f"imageTag={image_tag}",
        "--region",
        region,
        "--output",
        "json",
    ], capture_output=True)
    image = json.loads(raw_manifest)["images"][0]
    manifest = json.loads(image["imageManifest"])
    manifest["mediaType"] = "application/vnd.docker.distribution.manifest.v2+json"
    manifest["config"]["mediaType"] = "application/vnd.docker.container.image.v1+json"
    for layer in manifest["layers"]:
        layer["mediaType"] = "application/vnd.docker.image.rootfs.diff.tar.gzip"

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as manifest_file:
        json.dump(manifest, manifest_file, separators=(",", ":"))
        path = manifest_file.name

    try:
        run_command([
            "aws",
            "ecr",
            "put-image",
            "--repository-name",
            repository_name,
            "--image-tag",
            image_tag,
            "--image-manifest",
            f"file://{path}",
            "--image-manifest-media-type",
            "application/vnd.docker.distribution.manifest.v2+json",
            "--region",
            region,
        ])
    finally:
        Path(path).unlink(missing_ok=True)

    if not (terraform_dir / ".terraform").exists():
        run_command(["terraform", "init"], cwd=terraform_dir)
    run_command(
        ["terraform", "apply", "-auto-approve", "-var", f"classifier_image_uri={remote_image}"],
        cwd=terraform_dir,
    )

    endpoint = terraform_output(terraform_dir, "classifier_endpoint_name")
    print(f"Pushed image: {remote_image}")
    if endpoint:
        print(f"SageMaker endpoint: {endpoint}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
