locals {
  # "https://abc.lambda-url.us-east-1.on.aws/" → "abc.lambda-url.us-east-1.on.aws"
  waker_domain = trimsuffix(trimprefix(aws_lambda_function_url.waker.function_url, "https://"), "/")
}

# Espera a que el certificado esté validado (ISSUED)
resource "aws_acm_certificate_validation" "infra" {
  certificate_arn = aws_acm_certificate.infra.arn
}

# Políticas administradas por AWS
data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "infra" {
  enabled         = true
  comment         = "break-my-infra - landing"
  aliases         = [var.domain]
  price_class     = "PriceClass_100" # solo edges de América y Europa (más barato)
  is_ipv6_enabled = true

  origin {
    origin_id   = "waker"
    domain_name = local.waker_domain

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id         = "waker"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_except_host.id
    compress                 = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.infra.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.infra.domain_name
}