output "who_am_i" {
  value = data.aws_caller_identity.current.arn
}

output "ubuntu_ami" {
  value = nonsensitive(data.aws_ssm_parameter.ubuntu_arm.value)
}

output "instance_id" {
  value = aws_instance.demo.id
}

output "public_ip" {
  value = aws_instance.demo.public_ip
}