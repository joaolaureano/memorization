# DNS fica no Cloudflare; registros DNS-only porque o CloudFront ja termina o TLS
# com o certificado do ACM.
data "cloudflare_zone" "site" {
  filter = {
    name = var.cloudflare_zone
  }
}

# O CloudFront so aceita certificado do ACM emitido em us-east-1, que e a regiao
# do provider aws.
resource "aws_acm_certificate" "app" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_dns_record" "cert_validation" {
  for_each = {
    for o in aws_acm_certificate.app.domain_validation_options : o.domain_name => {
      name   = trimsuffix(o.resource_record_name, ".")
      type   = o.resource_record_type
      record = trimsuffix(o.resource_record_value, ".")
    }
  }

  zone_id = data.cloudflare_zone.site.zone_id
  name    = each.value.name
  type    = each.value.type
  content = each.value.record
  ttl     = 300
  proxied = false
}

resource "aws_acm_certificate_validation" "app" {
  certificate_arn         = aws_acm_certificate.app.arn
  validation_record_fqdns = [for r in cloudflare_dns_record.cert_validation : r.name]
}

resource "cloudflare_dns_record" "app" {
  zone_id = data.cloudflare_zone.site.zone_id
  name    = var.domain_name
  type    = "CNAME"
  content = aws_cloudfront_distribution.app.domain_name
  ttl     = 1 # automatic
  proxied = false
}
