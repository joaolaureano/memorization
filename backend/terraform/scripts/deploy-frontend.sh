#!/bin/bash
# Builda o SPA apontando a API para /api (mesmo dominio, atras do CloudFront -
# sem CORS), publica no bucket privado e invalida o index no CloudFront.
# Nao altera codigo: so passa VITE_ENDERECO_DA_API no build.
set -euo pipefail

TF_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$TF_DIR/../.." && pwd)"
DIST="$REPO_ROOT/frontend/dist"

bucket="$(tofu -chdir="$TF_DIR" output -raw site_bucket)"
distribution="$(tofu -chdir="$TF_DIR" output -raw distribution_id)"

(cd "$REPO_ROOT/frontend" && npm ci && VITE_ENDERECO_DA_API=/api npm run build)

# Os assets do Vite levam hash no nome, entao podem ficar em cache para sempre.
# O index.html e o que aponta para eles: no-cache, ou o navegador seguraria um
# index velho apontando para assets que o --delete ja removeu.
aws s3 sync "$DIST" "s3://$bucket" --delete --exclude index.html \
  --cache-control "public,max-age=31536000,immutable"
aws s3 cp "$DIST/index.html" "s3://$bucket/index.html" --cache-control "no-cache"

aws cloudfront create-invalidation --distribution-id "$distribution" \
  --paths "/index.html" "/" >/dev/null

echo "publicado: $(tofu -chdir="$TF_DIR" output -raw app_url)"
