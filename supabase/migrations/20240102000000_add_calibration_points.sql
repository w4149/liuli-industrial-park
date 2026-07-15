CREATE TABLE IF NOT EXISTS calibration_points (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lng DECIMAL(15,12) NOT NULL,
  lat DECIMAL(15,12) NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calibration_points_timestamp ON calibration_points(timestamp);
