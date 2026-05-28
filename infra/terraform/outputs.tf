# Outputs surfaced after a successful `terraform apply`.
# These values are used by CI/CD pipelines and referenced in the runbook.

output "cloud_run_url" {
  description = "HTTPS URL of the deployed Tessera Cloud Run service."
  value       = google_cloud_run_v2_service.agent.uri
}

output "postgres_connection_name" {
  description = "Cloud SQL instance connection name (used by Cloud SQL Auth Proxy and the Cloud Run sidecar)."
  value       = google_sql_database_instance.tessera.connection_name
}

output "project_id" {
  description = "GCP project id that owns this deployment."
  value       = var.project_id
}

output "region" {
  description = "GCP region where the service and database are deployed."
  value       = var.region
}

output "service_account_email" {
  description = "Email of the Cloud Run runtime service account."
  value       = google_service_account.agent.email
}

output "audit_bucket_name" {
  description = "Cloud Storage bucket that receives the Tessera audit-trail log sink."
  value       = google_storage_bucket.audit_logs.name
}
