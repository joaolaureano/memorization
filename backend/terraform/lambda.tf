# A Lambda le o segredo do Parameter Store no cold start, e nao por variavel de
# ambiente: variavel de ambiente fica legivel para qualquer um que consiga
# descrever a funcao, e a connection string carrega a senha do banco.
data "aws_iam_policy_document" "assume_lambda" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name                 = "${var.project_name}-api"
  assume_role_policy   = data.aws_iam_policy_document.assume_lambda.json
  permissions_boundary = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/${var.permissions_boundary_name}"
}

# Log group criado aqui, e nao pela Lambda no primeiro log: assim a retencao e
# definida desde o inicio e o grupo sai junto num destroy.
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${var.project_name}-api"
  retention_in_days = 14
}

# Os mesmos poderes da AWSLambdaBasicExecutionRole, porem inline: a policy do
# robot nega iam:AttachRolePolicy explicitamente, entao anexar a versao
# gerenciada nao e uma opcao. Sem CreateLogGroup porque o grupo ja existe.
data "aws_iam_policy_document" "lambda_logs" {
  statement {
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.api.arn}:*"]
  }
}

resource "aws_iam_role_policy" "lambda_logs" {
  name   = "${var.project_name}-api-logs"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_logs.json
}

resource "aws_iam_role_policy" "lambda_read_secrets" {
  name   = "${var.project_name}-api-read-secrets"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.read_secrets.json
}

# Enquanto o backend nao tem handler de Lambda (aws_pendencias.md), sobe a stub
# de ./stub: prova CloudFront -> Function URL -> Lambda -> SSM de ponta a ponta
# sem depender do codigo do app.
locals {
  use_stub = var.lambda_package == ""
}

data "archive_file" "stub" {
  count = local.use_stub ? 1 : 0

  type        = "zip"
  source_dir  = "${path.module}/stub"
  output_path = "${path.module}/.build/stub.zip"
}

resource "aws_lambda_function" "api" {
  function_name = "${var.project_name}-api"
  role          = aws_iam_role.lambda.arn
  handler       = local.use_stub ? "index.handler" : var.lambda_handler
  runtime       = "nodejs24.x"
  architectures = ["arm64"]

  filename         = local.use_stub ? one(data.archive_file.stub[*].output_path) : var.lambda_package
  source_code_hash = local.use_stub ? one(data.archive_file.stub[*].output_base64sha256) : filebase64sha256(var.lambda_package)

  # O cold start le o SSM e abre conexao TLS com o Neon; o timeout padrao de
  # 3s e pouco para isso na primeira invocacao.
  timeout = 30

  # Memoria tambem compra CPU na Lambda: 512 MB derruba o cold start bem abaixo
  # do que 128 MB entrega, e o custo por request continua desprezivel porque a
  # cobranca e por ms efetivo.
  memory_size = 512

  environment {
    variables = {
      SSM_PREFIX = local.ssm_prefix
      NODE_ENV   = "production"
    }
  }

  # Sem VPC de proposito: o Neon e alcancado pela internet publica, e uma
  # Lambda em VPC precisaria de NAT Gateway - sozinho, mais caro que a stack toda.
  depends_on = [
    aws_cloudwatch_log_group.api,
    aws_iam_role_policy.lambda_read_secrets,
    aws_iam_role_policy.lambda_logs,
  ]
}

# NONE, e nao AWS_IAM: com AWS_IAM o acesso so vem assinado, e o OAC que assina
# sobrescreve o header Authorization da aplicacao. Quem faz o papel de fechar a
# porta e o segredo de origem conferido no handler.
resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"
}

# Sao duas acoes, nao uma: mesmo com AuthType NONE a Lambda exige
# InvokeFunctionUrl e InvokeFunction na resource policy. So com a primeira o
# endpoint responde 403 sem explicar o que falta.
resource "aws_lambda_permission" "function_url" {
  statement_id           = "AllowPublicFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.api.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "function_url_invoke" {
  statement_id  = "AllowPublicFunctionUrlInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "*"
}
