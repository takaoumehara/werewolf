#!/usr/bin/env python3
"""一覧表示用のサムネイルを生成する。

原画は 1568x2744 / 3〜5MB。これを役職構成(24枚)や結果画面の小さなセルに
そのまま使っていたため、画面を開くだけで 86MB 落ちてきていた。
表示に必要なのは長辺 400px 程度なので、その大きさの WebP を作る。

    python3 tools/build-thumbnails.py

出力は 2段階:
  thumbs/  長辺400px — 一覧のセル用（役職構成は24枚が同時に出る）
  cards/   長辺1200px — カードを大きく見せる用（同時に出るのは1枚）
これにより、配信物から原画そのものを外せる。
生成物はリポジトリにコミットする（配信物なのでビルド環境に依存させない）。
"""
import pathlib
import sys

from PIL import Image

# 元フォルダ → サムネの長辺(px)。役職カードの絵は最大でも画面幅の半分程度、
# 背景はセルいっぱいに敷くだけなので、いずれも 400px あれば足りる。
SOURCES = [
    # (元フォルダ, 出力先, 長辺px, 品質)
    # thumbs: 一覧のセル用。役職構成では24枚が同時に出る
    ("00_transparent-illustrations-72-a-refined", "thumbs", 400, 82),
    ("00_transparent-illustrations-72-a-lifelike", "thumbs", 400, 82),
    ("backgrounds-72", "thumbs", 400, 82),
    # cards: カードを大きく見せる場面用。同時に出るのは1枚だけなので大きめ
    ("00_transparent-illustrations-72-a-refined", "cards", 1200, 88),
    ("00_transparent-illustrations-72-a-lifelike", "cards", 1200, 88),
    ("backgrounds-72", "cards", 1200, 88),
]
ROOT = pathlib.Path(__file__).resolve().parent.parent


def build() -> int:
    total_in = total_out = count = 0
    for folder, out_root, longest, quality in SOURCES:
        src_dir = ROOT / folder
        if not src_dir.is_dir():
            print(f"  skip {folder} (フォルダが無い)")
            continue
        out_dir = ROOT / out_root / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        for src in sorted(src_dir.glob("*.png")):
            out = out_dir / (src.stem + ".webp")
            image = Image.open(src)
            image.thumbnail((longest, longest), Image.LANCZOS)
            # 透過を保つため RGBA のまま WebP へ。品質 82 で見た目の劣化は出ない。
            image.save(out, "WEBP", quality=quality, method=6)
            total_in += src.stat().st_size
            total_out += out.stat().st_size
            count += 1
        print(f"  {out_root}/{folder}: {len(list(out_dir.glob('*.webp')))} 枚")
    if count == 0:
        print("生成対象がありませんでした", file=sys.stderr)
        return 1
    print(f"\n{count} 枚: {total_in / 1048576:.1f}MB → {total_out / 1048576:.1f}MB "
          f"({100 - total_out / total_in * 100:.0f}% 削減)")
    return 0


if __name__ == "__main__":
    raise SystemExit(build())
