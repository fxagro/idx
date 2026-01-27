-- Migration: Virtual Trading System
-- Created: 2025-09-23
-- Description: Adds virtual trading functionality with virtual balance, transactions, and portfolio

-- Add virtual_saldo column to users table
ALTER TABLE users ADD COLUMN virtual_saldo DECIMAL(15,2) DEFAULT 100000000.00;

-- Create virtual_transactions table
CREATE TABLE virtual_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    type VARCHAR(4) NOT NULL CHECK (type IN ('BUY', 'SELL')),
    qty INTEGER NOT NULL CHECK (qty > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price > 0),
    total_amount DECIMAL(15,2) NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create virtual_portfolio table
CREATE TABLE virtual_portfolio (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    qty INTEGER NOT NULL CHECK (qty >= 0),
    avg_price DECIMAL(10,2) NOT NULL CHECK (avg_price > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, symbol)
);

-- Create indexes for better performance
CREATE INDEX idx_virtual_transactions_user_id ON virtual_transactions(user_id);
CREATE INDEX idx_virtual_transactions_symbol ON virtual_transactions(symbol);
CREATE INDEX idx_virtual_transactions_date ON virtual_transactions(transaction_date);
CREATE INDEX idx_virtual_portfolio_user_id ON virtual_portfolio(user_id);
CREATE INDEX idx_virtual_portfolio_symbol ON virtual_portfolio(symbol);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_virtual_portfolio_updated_at
    BEFORE UPDATE ON virtual_portfolio
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial virtual balance for existing users
UPDATE users SET virtual_saldo = 100000000.00 WHERE virtual_saldo IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.virtual_saldo IS 'Virtual trading balance in IDR (default: 100M)';
COMMENT ON TABLE virtual_transactions IS 'Records of virtual buy/sell transactions';
COMMENT ON TABLE virtual_portfolio IS 'Current virtual stock holdings';
COMMENT ON COLUMN virtual_transactions.type IS 'BUY or SELL transaction type';
COMMENT ON COLUMN virtual_transactions.qty IS 'Quantity of shares traded';
COMMENT ON COLUMN virtual_transactions.price IS 'Price per share at transaction time';
COMMENT ON COLUMN virtual_transactions.total_amount IS 'Total transaction amount (qty * price)';
COMMENT ON COLUMN virtual_portfolio.qty IS 'Current quantity of shares held';
COMMENT ON COLUMN virtual_portfolio.avg_price IS 'Average purchase price per share';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON virtual_transactions TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON virtual_portfolio TO your_app_user;