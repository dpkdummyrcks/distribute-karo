#!/bin/sh
# One-time Garage setup: assign the single node, create the media bucket and an API key.
# Prints S3_ACCESS_KEY / S3_SECRET_KEY to put into the API's env. Safe to re-run.
set -eu
cd "$(dirname "$0")/.."
G="docker compose -f docker-compose.yml exec -T -e RUST_LOG=warn garage /garage"
BUCKET="${GARAGE_BUCKET:-dk-media}"

NODE_ID=$($G status 2>/dev/null | awk '/^[0-9a-f]{16}/ {print $1; exit}')
if $G layout show 2>/dev/null | grep -q "No nodes currently have a role"; then
  $G layout assign -z dc1 -c 10G "$NODE_ID" >/dev/null
  $G layout apply --version 1 >/dev/null
  echo "layout: node $NODE_ID assigned"
fi
$G bucket info "$BUCKET" >/dev/null 2>&1 || { $G bucket create "$BUCKET" >/dev/null && echo "bucket: $BUCKET created"; }
if ! $G key info dk-api >/dev/null 2>&1; then
  $G key create dk-api >/dev/null
  $G bucket allow --read --write --owner "$BUCKET" --key dk-api >/dev/null
  echo "key: dk-api created"
fi
$G key info dk-api --show-secret | awk '/Key ID/ {print "S3_ACCESS_KEY=" $NF} /Secret key/ {print "S3_SECRET_KEY=" $NF}'
