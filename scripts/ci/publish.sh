#!/usr/bin/env bash
set -euo pipefail

notes_file="$RUNNER_TEMP/release-notes.md"
title="Limits $RELEASE_BRANCH"
cat > "$notes_file" <<EOF
Builds from branch \`$RELEASE_BRANCH\` for Windows x64, macOS Apple Silicon / Intel, and Linux x64.

Commit: $GITHUB_SHA

Windows: portable EXE and installer. macOS: DMG and ZIP for each architecture. Linux: AppImage and DEB.

File checksums: \`SHA256SUMS.txt\`.
EOF

if gh release view "$RELEASE_TAG" > /dev/null 2>&1; then
  gh release edit "$RELEASE_TAG" --title "$title" --notes-file "$notes_file" --draft --prerelease=false
else
  gh release create "$RELEASE_TAG" --verify-tag --target "$GITHUB_SHA" --title "$title" --notes-file "$notes_file" --draft --prerelease=false
fi
gh release upload "$RELEASE_TAG" release/* --clobber
gh release edit "$RELEASE_TAG" --draft=false
