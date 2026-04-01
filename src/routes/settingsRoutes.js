const express = require('express');
const router = express.Router();
const { loadSettings, saveSettings } = require('../settings');

router.get('/api/settings', (req, res) => {
  res.json(loadSettings());
});

router.post('/api/settings', (req, res) => {
  try {
    const updated = saveSettings(req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
