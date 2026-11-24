# Certificado HTTPS gratuito (CloudFront lo exige en us-east-1)
resource "aws_acm_certificate" "infra" {
  domain_name       = var.domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# El registro que hay que poner en Porkbun para demostrar que el dominio es tuyo
output "cert_validation" {
  value = {
    for o in aws_acm_certificate.infra.domain_validation_options : o.domain_name => {
      type  = o.resource_record_type
      name  = o.resource_record_name
      value = o.resource_record_value
    }
  }
}
