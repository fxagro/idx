-- Migration: Create index_data and broker_data tables for Market Overview widget
-- Created: 2025-10-06
-- Purpose: Store market indices and broker transaction data for enhanced dashboard

-- Create index_data table for market indices (IHSG, LQ45, etc.)
CREATE TABLE IF NOT EXISTS index_data (
  id SERIAL PRIMARY KEY,
  index_name VARCHAR(50) NOT NULL,
  current_value DECIMAL(15,2) NOT NULL,
  change_percent DECIMAL(8,4) NOT NULL,
  last_updated DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(index_name, last_updated)
);

-- Create broker_data table for broker transaction statistics
CREATE TABLE IF NOT EXISTS broker_data (
  id SERIAL PRIMARY KEY,
  broker_name VARCHAR(100) NOT NULL,
  trade_volume BIGINT NOT NULL DEFAULT 0,
  market_share DECIMAL(8,4) NOT NULL DEFAULT 0,
  last_updated DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(broker_name, last_updated)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_index_data_name_date ON index_data(index_name, last_updated);
CREATE INDEX IF NOT EXISTS idx_broker_data_name_date ON broker_data(broker_name, last_updated);
CREATE INDEX IF NOT EXISTS idx_broker_data_volume ON broker_data(trade_volume DESC) WHERE last_updated = CURRENT_DATE;

-- Insert sample data for testing
INSERT INTO index_data (index_name, current_value, change_percent) VALUES
('IHSG', 7500.50, 1.35),
('LQ45', 950.75, -0.47),
('JII', 650.20, 0.89)
ON CONFLICT (index_name, last_updated) DO UPDATE SET
  current_value = EXCLUDED.current_value,
  change_percent = EXCLUDED.change_percent;

INSERT INTO broker_data (broker_name, trade_volume, market_share) VALUES
('Mandiri Sekuritas', 15000000000, 12.5),
('BCA Sekuritas', 12000000000, 10.2),
('BNI Sekuritas', 9000000000, 7.8),
('BRI Danareksa', 8000000000, 6.9),
('CIMB Sekuritas', 7000000000, 6.1)
ON CONFLICT (broker_name, last_updated) DO UPDATE SET
  trade_volume = EXCLUDED.trade_volume,
  market_share = EXCLUDED.market_share;

COMMENT ON TABLE index_data IS 'Market indices data (IHSG, LQ45, etc.) for dashboard overview';
COMMENT ON TABLE broker_data IS 'Broker transaction statistics for market analysis';