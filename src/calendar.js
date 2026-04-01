const { google } = require('googleapis');
const { getAuthenticatedClient } = require('./auth');

function parseBands(event, settings) {
  const title = event.summary || '';
  const bands = settings.bands || [];
  return bands
    .filter(band => (band.keywords || []).some(kw => {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(title);
    }))
    .map(band => band.id);
}

function parseStatus(event, settings) {
  const searchText = [
    event.summary || '',
    event.description || '',
  ].join(' ').toLowerCase();

  const confirmedKeywords = settings.confirmedKeywords || [];
  const holdKeywords = settings.holdKeywords || [];

  const matchesConfirmed = confirmedKeywords.length &&
    confirmedKeywords.some(kw => searchText.includes(kw.toLowerCase()));
  const matchesHold = holdKeywords.some(kw => searchText.includes(kw.toLowerCase()));

  if (matchesConfirmed) return 'confirmed';
  if (matchesHold) return 'hold';

  // If either keyword list is configured, treat unmatched events as hidden.
  // Only fall back to show-all when both lists are completely empty (unconfigured state).
  const hasFilters = confirmedKeywords.length > 0 || holdKeywords.length > 0;
  return hasFilters ? 'unmatched' : 'confirmed';
}

function parseVenue(event, settings) {
  if (settings.venueSource === 'location') {
    return event.location || '';
  }

  const summary = event.summary || '';

  // Try "at <Venue>" or "@ <venue>" — require "at" to be followed by a letter (avoids "at 9pm")
  const atMatch = summary.match(/(?:\bat\s+(?=[A-Za-z])|@\s*)([^(\[{\n]+?)(?:\s*[(\[{]|$)/i);
  if (atMatch) {
    return atMatch[1].trim().replace(/[,\s]+$/, '');
  }

  // Optional manual separator (e.g. " - ")
  if (settings.venueSummarySeparator) {
    const idx = summary.indexOf(settings.venueSummarySeparator);
    if (idx !== -1) {
      return summary.slice(idx + settings.venueSummarySeparator.length).trim();
    }
  }

  // Fall back: strip parenthesized markers and clean up the title
  let venue = summary.replace(/\([^)]{1,30}\)/g, '').trim();
  venue = venue.replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim();
  return venue || summary;
}

function parseDate(event) {
  // All-day events use start.date, timed events use start.dateTime
  return event.start?.dateTime || event.start?.date || null;
}

function parseEvent(event, settings) {
  return {
    id: event.id,
    date: parseDate(event),
    startTime: event.start?.dateTime || null,
    endTime: event.end?.dateTime || null,
    endDate: event.end?.date || null,   // all-day end (exclusive per Google Calendar)
    bands: parseBands(event, settings),
    venue: parseVenue(event, settings),
    status: parseStatus(event, settings),
    title: event.summary || '',
    location: event.location || '',
    description: event.description || '',
    htmlLink: event.htmlLink || null,
  };
}

async function fetchGigs(settings) {
  const client = await getAuthenticatedClient();
  if (!client) return null;

  const calendar = google.calendar({ version: 'v3', auth: client });

  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(timeMin.getDate() - (settings.daysBack ?? 0));
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + (settings.daysAhead ?? 365));

  const response = await calendar.events.list({
    calendarId: settings.calendarId || 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 500,
  });

  const items = response.data.items || [];
  return items.map(event => parseEvent(event, settings));
}

module.exports = { fetchGigs };
