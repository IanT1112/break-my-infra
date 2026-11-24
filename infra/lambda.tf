# Empaqueta el código en un .zip
data "archive_file" "waker" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/build/waker.zip"
}

# ─── Permisos: SOLO lo necesario ───
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "waker" {
  name               = "break-my-infra-waker"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "waker" {
  statement {
    sid       = "StartOnlyThisInstance"
    actions   = ["ec2:StartInstances"]
    resources = [aws_instance.demo.arn]
  }

  statement {
    sid       = "DescribeInstances"
    actions   = ["ec2:DescribeInstances"]
    resources = ["*"]
  }

  statement {
    sid       = "DailyStartCounter"
    actions   = ["ssm:GetParameter", "ssm:PutParameter"]
    resources = ["arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/break-my-infra/starts/*"]
  }

  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.waker.arn}:*"]
  }
}

resource "aws_iam_role_policy" "waker" {
  name   = "waker"
  role   = aws_iam_role.waker.id
  policy = data.aws_iam_policy_document.waker.json
}

# Logs que se borran solos a los 7 días (💰)
resource "aws_cloudwatch_log_group" "waker" {
  name              = "/aws/lambda/break-my-infra-waker"
  retention_in_days = 7
}

# ─── La función ───
resource "aws_lambda_function" "waker" {
  function_name                  = "break-my-infra-waker"
  role                           = aws_iam_role.waker.arn
  runtime                        = "python3.13"
  handler                        = "waker.handler"
  architectures                  = ["arm64"]
  memory_size                    = 128
  timeout                        = 10
  filename                       = data.archive_file.waker.output_path
  source_code_hash               = data.archive_file.waker.output_base64sha256
  reserved_concurrent_executions = var.waker_concurrency

  environment {
    variables = {
      INSTANCE_ID        = aws_instance.demo.id
      MAX_STARTS_PER_DAY = "3"
    }
  }

  depends_on = [aws_cloudwatch_log_group.waker]
}

# URL pública con HTTPS (gratis)
resource "aws_lambda_function_url" "waker" {
  function_name      = aws_lambda_function.waker.function_name
  authorization_type = "NONE"
}