# Cloud SQL Postgres with the pgvector extension.

resource "google_sql_database_instance" "tessera" {
  name             = "${var.service_name}-pg"
  database_version = var.postgres_version
  region           = var.region

  settings {
    tier              = var.postgres_tier
    availability_type = "ZONAL"
    disk_autoresize   = true
    disk_size         = 20

    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      location                       = var.region
      point_in_time_recovery_enabled = true
    }

    ip_configuration {
      ipv4_enabled = false
      private_network = "projects/${var.project_id}/global/networks/default"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "tessera" {
  name     = "tessera"
  instance = google_sql_database_instance.tessera.name
}

# Note: the pgvector extension itself is created at application start
# (see tessera.retrieval.store.ensure_schema). Terraform only provisions
# the instance and the database.
