// agent.js
const io = require("socket.io-client");
const express = require("express");
const os = require("os");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// === CONFIG ===
const CENTRAL_SERVER = "http://104.218.48.99:3000"; 
const PORT = 8080; // Local API port
const configPath = path.join(__dirname, "config.json");

// Load config
let config = { branchId: null, businessId: null };
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

let branchId = config.branchId || null;
let businessId = config.businessId || null;
const agentId = os.hostname(); // unique computer name

// Auto-detect default printer (Windows)
function getDefaultPrinter(callback) {
  exec('powershell -Command "Get-Printer | Where-Object Default -eq $True | Select-Object -ExpandProperty Name"', (err, stdout) => {
    if (err || !stdout.trim()) {
      console.warn("⚠️ No default printer found, falling back to Microsoft Print to PDF");
      callback("Microsoft Print to PDF");
    } else {
      callback(stdout.trim());
    }
  });
}

getDefaultPrinter((printerName) => {
  const socket = io(CENTRAL_SERVER);

  socket.on("connect", () => {
    console.log("✅ Connected to central server");
    // Register agent with business + branch
    socket.emit("register_agent", { agentId, printerName, branchId, businessId });
  });

  // Handle print jobs
  socket.on("execute_print", (payload) => {
    console.log("🖨️ Print job received:", payload);

    const tmpFile = path.join(__dirname, "tmp_print.txt");
    fs.writeFileSync(tmpFile, payload.content);

    exec(`notepad /p "${tmpFile}"`, (err) => {
      if (err) console.error("Print error:", err);
      else console.log("✅ Print job executed successfully");
      fs.unlinkSync(tmpFile);
    });
  });

  // === LOCAL API ===
  const app = express();
  app.use(express.json());

  // Identity info
  app.get("/identity", (req, res) => {
    res.json({ 
      id: agentId, 
      business_id: businessId, 
      branch_id: branchId, 
      printer: printerName 
    });
  });

  // Update branch only
  app.post("/set-branch", (req, res) => {
    const { branchId: newBranch } = req.body;
    if (!newBranch) return res.status(400).json({ error: "branchId required" });

    branchId = newBranch;
    config.branchId = newBranch;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(`🔄 Branch updated to ${branchId}`);
    socket.emit("update_branch", { agentId, branchId });

    res.json({ success: true, branchId });
  });

  // Update both business & branch IDs
  app.post("/set-ids", (req, res) => {
    const { businessId: newBusiness, branchId: newBranch } = req.body;
    if (!newBusiness || !newBranch) {
      return res.status(400).json({ error: "businessId and branchId required" });
    }

    businessId = newBusiness;
    branchId = newBranch;

    config.businessId = newBusiness;
    config.branchId = newBranch;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(`🔄 Business updated to ${businessId}, Branch updated to ${branchId}`);
    socket.emit("update_ids", { agentId, businessId, branchId });

    res.json({ success: true, businessId, branchId });
  });

  app.get("/", (req, res) => {
    res.send("Agent is running ✅");
  });

  app.listen(PORT, () => {
    console.log(`📡 Agent identity API running at http://localhost:${PORT}/identity`);
  });
});
