const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'stock',
  user: 'openpg',
  password: 'openpgpwd'
});

(async () => {
  try {
    const client = await pool.connect();
    
    // Check table structure
    console.log('=== Table Structure ===');
    const structureQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'saham_data' 
      ORDER BY ordinal_position
    `;
    const structureResult = await client.query(structureQuery);
    console.log('Columns:', structureResult.rows.map(r => r.column_name + ' (' + r.data_type + ')').join(', '));
    
    // Check sample data
    console.log('\n=== Sample Data (First 3 rows) ===');
    const sampleQuery = `
      SELECT * FROM saham_data 
      LIMIT 3
    `;
    const sampleResult = await client.query(sampleQuery);
    console.log(JSON.stringify(sampleResult.rows, null, 2));
    
    // Check date range
    console.log('\n=== Date Range ===');
    const dateQuery = `
      SELECT 
        MIN("Tanggal Perdagangan Terakhir") as min_date,
        MAX("Tanggal Perdagangan Terakhir") as max_date,
        COUNT(*) as total_rows
      FROM saham_data
    `;
    const dateResult = await client.query(dateQuery);
    console.log('Date Range:', dateResult.rows[0]);
    
    // Check specific stock
    console.log('\n=== Check AADI Stock ===');
    const stockQuery = `
      SELECT 
        "Kode Saham",
        "Nama Perusahaan",
        COUNT(*) as data_points,
        MIN("Tanggal Perdagangan Terakhir") as min_date,
        MAX("Tanggal Perdagangan Terakhir") as max_date
      FROM saham_data
      WHERE "Kode Saham" = 'AADI'
      GROUP BY "Kode Saham", "Nama Perusahaan"
    `;
    const stockResult = await client.query(stockQuery);
    console.log('AADI Info:', stockResult.rows[0] || 'No data found');
    
    // Check stocks with recent data
    console.log('\n=== Stocks with Recent Data (Last 30 days) ===');
    const recentQuery = `
      SELECT 
        "Kode Saham",
        "Nama Perusahaan",
        COUNT(*) as data_points,
        MAX("Tanggal Perdagangan Terakhir") as latest_date
      FROM saham_data
      WHERE "Tanggal Perdagangan Terakhir" >= NOW() - INTERVAL '30 days'
      GROUP BY "Kode Saham", "Nama Perusahaan"
      ORDER BY data_points DESC
      LIMIT 10
    `;
    const recentResult = await client.query(recentQuery);
    console.log('Recent Stocks:', recentResult.rows);
    
    // Check all stocks
    console.log('\n=== All Stocks Count ===');
    const countQuery = `
      SELECT 
        COUNT(DISTINCT "Kode Saham") as total_stocks
      FROM saham_data
    `;
    const countResult = await client.query(countQuery);
    console.log('Total Stocks:', countResult.rows[0]);
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
})();
