#!/usr/bin/env bash
#
# Fetch canvas-design fonts from the anthropics/skills GitHub repo.
# Idempotent — safe to re-run. Overwrites existing files.
#
# Usage: ./scripts/fetch-canvas-fonts.sh

set -euo pipefail

REPO="anthropics/skills"
FONTS_PATH="skills/canvas-design/canvas-fonts"
API_URL="https://api.github.com/repos/${REPO}/contents/skills/canvas-design/canvas-fonts"
DEST_DIR="$(cd "$(dirname "$0")/.." && pwd)/${FONTS_PATH}"

mkdir -p "$DEST_DIR"

echo "Fetching font list from GitHub API..."
FILE_LIST=$(curl -sL "$API_URL")

# Check for API errors
if echo "$FILE_LIST" | grep -q '"message"'; then
  echo "Error from GitHub API:"
  echo "$FILE_LIST" | grep '"message"'
  exit 1
fi

# Parse file names and download URLs using grep/sed (no jq dependency)
COUNT=0
echo "$FILE_LIST" | grep '"download_url"' | sed 's/.*"download_url": *"\([^"]*\)".*/\1/' | while read -r URL; do
  FILENAME=$(basename "$URL")
  # Only download .ttf and *-OFL.txt files
  case "$FILENAME" in
    *.ttf|*-OFL.txt)
      echo "  Downloading ${FILENAME}..."
      curl -sL "$URL" -o "${DEST_DIR}/${FILENAME}"
      ;;
  esac
done

DOWNLOADED=$(ls -1 "$DEST_DIR"/*.ttf 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "Done. ${DOWNLOADED} font files in ${FONTS_PATH}/"
