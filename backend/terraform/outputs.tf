output "app_url" {
  description = "URL publica da aplicacao, servida pelo CloudFront em HTTPS"
  value       = "https://${aws_cloudfront_distribution.app.domain_name}"
}

output "api_url" {
  description = "Base da API atras do CloudFront; o prefixo /api e removido na borda"
  value       = "https://${aws_cloudfront_distribution.app.domain_name}/api"
}

output "health_url" {
  description = "Health check da API, util para verificar a Lambda de ponta a ponta"
  value       = "https://${aws_cloudfront_distribution.app.domain_name}/health"
}

output "function_url" {
  description = "Function URL crua. Acesso direto, sem passar pelo CloudFront, deve responder 403"
  value       = aws_lambda_function_url.api.function_url
}

output "site_bucket" {
  description = "Bucket do SPA; o build do frontend e sincronizado para ca"
  value       = aws_s3_bucket.site.id
}

output "distribution_id" {
  description = "Distribuicao CloudFront, usada para invalidar o cache a cada deploy"
  value       = aws_cloudfront_distribution.app.id
}

output "lambda_log_command" {
  description = "Acompanha os logs da API, onde as falhas de invocacao aparecem"
  value       = "aws logs tail ${aws_cloudwatch_log_group.api.name} --follow --region ${var.aws_region}"
}

output "deploy_frontend_command" {
  description = "Builda o SPA com a API em /api, publica no bucket e invalida o cache"
  value       = "./scripts/deploy-frontend.sh"
}
