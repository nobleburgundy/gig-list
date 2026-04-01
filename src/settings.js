const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');

// Bump this when defaults change in a way that stale saved values would break behavior.
// loadSettings() resets any field listed in MIGRATED_FIELDS when it finds an older version.
const SETTINGS_VERSION = 4;
const MIGRATED_FIELDS = ['holdKeywords', 'confirmedKeywords', 'bands'];

const DEFAULTS = {
  _version: SETTINGS_VERSION,
  calendarId: 'd5s5fcphhafm0nvgcek25o9k18@group.calendar.google.com',
  holdKeywords: ['(h)', '(hold)', '[h]', '[hold]'],
  confirmedKeywords: ['(c)', '(confirmed)', '[c]', '[confirmed]'],
  bands: [
    { id: 'feds', name: 'The Federales', short: 'Feds', keywords: ['Feds', 'Federales'] },
    { id: 'td',   name: 'Tumbling Daisies', short: 'TD', keywords: ['TD', 'Tumbling Daisies'] },
  ],
  venueSource: 'title', // 'title' or 'location'
  venueSummarySeparator: '', // e.g. ' @ ' or ' - ' to split venue from title
  daysBack: 0,
  daysAhead: 365,
};

function loadSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) return { ...DEFAULTS };
  try {
    const stored = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    // Migrate stale keyword lists when upgrading from an older settings version
    if (!stored._version || stored._version < SETTINGS_VERSION) {
      for (const field of MIGRATED_FIELDS) {
        delete stored[field];
      }
    }
    return Object.assign({}, DEFAULTS, stored);
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(partial) {
  const current = loadSettings();
  const updated = Object.assign({}, current, partial);
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));
  return updated;
}

module.exports = { loadSettings, saveSettings, DEFAULTS };
