data "aws_caller_identity" "current" {}

data "aws_ssm_parameter" "ubuntu_arm" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id"
}