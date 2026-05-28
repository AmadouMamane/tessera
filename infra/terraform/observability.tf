# Logging retention, log-based metrics, and a single alert policy that pages
# when the guard layer's deny rate spikes.

resource "google_logging_project_bucket_config" "default" {
  project        = var.project_id
  location       = "global"
  bucket_id      = "_Default"
  retention_days = var.log_retention_days
  enable_analytics = true
}

# Log-based metric: count of guard 'deny' decisions.
resource "google_logging_metric" "guard_denies" {
  name        = "${var.service_name}/guard_denies"
  description = "Number of guard 'deny' decisions emitted, by tool."
  filter      = <<-EOT
    resource.type="cloud_run_revision"
    resource.labels.service_name="${var.service_name}"
    jsonPayload.type="tessera.guard.audit"
    jsonPayload.outcome="denied"
  EOT
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    labels {
      key         = "target"
      value_type  = "STRING"
      description = "Tool name that was denied."
    }
  }
  label_extractors = {
    target = "EXTRACT(jsonPayload.target)"
  }
}

# Alert when more than 20 denies fire in a 10-minute window.
resource "google_monitoring_alert_policy" "guard_deny_storm" {
  display_name = "Tessera — guard deny storm"
  combiner     = "OR"

  conditions {
    display_name = "guard_denies > 20 / 10m"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.guard_denies.name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 20
      duration        = "600s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_DELTA"
      }
    }
  }

  notification_channels = []
  documentation {
    content = <<-EOT
      Tessera's guard layer emitted more than 20 deny decisions in the last
      10 minutes. Investigate which tool is being repeatedly blocked and
      whether the user is being steered into a wall.
    EOT
    mime_type = "text/markdown"
  }
}
