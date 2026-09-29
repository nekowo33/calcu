const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Serve the simple HTML UI from the /public folder
app.use(express.static(path.join(__dirname, 'public')));

const PORT = 3000;
const PYTHON_URL = 'http://localhost:5001';
const HISTORY_FILE = path.join(__dirname, 'history.csv');

// Make sure the CSV file exists with a header row
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, 'timestamp,num1,num2,operation,result,status\n');
}

// Helper: append one calculation to history.csv
function logToHistory({ num1, num2, operation, result, status }) {
  const timestamp = new Date().toISOString();
  // Escape commas just in case a result string contains one
  const safeResult = String(result).replace(/,/g, ';');
  const row = `${timestamp},${num1},${num2},${operation},${safeResult},${status}\n`;
  fs.appendFile(HISTORY_FILE, row, (err) => {
    if (err) console.error('Failed to write history log:', err.message);
  });
}

// Route 1: Simple test endpoint
app.get('/hello', (req, res) => {
  res.json({ message: 'Hello from Node.js Gateway!' });
});

// Route 2: Main integration endpoint
app.post('/api/calculate', async (req, res) => {
  console.log('Node.js received:', req.body);
  const { num1, num2, operation } = req.body;

  try {
    // Forward to Python
    const pythonResponse = await axios.post(`${PYTHON_URL}/calculate`, req.body);

    // Log this calculation to history.csv
    logToHistory({
      num1,
      num2,
      operation,
      result: pythonResponse.data.result,
      status: pythonResponse.data.status,
    });

    // Enrich and return response
    res.json({
      gateway_message: 'Node.js successfully aggregated the data!',
      python_result: pythonResponse.data,
    });
  } catch (error) {
    console.error('Error:', error.message);

    logToHistory({
      num1,
      num2,
      operation,
      result: 'N/A',
      status: 'error',
    });

    res.status(500).json({
      error: 'Failed to reach Python service. Is it running on port 5001?',
    });
  }
});

// Route 3: System status check
app.get('/api/status', async (req, res) => {
  try {
    const ping = await axios.get(`${PYTHON_URL}/ping`);
    res.json({
      gateway: 'Node.js is running',
      python: ping.data,
    });
  } catch (error) {
    res.status(500).json({
      gateway: 'Node.js is running',
      python: 'Python is NOT reachable',
    });
  }
});

// Route 4: Read back the calculation history (bonus, handy for testing)
app.get('/api/history', (req, res) => {
  fs.readFile(HISTORY_FILE, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Could not read history file' });
    }
    res.type('text/plain').send(data);
  });
});

app.listen(PORT, () => {
  console.log(`Node.js Gateway: http://localhost:${PORT}`);
  console.log(`Python URL: ${PYTHON_URL}`);
  console.log(`UI available at: http://localhost:${PORT}/index.html`);
});