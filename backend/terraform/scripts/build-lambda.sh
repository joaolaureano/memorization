#!/bin/bash
# Empacota a API para a Lambda. O runtime nao executa .ts e o backend roda
# TypeScript direto no Node, entao o handler vira um unico .mjs via esbuild:
# pacote pequeno, sem node_modules. @aws-sdk fica de fora porque ja vem no
# runtime nodejs24.x.
#
# Mora aqui so enquanto o handler nao existe; quando existir, deve ir para
# backend/ versionado (aws_pendencias.md, item 5).
set -euo pipefail

TF_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$(cd "$TF_DIR/.." && pwd)"
OUT="$BACKEND_DIR/dist-lambda"

if [ ! -f "$BACKEND_DIR/src/lambda.ts" ]; then
  echo "backend/src/lambda.ts ainda nao existe - ver o item 'Handler Lambda' em aws_pendencias.md." >&2
  echo "Enquanto isso a infra publica a stub (tofu apply sem -var lambda_package)." >&2
  exit 1
fi

rm -rf "$OUT" "$OUT.zip"

# o banner da um require ao bundle ESM: dependencias CommonJS o chamam
(cd "$BACKEND_DIR" && npx --yes esbuild src/lambda.ts \
  --bundle --platform=node --target=node24 --format=esm \
  --outfile="$OUT/lambda.mjs" \
  --external:@aws-sdk/* \
  --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);")

(cd "$OUT" && zip -qr "../dist-lambda.zip" .)

echo "pacote: $OUT.zip ($(du -h "$OUT.zip" | cut -f1))"
echo "tofu -chdir=$TF_DIR apply -var lambda_package=../dist-lambda.zip -var lambda_handler=lambda.handler"
