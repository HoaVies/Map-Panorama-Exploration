import { IMapProvider, LatLng, MapOptions, StreetViewOptions } from './IMapProvider';

export class Map {
    private provider: IMapProvider;
    private mapContainerId: string;
    private streetViewContainerId: string;
    private options: MapOptions;
    private streetViewOptions: StreetViewOptions;
    private isCoverageVisible: boolean = false;
    private currentPosition: LatLng;

    constructor(
        provider: IMapProvider,
        mapContainerId: string,
        streetViewContainerId: string,
        options: MapOptions,
        streetViewOptions: StreetViewOptions
    ) {
        this.provider = provider;
        this.mapContainerId = mapContainerId;
        this.streetViewContainerId = streetViewContainerId;
        this.options = options;
        this.streetViewOptions = streetViewOptions;
        this.currentPosition = streetViewOptions.position;
    }

    public initialize(): void {
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

    private setupEventListeners(): void {
        // Map click handler
        this.provider.onMapClick((position: LatLng) => {
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

        this.provider.onStreetViewChange((position: LatLng, heading: number, pitch: number) => {
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

    public setMapType(mapTypeId: string): void {
        this.provider.setMapType(mapTypeId);
    }

    public setZoom(zoom: number): void {
        this.provider.setZoom(zoom);
    }

    public setCenter(position: LatLng): void {
        this.currentPosition = position;
        this.provider.setCenter(position);
    }

    public showCoverage(position?: LatLng): void {
        this.isCoverageVisible = true;
        this.provider.showCoverage(position || this.currentPosition);
    }

    public hideCoverage(): void {
        this.isCoverageVisible = false;
        this.provider.hideCoverage();
    }
    
    private updateLocationInfo(position: LatLng): void {
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