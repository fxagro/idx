const { Pool } = require("pg");

(async () => {
  try {
    const pool = new Pool({
      user: 'openpg',
      host: 'localhost',
      database: 'stock',
      password: 'openpgpwd',
      port: 5432,
      ssl: false,
    });

    const res = await pool.query("SELECT NOW()");
    console.log("Database connection successful:", res.rows);
    await pool.end();
  } catch (err) {
    console.error("DB error:", err.message);
    console.error("Error code:", err.code);
    console.error("Error detail:", err.detail);
  }
})();
