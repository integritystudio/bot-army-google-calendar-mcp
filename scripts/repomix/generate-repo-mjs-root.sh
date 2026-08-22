#!/usr/bin/env bash
# Runs repomix over the root-level *.mjs CLI scripts and writes docs/repomix/repo-mjs-root.xml
set -euo pipefail

ROOT="${1:?Usage: $0 <root_dir> <output_file>}"
OUTPUT_FILE="${2:?Usage: $0 <root_dir> <output_file>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/repomix-mjs-root.config.json"

FORCE_COLOR=0 NO_COLOR=1 timeout 60 \
npx repomix "$ROOT" -c "$CONFIG_FILE" -o "$OUTPUT_FILE" >/dev/null 2>&1
