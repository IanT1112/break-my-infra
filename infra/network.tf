# VPC por defecto: ya existe en tu cuenta, es gratis y no necesita NAT
data "aws_vpc" "default" {
  default = true
}

# Zonas de disponibilidad donde SÍ existe t4g.small
data "aws_ec2_instance_type_offerings" "supported" {
  location_type = "availability-zone"

  filter {
    name   = "instance-type"
    values = [var.instance_type]
  }
}

# Subredes de la VPC por defecto que están en esas zonas
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }

  filter {
    name   = "availability-zone"
    values = data.aws_ec2_instance_type_offerings.supported.locations
  }
}

resource "aws_security_group" "web" {
  name        = "break-my-infra-web"
  description = "Solo HTTP publico, sin SSH"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Salida a internet (descargar Docker, imagenes, etc.)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}