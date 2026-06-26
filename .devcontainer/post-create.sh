#!/usr/bin/env bash
set -euo pipefail

echo "==> Adding wasm32 target for Soroban contract builds"
rustup target add wasm32-unknown-unknown

echo "==> Installing stellar-cli"
cargo install --locked stellar-cli --features opt

echo "==> Installing pnpm"
npm install -g pnpm

echo "==> Installing frontend dependencies"
cd Dechat/dex_with_fiat_frontend
pnpm install
pnpm test:e2e:install
cd ../..

echo "==> Dev environment ready. Run 'stellar --version' to verify."
