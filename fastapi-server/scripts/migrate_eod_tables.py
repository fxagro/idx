"""
Migration script: Add tables needed by EOD/BOD/Recon processors
- pe_daily_snapshots: Daily archive snapshots
- pe_trading_calendar: Trading day calendar
"""
import psycopg2

DB = {"host": "localhost", "port": 5432, "dbname": "stock", "user": "openpg", "password": "openpgpwd"}

conn = psycopg2.connect(**DB)
cur = conn.cursor()

try:
    # Trading calendar
    cur.execute("""
        CREATE TABLE IF NOT EXISTS pe_trading_calendar (
            trade_date DATE PRIMARY KEY,
            status VARCHAR(20) DEFAULT 'OPEN',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("OK: pe_trading_calendar")

    # Daily snapshots (using JSONB for flexible schema)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS pe_daily_snapshots (
            id SERIAL PRIMARY KEY,
            snapshot_date DATE NOT NULL,
            data_type VARCHAR(50) NOT NULL,
            snapshot JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("OK: pe_daily_snapshots")

    # Index for faster lookups
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date 
        ON pe_daily_snapshots (snapshot_date, data_type)
    """)
    print("OK: index on pe_daily_snapshots")

    # Check existing tables
    cur.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name LIKE 'pe_%'
        ORDER BY table_name
    """)
    tables = [r[0] for r in cur.fetchall()]
    print(f"\nExisting pe_* tables: {tables}")

    conn.commit()
    print("\nMigration completed successfully!")

except Exception as e:
    conn.rollback()
    print(f"Migration FAILED: {e}")
finally:
    cur.close()
    conn.close()
