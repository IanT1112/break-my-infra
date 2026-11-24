# Quién puede "ponerse" este rol: solo el servicio EC2
data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2" {
  name               = "break-my-infra-ec2"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

# ÚNICO permiso: que SSM pueda administrarla (mínimo privilegio)
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2" {
  name = "break-my-infra-ec2"
  role = aws_iam_role.ec2.name
}