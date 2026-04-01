/**
 * GIG LIST — Monthly Email Digest
 * Google Apps Script
 *
 * Setup:
 *  1. Go to script.google.com → New project
 *  2. Paste this entire file, replacing the default content
 *  3. Edit the CONFIG section below with your emails
 *  4. Click Run → sendGigEmails to test (approve Calendar + Gmail permissions when prompted)
 *  5. Triggers (clock icon) → Add Trigger → sendGigEmails → Time-based → Month timer
 */

// ================================================================
// CONFIG — edit this section
// ================================================================

const CONFIG = {
  calendarId:        'd5s5fcphhafm0nvgcek25o9k18@group.calendar.google.com',
  daysAhead:         60,   // how many days ahead to include
  emailSubject:      'Upcoming Gigs',

  confirmedKeywords: ['(c)', '(confirmed)', '[c]', '[confirmed]'],
  holdKeywords:      ['(h)', '(hold)', '[h]', '[hold]'],

  bands: [
    { id: 'feds', name: 'The Federales',    keywords: ['Feds', 'Federales']      },
    { id: 'td',   name: 'Tumbling Daisies', keywords: ['TD', 'Tumbling Daisies'] },
  ],

  // Receives all gigs (both bands) — e.g. band leaders, members in both bands
  recipientsAll: [
    'you@example.com',
  ],

  // Receives only their band's gigs — keyed by band id above
  recipientsByBand: {
    feds: ['fedsonly@example.com'],
    td:   ['tdonly@example.com'],
  },
};

// ================================================================
// MAIN
// ================================================================

function sendGigEmails() {
  const gigs = fetchGigs();

  // All-bands email
  if (CONFIG.recipientsAll.length) {
    sendEmail(
      CONFIG.recipientsAll,
      CONFIG.emailSubject,
      buildEmail(gigs, null)
    );
  }

  // Per-band emails
  for (const band of CONFIG.bands) {
    const recipients = CONFIG.recipientsByBand[band.id] || [];
    if (!recipients.length) continue;
    const bandGigs = gigs.filter(g => g.bands.includes(band.id));
    sendEmail(
      recipients,
      `${CONFIG.emailSubject} — ${band.name}`,
      buildEmail(bandGigs, band)
    );
  }
}

// ================================================================
// FETCH & PARSE
// ================================================================

function fetchGigs() {
  const cal = CalendarApp.getCalendarById(CONFIG.calendarId);
  const now = new Date();
  const end = new Date();
  end.setDate(end.getDate() + CONFIG.daysAhead);

  return cal.getEvents(now, end)
    .map(parseEvent)
    .filter(g => g.status !== 'unmatched')
    .sort((a, b) => a.startDate - b.startDate);
}

function parseEvent(event) {
  const title    = event.getTitle()       || '';
  const desc     = event.getDescription() || '';
  const isAllDay = event.isAllDayEvent();

  return {
    title:     title,
    venue:     parseVenue(title),
    status:    parseStatus(title, desc),
    bands:     parseBands(title),
    startDate: isAllDay ? event.getAllDayStartDate() : event.getStartTime(),
    endDate:   isAllDay ? event.getAllDayEndDate()   : event.getEndTime(),
    isAllDay:  isAllDay,
    location:  event.getLocation() || '',
  };
}

function parseStatus(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  const isConfirmed = CONFIG.confirmedKeywords.some(kw => text.includes(kw.toLowerCase()));
  const isHold      = CONFIG.holdKeywords.some(kw => text.includes(kw.toLowerCase()));
  if (isConfirmed) return 'confirmed';
  if (isHold)      return 'hold';
  const hasFilters  = CONFIG.confirmedKeywords.length > 0 || CONFIG.holdKeywords.length > 0;
  return hasFilters ? 'unmatched' : 'confirmed';
}

function parseBands(title) {
  return CONFIG.bands
    .filter(band => band.keywords.some(kw => {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(title);
    }))
    .map(band => band.id);
}

function parseVenue(title) {
  const atMatch = title.match(/(?:\bat\s+(?=[A-Za-z])|@\s*)([^(\[{\n]+?)(?:\s*[(\[{]|$)/i);
  if (atMatch) return atMatch[1].trim().replace(/[,\s]+$/, '');
  let venue = title.replace(/\([^)]{1,30}\)/g, '').trim();
  venue = venue.replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim();
  return venue || title;
}

// ================================================================
// EMAIL FORMATTING
// ================================================================

const DAYS_LONG   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS_LONG = ['January','February','March','April','May','June','July',
                     'August','September','October','November','December'];

function formatDate(date) {
  return `${DAYS_LONG[date.getDay()]}, ${MONTHS_LONG[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function buildEmail(gigs, band) {
  const heading   = band ? `${band.name} — Upcoming Gigs` : 'Upcoming Gigs';
  const subhead   = `Next ${CONFIG.daysAhead} days`;
  const confirmed = gigs.filter(g => g.status === 'confirmed');
  const holds     = gigs.filter(g => g.status === 'hold');

  let body = '';

  if (!gigs.length) {
    body = `<p style="padding:24px 32px;margin:0;font-size:14px;color:#666666;">
              No upcoming gigs in the next ${CONFIG.daysAhead} days.
            </p>`;
  } else {
    if (confirmed.length) {
      body += sectionHeader('Confirmed');
      confirmed.forEach(g => { body += gigRow(g); });
    }
    if (holds.length) {
      body += sectionHeader('On Hold');
      holds.forEach(g => { body += gigRow(g); });
    }
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e0e0e0;">

      <!-- Header -->
      <tr>
        <td style="background:#111111;padding:28px 32px;">
          <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888888;margin-bottom:8px;">${escHtml(subhead)}</div>
          <div style="font-size:22px;font-weight:bold;color:#ffffff;">${escHtml(heading)}</div>
        </td>
      </tr>

      <!-- Gig rows -->
      <tr><td style="padding:8px 0 16px;">${body}</td></tr>

      <!-- Reminder -->
      <tr>
        <td style="background:#f9f9f9;border-top:1px solid #e0e0e0;padding:18px 32px;">
          <p style="margin:0;font-size:13px;color:#666666;">
            Remember to update your Federales calendar.
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="border-top:1px solid #e0e0e0;padding:18px 32px;">
          <p style="margin:0;font-size:11px;color:#bbbbbb;letter-spacing:1px;text-transform:uppercase;">
            Gig List — automated digest
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function sectionHeader(label) {
  return `<div style="padding:16px 32px 8px;font-size:10px;letter-spacing:2px;
            text-transform:uppercase;color:#bbbbbb;border-bottom:1px solid #f0f0f0;">${label}</div>`;
}

function gigRow(gig) {
  const statusColor = gig.status === 'hold' ? '#c47c00' : '#1db954';
  const statusLabel = gig.status === 'hold' ? 'Hold' : 'Confirmed';
  const bandNames   = gig.bands
    .map(id => CONFIG.bands.find(b => b.id === id))
    .filter(Boolean)
    .map(b => b.name)
    .join(' & ');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #f0f0f0;">
      <tr>
        <td style="padding:14px 32px;">
          <div style="font-size:11px;color:#999999;letter-spacing:1px;text-transform:uppercase;
                      margin-bottom:5px;">${escHtml(formatDate(gig.startDate))}</div>
          <div style="font-size:16px;font-weight:bold;color:#111111;margin-bottom:3px;">
            ${escHtml(gig.venue || gig.title)}
          </div>
          ${gig.location
            ? `<div style="font-size:12px;color:#666666;margin-top:2px;">${escHtml(gig.location)}</div>`
            : ''}
          ${bandNames
            ? `<div style="font-size:11px;color:#aaaaaa;margin-top:5px;letter-spacing:1px;
                           text-transform:uppercase;">${escHtml(bandNames)}</div>`
            : ''}
        </td>
        <td align="right" style="padding:14px 32px;vertical-align:middle;white-space:nowrap;">
          <span style="font-size:10px;letter-spacing:1px;text-transform:uppercase;
                       font-weight:bold;color:${statusColor};">${statusLabel}</span>
        </td>
      </tr>
    </table>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sendEmail(recipients, subject, html) {
  recipients.forEach(function(email) {
    GmailApp.sendEmail(email, subject, '', { htmlBody: html });
  });
}
