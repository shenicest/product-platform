#!/usr/bin/env python3
"""Re-encode raster images to WebP and report which encoding came out smaller.

Called by scripts/html-snapshot.mjs. Base64 inflates every inlined byte by ~33%,
so squeezing the placeholder covers before embedding is worth the extra step.

Usage:
    python image-optimize.py --out-dir <dir> <image> [<image> ...]

Writes <out-dir>/<stem>.webp for each input and prints one JSON line per image:
    {"src": "...", "webp": "...", "original_bytes": N, "webp_bytes": N}
"""
import argparse
import json
import pathlib
import sys


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--quality", type=int, default=82)
    parser.add_argument("images", nargs="+")
    args = parser.parse_args()

    try:
        from PIL import Image
    except ImportError:
        print("Pillow not installed; skipping image optimization", file=sys.stderr)
        return 2

    out_dir = pathlib.Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    ok = 0
    for src in args.images:
        src_path = pathlib.Path(src)
        dest = out_dir / (src_path.stem + ".webp")
        try:
            with Image.open(src_path) as im:
                im.convert("RGB").save(dest, "WEBP", quality=args.quality, method=6)
        except Exception as exc:  # noqa: BLE001 - report and continue
            print(f"optimize failed: {src}: {exc}", file=sys.stderr)
            continue
        ok += 1
        print(json.dumps({
            "src": str(src_path),
            "webp": str(dest),
            "original_bytes": src_path.stat().st_size,
            "webp_bytes": dest.stat().st_size,
        }))

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
