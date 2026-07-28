#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
input="$project_dir/outputs/lattice-demo.webm"
gif="$project_dir/outputs/lattice-demo.gif"
mp4="$project_dir/outputs/lattice-demo.mp4"
contact_sheet="$project_dir/outputs/lattice-contact-sheet.png"

ffmpeg -y -loglevel error -i "$input" \
  -vf "fps=12,scale=1120:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=160:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
  "$gif"

ffmpeg -y -loglevel error -i "$input" \
  -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -movflags +faststart \
  "$mp4"

montage "$project_dir"/outputs/proof/frame-*.png \
  -thumbnail 480x300 \
  -tile 3x \
  -geometry +12+12 \
  -background "#111410" \
  "$contact_sheet"

printf '%s\n' "$gif" "$mp4" "$contact_sheet"
