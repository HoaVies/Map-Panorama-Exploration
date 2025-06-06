var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/**
 * Mapillary implementation with real coverage tiles and Graph API integration
 */
export class MapillaryMapsProvider {
    constructor(apiKey) {
        this.map = null;
        this.mapillaryViewer = null;
        this.pegmanMarker = null;
        this.mapClickCb = null;
        this.svChangeCb = null;
        this.currentPosition = null;
        this.currentHeading = 0;
        this.currentPitch = 0;
        this.currentMapType = 'roadmap';
        this.baseTileLayer = null;
        this.hybridLabelLayer = null;
        // Mapillary API configuration
        this.apiKey = 'MLY|23877988385171145|bb1227780b1b533bcff4a7db5abe8bf2';
        // Coverage layers
        this.coverageLayers = {};
        this.coverageVisible = false;
        this.streetViewContainerId = 'street-view-container';
        if (apiKey)
            this.apiKey = apiKey;
        this.waitForLeaflet(() => console.log('Leaflet ready (Mapillary)'));
    }
    waitForLeaflet(cb) {
        if (window.L)
            return cb();
        const id = setInterval(() => {
            if (window.L) {
                clearInterval(id);
                cb();
            }
        }, 100);
    }
    /* ----------------------------------------------------------- Map Section */
    initializeMap(containerId, opts) {
        this.waitForLeaflet(() => {
            var _a, _b;
            const L = window.L;
            const el = document.getElementById(containerId);
            if (!el)
                throw new Error(`#${containerId} not found`);
            this.currentPosition = opts.center;
            this.map = L.map(el, {
                center: [opts.center.lat, opts.center.lng],
                zoom: (_a = opts.zoom) !== null && _a !== void 0 ? _a : 16,
                zoomControl: true,
                attributionControl: true,
            });
            this.setMapType((_b = opts.mapTypeId) !== null && _b !== void 0 ? _b : this.currentMapType);
            this.addMapControls(L);
            // Map click handler
            this.map.on('click', (e) => {
                const p = { lat: e.latlng.lat, lng: e.latlng.lng };
                this.handleMapClick(p);
            });
            // Add zoom change handler to update coverage layers
            this.map.on('zoomend', () => {
                if (this.coverageVisible) {
                    this.updateCoverageLayers();
                }
            });
        });
    }
    handleMapClick(p) {
        return __awaiter(this, void 0, void 0, function* () {
            this.currentPosition = p;
            this.setPegmanPosition(p);
            this.setPegmanVisible(true);
            if (this.mapClickCb) {
                this.mapClickCb(p);
            }
            // If coverage is visible, try to find and load street view
            if (this.coverageVisible) {
                yield this.findAndLoadNearestImage(p);
            }
        });
    }
    setCenter(p) {
        this.currentPosition = p;
        if (this.map)
            this.map.setView([p.lat, p.lng], this.map.getZoom());
    }
    setZoom(z) {
        if (this.map)
            this.map.setZoom(z);
    }
    /* ------------------------------------------------- Street View Section */
    initializeStreetView(containerId, opts) {
        this.streetViewContainerId = containerId;
        this.currentPosition = opts.position;
        this.currentHeading = opts.pov.heading;
        this.currentPitch = opts.pov.pitch;
        const container = document.getElementById(this.streetViewContainerId);
        if (container) {
            container.innerHTML = '<div style="display:flex;height:100%;align-items:center;justify-content:center;background:#f8f8f8;color:#666;">Click on green coverage dots to view street imagery</div>';
        }
    }
    setStreetViewPosition(p) {
        this.currentPosition = p;
        this.setPegmanPosition(p);
        this.setPegmanVisible(true);
        this.findAndLoadNearestImage(p);
    }
    setStreetViewPOV(heading, pitch) {
        this.currentHeading = heading;
        this.currentPitch = pitch;
        if (this.mapillaryViewer) {
            try {
                this.mapillaryViewer.setBearing(heading);
                this.mapillaryViewer.setTilt(pitch);
            }
            catch (e) {
                console.warn('Error setting POV:', e);
            }
        }
    }
    /* -------------------------------------------- Real Coverage Implementation */
    showCoverage(_position) {
        if (!this.map || this.coverageVisible)
            return;
        console.log('Loading real Mapillary coverage...');
        this.coverageVisible = true;
        this.loadCoverageTiles();
    }
    loadCoverageTiles() {
        const L = window.L;
        if (!this.map)
            return;
        try {
            this.clearCoverageLayers();
            this.addVectorTileCoverage(L);
        }
        catch (error) {
            console.error('Error loading coverage tiles:', error);
            this.showError('Failed to load coverage data');
        }
    }
    addVectorTileCoverage(L) {
        if (!L.vectorGrid || !L.vectorGrid.protobuf) {
            this.showError('Leaflet.VectorGrid plugin is not loaded. Please check your index.html.');
            throw new Error('Leaflet.VectorGrid plugin is not loaded. Please check your index.html.');
        }
        // Remove existing vector grid if present
        if (this.coverageLayers.vectorGrid) {
            this.map.removeLayer(this.coverageLayers.vectorGrid);
            delete this.coverageLayers.vectorGrid;
        }
        // Add Mapillary vector tile layer (matching the MapLibre/MapboxGL example)
        const vectorGrid = L.vectorGrid.protobuf('https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=' + this.apiKey, {
            vectorTileLayerStyles: {
                sequence: {
                    weight: 1,
                    color: '#05CB63',
                    opacity: 1,
                    lineCap: 'round',
                    lineJoin: 'round',
                },
                image: {
                    radius: 5,
                    fillColor: '#05CB63',
                    color: '#05CB63',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 1,
                }
            },
            interactive: true,
            maxZoom: 20,
            getFeatureId: (f) => f.properties.id
        });
        // Click handler for images
        vectorGrid.on('click', (e) => {
            if (e.layer.properties && e.layer.properties.id) {
                this.loadImageById(e.layer.properties.id);
                // Move pegman to this point
                if (e.latlng) {
                    this.setPegmanPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
                }
            }
        });
        vectorGrid.addTo(this.map);
        this.coverageLayers.vectorGrid = vectorGrid;
    }
    hideCoverage() {
        this.coverageVisible = false;
        this.clearCoverageLayers();
    }
    clearCoverageLayers() {
        Object.keys(this.coverageLayers).forEach(key => {
            if (this.coverageLayers[key] && this.map) {
                if (key === 'overviewMarker') {
                    // Handle marker separately
                    this.map.removeLayer(this.coverageLayers[key]);
                }
                else if (typeof this.coverageLayers[key].removeFrom === 'function') {
                    // Handle layer groups
                    this.coverageLayers[key].removeFrom(this.map);
                }
                else {
                    // Handle regular layers
                    this.map.removeLayer(this.coverageLayers[key]);
                }
                delete this.coverageLayers[key];
            }
        });
    }
    updateCoverageLayers() {
        if (this.coverageVisible) {
            if (this.coverageUpdateTimeout)
                clearTimeout(this.coverageUpdateTimeout);
            this.coverageUpdateTimeout = setTimeout(() => {
                this.clearCoverageLayers();
                this.loadCoverageTiles();
            }, 300); // 300ms debounce
        }
    }
    /* ----------------------------------------- Image Loading and Viewer */
    findAndLoadNearestImage(position) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`Finding nearest image to ${position.lat}, ${position.lng}`);
                // Search for images near the clicked position
                const radius = 0.001; // Approximately 100 meters
                const bbox = `${position.lng - radius},${position.lat - radius},${position.lng + radius},${position.lat + radius}`;
                const response = yield fetch(`https://graph.mapillary.com/images?access_token=${this.apiKey}&fields=id,computed_geometry,compass_angle&bbox=${bbox}&limit=1`);
                const data = yield response.json();
                if (data.data && data.data.length > 0) {
                    const nearestImage = data.data[0];
                    console.log('Found nearest image:', nearestImage.id);
                    yield this.loadImageById(nearestImage.id);
                }
                else {
                    this.showError('No street imagery available at this location. Try clicking on green coverage dots.');
                }
            }
            catch (error) {
                console.error('Error finding nearest image:', error);
                this.showError('Error loading street imagery');
            }
        });
    }
    loadImageById(imageId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Attempting to load Mapillary image: ${imageId}`);
            // Check if Mapillary API is available
            let MapillaryAPI = null;
            if (window.mapillary && window.mapillary.Viewer) {
                MapillaryAPI = window.mapillary;
                console.log('Using mapillary.Viewer');
            }
            else if (window.Mapillary && window.Mapillary.Viewer) {
                MapillaryAPI = window.Mapillary;
                console.log('Using Mapillary.Viewer');
            }
            else {
                console.error('Mapillary API not available or incorrect structure');
                this.showError('Mapillary library not properly loaded');
                return;
            }
            const container = document.getElementById(this.streetViewContainerId);
            if (!container) {
                console.error('Street view container not found');
                return;
            }
            try {
                // Clean up existing viewer
                if (this.mapillaryViewer) {
                    try {
                        this.mapillaryViewer.remove();
                    }
                    catch (e) {
                        console.warn('Error removing existing viewer:', e);
                    }
                    this.mapillaryViewer = null;
                }
                // Prepare container
                container.innerHTML = '';
                container.style.display = 'block';
                container.style.width = '100%';
                container.style.height = '100%';
                // Create viewer using the correct constructor pattern
                console.log('Creating Mapillary viewer with constructor');
                this.mapillaryViewer = new MapillaryAPI.Viewer({
                    accessToken: this.apiKey,
                    container: container,
                    imageId: imageId,
                    component: {
                        cover: false,
                        direction: true,
                        sequence: true,
                        zoom: true,
                        attribution: true
                    }
                });
                // Setup event listeners
                this.wireViewerEvents();
                console.log(`Successfully loaded Mapillary image: ${imageId}`);
            }
            catch (error) {
                console.error('Error creating Mapillary viewer:', error);
                // Type-safe error handling
                const errorMessage = error instanceof Error
                    ? error.message
                    : 'Unknown error occurred';
                this.showError(`Failed to load street imagery: ${errorMessage}`);
            }
        });
    }
    wireViewerEvents() {
        if (!this.mapillaryViewer)
            return;
        // Listen for position changes using event data (not getState)
        this.mapillaryViewer.on('position', (event) => {
            try {
                // Use event data directly
                if (event && event.latLon) {
                    const p = { lat: event.latLon.lat, lng: event.latLon.lon };
                    this.currentPosition = p;
                    this.setPegmanPosition(p);
                    this.setPegmanVisible(true);
                    if (this.map) {
                        this.map.setView([p.lat, p.lng], this.map.getZoom());
                    }
                    // Mapillary v4+ does not provide camera info in the same way
                    if (this.svChangeCb) {
                        // If event has camera info, use it, else fallback to current heading/pitch
                        const heading = event.bearing || this.currentHeading;
                        const pitch = event.tilt || this.currentPitch;
                        this.svChangeCb(p, heading, pitch);
                    }
                }
            }
            catch (e) {
                console.warn('Error handling position change:', e);
            }
        });
        // Listen for bearing changes using event data
        this.mapillaryViewer.on('bearing', (ev) => {
            try {
                this.currentHeading = ev.bearing || 0;
                if (this.svChangeCb && this.currentPosition) {
                    // Mapillary v4+ does not provide pitch in bearing event, so use currentPitch
                    this.svChangeCb(this.currentPosition, this.currentHeading, this.currentPitch);
                }
            }
            catch (e) {
                console.warn('Error handling bearing change:', e);
            }
        });
    }
    /* ---------------------------------------------- Helper Methods */
    getTileCoordinatesForBounds(bounds, zoom) {
        // Simple tile coordinate calculation
        const tiles = [];
        const nwTile = this.latLngToTile(bounds.getNorthWest(), zoom);
        const seTile = this.latLngToTile(bounds.getSouthEast(), zoom);
        for (let x = nwTile.x; x <= seTile.x; x++) {
            for (let y = nwTile.y; y <= seTile.y; y++) {
                tiles.push({ x, y, z: zoom });
            }
        }
        return tiles;
    }
    latLngToTile(latLng, zoom) {
        const lat = latLng.lat * Math.PI / 180;
        const n = Math.pow(2, zoom);
        const x = Math.floor((latLng.lng + 180) / 360 * n);
        const y = Math.floor((1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2 * n);
        return { x, y };
    }
    /* -------------------------------------------- Map Controls */
    setMapType(id) {
        if (!this.map)
            return;
        const L = window.L;
        this.currentMapType = id;
        if (this.baseTileLayer)
            this.map.removeLayer(this.baseTileLayer);
        if (this.hybridLabelLayer)
            this.map.removeLayer(this.hybridLabelLayer);
        switch (id) {
            case 'satellite':
                this.baseTileLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                    maxZoom: 20,
                    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                    attribution: '&copy; Google Satellite',
                }).addTo(this.map);
                break;
            case 'hybrid':
                this.baseTileLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                    maxZoom: 20,
                    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                    attribution: '&copy; Google Satellite',
                }).addTo(this.map);
                this.hybridLabelLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
                    maxZoom: 20,
                    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                }).addTo(this.map);
                break;
            case 'roadmap':
            default:
                this.baseTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(this.map);
                break;
        }
    }
    addMapControls(L) {
        this.addMapTypeControl(L);
        this.addCoverageToggleControl(L);
    }
    addMapTypeControl(L) {
        const MapTypeControl = L.Control.extend({
            options: { position: 'topright' },
            onAdd: () => {
                const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                div.innerHTML = `
          <select id="mly-maptype" style="height:28px; padding: 4px; border: none;">
            <option value="roadmap">Road</option>
            <option value="satellite">Satellite</option>
            <option value="hybrid">Hybrid</option>
          </select>`;
                L.DomEvent.disableClickPropagation(div);
                const selector = div.querySelector('#mly-maptype');
                if (selector) {
                    selector.value = this.currentMapType;
                    selector.onchange = (e) => {
                        this.setMapType(e.target.value);
                    };
                }
                return div;
            },
        });
        new MapTypeControl().addTo(this.map);
    }
    addCoverageToggleControl(L) {
        const CoverageControl = L.Control.extend({
            options: { position: 'topright' },
            onAdd: () => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                const button = L.DomUtil.create('button', '', container);
                button.innerHTML = '📍 Show Coverage';
                button.style.cssText = 'cursor:pointer;padding:6px 12px;border:none;background:white;color:#05CB63;font-weight:bold;';
                L.DomEvent.on(button, 'click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    L.DomEvent.preventDefault(e);
                    if (this.coverageVisible) {
                        this.hideCoverage();
                        button.innerHTML = '📍 Show Coverage';
                        button.style.color = '#05CB63';
                        button.style.backgroundColor = 'white';
                    }
                    else {
                        this.showCoverage(this.currentPosition || { lat: 0, lng: 0 });
                        button.innerHTML = '❌ Hide Coverage';
                        button.style.color = 'white';
                        button.style.backgroundColor = '#05CB63';
                    }
                });
                return container;
            }
        });
        new CoverageControl().addTo(this.map);
    }
    /* -------------------------------------------- Pegman */
    setPegmanPosition(p) {
        const L = window.L;
        if (!this.map)
            return;
        if (!this.pegmanMarker) {
            const icon = L.icon({
                iconUrl: 'src/pegman.png',
                iconSize: [32, 32],
                iconAnchor: [16, 32],
            });
            this.pegmanMarker = L.marker([p.lat, p.lng], {
                icon,
                draggable: true,
            }).addTo(this.map);
            this.pegmanMarker.on('dragend', (e) => __awaiter(this, void 0, void 0, function* () {
                const q = e.target.getLatLng();
                // Find closest image and load it
                yield this.findAndLoadNearestImage({ lat: q.lat, lng: q.lng });
            }));
        }
        else {
            this.pegmanMarker.setLatLng([p.lat, p.lng]);
        }
    }
    setPegmanVisible(visible) {
        if (this.pegmanMarker) {
            this.pegmanMarker.setOpacity(visible ? 1 : 0);
        }
    }
    /* -------------------------------------------- Event Handlers */
    onMapClick(cb) {
        this.mapClickCb = cb;
    }
    onStreetViewChange(cb) {
        this.svChangeCb = cb;
    }
    /* -------------------------------------------- Utilities */
    showError(message) {
        const container = document.getElementById(this.streetViewContainerId);
        if (container) {
            container.innerHTML = `
        <div style="display:flex;height:100%;align-items:center;justify-content:center;background:#f8f8f8;color:#666;flex-direction:column;padding:20px;text-align:center;">
          <div style="margin-bottom:10px;font-size:24px;">⚠️</div>
          <div>${message}</div>
        </div>
      `;
        }
    }
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            this.hideCoverage();
            if (this.mapillaryViewer) {
                this.mapillaryViewer.remove();
                this.mapillaryViewer = null;
            }
            if (this.map) {
                this.map.remove();
                this.map = null;
            }
        });
    }
}
//# sourceMappingURL=MapillaryMapsProvider.js.map