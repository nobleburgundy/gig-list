#!/usr/bin/env node
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { google } = require('googleapis');
const fs   = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../docs/config.json');
const OUTPUT_PATH = path.join(__dirname, '../docs/gigs.json');

// ---- Load config ----
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// ---- Service account auth ----
// GOOGLE_SERVICE_ACCOUNT_KEY env var must contain the full service account JSON key.
function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY env var is not set');
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });
}

// ---- Event parsing (mirrors src/calendar.js) ----
function parseBands(event, settings) {
  const title = event.summary || '';
  return (settings.bands || [])
    .filter(band => (band.keywords || []).some(kw => {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(title);
    }))
    .map(band => band.id);
}

function parseStatus(event, settings) {
  const searchText = [event.summary || '', event.description || ''].join(' ').toLowerCase();
  const confirmedKeywords = settings.confirmedKeywords || [];
  const holdKeywords      = settings.holdKeywords      || [];
  const matchesConfirmed  = confirmedKeywords.length &&
    confirmedKeywords.some(kw => searchText.includes(kw.toLowerCase()));
  const matchesHold = holdKeywords.some(kw => searchText.includes(kw.toLowerCase()));
  if (matchesConfirmed) return 'confirmed';
  if (matchesHold)      return 'hold';
  const hasFilters = confirmedKeywords.length > 0 || holdKeywords.length > 0;
  return hasFilters ? 'unmatched' : 'confirmed';
}

function parseVenue(event, settings) {
  if (settings.venueSource === 'location') return event.location || '';
  const summary = event.summary || '';
  const atMatch = summary.match(/(?:\bat\s+(?=[A-Za-z])|@\s*)([^(\[{\n]+?)(?:\s*[(\[{]|$)/i);
  if (atMatch) return atMatch[1].trim().replace(/[,\s]+$/, '');
  if (settings.venueSummarySeparator) {
    const idx = summary.indexOf(settings.venueSummarySeparator);
    if (idx !== -1) return summary.slice(idx + settings.venueSummarySeparator.length).trim();
  }
  let venue = summary.replace(/\([^)]{1,30}\)/g, '').trim();
  venue = venue.replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim();
  return venue || summary;
}

function parseEvent(event, settings) {
  return {
    id:          event.id,
    date:        event.start?.dateTime || event.start?.date || null,
    startTime:   event.start?.dateTime || null,
    endTime:     event.end?.dateTime   || null,
    endDate:     event.end?.date       || null,
    bands:       parseBands(event, settings),
    venue:       parseVenue(event, settings),
    status:      parseStatus(event, settings),
    title:       event.summary     || '',
    location:    event.location    || '',
    description: event.description || '',
    htmlLink:    event.htmlLink    || null,
  };
}

// ---- Fetch and write ----
async function main() {
  const auth     = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  const now     = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(timeMin.getDate() - (config.daysBack ?? 0));
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + (config.daysAhead ?? 365));

  const response = await calendar.events.list({
    calendarId:   config.calendarId || 'primary',
    timeMin:      timeMin.toISOString(),
    timeMax:      timeMax.toISOString(),
    singleEvents: true,
    orderBy:      'startTime',
    maxResults:   500,
  });

  const gigs = (response.data.items || []).map(ev => parseEvent(ev, config));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ fetchedAt: now.toISOString(), gigs }, null, 2));
  console.log(`Wrote ${gigs.length} events to docs/gigs.json`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
