variable "project_name" {
  description = "Prefixo aplicado ao nome de todos os recursos"
  type        = string
  default     = "memorization"
}

variable "aws_region" {
  description = "Regiao onde o ambiente e provisionado"
  type        = string
  default     = "us-east-1"
}

# Segredo preenchido via terraform.tfvars (nao versionado) e guardado no SSM
# Parameter Store, de onde a Lambda o le no cold start.
variable "db_conn_string" {
  description = "Connection string do Postgres no Neon, no formato postgresql://usuario:senha@host/banco?sslmode=require."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^postgres(ql)?://", var.db_conn_string))
    error_message = "A connection string precisa comecar com postgresql:// (ou postgres://)."
  }
}

variable "permissions_boundary_name" {
  description = "Nome da policy usada como permissions boundary das roles criadas aqui. O robot so cria roles com ela; o ARN e montado com o ID da conta em uso, entao nada de especifico de conta fica versionado."
  type        = string
  default     = "robot-ec2-boundary"
}

variable "lambda_package" {
  description = "Caminho do zip gerado por scripts/build-lambda.sh. Vazio publica a stub de ./stub, enquanto o backend nao tem handler de Lambda (ver aws_pendencias.md)."
  type        = string
  default     = ""
}

variable "lambda_handler" {
  description = "Handler do pacote real (arquivo.export). Ignorado quando a stub esta em uso."
  type        = string
  default     = "lambda.handler"
}

# A Lambda troca memoria por CPU, e a Senha e verificada em **cada** requisicao
# autenticada: nao ha sessao, cookie nem token (FR-079, FR-131), e o scrypt roda
# sempre. Medido no deploy real, atraves do CloudFront: com 1024 MB o p95 de um
# GET autenticado ficava em 0,99s (limite de 1s, SC-059); com 1769 MB - que e um
# vCPU inteiro na Lambda - caiu para 0,81s. Ja o /health, que nao verifica a
# Senha, tem mediana de 0,65s e ali o que domina e a rede. Elevar este numero e o
# remedio quando o p95 das operacoes simples passa de 1s (SC-059); enfraquecer a
# derivacao da Senha nunca e.
variable "lambda_memory_mb" {
  description = "Memoria da funcao, em MB. 1769 MB e um vCPU inteiro: elevar e mais CPU para a verificacao da Senha em cada requisicao."
  type        = number
  default     = 1769
}

variable "secrets_version" {
  description = "Versao dos segredos write-only. O Terraform nao enxerga o valor gravado, entao so reescreve quando este numero muda: incremente ao trocar um segredo."
  type        = number
  default     = 1
}
