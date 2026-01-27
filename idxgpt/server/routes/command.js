// server/routes/command.js
const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Lokasi Python 3.10 yang sudah terinstall di Windows kamu
const PYTHON_EXE = "C:\\Users\\Hp\\AppData\\Local\\Programs\\Python\\Python310\\python.exe";

// Lokasi script Python stock.py (absolute path)
const SCRIPT_PATH = "C:\\stock\\stock.py";

// Cek apakah python.exe benar ada
function pythonBin() {
  if (fs.existsSync(PYTHON_EXE)) {
    return PYTHON_EXE;
  }
  return "python"; // fallback kalau di sistem sudah ada alias python
}

// POST /api/run-command
router.post("/", async (req, res) => {
  const { command, kode, market, question } = req.body;

  if (!command || !kode) {
    return res.status(400).json({ error: "Command dan kode saham wajib diisi" });
  }

  const bin = pythonBin();
  const args = [SCRIPT_PATH, command, kode, market];
  if (question) {
    args.push(question);
  }

  console.log(`▶️ Running Python: ${bin} ${args.join(" ")}`);
  console.log(`📁 Script path: ${SCRIPT_PATH}`);
  console.log(`📁 Resolved path: ${path.resolve(SCRIPT_PATH)}`);

  try {
    const py = spawn(bin, args, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = "";
    let errorOutput = "";

    // Collect stdout data
    py.stdout.on("data", (data) => {
      output += data.toString();
      console.log("📤 Python stdout:", data.toString().substring(0, 200) + (data.toString().length > 200 ? "..." : ""));
    });

    // Collect stderr data
    py.stderr.on("data", (data) => {
      errorOutput += data.toString();
      console.log("📥 Python stderr:", data.toString());
    });

    py.on("close", (code) => {
      console.log("🔎 Python exited with code", code);

      if (code !== 0) {
        console.error("❌ Python script failed with stderr:", errorOutput);
        return res.status(500).json({
          error: errorOutput || "Python script error",
          code: code,
          command: command,
          args: args
        });
      }

      // Clean up output
      output = output.trim();
      console.log("📄 Full Python output:", output);

      if (!output) {
        console.error("❌ No output from Python script");
        return res.status(500).json({
          error: "No output from Python script",
          command: command,
          args: args
        });
      }

      // Try to parse JSON
      try {
        const parsed = JSON.parse(output);
        console.log("✅ Successfully parsed JSON output");
        res.json(parsed);
      } catch (parseError) {
        console.error("❌ Failed to parse JSON output:", parseError.message);
        console.error("📄 Raw output:", output);
        // Return raw output as fallback
        res.json({
          error: "Invalid JSON output from Python script",
          raw_output: output,
          parse_error: parseError.message
        });
      }
    });

    // Handle spawn errors
    py.on("error", (error) => {
      console.error("❌ Spawn error:", error);
      res.status(500).json({
        error: "Failed to start Python script",
        details: error.message
      });
    });

  } catch (err) {
    console.error("❌ run-command error:", err);
    res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

module.exports = router;
