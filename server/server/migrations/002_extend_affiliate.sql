-- Stock Dashboard IDX - Extend Affiliate System Migration
-- Adds 2-level commission support and commission settings

-- Create commission_settings table
CREATE TABLE IF NOT EXISTS commission_settings (
    id SERIAL PRIMARY KEY,
    l1_rate DECIMAL(3,2) NOT NULL DEFAULT 0.40 CHECK (l1_rate >= 0 AND l1_rate <= 1),
    l2_rate DECIMAL(3,2) NOT NULL DEFAULT 0.20 CHECK (l2_rate >= 0 AND l2_rate <= 1),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id)
);

-- Insert default commission rates
INSERT INTO commission_settings (l1_rate, l2_rate, updated_by)
SELECT 0.40, 0.20, 1
WHERE NOT EXISTS (SELECT 1 FROM commission_settings);

-- Add month column to affiliate_commissions for monthly tracking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'affiliate_commissions'
        AND column_name = 'month'
    ) THEN
        ALTER TABLE affiliate_commissions
        ADD COLUMN month VARCHAR(7); -- Format: YYYY-MM
        RAISE NOTICE 'Added month column to affiliate_commissions table';
    ELSE
        RAISE NOTICE 'Month column already exists in affiliate_commissions table';
    END IF;
END $$;

-- Ensure affiliate_commissions table exists with proper structure
CREATE TABLE IF NOT EXISTS affiliate_commissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    referred_id INTEGER,
    amount DECIMAL(10,2) NOT NULL,
    level INTEGER,
    type VARCHAR(50) DEFAULT 'referral',
    description TEXT,
    month VARCHAR(7), -- Format: YYYY-MM
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster month-based queries
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_month
ON affiliate_commissions(month);

-- Create index for faster user queries
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_user_id
ON affiliate_commissions(user_id);

-- Add referral_count column to users table if not exists
ALTER TABLE users
ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;

-- Update existing commissions to have month data
-- This will set month based on created_at for existing records
UPDATE affiliate_commissions
SET month = TO_CHAR(created_at, 'YYYY-MM')
WHERE month IS NULL AND created_at IS NOT NULL;

-- Create function to automatically calculate 2-level commissions
CREATE OR REPLACE FUNCTION calculate_2level_commissions()
RETURNS TRIGGER AS $$
DECLARE
    l1_user_id INTEGER;
    l2_user_id INTEGER;
    commission_amount DECIMAL(10,2);
    l1_rate DECIMAL(3,2);
    l2_rate DECIMAL(3,2);
    l1_commission DECIMAL(10,2);
    l2_commission DECIMAL(10,2);
BEGIN
    -- Get commission rates from settings
    SELECT l1_rate, l2_rate INTO l1_rate, l2_rate
    FROM commission_settings
    ORDER BY id DESC
    LIMIT 1;

    -- Default rates if settings not found
    IF l1_rate IS NULL THEN l1_rate := 0.40; END IF;
    IF l2_rate IS NULL THEN l2_rate := 0.20; END IF;

    -- Validate total commission doesn't exceed 60%
    IF (l1_rate + l2_rate) > 0.60 THEN
        RAISE EXCEPTION 'Total commission rate cannot exceed 60%% (L1: %%, L2: %%)', l1_rate * 100, l2_rate * 100;
    END IF;

    -- Get the user who made the subscription (this will be L0)
    SELECT referred_by INTO l1_user_id
    FROM affiliate_referrals
    WHERE referred_user_id = NEW.user_id;

    -- If user has a referrer (L1), calculate L1 commission
    IF l1_user_id IS NOT NULL THEN
        l1_commission := NEW.amount * l1_rate;

        -- Insert L1 commission
        INSERT INTO affiliate_commissions (
            user_id, amount, type, description, month, created_at
        ) VALUES (
            l1_user_id,
            l1_commission,
            'referral',
            'L1 commission from ' || (SELECT username FROM users WHERE id = NEW.user_id) || ' subscription',
            TO_CHAR(NOW(), 'YYYY-MM'),
            NOW()
        );

        -- Get L2 (referrer of L1)
        SELECT referred_by INTO l2_user_id
        FROM affiliate_referrals
        WHERE referred_user_id = l1_user_id;

        -- If L1 has a referrer (L2), calculate L2 commission
        IF l2_user_id IS NOT NULL THEN
            l2_commission := NEW.amount * l2_rate;

            -- Insert L2 commission
            INSERT INTO affiliate_commissions (
                user_id, amount, type, description, month, created_at
            ) VALUES (
                l2_user_id,
                l2_commission,
                'referral',
                'L2 commission from ' || (SELECT username FROM users WHERE id = NEW.user_id) || ' subscription',
                TO_CHAR(NOW(), 'YYYY-MM'),
                NOW()
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate 2-level commissions
DROP TRIGGER IF EXISTS trigger_calculate_2level_commissions ON affiliate_commissions;
CREATE TRIGGER trigger_calculate_2level_commissions
    AFTER INSERT ON affiliate_commissions
    FOR EACH ROW
    WHEN (NEW.type = 'subscription')
    EXECUTE FUNCTION calculate_2level_commissions();

-- Create view for user network (L1 and L2 downlines)
CREATE OR REPLACE VIEW user_network AS
WITH RECURSIVE network AS (
    -- Base case: direct referrals (L1)
    SELECT
        r.referred_by as user_id,
        r.referred_user_id as downline_id,
        u.username as downline_username,
        1 as level,
        r.created_at as referral_date
    FROM affiliate_referrals r
    JOIN users u ON r.referred_user_id = u.id

    UNION ALL

    -- Recursive case: L2 referrals
    SELECT
        n.user_id,
        r.referred_user_id,
        u.username,
        n.level + 1,
        r.created_at
    FROM network n
    JOIN affiliate_referrals r ON n.downline_id = r.referred_by
    JOIN users u ON r.referred_user_id = u.id
    WHERE n.level < 2
)
SELECT
    user_id,
    downline_id,
    downline_username,
    level,
    referral_date,
    -- Count total referrals for this user
    (SELECT COUNT(*) FROM affiliate_referrals WHERE referred_by = user_id) as total_referrals,
    -- Count L1 referrals
    (SELECT COUNT(*) FROM affiliate_referrals WHERE referred_by = user_id) as l1_count,
    -- Count L2 referrals
    (SELECT COUNT(*) FROM network WHERE user_id = network.user_id AND level = 2) as l2_count
FROM network;

-- Create view for monthly commission summary
CREATE OR REPLACE VIEW monthly_commission_summary AS
SELECT
    user_id,
    month,
    SUM(amount) as total_commission,
    COUNT(*) as commission_count,
    STRING_AGG(DISTINCT type, ', ') as commission_types
FROM affiliate_commissions
GROUP BY user_id, month
ORDER BY month DESC, total_commission DESC;

-- Add comments for documentation
COMMENT ON TABLE commission_settings IS 'Commission rates for 2-level affiliate system';
COMMENT ON COLUMN commission_settings.l1_rate IS 'Commission rate for L1 referrals (default 0.40 = 40%)';
COMMENT ON COLUMN commission_settings.l2_rate IS 'Commission rate for L2 referrals (default 0.20 = 20%)';
COMMENT ON COLUMN affiliate_commissions.month IS 'Month in YYYY-MM format for commission tracking';
COMMENT ON VIEW user_network IS 'User referral network showing L1 and L2 downlines';
COMMENT ON VIEW monthly_commission_summary IS 'Monthly commission summary per user';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT ON user_network TO authenticated_users;
-- GRANT SELECT ON monthly_commission_summary TO authenticated_users;