#!/usr/bin/env python3
"""Enforces the InkCard layer invariant (see CLAUDE.md):

  genblaze_s3                → services/api/app/repo/store.py ONLY
  genblaze_core/genblaze_*   → services/api/app/repo/pipelines.py ONLY
  boto3 / botocore           → never imported directly, anywhere
"""

import ast
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP_DIR = ROOT / "services" / "api" / "app"

STORE_FILE = APP_DIR / "repo" / "store.py"
PIPELINES_FILE = APP_DIR / "repo" / "pipelines.py"

BANNED_ANYWHERE = {"boto3", "botocore"}
STORE_ONLY = {"genblaze_s3"}


def imported_top_level_modules(tree: ast.Module) -> set[str]:
    modules: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                modules.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                modules.add(node.module.split(".")[0])
    return modules


def main() -> int:
    if not APP_DIR.exists():
        print(f"check:structure: {APP_DIR} does not exist, nothing to check.")
        return 0

    violations: list[str] = []

    for path in sorted(APP_DIR.rglob("*.py")):
        tree = ast.parse(path.read_text(), filename=str(path))
        modules = imported_top_level_modules(tree)
        rel = path.relative_to(ROOT)

        for module in modules:
            if module in BANNED_ANYWHERE:
                violations.append(f"{rel}: imports '{module}' directly (never allowed — use genblaze_s3)")
                continue

            if module in STORE_ONLY and path != STORE_FILE:
                violations.append(f"{rel}: imports '{module}' outside repo/store.py")
                continue

            if module.startswith("genblaze_") and module not in STORE_ONLY and path != PIPELINES_FILE:
                violations.append(f"{rel}: imports '{module}' outside repo/pipelines.py")

    if violations:
        print("check:structure: FAILED")
        for v in violations:
            print(f"  - {v}")
        return 1

    print("check:structure: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
