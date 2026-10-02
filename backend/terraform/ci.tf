# A publicacao deixa de ser manual: o GitHub Actions assume esta role por OIDC e
# usa as credenciais temporarias para publicar a Lambda, sincronizar o SPA e
# invalidar o cache. Nenhuma chave de acesso fica guardada em lugar algum.
#
# O provedor OIDC ja existe na conta (criado fora daqui), entao apenas o
# referenciamos pela URL; criar um segundo provedor para o mesmo emissor e
# proibido pela propria AWS.
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# So o ambiente "production" deste repositorio pode assumir a role. O sub usa os
# ids imutaveis do dono e do repositorio (var.github_subject_prefix): renomear
# qualquer um dos dois nao transfere o acesso para o nome novo.
data "aws_iam_policy_document" "ci_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["${var.github_subject_prefix}:environment:production"]
    }
  }
}

resource "aws_iam_role" "ci_deploy" {
  name               = "${var.project_name}-deploy-ci"
  assume_role_policy = data.aws_iam_policy_document.ci_trust.json

  # Mesma montagem da role da Lambda, porem com variavel propria: o robot so
  # cria roles com a boundary, e o valor vazio desliga a boundary para um apply
  # de admin quando ela bloquear o deploy (ver README).
  permissions_boundary = var.ci_permissions_boundary_name == "" ? null : "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/${var.ci_permissions_boundary_name}"
}

# Policy inline, e nao gerenciada anexada: a policy do robot nega
# iam:AttachRolePolicy. O minimo para publicar: trocar o codigo da funcao,
# ler a configuracao dela, sincronizar os objetos do SPA e invalidar o cache.
# Nada de criar, alterar configuracao ou apagar recursos.
data "aws_iam_policy_document" "ci_deploy" {
  statement {
    actions = [
      "lambda:UpdateFunctionCode",
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
    ]
    resources = [aws_lambda_function.api.arn]
  }

  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.site.arn]
  }

  # GetObject entra por causa da auditoria do que ja esta publicado; DeleteObject
  # porque `aws s3 sync --delete` remove os arquivos que sairam do build.
  statement {
    actions = [
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:GetObject",
    ]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }

  statement {
    actions = [
      "cloudfront:CreateInvalidation",
      "cloudfront:GetInvalidation",
    ]
    resources = [aws_cloudfront_distribution.app.arn]
  }
}

resource "aws_iam_role_policy" "ci_deploy" {
  name   = "${var.project_name}-deploy-ci"
  role   = aws_iam_role.ci_deploy.id
  policy = data.aws_iam_policy_document.ci_deploy.json
}
