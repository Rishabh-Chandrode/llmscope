CREATE TABLE apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  api_key_hash VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id),
  feature_name VARCHAR(255) NOT NULL,
  model VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 8) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  error_message TEXT,
  prompt TEXT,
  response TEXT,
  client_timestamp TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sdk_version VARCHAR(20)
);

CREATE INDEX idx_traces_app_id ON traces(app_id);
CREATE INDEX idx_traces_received_at ON traces(received_at DESC);
CREATE INDEX idx_traces_feature_name ON traces(app_id, feature_name);
CREATE INDEX idx_traces_status ON traces(app_id, status);

CREATE TABLE hourly_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id),
  feature_name VARCHAR(255) NOT NULL,
  hour_bucket TIMESTAMPTZ NOT NULL,
  total_calls INTEGER NOT NULL DEFAULT 0,
  failed_calls INTEGER NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0,
  total_input_tokens INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10, 2),
  p95_latency_ms NUMERIC(10, 2),
  p99_latency_ms NUMERIC(10, 2),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(app_id, feature_name, hour_bucket)
);

CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id),
  metric VARCHAR(50) NOT NULL,
  threshold NUMERIC(12, 4) NOT NULL,
  window_minutes INTEGER NOT NULL DEFAULT 60,
  feature_name VARCHAR(255),
  notify_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES alert_rules(id),
  app_id UUID NOT NULL REFERENCES apps(id),
  metric VARCHAR(50) NOT NULL,
  current_value NUMERIC(12, 4) NOT NULL,
  threshold NUMERIC(12, 4) NOT NULL,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notify_url TEXT NOT NULL,
  notified_successfully BOOLEAN NOT NULL DEFAULT FALSE
);