"""Build the small launcher and seed it with hard-to-download legacy assets.

The legacy distribution is copied into a cache only. The launcher runs the
downloaded source with a separately preserved Python environment, so source
updates do not require a new backend artifact for every commit.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BOOTSTRAP = ROOT / "build" / "launcher_bootstrap"
LEGACY_ASSETS = (
    Path("dist/backend"),
    Path(".node_env"),
    Path("wriggle_test.zip"),
    Path("zh_core_web_sm-3.8.0-py3-none-any.whl"),
)


def find_python_environment(explicit: Path | None, legacy_release: Path | None) -> Path | None:
    candidates = []
    if explicit:
        candidates.append(explicit)
    candidates.append(ROOT / ".venv")
    if legacy_release:
        candidates.append(legacy_release / ".venv")
    for candidate in candidates:
        if (candidate / "Scripts" / "python.exe").exists() or (candidate / "bin" / "python").exists():
            return candidate
    return None


def find_legacy_release(explicit: Path | None) -> Path | None:
    candidates = []
    if explicit:
        candidates.append(explicit)
    candidates.append(ROOT.parent / "rumia_clean_test_v2")
    for candidate in candidates:
        if candidate.is_dir() and (candidate / "dist" / "backend").exists():
            return candidate
    return None


def prepare_bootstrap(legacy_release: Path | None, python_environment: Path | None) -> dict[str, list[str]]:
    if BOOTSTRAP.exists():
        shutil.rmtree(BOOTSTRAP)
    dependency_cache = BOOTSTRAP / "dependency-cache" / "legacy-release"
    dependency_cache.mkdir(parents=True, exist_ok=True)

    copied = []
    missing = []
    if legacy_release:
        for relative_path in LEGACY_ASSETS:
            source = legacy_release / relative_path
            if not source.exists():
                missing.append(str(relative_path))
                continue
            destination = dependency_cache / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            if source.is_dir():
                shutil.copytree(source, destination, dirs_exist_ok=True)
            else:
                shutil.copy2(source, destination)
            copied.append(str(relative_path))
    else:
        missing.extend(str(item) for item in LEGACY_ASSETS)

    if python_environment:
        destination = BOOTSTRAP / "dependency-cache" / "python-env" / ".venv"
        shutil.copytree(python_environment, destination, dirs_exist_ok=True)
        copied.append("python-env/.venv")
    else:
        missing.append("python-env/.venv")

    readme = dependency_cache / "README.txt"
    readme.write_text(
        "这些文件来自旧版发行版，仅作为难下载依赖缓存保留。\n"
        "python-env/.venv 是运行最新版源码所需的固定 Python 依赖环境。\n"
        "启动器更新时不会覆盖 dependency-cache，也不会把旧版后端当作最新版运行。\n",
        encoding="utf-8",
    )
    return {"copied": copied, "missing": missing}


def build_installer() -> None:
    npx = "npx.cmd" if os.name == "nt" else "npx"
    subprocess.run(
        [npx, "electron-builder", "--win", "-c", "build_launcher.json"],
        cwd=ROOT,
        check=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="构建大贤者启动器发行版")
    parser.add_argument(
        "--legacy-release",
        type=Path,
        help="旧版发行目录，默认自动查找 ../rumia_clean_test_v2",
    )
    parser.add_argument(
        "--python-env",
        type=Path,
        help="可复用的 Python 虚拟环境，默认自动查找项目 .venv",
    )
    parser.add_argument("--no-installer", action="store_true", help="只准备启动器依赖缓存，不运行 electron-builder")
    args = parser.parse_args()

    legacy_release = find_legacy_release(args.legacy_release)
    python_environment = find_python_environment(args.python_env, legacy_release)
    result = prepare_bootstrap(legacy_release, python_environment)
    print(json.dumps({"legacy_release": str(legacy_release) if legacy_release else None, **result}, ensure_ascii=False, indent=2))
    if not args.no_installer:
        build_installer()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
