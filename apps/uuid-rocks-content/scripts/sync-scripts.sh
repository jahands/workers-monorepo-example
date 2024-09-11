#!/bin/bash
set -euo pipefail

# Scripts that I like to pipe to bash but don't like trusting upstream
content_dir="./sh-uuid-rocks"

if [[ ! -d "$content_dir" ]]; then
  echo "sh-uuid-rocks dir not found - are you running this script from the package root?"
  exit 1
fi

if [[ ! -z "${GITHUB_ACTIONS:-}" ]]; then
  echo "Running sync-scripts in CI mode"
  rclone -vP sync "$content_dir" :s3:uuid-rocks-content/SCRIPTS \
    --transfers 20 \
    --checkers 20 \
    --s3-provider='Cloudflare' \
    --s3-env-auth='true' \
    --s3-acl=private \
    --s3-endpoint='https://f9b1e1e2cf50cca79a58e395b6084239.r2.cloudflarestorage.com'
else
  echo "Running sync-scripts in local mode"
  rclone -vP sync "$content_dir" r2:uuid-rocks-content/SCRIPTS \
    --transfers 20 \
    --checkers 20
fi
