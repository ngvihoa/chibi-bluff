#!/usr/bin/env bash
# Vercel "Ignored Build Step" (apps/web/vercel.json → ignoreCommand).
# Exit 1 = build, exit 0 = skip (docs/deployment.md).
#   main:           always build (production).
#   other branches: build a preview only when the latest commit message contains "[deploy]".

if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
  echo "main: building"
  exit 1
fi

if printf '%s' "$VERCEL_GIT_COMMIT_MESSAGE" | grep -qF "[deploy]"; then
  echo "$VERCEL_GIT_COMMIT_REF: commit asks for a preview ([deploy]), building"
  exit 1
fi

echo "$VERCEL_GIT_COMMIT_REF: no [deploy] in the commit message, skipping the preview"
exit 0
