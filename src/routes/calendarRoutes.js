const express = require('express');
const router = express.Router();
const { fetchGigs } = require('../calendar');
const { loadSettings } = require('../settings');
const { clearTokens } = require('../auth');

router.get('/api/gigs', async (req, res) => {
  const settings = loadSettings();
  try {
    const gigs = await fetchGigs(settings);
    if (gigs === null) {
      return res.status(401).json({ error: 'not_authenticated' });
    }
    res.json(gigs);
  } catch (err) {
    console.error('Calendar fetch error:', err.message);
    if (err.code === 401 || err.status === 401) {
      clearTokens();
      return res.status(401).json({ error: 'token_expired' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
