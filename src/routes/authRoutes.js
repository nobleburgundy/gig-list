const express = require('express');
const router = express.Router();
const { getOAuthClient, getAuthUrl, loadTokens, saveTokens, clearTokens } = require('../auth');

router.get('/auth', (req, res) => {
  res.redirect(getAuthUrl());
});

router.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect('/?error=auth_denied');

  const client = getOAuthClient();
  try {
    const { tokens } = await client.getToken(code);
    saveTokens(tokens);
    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.redirect('/?error=auth_failed');
  }
});

router.get('/auth/logout', (req, res) => {
  clearTokens();
  res.redirect('/');
});

router.get('/auth/status', (req, res) => {
  const tokens = loadTokens();
  res.json({ authenticated: !!tokens });
});

module.exports = router;
