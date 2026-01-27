-- Create users table with all required columns including auth_method
-- This migration ensures compatibility with the application requirements

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  auth_method VARCHAR(50) DEFAULT 'local',
  name VARCHAR(255),
  phone VARCHAR(50),
  role VARCHAR(50) DEFAULT 'user',
  subscription_expiry TIMESTAMP,
  api_usage INTEGER DEFAULT 0,
  api_limit INTEGER DEFAULT 100,
  ai_quota INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create trigger to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert test users if they don't exist (for development/testing)
INSERT INTO users (email, password, auth_method, name, role) VALUES
  ('test@example.com', 'password123', 'local', 'Test User', 'user'),
  ('admin@ai-saham.com', 'password123', 'local', 'Admin User', 'admin'),
  ('agro@demo.com', 'password123', 'local', 'Agro Demo User', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;