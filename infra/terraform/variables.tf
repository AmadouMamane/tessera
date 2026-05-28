# Input variables for the Tessera GCP deployment.
#
# Sensible defaults are provided for the demo region (europe-west1) and the
# canonical service names; per-environment overrides go in tfvars files
# that are never committed.

variable "project_id" {
  description = "Google Cloud project id that owns the deployment."
  type        = string
}

variable "region" {
  description = "Primary deployment region."
  type        = string
  default     = "europe-west1"
}

variable "service_name" {
  description = "Cloud Run service name."
  type        = string
  default     = "tessera-agent"
}

variable "image" {
  description = "Fully-qualified container image (Artifact Registry path)."
  type        = string
}

variable "min_instances" {
  description = "Cloud Run minimum-instance floor (use 0 for the demo)."
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Cloud Run hard cap on concurrent instances."
  type        = number
  default     = 5
}

variable "cpu" {
  description = "vCPU allocation per Cloud Run instance."
  type        = string
  default     = "2"
}

variable "memory" {
  description = "RAM allocation per Cloud Run instance."
  type        = string
  default     = "2Gi"
}

variable "postgres_tier" {
  description = "Cloud SQL machine tier for the demo (db-f1-micro = free-tier eligible)."
  type        = string
  default     = "db-custom-1-3840"
}

variable "postgres_version" {
  description = "Cloud SQL Postgres major version."
  type        = string
  default     = "POSTGRES_16"
}

variable "vertex_chat_model" {
  description = "Vertex AI chat model id."
  type        = string
  default     = "gemini-2.0-flash-001"
}

variable "vertex_embedding_model" {
  description = "Vertex AI embedding model id."
  type        = string
  default     = "text-multilingual-embedding-002"
}

variable "log_retention_days" {
  description = "Cloud Logging retention window in days."
  type        = number
  default     = 30
}

variable "allowed_invokers" {
  description = "IAM principals allowed to invoke the Cloud Run service. Leave empty to deny all (forces use of identity-aware proxy)."
  type        = list(string)
  default     = []
}
