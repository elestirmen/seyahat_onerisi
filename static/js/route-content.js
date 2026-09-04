/**
 * Presentation-layer cleanup for imported route content.
 *
 * Most routes in the catalogue were imported from GPX tracks, and they carry the
 * artefacts of that import: names like "Wikiloc - Ürgüp. Hıdırellez kilisesi .
 * 13/06/2021" or bare timestamps like "Apr 26, 2023 17:05:11", and description
 * fields holding waypoint telemetry ("Elevation: 1601 m / Time from start:
 * 00:22:41 / ..."). Those read as raw database rows on a page that is meant to
 * read like a travel guide.
 *
 * This module normalises that data for display only - it never writes back, and
 * it never invents descriptive prose. Where a name is unusable it derives an
 * honest label from the route's own attributes ("Doğa yürüyüşü · 23,1 km"), and
 * where a description holds nothing but telemetry it returns an empty string so
 * the caller can leave the space blank rather than fill it with filler copy.
 *
 * Writing real editorial copy for these routes remains an editorial task; this
 * only stops the imported data from looking broken in the meantime.
 */
(function (global) {
  'use strict';

  /* Import sources that prefix the track name. */
  var SOURCE_PREFIX = /^\s*(wikiloc|strava|komoot|garmin|alltrails|mapmyrun|endomondo|gpx|kml|track|trace)\s*[-–—:|]+\s*/i;

  /* A trailing "13/06/2021" or "28.05.2021". */
  var TRAILING_DATE = /[\s.,;:|–—-]*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s*$/;

  /* A trailing "17:05:11" or "17:14". */
  var TRAILING_TIME = /[\s.,;:|–—-]*\d{1,2}:\d{2}(?::\d{2})?\s*$/;

  /* Names that carry no information. */
  var PLACEHOLDER_NAME = /^(yeni rota|isimsiz(\s+rota)?|adsız(\s+rota)?|untitled|unnamed|new route|no name|route|rota|track|parkur)\.?$/i;

  /* Month names, English and Turkish, so date-only names can be recognised. */
  var MONTH_WORDS = new RegExp(
    '\\b(' +
    'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|' +
    'january|february|march|april|june|july|august|september|october|november|december|' +
    'oca|şub|sub|mar|nis|may|haz|tem|ağu|agu|eyl|eki|kas|ara|' +
    'ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik|' +
    'pazartesi|salı|sali|çarşamba|carsamba|perşembe|persembe|cuma|cumartesi|pazar|' +
    'mon|tue|wed|thu|fri|sat|sun' +
    ')\\b', 'gi');

  /* Telemetry keys that GPX exporters dump into the description field. */
  var TELEMETRY_LINE = new RegExp(
    '^\\s*(' +
    'elevation|altitude|ele|time from start|time|distance from start|distance|' +
    'speed|avg(erage)? speed|max(imum)? speed|pace|heart rate|hr|cadence|power|' +
    'temperature|temp|slope|grade|accuracy|course|bearing|' +
    'yükseklik|yukseklik|rakım|rakim|mesafe|süre|sure|hız|hiz|sıcaklık|sicaklik|eğim|egim' +
    ')\\s*[:=]', 'i');

  var ROUTE_TYPE_LABEL = {
    walking: 'Yürüyüş rotası',
    hiking: 'Doğa yürüyüşü',
    cycling: 'Bisiklet rotası',
    driving: 'Araç rotası'
  };

  var DIFFICULTY_LABEL = {
    1: 'Kolay',
    2: 'Orta',
    3: 'Zor',
    4: 'Çok zor',
    5: 'Uzman'
  };

  function text(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function collapse(value) {
    return text(value).replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    }

  /* Turkish-aware capitalisation of the first letter only; the rest of the name
   * is left as the author typed it. */
  function capitalizeFirst(value) {
    if (!value) return value;
    var first = value.charAt(0);
    var upper = typeof first.toLocaleUpperCase === 'function'
      ? first.toLocaleUpperCase('tr-TR')
      : first.toUpperCase();
    return upper + value.slice(1);
  }

  /* True when what is left after removing digits, month/day words and
   * punctuation has no real word in it - which is how a bare timestamp such as
   * "18 Ağu 2025 17:14:55" or "Apr 26, 2023 17:05:11" gives itself away. */
  function isDateLike(value) {
    var residue = text(value)
      .replace(MONTH_WORDS, ' ')
      .replace(/[0-9]/g, ' ')
      .replace(/[^\p{L}]+/gu, ' ')
      .trim();
    return residue.length < 3;
  }

  function formatNumber(value, decimals) {
    var n = Number(value);
    if (!isFinite(n)) return '';
    var fixed = n.toFixed(decimals === undefined ? 1 : decimals);
    /* Turkish uses a comma for the decimal separator. */
    return fixed.replace('.', ',');
  }

  function typeLabel(routeType) {
    return ROUTE_TYPE_LABEL[text(routeType).toLowerCase()] || 'Keşif rotası';
  }

  function difficultyLabel(level) {
    return DIFFICULTY_LABEL[Number(level)] || '';
  }

  function distanceLabel(km) {
    var n = Number(km);
    if (!isFinite(n) || n <= 0) return '';
    return formatNumber(n, n < 10 ? 1 : 1) + ' km';
  }

  /* Minutes in, a human duration out. Returns '' for missing or zero values so
   * the caller can drop the field instead of printing "0 saat". */
  function durationLabel(minutes) {
    var total = Math.round(Number(minutes));
    if (!isFinite(total) || total <= 0) return '';
    if (total < 60) return total + ' dk';
    var hours = Math.floor(total / 60);
    var rest = total % 60;
    return rest ? hours + ' sa ' + rest + ' dk' : hours + ' saat';
  }

  function stopsLabel(count) {
    var n = Math.round(Number(count));
    if (!isFinite(n) || n <= 0) return '';
    return n + ' durak';
  }

  /* A label built only from attributes the route actually has. */
  function derivedTitle(route) {
    route = route || {};
    var parts = [typeLabel(route.route_type)];
    var distance = distanceLabel(
      route.total_distance !== undefined ? route.total_distance : route.distance
    );
    if (distance) parts.push(distance);
    return parts.join(' · ');
  }

  /**
   * The route's own name, cleaned of import artefacts - or null when what is
   * stored carries no information (empty, a placeholder, or a bare timestamp).
   */
  function storedName(route) {
    route = route || {};
    var raw = collapse(route.name);
    if (!raw) return null;

    var name = raw.replace(SOURCE_PREFIX, '');
    name = name.replace(TRAILING_TIME, '');
    name = name.replace(TRAILING_DATE, '');
    /* Strip punctuation the date/time removal left dangling. */
    name = name.replace(/[\s.,;:|–—-]+$/, '').trim();

    if (!name || PLACEHOLDER_NAME.test(name) || isDateLike(name)) return null;

    /* Imported tracks are often entirely lower case. */
    if (name === name.toLocaleLowerCase('tr-TR')) {
      name = capitalizeFirst(name);
    }
    return name;
  }

  /**
   * True when the route has a usable name of its own, so callers can tell a
   * real title from one this module derived. A derived title already states the
   * distance, and a card should not print that twice.
   */
  function hasName(route) {
    return storedName(route) !== null;
  }

  /**
   * A display title for a route. Never returns an empty string.
   */
  function title(route) {
    return storedName(route) || derivedTitle(route);
  }

  /**
   * A display description for a route, or '' when the stored value holds
   * nothing but import telemetry. Never returns invented prose.
   */
  function description(route) {
    route = route || {};
    var raw = text(route.description);
    if (!raw.trim()) return '';

    var lines = raw
      .split(/\r?\n|\s{2,}\|/)
      .map(function (line) { return line.trim(); })
      .filter(Boolean)
      .filter(function (line) { return !TELEMETRY_LINE.test(line); });

    var out = collapse(lines.join(' '));

    /* Whatever survived is only worth showing if it reads like a sentence
     * rather than a leftover measurement. */
    if (out.replace(/[^\p{L}]+/gu, '').length < 12) return '';
    return out;
  }

  /**
   * True when the route carries no author-written description. Useful for
   * telling "we have nothing to say" apart from "the author said little".
   */
  function hasDescription(route) {
    return description(route) !== '';
  }

  global.RouteContent = {
    escapeHtml: escapeHtml,
    title: title,
    hasName: hasName,
    storedName: storedName,
    description: description,
    hasDescription: hasDescription,
    derivedTitle: derivedTitle,
    typeLabel: typeLabel,
    difficultyLabel: difficultyLabel,
    distanceLabel: distanceLabel,
    durationLabel: durationLabel,
    stopsLabel: stopsLabel,
    formatNumber: formatNumber,
    isDateLike: isDateLike
  };
})(typeof window !== 'undefined' ? window : globalThis);
