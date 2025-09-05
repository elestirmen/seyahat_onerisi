Route Pages Split and Shell Integration
======================================

Overview
- The original `poi_recommendation_system.html` had two tabs: personal (dynamic) routes and predefined (hazır) routes.
- We split these into two standalone pages and converted `poi_recommendation_system.html` into a lightweight iframe-based shell.

New Pages
- `personal_routes.html`: Kişiye göre yerler/rotalar. Loads its own CSS/JS.
- `predefined_routes.html`: Hazır rotalar. Loads its own CSS/JS.

Assets
- `static/css/personal_routes.css`: Page styles (imports existing base styles).
- `static/css/predefined_routes.css`: Page styles (imports existing base styles).
- `assets/js/personal_routes.js`: Page bootstrap + postMessage skeleton.
- `assets/js/predefined_routes.js`: Page bootstrap + postMessage skeleton.

Shell
- `poi_recommendation_system.html` now only renders two tabs and toggles two iframes:
  - `personal_routes.html`
  - `predefined_routes.html` (lazy loaded)
- Contains minimal CSS strictly for tab + iframe layout.
- Includes a `window.postMessage` listener skeleton for future parent↔iframe communication.

Standalone Development
- Each page can be opened directly (e.g. `personal_routes.html`) and works independently.
- Both pages include required dependencies (Leaflet, MarkerCluster, Chart.js, etc.) and the existing main logic `static/js/poi_recommendation_system.js` which already handles per-page initialization based on available DOM.

Notes
- API endpoints and logic remain unchanged; requests keep using existing URLs and credentials.
- If a cross-frame bridge is needed later, extend the skeletons in `assets/js/*_routes.js` and the shell listener.

