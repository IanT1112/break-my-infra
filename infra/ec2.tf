resource "aws_instance" "demo" {
  ami                                  = data.aws_ssm_parameter.ubuntu_arm.value
  instance_type                        = var.instance_type
  subnet_id                            = data.aws_subnets.default.ids[0]
  vpc_security_group_ids               = [aws_security_group.web.id]
  iam_instance_profile                 = aws_iam_instance_profile.ec2.name
  associate_public_ip_address          = true
  instance_initiated_shutdown_behavior = "stop"

  user_data                   = file("${path.module}/user-data.sh")
  user_data_replace_on_change = true

  # 💰 Nunca cobrar CPU extra: si se acaban los créditos, solo va más lento
  credit_specification {
    cpu_credits = "standard"
  }

  # 🔒 IMDSv2 obligatorio: protege las credenciales del rol
  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    volume_size = 16
    volume_type = "gp3"
    encrypted   = true
  }

  tags = {
    Name = "break-my-infra"
  }

  # Si Ubuntu publica una imagen nueva, NO recrear la máquina
  lifecycle {
    ignore_changes = [ami, associate_public_ip_address]
  }
}