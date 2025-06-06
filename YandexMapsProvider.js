var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export class YandexMapsProvider {
    constructor() {
        this.map = null;
        this.panoramaPlayer = null;
        this.pegman = null;
        this.mapClickCallback = null;
        this.streetViewChangeCallback = null;
        this.currentPanoramaPosition = null;
        this.panoramaManager = null;
        this.coverageVisible = false;
        this._originalOpenPlayer = null;
        // For POV management
        this.pendingHeading = null;
        this.pendingPitch = null;
        this.pendingPovInterval = null;
        this.coverageToggleButton = null;
        this.lastUserZoom = null;
        this.lastUserCenter = null;
    }
    createCoverageToggleButton() {
        if (!this.map)
            return;
        const mapContainer = this.map.container.getElement();
        if (!mapContainer)
            return;
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'yandex-map-controls';
        controlsContainer.style.position = 'absolute';
        controlsContainer.style.top = '50px'; // Move down to 50px
        controlsContainer.style.left = '10px';
        controlsContainer.style.zIndex = '10000';
        mapContainer.appendChild(controlsContainer);
        this.coverageToggleButton = document.createElement('button');
        this.coverageToggleButton.innerText = this.coverageVisible ?
            'Coverage Map' : 'Coverage Map';
        this.coverageToggleButton.style.padding = '8px 12px';
        this.coverageToggleButton.style.backgroundColor = '#4285f4';
        this.coverageToggleButton.style.color = 'white';
        this.coverageToggleButton.style.border = 'none';
        this.coverageToggleButton.style.borderRadius = '4px';
        this.coverageToggleButton.style.cursor = 'pointer';
        this.coverageToggleButton.style.margin = '5px';
        this.coverageToggleButton.style.fontSize = '14px';
        this.coverageToggleButton.onmouseover = () => {
            if (this.coverageToggleButton)
                this.coverageToggleButton.style.backgroundColor = '#3367d6';
        };
        this.coverageToggleButton.onmouseout = () => {
            if (this.coverageToggleButton)
                this.coverageToggleButton.style.backgroundColor = '#4285f4';
        };
        this.coverageToggleButton.addEventListener('click', () => {
            if (this.coverageVisible) {
                this.hideCoverage();
            }
            else {
                this.showCoverage();
            }
        });
        controlsContainer.appendChild(this.coverageToggleButton);
    }
    initializeMap(containerId, options) {
        ymaps.ready(() => {
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Container element with ID "${containerId}" not found`);
            }
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.minHeight = '300px';
            const center = [options.center.lat, options.center.lng];
            let mapType;
            switch (options.mapTypeId) {
                case 'satellite':
                    mapType = 'yandex#satellite';
                    break;
                case 'hybrid':
                    mapType = 'yandex#hybrid';
                    break;
                default: mapType = 'yandex#map';
            }
            setTimeout(() => {
                try {
                    this.map = new ymaps.Map(container, {
                        center: center,
                        zoom: options.zoom,
                        type: mapType,
                        controls: ['zoomControl', 'fullscreenControl'],
                    });
                    this.createCustomMapTypeControl(container);
                    window.yandexMap = this.map;
                    // Resize event listener to handle layout changes
                    window.addEventListener('resize', () => {
                        if (this.map) {
                            setTimeout(() => {
                                var _a;
                                (_a = this.map) === null || _a === void 0 ? void 0 : _a.container.fitToViewport();
                            }, 100);
                        }
                    });
                    this.pegman = new ymaps.Placemark(center, {
                        hintContent: 'Pegman - Drag to view street panorama'
                    }, {
                        iconLayout: 'default#image',
                        iconImageHref: 'src/pegman.png',
                        iconImageSize: [32, 32],
                        iconImageOffset: [-16, -32],
                        draggable: true,
                    });
                    this.map.geoObjects.add(this.pegman);
                    this.map.getPanoramaManager().then((manager) => {
                        this.panoramaManager = manager;
                        this.createCoverageToggleButton();
                        // Set up event handling for the panorama manager
                        this.setupPanoramaManagerEvents();
                        this.setupMapEventListeners();
                        // Add the pegman event handlers
                        this.setupPegmanEvents();
                    }).catch((error) => {
                        console.error("Error getting panorama manager:", error);
                    });
                }
                catch (error) {
                    console.error("Error creating Yandex map:", error);
                }
            }, 100);
        });
    }
    setupPanoramaManagerEvents() {
        if (!this.panoramaManager)
            return;
        this._originalOpenPlayer = this.panoramaManager.openPlayer;
        // Custom implementation for opening the panorama player
        this.panoramaManager.openPlayer = (panorama, locateOptions, options) => {
            // Only allow the default panorama player when coverage is not enabled
            if (!this.coverageVisible) {
                return this._originalOpenPlayer.call(this.panoramaManager, panorama, locateOptions, options);
            }
            // When coverage is enabled, we handle it 
            console.log('Intercepted panorama open request');
            // Try to get coordinates from the panorama
            if (panorama && typeof panorama.getPosition === 'function') {
                try {
                    const coords = panorama.getPosition();
                    if (coords && coords.length >= 2) {
                        const position = {
                            lat: coords[0],
                            lng: coords[1]
                        };
                        // Move pegman to this position and show our custom panorama
                        this.setPegmanPosition(position);
                        this.setPegmanVisible(true);
                        this.setStreetViewPosition(position);
                        // Call the map click callback if registered
                        if (this.mapClickCallback) {
                            this.mapClickCallback(position);
                        }
                    }
                }
                catch (e) {
                    console.warn('Error getting panorama coordinates:', e);
                }
            }
            return Promise.resolve();
        };
        this.panoramaManager.events.add('openplayer', (e) => {
            if (this.map) {
                this.lastUserZoom = this.map.getZoom();
                this.lastUserCenter = this.map.getCenter();
                console.log('Stored user zoom level:', this.lastUserZoom);
            }
        });
        // When closing, restore with a longer timeout
        this.panoramaManager.events.add('closeplayer', (e) => {
            // Use stored values (not the current ones which might already be changed)
            if (this.map && this.lastUserZoom !== null && this.lastUserCenter !== null) {
                console.log('Will restore zoom to:', this.lastUserZoom);
                // Timeout to make sure Yandex's handlers are done
                setTimeout(() => {
                    if (this.map) {
                        // Restore center first
                        this.map.setCenter(this.lastUserCenter);
                        // Then zoom
                        this.map.setZoom(this.lastUserZoom);
                        console.log('Zoom restored to:', this.lastUserZoom);
                    }
                }, 150);
                setTimeout(() => {
                    if (this.map) {
                        this.map.setZoom(this.lastUserZoom);
                    }
                }, 300);
            }
        });
        this.panoramaManager.events.add('locate', (e) => {
            if (!this.coverageVisible)
                return;
            console.log('Panorama locate event intercepted');
            const point = e.get('point');
            if (point && point.length >= 2) {
                const position = {
                    lat: point[0],
                    lng: point[1]
                };
                // Call our map click handler
                if (this.mapClickCallback) {
                    this.mapClickCallback(position);
                }
                e.preventDefault();
            }
        });
        // Add an additional event handler for locatesuccess (when panoramas are found)
        this.panoramaManager.events.add('locatesuccess', (e) => {
            if (!this.coverageVisible)
                return;
            console.log('Panorama locate success intercepted');
            const result = e.get('result');
            if (result && result.length > 0) {
                const panorama = result[0];
                if (panorama && typeof panorama.getPosition === 'function') {
                    try {
                        const coords = panorama.getPosition();
                        if (coords && coords.length >= 2) {
                            const position = {
                                lat: coords[0],
                                lng: coords[1]
                            };
                            // Ensure pegman is positioned correctly
                            this.setPegmanPosition(position);
                        }
                    }
                    catch (err) {
                        console.warn('Error handling panorama locate success:', err);
                    }
                }
            }
        });
    }
    setupPegmanEvents() {
        if (!this.pegman)
            return;
        this.pegman.events.add('dragend', () => {
            if (!this.pegman)
                return;
            const coords = this.pegman.geometry.getCoordinates();
            const position = {
                lat: coords[0],
                lng: coords[1]
            };
            this.setStreetViewPosition(position);
        });
        this.pegman.events.add('click', (e) => {
            // If the pegman is already at a valid position, clicking it should
            // just focus or show the streetview that's already there
            if (this.panoramaPlayer) {
                // Ensure the street view is visible
                const container = document.getElementById('street-view-container');
                if (container) {
                    container.style.display = 'block';
                }
                // Get current position and notify listeners
                if (this.currentPanoramaPosition && this.streetViewChangeCallback) {
                    const direction = this.panoramaPlayer.getDirection();
                    this.streetViewChangeCallback(this.currentPanoramaPosition, direction[0], direction[1]);
                }
                // Prevent the map click from firing
                e.stopPropagation();
            }
        });
    }
    setupMapEventListeners() {
        if (!this.map)
            return;
        // Handle map clicks
        this.map.events.add('click', (e) => {
            // Get click coordinates
            const coords = e.get('coords');
            const position = { lat: coords[0], lng: coords[1] };
            // If coverage is enabled, check for panorama at the click location
            if (this.coverageVisible) {
                ymaps.panorama.locate(coords).then((panoramas) => {
                    if (panoramas && panoramas.length > 0) {
                        // Move pegman to this location and update panorama
                        this.setPegmanPosition(position);
                        this.setPegmanVisible(true);
                        this.setStreetViewPosition(position);
                        // Call map click callback if registered
                        if (this.mapClickCallback) {
                            this.mapClickCallback(position);
                        }
                    }
                }).catch((error) => {
                    console.error('Error checking for panorama at location:', error);
                });
                // Prevent default handling of the click
                e.preventDefault();
                return false;
            }
            // Handle regular clicks - check if there's a panorama here
            // This allows users to click anywhere on the map to place the pegman
            ymaps.panorama.locate(coords).then((panoramas) => {
                if (panoramas && panoramas.length > 0) {
                    // Move pegman to this location
                    this.setPegmanPosition(position);
                    this.setPegmanVisible(true);
                    // Add a visual indication that this location has a panorama
                    if (this.pegman) {
                        this.pegman.options.set('iconImageSize', [40, 40]);
                        setTimeout(() => {
                            if (this.pegman)
                                this.pegman.options.set('iconImageSize', [32, 32]);
                        }, 300);
                    }
                }
            });
            // Forward regular clicks to the callback
            if (this.mapClickCallback) {
                this.mapClickCallback(position);
            }
        });
    }
    setCenter(position) {
        if (!this.map)
            return;
        this.map.setCenter([position.lat, position.lng]);
    }
    setZoom(zoom) {
        if (!this.map)
            return;
        this.map.setZoom(zoom);
    }
    setMapType(mapTypeId) {
        if (!this.map)
            return;
        let mapType;
        switch (mapTypeId) {
            case 'satellite':
                mapType = 'yandex#satellite';
                break;
            case 'hybrid':
                mapType = 'yandex#hybrid';
                break;
            default: mapType = 'yandex#map';
        }
        this.map.setType(mapType);
    }
    initializeStreetView(containerId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                ymaps.ready(() => __awaiter(this, void 0, void 0, function* () {
                    const container = document.getElementById(containerId);
                    if (!container) {
                        throw new Error(`Container element with ID "${containerId}" not found`);
                    }
                    container.style.width = '100%';
                    container.style.height = '100%';
                    container.style.minHeight = '300px';
                    container.style.display = 'block';
                    setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            const position = [options.position.lat, options.position.lng];
                            this.pendingHeading = options.pov.heading;
                            this.pendingPitch = options.pov.pitch;
                            const panoramas = yield ymaps.panorama.locate(position);
                            if (panoramas && panoramas.length > 0) {
                                this.panoramaPlayer = new ymaps.panorama.Player(container, panoramas[0], {
                                    direction: [options.pov.heading, options.pov.pitch],
                                    controls: ['zoomControl', 'fullscreenControl'],
                                    suppressMapOpenBlock: true,
                                    width: container.offsetWidth || 640,
                                    height: container.offsetHeight || 480,
                                    hotkeysEnabled: false
                                });
                                this.currentPanoramaPosition = options.position;
                                this.setupPanoramaEventListeners();
                                this.setPegmanPosition(options.position);
                                this.setPegmanVisible(true);
                            }
                        }
                        catch (error) {
                            console.error('Error initializing Yandex panorama:', error);
                            container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; background:#f5f5f5;">
                            <p>Error loading street view</p>
                        </div>`;
                        }
                        resolve();
                    }), 100);
                }));
            });
        });
    }
    setStreetViewPosition(position) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.panoramaPlayer) {
                const currentDirection = this.panoramaPlayer.getDirection();
                this.pendingHeading = currentDirection[0];
                this.pendingPitch = currentDirection[1];
            }
            const yandexPosition = [position.lat, position.lng];
            try {
                const panoramas = yield ymaps.panorama.locate(yandexPosition);
                if (panoramas && panoramas.length > 0) {
                    if (this.panoramaPlayer) {
                        yield this.panoramaPlayer.setPanorama(panoramas[0]);
                    }
                    else {
                        const container = document.getElementById('street-view-container');
                        if (container) {
                            this.panoramaPlayer = new ymaps.panorama.Player(container, panoramas[0], {
                                direction: this.pendingHeading !== null && this.pendingPitch !== null ?
                                    [this.pendingHeading, this.pendingPitch] : 'auto',
                                controls: ['zoomControl', 'fullscreenControl'],
                                suppressMapOpenBlock: true,
                                hotkeysEnabled: false,
                            });
                            this.setupPanoramaEventListeners();
                        }
                    }
                    this.currentPanoramaPosition = position;
                    if (this.pendingHeading !== null && this.pendingPitch !== null) {
                        setTimeout(() => this.applyPendingPov(), 500);
                    }
                    if (this.streetViewChangeCallback && this.panoramaPlayer) {
                        const direction = this.panoramaPlayer.getDirection();
                        this.streetViewChangeCallback(position, direction[0], direction[1]);
                    }
                    const container = document.getElementById('street-view-container');
                    if (container) {
                        container.style.display = 'block';
                    }
                    this.setPegmanVisible(true);
                }
                else {
                    console.log('No panorama available at the requested position');
                    if (this.panoramaPlayer) {
                        try {
                            if (typeof this.panoramaPlayer.destroy === 'function') {
                                this.panoramaPlayer.destroy();
                            }
                        }
                        catch (e) {
                            console.warn('Error destroying panorama player:', e);
                        }
                        this.panoramaPlayer = null;
                    }
                    const container = document.getElementById('street-view-container');
                    if (container) {
                        container.innerHTML = '';
                        container.style.display = 'block';
                        container.style.backgroundColor = '#f5f5f5';
                    }
                }
            }
            catch (error) {
                console.error('Error updating Yandex panorama position:', error);
            }
        });
    }
    setStreetViewPOV(heading, pitch) {
        this.pendingHeading = heading;
        this.pendingPitch = pitch;
        if (this.panoramaPlayer) {
            this.applyPendingPov();
        }
    }
    setPegmanPosition(position) {
        if (!this.pegman)
            return;
        this.pegman.geometry.setCoordinates([position.lat, position.lng]);
    }
    setPegmanVisible(visible) {
        if (!this.pegman || !this.map)
            return;
        try {
            if (visible) {
                this.pegman.options.set('visible', true);
                if (this.map && !this.pegman.getMap()) {
                    this.map.geoObjects.add(this.pegman);
                }
            }
            else {
                this.pegman.options.set('visible', false);
            }
        }
        catch (e) {
            console.warn('Error setting pegman visibility:', e);
        }
    }
    showCoverage(position) {
        if (!this.map || !this.panoramaManager)
            return;
        // Enable panorama lookup to show the blue lines
        this.panoramaManager.enableLookup();
        this.coverageVisible = true;
        // Immediately after enabling lookup, check if there's already a player open
        const currentPlayer = this.panoramaManager.getPlayer();
        if (currentPlayer) {
            // Force close any existing panorama player
            this.panoramaManager.closePlayer();
        }
        // Monitor for player creation
        const checkForPlayer = setInterval(() => {
            if (!this.coverageVisible) {
                clearInterval(checkForPlayer);
                return;
            }
            const player = this.panoramaManager.getPlayer();
            if (player) {
                console.log('Detected panorama player - closing it');
                this.panoramaManager.closePlayer();
            }
        }, 500);
    }
    hideCoverage() {
        if (!this.map || !this.panoramaManager)
            return;
        this.coverageVisible = false;
        this.panoramaManager.disableLookup();
        if (this.coverageToggleButton) {
            this.coverageToggleButton.innerText = 'Coverage Map';
        }
    }
    onMapClick(callback) {
        this.mapClickCallback = callback;
    }
    onStreetViewChange(callback) {
        this.streetViewChangeCallback = callback;
    }
    setupPanoramaEventListeners() {
        if (!this.panoramaPlayer)
            return;
        // Pegman sync
        this.panoramaPlayer.events.add('position_changed', () => {
            var _a;
            try {
                // Get panorama position DIRECTLY from the player
                const panorama = (_a = this.panoramaPlayer) === null || _a === void 0 ? void 0 : _a.getPanorama();
                if (!panorama)
                    return;
                // Get position using the correct API call
                const position = panorama.getPosition();
                if (!position || position.length < 2)
                    return;
                // Create position object
                const latLng = {
                    lat: position[0],
                    lng: position[1]
                };
                console.log('Yandex panorama position changed:', latLng);
                // Update stored position
                this.currentPanoramaPosition = latLng;
                // Update pegman position - this is the critical line
                if (this.pegman) {
                    this.pegman.geometry.setCoordinates([latLng.lat, latLng.lng]);
                    this.setPegmanVisible(true);
                }
                // Update map center
                if (this.map) {
                    this.map.setCenter([latLng.lat, latLng.lng]);
                }
                // Call the registered callback
                if (this.streetViewChangeCallback && this.panoramaPlayer) {
                    const direction = this.panoramaPlayer.getDirection();
                    this.streetViewChangeCallback(latLng, direction[0], direction[1]);
                }
            }
            catch (error) {
                console.error('Error handling position change:', error);
            }
        });
        // Add listener for navigation links in panorama
        this.panoramaPlayer.events.add('panoramachange', () => {
            setTimeout(() => {
                try {
                    if (!this.panoramaPlayer)
                        return;
                    // Get the new panorama object
                    const panorama = this.panoramaPlayer.getPanorama();
                    if (!panorama)
                        return;
                    // Get the position
                    const position = panorama.getPosition();
                    if (!position || position.length < 2)
                        return;
                    // Update pegman position
                    if (this.pegman) {
                        this.pegman.geometry.setCoordinates([position[0], position[1]]);
                        this.setPegmanVisible(true);
                    }
                    // Store current position
                    this.currentPanoramaPosition = {
                        lat: position[0],
                        lng: position[1]
                    };
                    // Apply pending POV
                    if (this.pendingHeading !== null && this.pendingPitch !== null) {
                        this.applyPendingPov();
                    }
                }
                catch (error) {
                    console.error('Error in panoramachange event:', error);
                }
            }, 200);
        });
        // Direction change event
        this.panoramaPlayer.events.add('directionchange', () => {
            if (!this.panoramaPlayer || !this.currentPanoramaPosition)
                return;
            const direction = this.panoramaPlayer.getDirection();
            if (this.streetViewChangeCallback) {
                this.streetViewChangeCallback(this.currentPanoramaPosition, direction[0], direction[1]);
            }
        });
    }
    applyPendingPov() {
        if (!this.panoramaPlayer || this.pendingHeading === null || this.pendingPitch === null)
            return;
        // Clear existing interval
        if (this.pendingPovInterval) {
            clearInterval(this.pendingPovInterval);
            this.pendingPovInterval = null;
        }
        // Apply the POV immediately
        try {
            this.panoramaPlayer.setDirection([this.pendingHeading, this.pendingPitch]);
        }
        catch (e) {
            console.warn('Error setting panorama direction:', e);
        }
        // Clear pending values
        this.pendingHeading = null;
        this.pendingPitch = null;
    }
    createCustomMapTypeControl(container) {
        var _a;
        const controlContainer = document.createElement('div');
        controlContainer.className = 'custom-map-type-control';
        controlContainer.style.position = 'absolute';
        controlContainer.style.top = '10px';
        controlContainer.style.left = '10px';
        controlContainer.style.backgroundColor = 'white';
        controlContainer.style.borderRadius = '2px';
        controlContainer.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.3)';
        controlContainer.style.zIndex = '10000';
        controlContainer.style.display = 'flex';
        const mapTypes = [
            { id: 'roadmap', title: 'Map', type: 'yandex#map' },
            { id: 'satellite', title: 'Satellite', type: 'yandex#satellite' },
        ];
        const currentType = ((_a = this.map) === null || _a === void 0 ? void 0 : _a.getType()) || 'yandex#map';
        mapTypes.forEach((mapType, index) => {
            const button = document.createElement('button');
            button.innerText = mapType.title;
            button.className = 'map-type-button';
            button.style.padding = '8px 16px';
            button.style.margin = '0';
            button.style.backgroundColor = mapType.type === currentType ? '#e6e6e6' : 'white';
            button.style.color = '#000';
            button.style.border = 'none';
            button.style.borderRight = index < mapTypes.length - 1 ? '1px solid #ccc' : 'none';
            button.style.cursor = 'pointer';
            button.style.fontSize = '13px';
            button.style.fontFamily = 'Arial, sans-serif';
            button.style.outline = 'none';
            button.addEventListener('click', () => {
                this.setMapType(mapType.id);
                const buttons = controlContainer.getElementsByClassName('map-type-button');
                for (let i = 0; i < buttons.length; i++) {
                    buttons[i].style.backgroundColor = 'white';
                }
                button.style.backgroundColor = '#e6e6e6';
            });
            controlContainer.appendChild(button);
        });
        container.appendChild(controlContainer);
    }
}
//# sourceMappingURL=YandexMapsProvider.js.map