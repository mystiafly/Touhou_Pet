"""Build the launcher and seed it with hard-to-download project assets.

The launcher runs downloaded source with a separately preserved Python
environment and the current project's local model cache. Source updates do
not require a new backend artifact for every commit.
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
MODEL_CACHE = Path("services/models")


def find_python_environment(explicit: Path | None) -> Path | None:
    candidates = []
    if explicit:
        candidates.append(explicit)
    candidates.append(ROOT / ".venv")
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


def prepare_bootstrap(python_environment: Path | None) -> dict[str, list[str]]:
    if BOOTSTRAP.exists():
        shutil.rmtree(BOOTSTRAP)
    dependency_cache = BOOTSTRAP / "dependency-cache"
    dependency_cache.mkdir(parents=True, exist_ok=True)

    copied = []
    missing = []

    model_source = ROOT / MODEL_CACHE
    if model_source.is_dir():
        model_archive = dependency_cache / "models.zip"
        with zipfile.ZipFile(model_archive, "w", compression=zipfile.ZIP_STORED) as archive:
            model_count = add_tree_to_zip(archive, model_source, Path("services/models"))
        copied.append(f"models.zip: services/models ({model_count} files)")
    else:
        missing.append(str(MODEL_CACHE))

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
        "这些文件来自当前项目，仅作为难下载依赖缓存保留。\n"
        "python-env.zip 是运行最新版源码所需的固定 Python 依赖环境。\n"
        "models.zip 是当前项目内嵌的 HuggingFace 嵌入模型缓存。\n"
        "启动器更新时不会覆盖 dependency-cache，也不会把用户数据或模型缓存重置。\n",
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
        "--python-env",
        type=Path,
        help="可复用的 Python 虚拟环境，默认自动查找项目 .venv",
    )
    parser.add_argument("--no-installer", action="store_true", help="只准备启动器依赖缓存，不运行 electron-builder")
    args = parser.parse_args()

    python_environment = find_python_environment(args.python_env)
    result = prepare_bootstrap(python_environment)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not args.no_installer:
        build_installer()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
