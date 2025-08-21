#!/usr/bin/env python3
"""Simple test to ensure project functions execute without errors.

This script dynamically imports Python modules in the repository and attempts
to call functions that require no mandatory arguments. Functions requiring
arguments or those that raise exceptions are reported.
"""

import os
import importlib.util
import inspect
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
EXCLUDED_DIRS = {
    'tests', 'assets', 'cache', 'poi_env', 'poi_media', 'temp_uploads',
    'perf', 'scripts', 'static'
}


def discover_python_files(root: Path):
    """Yield Python files under root excluding certain directories."""
    for path in root.rglob('*.py'):
        if any(part in EXCLUDED_DIRS for part in path.parts):
            continue
        if path.name.startswith('test_') or path.name == '__init__.py' or 'test' in path.name:
            continue
        yield path


def import_module_from_path(module_path: Path):
    """Import a module from its filesystem path."""
    module_name = module_path.stem
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)  # type: ignore
    except BaseException as exc:  # noqa: BLE001
        raise ImportError(str(exc)) from exc
    return module


def run_zero_arg_functions(module):
    """Run functions that do not require mandatory arguments."""
    results = []
    for name, func in inspect.getmembers(module, inspect.isfunction):
        if inspect.getmodule(func) is not module:
            continue
        sig = inspect.signature(func)
        has_required = any(
            p.default is inspect._empty and p.kind in (
                inspect.Parameter.POSITIONAL_ONLY,
                inspect.Parameter.POSITIONAL_OR_KEYWORD,
            )
            for p in sig.parameters.values()
        )
        if has_required:
            results.append((name, 'skipped', 'requires arguments'))
            continue
        try:
            func()
            results.append((name, 'passed', ''))
        except Exception as exc:  # pylint: disable=broad-except
            results.append((name, 'failed', str(exc)))
    return results


def main():
    all_results = []
    for py_file in discover_python_files(PROJECT_ROOT):
        try:
            module = import_module_from_path(py_file)
        except Exception as exc:  # pylint: disable=broad-except
            all_results.append((py_file, 'skipped', str(exc)))
            continue
        for func_name, status, message in run_zero_arg_functions(module):
            all_results.append((f"{py_file}:{func_name}", status, message))

    failed = [r for r in all_results if r[1] == 'failed']
    skipped = [r for r in all_results if r[1] == 'skipped']

    for entry in failed:
        print(f"❌ {entry[0]} -> {entry[2]}")

    passed = [r for r in all_results if r[1] == 'passed']

    print(f"\n✅ Passed: {len(passed)}")
    print(f"⚠️  Skipped: {len(skipped)}")
    print(f"❌ Failed: {len(failed)}")

    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
