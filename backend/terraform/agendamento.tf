# Limpeza periodica das Contas de teste (030, research R4).

resource "aws_cloudwatch_event_rule" "limpeza_contas_de_teste" {
  name                = "${var.project_name}-limpeza-contas-de-teste"
  description         = "Limpa as Contas de teste encerradas a cada 15 minutos (030, R4)."
  schedule_expression = "rate(15 minutes)"
}

resource "aws_cloudwatch_event_target" "limpeza_contas_de_teste" {
  rule  = aws_cloudwatch_event_rule.limpeza_contas_de_teste.name
  arn   = aws_lambda_function.api.arn
  input = jsonencode({ acao = "limpar-contas-de-teste" })
}

resource "aws_lambda_permission" "limpeza_contas_de_teste" {
  statement_id  = "PermitirLimpezaAgendada"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.limpeza_contas_de_teste.arn
}
