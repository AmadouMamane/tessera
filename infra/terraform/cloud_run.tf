# Cloud Run service hosting the FastAPI app.

resource "google_cloud_run_v2_service" "agent" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    service_account = google_service_account.agent.email
    timeout         = "300s"
    max_instance_request_concurrency = 40

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    vpc_access {
      egress = "PRIVATE_RANGES_ONLY"
      network_interfaces {
        network    = "default"
        subnetwork = "default"
      }
    }

    containers {
      image = var.image

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "TESSERA_ENVIRONMENT"
        value = "production"
      }
      env {
        name  = "TESSERA_LLM_PROFILE"
        value = "frontier"
      }
      env {
        name  = "TESSERA_VERTEX__PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "TESSERA_VERTEX__LOCATION"
        value = var.region
      }
      env {
        name  = "TESSERA_VERTEX__CHAT_MODEL"
        value = var.vertex_chat_model
      }
      env {
        name  = "TESSERA_VERTEX__EMBEDDING_MODEL"
        value = var.vertex_embedding_model
      }
      env {
        name  = "TESSERA_OBS__CLOUD_LOGGING_PROJECT"
        value = var.project_id
      }
      env {
        name  = "TESSERA_GUARD__AUDIT_SINK"
        value = "cloud_logging"
      }

      env {
        name = "TESSERA_POSTGRES__DSN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.managed["postgres_url"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "TESSERA_API__BEARER_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.managed["bearer_token"].secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        period_seconds  = 5
        failure_threshold = 12
        tcp_socket {
          port = 8080
        }
      }

      liveness_probe {
        period_seconds = 30
        http_get {
          path = "/healthz"
          port = 8080
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [google_project_service.apis]
}

# Optional invoker bindings — empty by default so the service is private until
# a real allowed_invokers list is supplied per environment.
resource "google_cloud_run_v2_service_iam_member" "invokers" {
  for_each = toset(var.allowed_invokers)
  project  = var.project_id
  location = google_cloud_run_v2_service.agent.location
  name     = google_cloud_run_v2_service.agent.name
  role     = "roles/run.invoker"
  member   = each.value
}

output "service_url" {
  value       = google_cloud_run_v2_service.agent.uri
  description = "Cloud Run service URL once deployed."
}
