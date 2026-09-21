#!/bin/bash
# Constroi o pacote da API para a Lambda. O empacotamento e do backend,
# versionado em backend/scripts/construir.mjs (npm run build:lambda): este
# script e uma chamada fina, e existe so como o caminho que o README de
# infraestrutura documenta - ele nao tem mais esbuild proprio.
set -euo pipefail

TF_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$(cd "$TF_DIR/.." && pwd)"

(cd "$BACKEND_DIR" && npm run build:lambda)

echo "pacote: $BACKEND_DIR/dist-lambda.zip ($(du -h "$BACKEND_DIR/dist-lambda.zip" | cut -f1))"
echo "tofu -chdir=$TF_DIR apply -var lambda_package=../dist-lambda.zip -var lambda_handler=lambda.handler"
