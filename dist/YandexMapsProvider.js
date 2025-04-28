export class YandexMapsProvider {
    constructor() {
        this.map = null;
        this.panoramaPlayer = null;
        this.pegmanMarker = null;
        this.mapClickCallback = null;
        this.streetViewChangeCallback = null;
        this.mapContainer = null;
        this.panoramaContainer = null;
        this.coverageShown = false;
    }
    initializeMap(containerId, options) {
        this.mapContainer = document.getElementById(containerId);
        if (!this.mapContainer) {
            console.error('Map container not found');
            return;
        }
        // Convert to Yandex format
        const yandexOptions = {
            center: [options.center.lat, options.center.lng],
            zoom: options.zoom,
            type: this.getYandexMapType(options.mapTypeId),
            controls: ['zoomControl', 'fullscreenControl', 'geolocationControl']
        };
        // Create map instance
        this.map = new ymaps.Map(containerId, yandexOptions);
        // Handle map click events
        if (this.map) {
            this.map.events.add('click', (e) => {
                if (this.mapClickCallback) {
                    const coords = e.get('coords');
                    const latLng = {
                        lat: coords[0],
                        lng: coords[1]
                    };
                    this.mapClickCallback(latLng);
                    if (this.pegmanMarker) {
                        this.pegmanMarker.geometry.setCoordinates([latLng.lat, latLng.lng]);
                        this.checkPanoramaAvailability([latLng.lat, latLng.lng]);
                    }
                }
            });
        }
    }
    initializeStreetView(containerId, options) {
        this.panoramaContainer = document.getElementById(containerId);
        if (!this.panoramaContainer || !this.map) {
            console.error('Street view container or map not found');
            return;
        }
        // Create pegman marker
        this.pegmanMarker = new ymaps.Placemark([options.position.lat, options.position.lng], { hintContent: 'Street View Pegman' }, {
            draggable: true,
            preset: 'islands#redDotIcon'
        });
        // Add marker to map
        this.map.geoObjects.add(this.pegmanMarker);
        // Handle pegman drag events
        this.pegmanMarker.events.add('dragend', () => {
            if (!this.pegmanMarker)
                return;
            const coords = this.pegmanMarker.geometry.getCoordinates();
            this.checkPanoramaAvailability(coords);
        });
        // Try to initialize panorama with given position
        this.checkPanoramaAvailability([options.position.lat, options.position.lng]);
    }
    checkPanoramaAvailability(coords) {
        ymaps.panorama.locate(coords).then((panoramas) => {
            if (panoramas.length > 0) {
                if (!this.panoramaContainer)
                    return;
                // If we already have a player, destroy it first
                if (this.panoramaPlayer) {
                    this.panoramaPlayer.destroy();
                    this.panoramaPlayer = null;
                }
                // Create new panorama player
                ymaps.panorama.createPlayer(this.panoramaContainer, coords).then((player) => {
                    this.panoramaPlayer = player;
                    // Setup direction (heading and pitch)
                    const direction = [0, 0]; // Default direction
                    player.setDirection(direction);
                    // Handle panorama position and direction changes
                    player.events.add('directionchange', () => {
                        if (!this.panoramaPlayer || !this.streetViewChangeCallback)
                            return;
                        const position = this.panoramaPlayer.getPosition();
                        const direction = this.panoramaPlayer.getDirection();
                        this.streetViewChangeCallback({ lat: position[0], lng: position[1] }, direction[0], // heading
                        direction[1] // pitch
                        );
                    });
                    // Similar null checks for other event handlers...
                    // Make sure the container exists before modifying its style
                    if (this.panoramaContainer) {
                        this.panoramaContainer.style.display = 'block';
                    }
                });
            }
            else {
                console.warn('No panorama available at this location');
                if (this.panoramaContainer) {
                    this.panoramaContainer.style.display = 'none';
                }
            }
        });
    }
    setCenter(position) {
        if (this.map) {
            this.map.setCenter([position.lat, position.lng]);
        }
    }
    setZoom(zoom) {
        if (this.map) {
            this.map.setZoom(zoom);
        }
    }
    setMapType(mapTypeId) {
        if (this.map) {
            this.map.setType(this.getYandexMapType(mapTypeId));
        }
    }
    setStreetViewPosition(position) {
        if (this.pegmanMarker) {
            this.pegmanMarker.geometry.setCoordinates([position.lat, position.lng]);
        }
        this.checkPanoramaAvailability([position.lat, position.lng]);
    }
    setStreetViewPOV(heading, pitch) {
        if (this.panoramaPlayer) {
            this.panoramaPlayer.setDirection([heading, pitch]);
        }
    }
    setPegmanPosition(position) {
        if (this.pegmanMarker) {
            this.pegmanMarker.geometry.setCoordinates([position.lat, position.lng]);
        }
    }
    setPegmanVisible(visible) {
        if (this.pegmanMarker && this.map) {
            if (visible) {
                this.map.geoObjects.add(this.pegmanMarker);
            }
            else {
                this.map.geoObjects.remove(this.pegmanMarker);
            }
        }
    }
    showCoverage(position) {
        // Yandex doesn't have a direct equivalent to showing street view coverage
        // Instead, we can try to check if panorama is available at the position
        this.coverageShown = true;
        console.warn('Direct panorama coverage display is not available in Yandex Maps API');
    }
    hideCoverage() {
        this.coverageShown = true;
    }
    onMapClick(callback) {
        this.mapClickCallback = callback;
    }
    onStreetViewChange(callback) {
        this.streetViewChangeCallback = callback;
    }
    // Helper method to convert generic map types to Yandex map types
    getYandexMapType(mapTypeId) {
        switch (mapTypeId.toLowerCase()) {
            case 'satellite':
                return 'yandex#satellite';
            case 'hybrid':
                return 'yandex#hybrid';
            case 'terrain':
                return 'yandex#map';
            case 'roadmap':
            default:
                return 'yandex#map';
        }
    }
}
