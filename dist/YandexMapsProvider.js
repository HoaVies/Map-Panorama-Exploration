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
        this.coverageLayer = null;
        this.isCoverageVisible = false;
        // Constructor doesn't need parameters as the API key is loaded in the HTML
    }
    initializeMap(containerId, options) {
        ymaps.ready(() => {
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Container element with ID "${containerId}" not found`);
            }
            // Ensure container has proper dimensions (if needed)
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.minHeight = '300px';
            const center = [options.center.lat, options.center.lng];
            console.log("Initializing Yandex Map with center:", center);
            // Use CORRECT Yandex map type format
            let mapType;
            switch (options.mapTypeId) {
                case 'roadmap':
                    mapType = 'yandex#map'; // FIXED: Added 'yandex#' prefix
                    break;
                case 'satellite':
                    mapType = 'yandex#satellite'; // FIXED: Added 'yandex#' prefix
                    break;
                case 'hybrid':
                    mapType = 'yandex#hybrid'; // FIXED: Added 'yandex#' prefix
                    break;
                default:
                    mapType = 'yandex#map'; // FIXED: Added 'yandex#' prefix
            }
            // Add short delay to ensure DOM is ready
            setTimeout(() => {
                try {
                    // Initialize Yandex Map
                    this.map = new ymaps.Map(container, {
                        center: center,
                        zoom: options.zoom,
                        type: mapType, // FIXED: Using correct map type
                        controls: ['zoomControl', 'fullscreenControl', 'typeSelector']
                    });
                    console.log("Yandex Map created successfully");
                    // Create pegman marker
                    this.pegman = new ymaps.Placemark(center, {
                        hintContent: 'Pegman - Drag to view street panorama'
                    }, {
                        preset: 'islands#bluePersonIcon',
                        draggable: true
                    });
                    // Add pegman to the map
                    this.map.geoObjects.add(this.pegman);
                    // Set up event listeners for the map
                    this.setupMapEventListeners();
                }
                catch (error) {
                    console.error("Error creating Yandex map:", error);
                }
            }, 100); // Small delay to ensure DOM is ready
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
        this.map.setCenter(this.map.getCenter(), zoom);
    }
    setMapType(mapTypeId) {
        if (!this.map)
            return;
        // Map the mapTypeId to Yandex equivalent
        let mapType;
        switch (mapTypeId) {
            case 'roadmap':
                mapType = 'yandex#map';
                break;
            case 'satellite':
                mapType = 'yandex#satellite';
                break;
            case 'hybrid':
                mapType = 'yandex#hybrid';
                break;
            default:
                mapType = 'yandex#map';
        }
        this.map.setType(mapType);
    }
    initializeStreetView(containerId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                ymaps.ready(() => __awaiter(this, void 0, void 0, function* () {
                    // Get container element
                    const container = document.getElementById(containerId);
                    if (!container) {
                        throw new Error(`Container element with ID "${containerId}" not found`);
                    }
                    // Convert position format
                    const position = [options.position.lat, options.position.lng];
                    try {
                        // Find available panoramas at the specified position
                        const panoramas = yield ymaps.panorama.locate(position);
                        if (panoramas && panoramas.length > 0) {
                            // Create panorama player
                            this.panoramaPlayer = new ymaps.panorama.Player(container, panoramas[0], {
                                direction: [options.pov.heading, options.pov.pitch],
                                controls: ['zoomControl', 'fullscreenControl']
                            });
                            // Store the current panorama position
                            this.currentPanoramaPosition = options.position;
                            // Set up event listeners for the panorama
                            this.setupPanoramaEventListeners();
                        }
                        else {
                            // No panorama available - show a message
                            container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; background:#f5f5f5;">
                            <p>No street view available at this location</p>
                        </div>`;
                        }
                    }
                    catch (error) {
                        console.error('Error initializing Yandex panorama:', error);
                        container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; background:#f5f5f5;">
                        <p>Error loading street view</p>
                    </div>`;
                    }
                    resolve();
                }));
            });
        });
    }
    setStreetViewPosition(position) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.panoramaPlayer) {
                // If panorama player doesn't exist yet, initialize it
                yield this.initializeStreetView('street-view-container', {
                    position: position,
                    pov: { heading: 0, pitch: 0 }
                });
                return;
            }
            // Convert position format
            const yandexPosition = [position.lat, position.lng];
            try {
                // Find available panoramas at the new position
                const panoramas = yield ymaps.panorama.locate(yandexPosition);
                if (panoramas && panoramas.length > 0) {
                    // Update panorama
                    yield this.panoramaPlayer.setPanorama(panoramas[0]);
                    // Store the current panorama position
                    this.currentPanoramaPosition = position;
                    // Notify about street view change if callback is registered
                    if (this.streetViewChangeCallback && this.panoramaPlayer) {
                        const direction = this.panoramaPlayer.getDirection();
                        this.streetViewChangeCallback(position, direction[0], // heading
                        direction[1] // pitch
                        );
                    }
                }
                else {
                    console.log('No panorama available at the requested position');
                    // Get the container element
                    const container = document.getElementById('street-view-container');
                    if (container) {
                        container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; background:#f5f5f5;">
                        <p>No street view available at this location</p>
                    </div>`;
                    }
                }
            }
            catch (error) {
                console.error('Error updating Yandex panorama position:', error);
            }
        });
    }
    setStreetViewPOV(heading, pitch) {
        if (!this.panoramaPlayer)
            return;
        this.panoramaPlayer.setDirection([heading, pitch]);
    }
    setPegmanPosition(position) {
        if (!this.pegman)
            return;
        this.pegman.geometry.setCoordinates([position.lat, position.lng]);
    }
    setPegmanVisible(visible) {
        if (!this.pegman)
            return;
        // Yandex Maps doesn't directly support changing visibility of a placemark
        // As a workaround, we add or remove it from the map
        if (visible) {
            if (this.map) {
                this.map.geoObjects.add(this.pegman);
            }
        }
        else {
            if (this.map) {
                this.map.geoObjects.remove(this.pegman);
            }
        }
    }
    showCoverage(position) {
        this.isCoverageVisible = true;
        // Note: Yandex Maps doesn't have a built-in coverage layer like Google Maps
        // As a workaround, we can try to show places where panorama is available
        // This would ideally involve querying multiple points around the area
        // and indicating where panoramas exist
        // For simplicity in this implementation, we just log this action
        console.log('Showing coverage around', position);
        // You could implement a custom coverage visualization here
        // For example, by checking panorama availability in a grid and drawing
        // colored polygons where panoramas are available
    }
    hideCoverage() {
        this.isCoverageVisible = false;
        // If you implemented a custom coverage visualization, you would hide it here
        console.log('Hiding coverage layer');
    }
    onMapClick(callback) {
        this.mapClickCallback = callback;
    }
    onStreetViewChange(callback) {
        this.streetViewChangeCallback = callback;
    }
    setupMapEventListeners() {
        if (!this.map)
            return;
        // Handle map clicks
        this.map.events.add('click', (e) => {
            const coords = e.get('coords');
            const position = { lat: coords[0], lng: coords[1] };
            // Call the registered callback
            if (this.mapClickCallback) {
                this.mapClickCallback(position);
            }
            // Handle Shift+click directly (as specified in requirements)
            // Note: The shift detection is already handled in index.ts
            const originalEvent = e.get('domEvent').originalEvent;
            if (originalEvent && originalEvent.shiftKey) {
                // Drop pegman at click location and show street view
                this.setPegmanPosition(position);
                this.setPegmanVisible(true);
                this.setStreetViewPosition(position);
            }
        });
        // Handle pegman drag
        if (this.pegman) {
            this.pegman.events.add('dragend', (e) => {
                if (!this.pegman)
                    return;
                const coords = this.pegman.geometry.getCoordinates();
                const position = { lat: coords[0], lng: coords[1] };
                // Update street view to the dragged position
                this.setStreetViewPosition(position);
            });
        }
    }
    setupPanoramaEventListeners() {
        if (!this.panoramaPlayer)
            return;
        // Listen for panorama position changes
        this.panoramaPlayer.events.add('positionchange', () => {
            if (!this.panoramaPlayer || !this.currentPanoramaPosition)
                return;
            try {
                // Get the new panorama object
                const panorama = this.panoramaPlayer.getPanorama();
                // Get the position from the panorama
                const position = panorama.getPosition();
                const latLng = {
                    lat: position[0],
                    lng: position[1]
                };
                // Update stored position
                this.currentPanoramaPosition = latLng;
                // Update pegman position
                this.setPegmanPosition(latLng);
                // Call the registered callback
                if (this.streetViewChangeCallback) {
                    const direction = this.panoramaPlayer.getDirection();
                    this.streetViewChangeCallback(latLng, direction[0], // heading
                    direction[1] // pitch
                    );
                }
            }
            catch (error) {
                console.error('Error handling panorama position change:', error);
            }
        });
        // Listen for direction changes
        this.panoramaPlayer.events.add('directionchange', () => {
            if (!this.panoramaPlayer || !this.currentPanoramaPosition)
                return;
            // Get current direction
            const direction = this.panoramaPlayer.getDirection();
            // Update pegman orientation (visual rotation)
            // Note: This is challenging with Yandex Maps as it doesn't directly
            // support rotating markers. You could implement a custom marker with
            // rotation if needed.
            // Call the registered callback
            if (this.streetViewChangeCallback) {
                this.streetViewChangeCallback(this.currentPanoramaPosition, direction[0], // heading
                direction[1] // pitch
                );
            }
        });
    }
}
