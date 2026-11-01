"""Archive source only; omit profiles, dependencies, caches and local diagnostics."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parents[1]
target = root.parent / 'desktop-message-translator-source-review.zip'
excluded_dirs = {'node_modules', '.git', '.builder-cache', '.runtime-temp', '.smoke-profile', '.build-temp', 'release', 'release-verified', 'bundles', 'dist', '__pycache__'}
excluded_names = {'UPGRADE-STATUS.md', 'smoke-startup.png', 'tsconfig.tsbuildinfo'}
with ZipFile(target, 'w', ZIP_DEFLATED, compresslevel=6) as archive:
    import os
    paths = []
    for current, directories, files in os.walk(root):
        directories[:] = [name for name in directories if name not in excluded_dirs and not name.startswith('.smoke-')]
        paths.extend(Path(current) / name for name in files)
    for path in paths:
        relative = path.relative_to(root)
        if not path.is_file() or any(part in excluded_dirs for part in relative.parts):
            continue
        if path.name in excluded_names or path.suffix in {'.log', '.out', '.err', '.node'}:
            continue
        if relative.parts[:2] == ('build', 'compact-locales'):
            continue
        archive.write(path, Path(root.name) / relative)
print(target)
print(f'{target.stat().st_size} bytes')
