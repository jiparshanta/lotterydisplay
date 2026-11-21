/* Shared state for the display and the control panel.
 * Slot assignments + settings live in localStorage; uploaded ticket images live
 * in IndexedDB (too big for localStorage). Changes are broadcast so an open
 * display window updates instantly when the control panel saves.
 */
(function (global) {
  'use strict';

  var SLOT_COUNT = 74;
  var KEY_SLOTS = 'txso.slots.v1';
  var KEY_SETTINGS = 'txso.settings.v1';
  var CHANNEL = 'txso-sync';

  var DEFAULT_SETTINGS = {
    // Image lookup order for a game number. {game} is replaced by the number.
    // Uploaded images (control panel) always win over these.
    imageSources: [
      'tickets/{game}.gif',
      'tickets/{game}.jpg',
      'tickets/{game}.png',
      'https://www.texaslottery.com/export/sites/lottery/Images/scratchoffs/{game}_img1.gif'
    ],
    columns: 0,            // 0 = auto-fit
    ticketAspect: 0.62,    // width / height of a ticket image (portrait)
    showSlotNumber: true,
    showGameNumber: true,
    showPrice: true,
    gap: 4,
    background: '#0b0d12',
    title: ''
  };

  function emptySlots() {
    var s = [];
    for (var i = 0; i < SLOT_COUNT; i++) s.push({ game: '', price: '', soldOut: false });
    return s;
  }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.error('Could not save', key, e); return false; }
  }

  function getSlots() {
    var s = readJSON(KEY_SLOTS, null);
    var base = emptySlots();
    if (Array.isArray(s)) {
      for (var i = 0; i < SLOT_COUNT; i++) {
        if (s[i]) base[i] = {
          game: String(s[i].game || '').trim(),
          price: String(s[i].price || '').trim(),
          soldOut: !!s[i].soldOut
        };
      }
    }
    return base;
  }
  function getSettings() {
    var s = readJSON(KEY_SETTINGS, {});
    var out = {};
    for (var k in DEFAULT_SETTINGS) out[k] = (s && s[k] !== undefined) ? s[k] : DEFAULT_SETTINGS[k];
    // Migrate settings saved with the first (unverified) image URL guess.
    if (out.imageSources.some(function (u) { return /_front\.jpg$/.test(u); })) {
      out.imageSources = DEFAULT_SETTINGS.imageSources.slice();
    }
    return out;
  }

  var bc = null;
  try { bc = new BroadcastChannel(CHANNEL); } catch (e) { /* older browsers: storage event still works */ }

  function notify(kind) { if (bc) bc.postMessage({ kind: kind, t: Date.now() }); }

  function saveSlots(slots) { var ok = writeJSON(KEY_SLOTS, slots); notify('slots'); return ok; }
  function saveSettings(settings) { var ok = writeJSON(KEY_SETTINGS, settings); notify('settings'); return ok; }

  function onChange(cb) {
    if (bc) bc.onmessage = function (ev) { cb(ev.data && ev.data.kind); };
    window.addEventListener('storage', function (ev) {
      if (ev.key === KEY_SLOTS) cb('slots');
      else if (ev.key === KEY_SETTINGS) cb('settings');
    });
  }

  // ---------- Uploaded images (IndexedDB) ----------
  var dbPromise = null;
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!global.indexedDB) return reject(new Error('IndexedDB unavailable'));
      var req = indexedDB.open('txso-images', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('images'); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction('images', mode);
        var store = t.objectStore('images');
        var result = fn(store);
        t.oncomplete = function () { resolve(result && result.result !== undefined ? result.result : undefined); };
        t.onerror = function () { reject(t.error); };
      });
    });
  }
  function putImage(game, blob) { return tx('readwrite', function (s) { return s.put(blob, String(game)); }).then(function () { notify('images'); }); }
  function deleteImage(game) { return tx('readwrite', function (s) { return s.delete(String(game)); }).then(function () { notify('images'); }); }
  function getImage(game) { return tx('readonly', function (s) { return s.get(String(game)); }).catch(function () { return undefined; }); }
  function listImageKeys() { return tx('readonly', function (s) { return s.getAllKeys(); }).catch(function () { return []; }); }

  // Object URL cache so we don't recreate blobs on every render.
  var urlCache = {};
  function uploadedUrl(game) {
    game = String(game);
    return getImage(game).then(function (blob) {
      if (!blob) { if (urlCache[game]) { URL.revokeObjectURL(urlCache[game].url); delete urlCache[game]; } return null; }
      if (urlCache[game] && urlCache[game].blob === blob) return urlCache[game].url;
      if (urlCache[game]) URL.revokeObjectURL(urlCache[game].url);
      var url = URL.createObjectURL(blob);
      urlCache[game] = { blob: blob, url: url };
      return url;
    });
  }
  function invalidateImageCache() {
    for (var k in urlCache) URL.revokeObjectURL(urlCache[k].url);
    urlCache = {};
  }

  /* Resolve the best image for a game: uploaded image first, then each source
   * template in order until one loads. Resolves to a URL string or null. */
  var resolveCache = {};
  function resolveImage(game, settings) {
    game = String(game).trim();
    if (!game) return Promise.resolve(null);
    return uploadedUrl(game).then(function (up) {
      if (up) return up;
      var key = game + '|' + settings.imageSources.join('|');
      if (resolveCache[key] !== undefined) return resolveCache[key];
      var candidates = settings.imageSources.map(function (t) { return t.split('{game}').join(encodeURIComponent(game)); });
      return tryLoad(candidates, 0).then(function (url) { resolveCache[key] = url; return url; });
    });
  }
  function tryLoad(list, i) {
    if (i >= list.length) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var img = new Image();
      var done = false;
      var timer = setTimeout(function () { finish(false); }, 8000);
      function finish(ok) {
        if (done) return; done = true; clearTimeout(timer);
        resolve(ok ? list[i] : tryLoad(list, i + 1));
      }
      img.onload = function () { finish(img.naturalWidth > 0); };
      img.onerror = function () { finish(false); };
      img.src = list[i];
    });
  }
  function clearResolveCache() { resolveCache = {}; }

  /* Game catalog (games.json: number -> name, price, top prize). Built by
   * tools/update_tickets.py from the Texas Lottery scratch-off list. */
  var catalogPromise = null;
  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = fetch('games.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; })
        .then(function (list) {
          var map = {};
          (list || []).forEach(function (g) { map[String(g.game)] = g; });
          return map;
        });
    }
    return catalogPromise;
  }

  global.TXSO = {
    loadCatalog: loadCatalog,
    SLOT_COUNT: SLOT_COUNT,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    getSlots: getSlots, saveSlots: saveSlots, emptySlots: emptySlots,
    getSettings: getSettings, saveSettings: saveSettings,
    onChange: onChange,
    putImage: putImage, deleteImage: deleteImage, listImageKeys: listImageKeys,
    resolveImage: resolveImage, clearResolveCache: clearResolveCache,
    invalidateImageCache: invalidateImageCache
  };
})(window);
