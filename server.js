require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');

// Ensure data/ directory exists before routes load
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const app = express();
app.use(express.json());
app.use(express.static('docs'));

app.use('/', require('./src/routes/authRoutes'));
app.use('/', require('./src/routes/calendarRoutes'));
app.use('/', require('./src/routes/settingsRoutes'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gig List running at http://localhost:${PORT}`);
});
