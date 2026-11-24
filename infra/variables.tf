variable "region" {
  description = "Región de AWS donde se despliega todo"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "Tipo de instancia EC2"
  type        = string
  default     = "t4g.small"
}

variable "waker_concurrency" {
  description = "Máximo de ejecuciones simultáneas de la Lambda (anti-spam)"
  type        = number
  default     = -1
}