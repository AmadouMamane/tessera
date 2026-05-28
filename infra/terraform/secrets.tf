# Secret Manager entries consumed by the Cloud Run revision at start-up.
#
# Each secret is created here with `automatic_replication`, but the secret
# *value* is set out-of-band (gcloud secrets versions add) so that the
# Terraform state never holds plaintext.

locals {
  managed_secrets = {
    postgres_url      = "Tessera Postgres connection string (psycopg DSN)."
    bearer_token      = "Optional bearer token for the API; leave empty to disable auth."
    audit_signing_key = "HMAC key used to sign audit-trail entries."
  }
}

resource "google_secret_manager_secret" "managed" {
  for_each  = local.managed_secrets
  secret_id = "${var.service_name}-${each.key}"
  labels    = {
    service = var.service_name
    managed = "terraform"
  }

  replication {
    auto {}
  }
}

# Read access for the runtime service account.
resource "google_secret_manager_secret_iam_member" "runtime_access" {
  for_each  = google_secret_manager_secret.managed
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.agent.email}"
}
