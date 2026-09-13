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
import zipfile
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


def find_python_home(virtual_environment: Path) -> Path | None:
    config_path = virtual_environment / "pyvenv.cfg"
    if not config_path.exists():
        return None
    for line in config_path.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.lower().startswith("home") and "=" in line:
            configured_home = Path(line.split("=", 1)[1].strip())
            if (configured_home / "python.exe").exists():
                return configured_home
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


def add_tree_to_zip(
    archive: zipfile.ZipFile,
    source_root: Path,
    archive_root: Path,
    skip_parts: set[tuple[str, ...]] | None = None,
) -> int:
    """Add a directory without materializing a second expanded copy."""
    added = 0
    for source_path in source_root.rglob("*"):
        if not source_path.is_file():
            continue
        relative_path = source_path.relative_to(source_root)
        if skip_parts and any(relative_path.parts[:len(parts)] == parts for parts in skip_parts):
            continue
        if "__pycache__" in relative_path.parts or source_path.suffix in {".pyc", ".pyo"}:
            continue
        archive.write(source_path, (archive_root / relative_path).as_posix())
        added += 1
    return added


def add_legacy_assets_to_zip(archive: zipfile.ZipFile, legacy_release: Path) -> tuple[list[str], list[str]]:
    copied = []
    missing = []
    for relative_path in LEGACY_ASSETS:
        source = legacy_release / relative_path
        if not source.exists():
            missing.append(str(relative_path))
            continue
        if source.is_dir():
            added = add_tree_to_zip(archive, source, Path("legacy-release") / relative_path)
            if added:
                copied.append(f"{relative_path} ({added} files)")
        else:
            archive.write(source, (Path("legacy-release") / relative_path).as_posix())
            copied.append(str(relative_path))
    return copied, missing


def add_python_base_to_zip(archive: zipfile.ZipFile, python_home: Path) -> int:
    # The configured Python installation also contains unrelated global tools
    # and site-packages. Only the interpreter, standard library and DLLs are
    # needed; project packages come from the selected virtual environment.
    return add_tree_to_zip(
        archive,
        python_home,
        Path("base-python"),
        skip_parts={
            ("Doc",),
            ("include",),
            ("libs",),
            ("Scripts",),
            ("share",),
            ("tcl",),
            ("Lib", "site-packages"),
        },
    )


def prepare_bootstrap(legacy_release: Path | None, python_environment: Path | None) -> dict[str, list[str]]:
    if BOOTSTRAP.exists():
        shutil.rmtree(BOOTSTRAP)
    dependency_cache = BOOTSTRAP / "dependency-cache"
    dependency_cache.mkdir(parents=True, exist_ok=True)

    copied = []
    missing = []
    if legacy_release:
        legacy_archive = dependency_cache / "legacy-release.zip"
        with zipfile.ZipFile(legacy_archive, "w", compression=zipfile.ZIP_STORED) as archive:
            legacy_copied, legacy_missing = add_legacy_assets_to_zip(archive, legacy_release)
        copied.extend(f"legacy-release.zip: {item}" for item in legacy_copied)
        missing.extend(legacy_missing)
    else:
        missing.extend(str(item) for item in LEGACY_ASSETS)

    if python_environment:
        python_home = find_python_home(python_environment)
        site_packages = python_environment / "Lib" / "site-packages"
        if not python_home or not site_packages.exists():
            missing.append("python-env/base-python-and-site-packages")
        else:
            python_archive = dependency_cache / "python-env.zip"
            with zipfile.ZipFile(python_archive, "w", compression=zipfile.ZIP_STORED) as archive:
                base_count = add_python_base_to_zip(archive, python_home)
                packages_count = add_tree_to_zip(archive, site_packages, Path("site-packages"))
            copied.append(f"python-env.zip: base-python ({base_count} files), site-packages ({packages_count} files)")
    else:
        missing.append("python-env/base-python-and-site-packages")

    readme = dependency_cache / "README.txt"
    readme.write_text(
        "这些文件来自旧版发行版，仅作为难下载依赖缓存保留。\n"
        "python-env.zip 是运行最新版源码所需的固定 Python 依赖环境。\n"
        "legacy-release.zip 保留旧发行版中的难下载依赖，不作为最新版源码运行。\n"
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
