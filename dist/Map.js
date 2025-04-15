export class Map {
    constructor(provider, mapContainerId, streetViewContainerId, options, streetViewOptions) {
        this.isCoverageVisible = false;
        this.provider = provider;
        this.mapContainerId = mapContainerId;
        this.streetViewContainerId = streetViewContainerId;
        this.options = options;
        this.streetViewOptions = streetViewOptions;
        this.currentPosition = streetViewOptions.position;
    }
    initialize() {
        // Initialize map
        this.provider.initializeMap(this.mapContainerId, this.options);
        // Initialize street view
        this.provider.initializeStreetView(this.streetViewContainerId, this.streetViewOptions);
        // Set up event listeners
        this.setupEventListeners();
        // Make pegman visible initially
        this.provider.setPegmanVisible(true);
        // Update location info if we have an HTML element for it
        this.updateLocationInfo(this.currentPosition);
    }
    setupEventListeners() {
        // Map click handler
        this.provider.onMapClick((position) => {
            this.currentPosition = position;
            // Update pegman and street view
            this.provider.setPegmanPosition(position);
            this.provider.setPegmanVisible(true);
            this.provider.setStreetViewPosition(position);
            // If coverage is being shown, update it
            if (this.isCoverageVisible) {
                this.showCoverage(position);
            }
            this.updateLocationInfo(position);
        });
        this.provider.onStreetViewChange((position, heading, pitch) => {
            this.currentPosition = position;
            // Update map center and pegman
            this.provider.setCenter(position);
            this.provider.setPegmanPosition(position);
            this.provider.setPegmanVisible(true);
            this.provider.setStreetViewPOV(heading, pitch);
            // If coverage is being shown, update it
            if (this.isCoverageVisible) {
                this.showCoverage(position);
            }
            // Update location info
            this.updateLocationInfo(position);
        });
    }
    setMapType(mapTypeId) {
        this.provider.setMapType(mapTypeId);
    }
    setZoom(zoom) {
        this.provider.setZoom(zoom);
    }
    setCenter(position) {
        this.currentPosition = position;
        this.provider.setCenter(position);
    }
    showCoverage(position) {
        this.isCoverageVisible = true;
        this.provider.showCoverage(position || this.currentPosition);
    }
    hideCoverage() {
        this.isCoverageVisible = false;
        this.provider.hideCoverage();
    }
    updateLocationInfo(position) {
        const infoElement = document.getElementById('location-info');
        if (infoElement) {
            infoElement.innerHTML = `Lat: ${position.lat.toFixed(6)}, Lng: ${position.lng.toFixed(6)}`;
            infoElement.style.display = 'block';
            // For simplicity, we'll just position it at the top-right of the map
            const mapElement = document.getElementById(this.mapContainerId);
            if (mapElement) {
                const rect = mapElement.getBoundingClientRect();
                infoElement.style.top = `${rect.top + 10}px`;
                infoElement.style.left = `${rect.right - infoElement.offsetWidth - 10}px`;
            }
            setTimeout(() => {
                infoElement.style.display = 'none';
            }, 3000);
        }
    }
}
