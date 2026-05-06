#!/bin/sh
set -e
echo "Running tests inside oven/bun container"

# install workspace dependencies (no-save to avoid modifying lockfile)
bun install --no-save || true

echo "Running money package tests"
bun test packages/money/tests/unit || true

echo "Running games service tests"
bun test services/games/tests/unit || true

echo "Running wallets service tests"
bun test services/wallets/tests/unit || true

echo "Tests finished. Press enter to exit."
read dummy
