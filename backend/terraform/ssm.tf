# Os segredos ficam no Parameter Store, e nao em variavel de ambiente da
# Lambda: variavel de ambiente e legivel para quem consiga descrever a funcao,
# e a connection string carrega a senha do banco.
# O OAC nao serve para esta API: com assinatura sempre ligada ele sobrescreve o
# header Authorization do cliente. No lugar dele, a Function URL fica publica e
# o CloudFront injeta um segredo de origem que a Lambda exige - quem chamar a
# Function URL direto nao passa.
resource "random_password" "origin_secret" {
  length  = 48
  special = false
}

# SESSION_SECRET entra aqui quando houver autenticacao (aws_pendencias.md).
locals {
  secrets = {
    DB_URL        = var.db_conn_string
    ORIGIN_SECRET = random_password.origin_secret.result
  }

  ssm_prefix = "/${var.project_name}"
}

# value_wo em vez de value: argumento write-only e enviado a AWS mas nao fica
# no terraform.tfstate, que e um arquivo em texto plano no disco de quem
# aplica. Como o Terraform deixa de enxergar o valor, ele nao detecta mudanca
# sozinho - quem troca um segredo incrementa var.secrets_version.
resource "aws_ssm_parameter" "secret" {
  for_each = local.secrets

  name             = "${local.ssm_prefix}/${each.key}"
  type             = "SecureString"
  value_wo         = each.value
  value_wo_version = var.secrets_version
}

# Sem statement de kms:Decrypt: SecureString sem chave propria usa a aws/ssm,
# cuja key policy (gerenciada pela AWS) ja libera decrypt via SSM para qualquer
# principal da conta. O que controla o acesso e o ssm:GetParameter abaixo.
data "aws_iam_policy_document" "read_secrets" {
  statement {
    actions   = ["ssm:GetParameter", "ssm:GetParameters"]
    resources = [for p in aws_ssm_parameter.secret : p.arn]
  }
}
