#!/usr/bin/env python3
"""Build faithful, lightweight DISCOVER thumbnails from the ORIGINAL archive.

Only changes preview assets. Neither the 155 originals nor the 3D atlas are
modified. Each thumbnail keeps the exact native aspect ratio, without cropping.
"""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
REEL = ROOT / "public" / "work" / "immersive" / "reel"
OUT = REEL / "thumbs"
MAX_SIZE = (256, 160)
IMAGE_QUALITY = 82


def image_for(item: dict, staging: Path) -> tuple[Path, str]:
    item_id = int(item["id"])
    if not item.get("video"):
        return REEL / "img" / f"{item_id:03d}.webp", "image"
    source = REEL / "vid" / f"{item_id}.mp4"
    still = staging / f"{item_id:03d}.png"
    # Select a real, representative video frame, not the distorted atlas.
    for seek in ("0.35", "0"):
        cmd = ["ffmpeg", "-nostdin", "-loglevel", "error", "-y",
               "-ss", seek, "-i", str(source), "-frames:v", "1", str(still)]
        try:
            run = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(f"Frame extraction timed out for {source.name}") from exc
        if run.returncode == 0 and still.is_file() and still.stat().st_size > 0:
            return still, "video"
        still.unlink(missing_ok=True)
    raise RuntimeError(f"Could not extract a frame from original video: {source.name}")


def main() -> None:
    catalogue = json.loads((REEL / "catalog.json").read_text(encoding="utf8"))
    items = catalogue["items"]
    assert len(items) == 155
    assert len({i["id"] for i in items}) == 155
    OUT.mkdir(parents=True, exist_ok=True)
    entries = []
    with tempfile.TemporaryDirectory(prefix="archive-thumb-") as temp:
        staging = Path(temp)
        for item in sorted(items, key=lambda value: int(value["id"])):
            src, kind = image_for(item, staging)
            assert src.is_file(), f"Original asset missing: {src}"
            dst = OUT / f'{int(item["id"]):03d}.webp'
            with Image.open(src) as opened:
                original = ImageOps.exif_transpose(opened)
                src_width, src_height = original.size
                assert src_width > 0 and src_height > 0
                original.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
                rgb = original.convert("RGBA" if "A" in original.getbands() else "RGB")
                icc = opened.info.get("icc_profile")
                options = {"format": "WEBP", "quality": IMAGE_QUALITY, "method": 5}
                if icc:
                    options["icc_profile"] = icc
                rgb.save(dst, **options)
            with Image.open(dst) as check:
                out_width, out_height = check.size
                assert out_width <= MAX_SIZE[0] and out_height <= MAX_SIZE[1]
                old_ratio = src_width / src_height
                new_ratio = out_width / out_height
                assert abs(new_ratio / old_ratio - 1) <= 0.025, item["id"]
                assert check.format == "WEBP", item["id"]
            entries.append({
                "id": item["id"], "type": kind,
                "original": [src_width, src_height],
                "thumbnail": [out_width, out_height],
                "bytes": dst.stat().st_size,
            })
    manifest = {"version": 1, "maxWidth": MAX_SIZE[0],
                "maxHeight": MAX_SIZE[1], "count": len(entries),
                "totalBytes": sum(x["bytes"] for x in entries), "items": entries}
    (OUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf8",
    )
    print(f"Created {len(entries)} ratio-true WebP thumbnails; "
          f"total {manifest['totalBytes'] / 1024:.1f} KiB; "
          f"including {sum(x['type']=='video' for x in entries)} real video frames.")


if __name__ == "__main__":
    main()
