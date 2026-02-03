// routes/me.js
const express = require("express");
const jwt = require("jsonwebtoken");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const User = require("../models/User");

// Load environment variables
require('dotenv').config({ path: '.env' });

const router = express.Router();
let JWT_SECRET = process.env.JWT_SECRET;

// Validate JWT_SECRET is loaded - use EXACT same fallback secret as AuthService
if (!JWT_SECRET) {
  console.log('JWT_SECRET not found in environment variables! Using same fallback as AuthService.');
  JWT_SECRET = 'your-super-secret-jwt-key-minimum-32-characters-fallback';
} else {
  console.log('🔑 JWT_SECRET loaded from environment in me.js:', JWT_SECRET.slice(0, 10) + '...');
}

// Middleware auth
function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : null;

  console.log('🔍 Incoming token in me.js:', t?.slice(0, 30) + '...');
  console.log('🔑 JWT_SECRET in me.js:', JWT_SECRET.slice(0, 10) + '...');

  if (!t) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(t, JWT_SECRET);
    console.log('✅ Token verified in me.js for user:', req.user.email);
    next();
  } catch (e) {
    console.error('❌ Token verification failed in me.js:', e.message);
    return res.status(401).json({ error: "Invalid token" });
  }
}

// GET /me → info user
router.get("/", auth, async (req, res) => {
  try {
    // Use User model to get actual user data from database
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        ai_quota: user.ai_quota || 10,
        subscription: user.subscription_expiry ? 'active' : 'inactive',
        subscription_expiry: user.subscription_expiry,
        api_usage: user.api_usage || 0,
        api_limit: user.api_limit || 100,
        username: user.name || user.email.split('@')[0],
      }
    });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// GET /me/transactions → daftar transaksi (assuming transactions table exists)
router.get("/transactions", auth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC", [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error("Transactions error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /me/run-command → simulasi analisa saham
router.post("/run-command", auth, async (req, res) => {
  const { command, kode, market } = req.body;
  if (!command || !kode) {
    return res
      .status(400)
      .json({ error: "Command dan kode saham wajib diisi" });
  }

  try {
    let output = "";
    let chartBase64 = null;

    if (command === "fundamental") {
      output = `📊 Fundamental ${kode}.${market?.toUpperCase() || "IDX"}:
EPS: 123
PER: 15x
PBV: 1.2x
ROE: 12%`;
    } else if (command === "analisa") {
      output = `📝 Analisa ${kode}.${market?.toUpperCase() || "IDX"}:
- Trend jangka pendek bullish
- Valuasi masih menarik`;
    } else if (command === "teknikal") {
      output = `📈 Teknikal ${kode}.${market?.toUpperCase() || "IDX"}:
MA(20) di atas MA(50), volume meningkat`;

      // ---- Generate Dummy Chart ----
      const width = 600;
      const height = 300;
      const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });
      const labels = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
      const data = [1000, 1050, 1020, 1080, 1100];

      const config = {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: `${kode} Price`,
              data,
              borderColor: "rgba(75, 192, 192, 1)",
              backgroundColor: "rgba(75, 192, 192, 0.2)",
              fill: true,
            },
          ],
        },
      };

      const image = await chartJSNodeCanvas.renderToBuffer(config);
      chartBase64 = `data:image/png;base64,${image.toString("base64")}`;
    } else if (command === "berita") {
      output = `📰 Sentimen ${kode}.${market?.toUpperCase() || "IDX"}:
Mayoritas berita positif, sentimen investor optimis.`;
    } else {
      output = `❌ Command ${command} belum dikenali.`;
    }

    res.json({ output, chart: chartBase64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan pada analisa" });
  }
});

module.exports = router;
