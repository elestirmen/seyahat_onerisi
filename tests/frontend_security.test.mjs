import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.className = '';
    this.type = '';
    this.ownTextContent = '';
  }

  set textContent(value) {
    this.ownTextContent = String(value ?? '');
    this.children = [];
  }

  get textContent() {
    return this.ownTextContent + this.children.map(child => child.textContent).join('');
  }

  append(...children) {
    this.children.push(...children);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  addEventListener(type, listener) {
    this.listeners[type] ||= [];
    this.listeners[type].push(listener);
  }

  click() {
    (this.listeners.click || []).forEach(listener => listener({ type: 'click' }));
  }
}

function descendants(element) {
  return [element, ...element.children.flatMap(descendants)];
}

async function read(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('POI popup treats remote fields as text and keeps actions functional', async () => {
  const source = await read('../static/js/modules/map-controller.js');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const { createPOIPopupElement } = await import(moduleUrl);

  globalThis.document = {
    createElement: tagName => new FakeElement(tagName),
  };

  const poi = {
    _id: `poi-'\"`,
    name: '<img src=x onerror="globalThis.compromised=true">',
    description: '</p><script>globalThis.compromised=true</script>',
    category: 'museum',
    latitude: 38.6,
    longitude: 34.9,
  };
  const category = '<svg onload="globalThis.compromised=true">';
  const calls = [];

  const popup = createPOIPopupElement(poi, {
    categoryDisplayName: category,
    showPOIDetail: (...args) => calls.push(['detail', ...args]),
    openInGoogleMaps: (...args) => calls.push(['maps', ...args]),
    addToRoute: (...args) => calls.push(['route', ...args]),
  });
  const nodes = descendants(popup);

  assert.match(popup.textContent, /<img src=x onerror=/);
  assert.match(popup.textContent, /<script>/);
  assert.match(popup.textContent, /<svg onload=/);
  assert.equal(nodes.some(node => ['IMG', 'SCRIPT', 'SVG'].includes(node.tagName)), false);
  assert.equal(nodes.some(node => Object.keys(node.attributes).some(name => /^on/i.test(name))), false);

  const buttons = nodes.filter(node => node.tagName === 'BUTTON');
  assert.equal(buttons.length, 3);
  buttons.forEach(button => button.click());

  assert.equal(calls[0][0], 'detail');
  assert.equal(calls[0][1], poi._id);
  assert.equal(calls[0][2], poi);
  assert.deepEqual(calls[1], ['maps', poi.latitude, poi.longitude, poi.name]);
  assert.deepEqual(calls[2], ['route', poi]);
  assert.equal(globalThis.compromised, undefined);
});

test('iframe bridge uses exact same-origin targets and validates message senders', async () => {
  const [shell, predefined] = await Promise.all([
    read('../poi_recommendation_system.html'),
    read('../static/js/predefined_routes.js'),
  ]);

  assert.doesNotMatch(shell, /postMessage\(message,\s*['"]\*['"]\)/);
  assert.match(shell, /postMessage\(message, window\.location\.origin\)/);
  assert.match(shell, /e\.origin !== window\.location\.origin/);
  assert.match(shell, /e\.source !== personalFrame\.contentWindow/);

  assert.doesNotMatch(predefined, /postMessage\([^\n]+['"]\*['"]\)/);
  assert.match(predefined, /const MESSAGE_ORIGIN = window\.location\.origin/);
  assert.match(predefined, /e\.origin !== MESSAGE_ORIGIN/);
  assert.match(predefined, /e\.source !== window\.parent/);
  assert.doesNotMatch(predefined, /^\s*initializePredefinedRoutes\(\);/m);
  assert.doesNotMatch(predefined, /^\s*await initializePredefinedMap\(\);/m);
  assert.match(predefined, /window\.__predefinedRoutesDataLoadPromise = pendingLoad/);
});

test('icon-only predefined-route controls have accessible names', async () => {
  const html = await read('../predefined_routes.html');

  assert.match(html, /<label for="routeSearchInput"[^>]*>Rota ara<\/label>/);
  for (const id of [
    'mobileFilterClose',
    'filtersToggleBtn',
    'predefinedMediaPrevBtn',
    'predefinedMediaNextBtn',
  ]) {
    assert.match(html, new RegExp(`<button[^>]+id="${id}"[^>]+aria-label="[^"]+"`));
  }
  assert.match(html, /<button[^>]+class="close-btn"[^>]+aria-label="Rota detaylarını kapat"/);
});

test('privacy and mobile preference UX avoid hidden background work', async () => {
  const [shell, personal, personalScript, personalStyles, mainScript, loadingPerformance, mobileOptimizations] = await Promise.all([
    read('../poi_recommendation_system.html'),
    read('../personal_routes.html'),
    read('../static/js/personal_routes.js'),
    read('../static/css/personal_routes.css'),
    read('../static/js/poi_recommendation_system.js'),
    read('../static/js/loading-performance.js'),
    read('../static/js/mobile-optimizations.js'),
  ]);

  assert.match(shell, /href="policy\.html"/);
  assert.doesNotMatch(shell, /'unsafe-eval'/);
  assert.doesNotMatch(personal, /'unsafe-eval'/);
  assert.doesNotMatch(personal, /smartPresetLock/);
  assert.doesNotMatch(personal, /exploreBtn\.click\(\)/);
  assert.match(personal, /id="exploreBtn"/);
  assert.match(personal, /id="notificationPreferencesShortcut"/);
  assert.match(personal, /id="dynamicMapFullscreenBtn"[^>]+aria-label="Haritayı tam ekran göster"/);
  assert.match(personal, /id="poiMediaPrevBtn"[^>]+aria-label="Önceki POI görseli"/);
  assert.match(personal, /id="poiMediaNextBtn"[^>]+aria-label="Sonraki POI görseli"/);
  assert.ok(personal.indexOf('id="nearbyPOISection"') < personal.indexOf('id="resultsSection"'));
  assert.match(personal, /toolbelt\.insertAdjacentElement\('afterend', host\)/);
  assert.doesNotMatch(personalStyles, /bottom "Serbest Keşif" button is redundant/);
  assert.match(personalStyles, /#dynamicRoutesContent > :not\(#mobileMapHost\)/);
  assert.match(personalScript, /initializeNotificationPreferencesShortcut\(\)/);
  assert.match(personalScript, /exploreBtn\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(personalScript, /exploreBtn\.removeAttribute\('aria-busy'\)/);
  assert.doesNotMatch(mainScript, /getAllPOIs\(\{ normalize: true, refresh: true \}\)/);
  assert.doesNotMatch(mainScript, /\/pois\/nearby\?\$\{searchParams\.toString\(\)\}/);
  assert.doesNotMatch(mainScript, /\/panoramas\/nearby\?\$\{searchParams\.toString\(\)\}/);
  assert.match(mainScript, /fetch\(`\$\{apiBase\}\/pois\/nearby`, \{\s*method: 'POST'/);
  assert.match(loadingPerformance, /enabled: window\.__POI_PERF_DEBUG__ === true/);
  assert.match(mobileOptimizations, /if \(this\.performanceDebugEnabled\) \{\s*this\.setupPerformanceMonitoring\(\)/);
});
