"""Build the backend artifact consumed by the launcher updater.

The resulting ZIP must be uploaded to the GitHub release tag v<version> using
the exact filename printed by this script. The launcher then pairs it with the
source archive for the same commit.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def read_version() -> str:
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    return str(package["version"])


def git_commit() -> str:
    return subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()


def build_backend(force: bool) -> Path:
    backend_dir = ROOT / "dist" / "backend"
    executable = backend_dir / "web_interface.exe"
    if not executable.exists() or force:
        subprocess.run(
            [sys.executable, "-m", "PyInstaller", "--noconfirm", "web_interface.spec"],
            cwd=ROOT,
            check=True,
        )
        generated = ROOT / "dist" / "web_interface"
        if generated.exists():
            if backend_dir.exists():
                shutil.rmtree(backend_dir)
            generated.rename(backend_dir)
    if not executable.exists():
        raise FileNotFoundError(f"未找到后端可执行文件: {executable}")
    return backend_dir


def package_backend(force: bool) -> Path:
    version = read_version()
    commit = git_commit()
    backend_dir = build_backend(force)
    staging = ROOT / "build" / "backend_package" / f"{version}-{commit}"
    if staging.exists():
        shutil.rmtree(staging)
    packaged_backend = staging / "dist" / "backend"
    shutil.copytree(backend_dir, packaged_backend)
    (packaged_backend / "backend-manifest.json").write_text(
        json.dumps(
            {
                "format": 1,
                "version": version,
                "source_commit": commit,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    output_dir = ROOT / "dist" / "backend-release"
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / f"Rumia-Backend-{version}-{commit}.zip"
    if output.exists():
        output.unlink()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for file_path in staging.rglob("*"):
            if file_path.is_file():
                archive.write(file_path, file_path.relative_to(staging).as_posix())
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="构建启动器匹配的后端 ZIP")
    parser.add_argument("--rebuild", action="store_true", help="强制重新运行 PyInstaller")
    args = parser.parse_args()
    output = package_backend(args.rebuild)
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
