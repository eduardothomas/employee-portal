#!/usr/bin/env bash
# Builds both apps into web/_site for GitHub Pages:
#   /<repo>/        → Employee App
#   /<repo>/admin/  → HR / Admin portal
# Usage: REPO_NAME=employee-portal [VITE_BACKEND=demo|api] [VITE_API_URL=...] scripts/build-pages.sh
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_NAME="${REPO_NAME:?Set REPO_NAME (GitHub repository name)}"

VITE_BASE="/${REPO_NAME}/" npm run build -w @ep/employee
VITE_BASE="/${REPO_NAME}/admin/" npm run build -w @ep/admin

rm -rf _site
mkdir -p _site/admin
cp -R apps/employee/dist/. _site/
cp -R apps/admin/dist/. _site/admin/
cp _site/index.html _site/404.html
touch _site/.nojekyll
echo "Built _site (backend: ${VITE_BACKEND:-from .env.production})"
