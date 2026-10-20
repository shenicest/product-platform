#!/usr/bin/env python3
"""Subset webfonts down to the glyphs a snapshot page actually renders.

Called by scripts/html-snapshot.mjs. Reading a 4 MB CJK font per weight is the
single biggest cost in a self-contained HTML file, and a UI walkthrough only ever
shows a few hundred distinct glyphs, so subsetting takes the payload from
megabytes to tens of kilobytes.

Why the decompressed cache: fontTools must inflate the whole WOFF2 stream before
it can reach any glyph, and on a 29k-glyph CJK face that costs ~40s — while the
actual subsetting takes ~0.6s. Measured on the Harmony faces:

    from .woff2 (cold)          49.9s
    woff2 -> ttf decompress     40.7s
    subset from decompressed     0.6s

Snapshotting N pages means paying that decompression N times for identical
output. So the decompressed TTF is cached on disk, keyed by the source font's
content, and later runs subset from the cache instead. The cache is a pure
function of the font file, so it never produces stale subsets.

Usage:
    python font-subset.py --text-file <chars.txt> --out-dir <dir>
                          [--cache-dir <dir>] <font> [<font> ...]

Each input font is written to <out-dir> under its original basename. Fonts whose
subsetting fails are skipped (the caller falls back to the original file).
"""
import argparse
import hashlib
import pathlib
import sys
import time


def decompressed_ttf(src_path: pathlib.Path, cache_dir: pathlib.Path | None) -> pathlib.Path:
    """Return a decompressed TTF for `src_path`, caching it when a dir is given."""
    if cache_dir is None:
        return src_path

    digest = hashlib.sha1(src_path.read_bytes()).hexdigest()[:16]
    cached = cache_dir / f"{digest}.ttf"
    if cached.exists() and cached.stat().st_size > 0:
        return cached

    from fontTools.ttLib import TTFont

    font = TTFont(str(src_path))
    font.flavor = None  # dropping the flavor makes save() write a plain TTF
    cache_dir.mkdir(parents=True, exist_ok=True)
    tmp = cached.with_suffix(".tmp")
    font.save(str(tmp))
    tmp.replace(cached)
    return cached


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--text-file", required=True, help="UTF-8 file holding every glyph to keep")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--cache-dir", default=None, help="Reuse decompressed fonts across runs")
    parser.add_argument("fonts", nargs="+")
    args = parser.parse_args()

    try:
        from fontTools import subset
    except ImportError:
        print("fonttools not installed; skipping subsetting", file=sys.stderr)
        return 2

    text = pathlib.Path(args.text_file).read_text(encoding="utf-8")
    out_dir = pathlib.Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = pathlib.Path(args.cache_dir) if args.cache_dir else None

    failed = 0
    for src in args.fonts:
        src_path = pathlib.Path(src)
        dest = out_dir / src_path.name
        started = time.time()
        try:
            source = decompressed_ttf(src_path, cache_dir)
            subset.main([
                str(source),
                f"--text={text}",
                "--flavor=woff2",
                "--layout-features=*",
                "--no-hinting",
                "--desubroutinize",
                f"--output-file={dest}",
            ])
            # One line per font so the caller can report where time went.
            print(f"{dest.name}\t{time.time() - started:.1f}s", file=sys.stderr)
        except SystemExit:
            # fontTools calls sys.exit() on some recoverable errors
            failed += 1
            print(f"subset failed: {src}", file=sys.stderr)
        except Exception as exc:  # noqa: BLE001 - report and continue
            failed += 1
            print(f"subset failed: {src}: {exc}", file=sys.stderr)

    return 1 if failed == len(args.fonts) else 0


if __name__ == "__main__":
    raise SystemExit(main())
