# Midia dos Cartoes (026 e 028, research R10) e pacotes de Exportacao (029):
# o bucket guarda Imagens (prefixo imagens/, ate 5 MB), Audios (prefixo
# audios/, ate 10 MB) e arquivos efemeros de Exportacao (exportacoes/). O
# bucket e privado: o navegador envia por
# presigned POST (limite de tamanho imposto pelo proprio S3) e le por
# presigned GET de 15 minutos, ambos assinados pela role da Lambda. Nao ha
# chave nova a guardar.
resource "aws_s3_bucket" "imagens" {
  bucket = "${var.project_name}-imagens-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "imagens" {
  bucket = aws_s3_bucket.imagens.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "imagens" {
  bucket = aws_s3_bucket.imagens.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "imagens" {
  bucket = aws_s3_bucket.imagens.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Envios de Mídia que nunca viraram Cartão ficam em pendentes/, e Exportações
# ficam em exportacoes/; ambos expiram em 1 dia. O S3 arredonda para a
# meia-noite UTC seguinte, o que dá até 48 horas (FR-423, research R12; 029,
# FR-481, research R10).
resource "aws_s3_bucket_lifecycle_configuration" "imagens" {
  bucket = aws_s3_bucket.imagens.id

  rule {
    id     = "pendentes-expiram"
    status = "Enabled"

    filter {
      prefix = "pendentes/"
    }

    expiration {
      days = 1
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }

  rule {
    id     = "exportacoes-expiram"
    status = "Enabled"

    filter {
      prefix = "exportacoes/"
    }

    expiration {
      days = 1
    }
  }
}

# O navegador so faz POST (envio) a partir do dominio proprio ou da origem do
# CloudFront; a leitura por <img> e por <audio> nao precisa de CORS.
resource "aws_s3_bucket_cors_configuration" "imagens" {
  bucket = aws_s3_bucket.imagens.id

  cors_rule {
    allowed_methods = ["POST"]
    allowed_origins = ["https://${var.domain_name}", "https://${aws_cloudfront_distribution.app.domain_name}"]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

# A Lambda le, grava e apaga Imagens e Audios do bucket; sem ListBucket,
# porque as chaves vem sempre do banco.
data "aws_iam_policy_document" "lambda_imagens" {
  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["${aws_s3_bucket.imagens.arn}/*"]
  }
}

resource "aws_iam_role_policy" "lambda_imagens" {
  name   = "${var.project_name}-api-imagens"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_imagens.json
}
