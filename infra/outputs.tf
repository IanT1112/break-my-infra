output "who_am_i" {
  value = data.aws_caller_identity.current.arn
}

output "ubuntu_ami" {
  value = nonsensitive(data.aws_ssm_parameter.ubuntu_arm.value)
}