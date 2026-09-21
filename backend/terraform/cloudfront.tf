# Politicas gerenciadas pela AWS: evitam manter definicao de cache propria e
# ja trazem o comportamento correto para conteudo estatico e para API.
data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

# Sem OAC nao ha assinatura SigV4 a preservar, mas o Host do viewer continua
# tendo que ficar de fora: a Function URL responde pelo proprio hostname.
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

# O backend expoe /cartoes e /baralhos na raiz. O prefixo /api existe so para o
# CloudFront separar API de SPA, entao e removido aqui na borda: o codigo nao
# precisa mudar de rotas. /api/cartoes -> /cartoes; /api e /api/ -> /.
resource "aws_cloudfront_function" "api_prefix" {
  name    = "${var.project_name}-api-prefix"
  runtime = "cloudfront-js-2.0"
  comment = "Remove o prefixo /api antes da origem Lambda"
  publish = true

  code = <<-EOT
    function handler(event) {
      var request = event.request;
      request.uri = request.uri.replace(/^\/api(?=\/|$)/, "") || "/";
      return request;
    }
  EOT
}

resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${var.project_name}-s3"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "app" {
  enabled             = true
  comment             = "${var.project_name} - SPA e API"
  price_class         = "PriceClass_100"
  default_root_object = "index.html"

  origin {
    origin_id                = "s3"
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  origin {
    origin_id = "lambda"
    # A Function URL vem como https://<id>.lambda-url.<regiao>.on.aws/ e o
    # CloudFront quer so o host.
    domain_name = replace(replace(aws_lambda_function_url.api.function_url, "https://", ""), "/", "")

    # O que substitui o OAC: so o CloudFront conhece este valor, e o handler
    # recusa qualquer requisicao que chegue sem ele.
    custom_header {
      name  = "x-origin-secret"
      value = random_password.origin_secret.result
    }

    custom_origin_config {
      origin_protocol_policy = "https-only"
      http_port              = 80
      https_port             = 443
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    compress               = true
  }

  # A API nao pode ser cacheada e precisa dos headers do cliente intactos.
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "lambda"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.api_prefix.arn
    }
  }

  # /health e do Fastify, nao do SPA: sem este behavior ele cairia no bucket e
  # nunca responderia o estado real da API.
  ordered_cache_behavior {
    path_pattern             = "/health"
    target_origin_id         = "lambda"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  # Diferente do cineclube, nao ha custom_error_response 403/404 -> index.html:
  # o frontend roteia por location.hash, entao toda rota e "/" para o CloudFront.
  # E o custom_error_response vale para qualquer origem - reescreveria os 404 da
  # API (cartao ou baralho inexistente) como 200 com o index.html.

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Certificado *.cloudfront.net: HTTPS sem dominio proprio nem ACM.
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${var.project_name}-app"
  }
}
