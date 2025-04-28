// Fixes for the KakaoMapsProvider to address the coverage toggle and position update issues

import { IMapProvider, LatLng, MapOptions, StreetViewOptions } from './IMapProvider.js';

export class KakaoMapsProvider implements IMapProvider {
    private map: kakao.maps.Map | null = null;
    private roadview: kakao.maps.Roadview | null = null;
    private roadviewClient: kakao.maps.RoadviewClient | null = null;
    private pegmanMarker: kakao.maps.Marker | null = null;
    private mapClickCallback: ((position: LatLng) => void) | null = null;
    private roadviewChangeCallback: ((position: LatLng, heading: number, pitch: number) => void) | null = null;
    private roadviewControl: HTMLElement | null = null;
    private mapTypeControl: HTMLElement | null = null;
    private terrainCheckbox: HTMLInputElement | null = null;
    private overlayOn: boolean = false;
    private isProcessingEvent: boolean = false;
    private hasInitializedRoadviewListener: boolean = false;
    private currentPosition: LatLng | null = null;

    public initializeMap(containerId: string, options: MapOptions): void {
        const mapContainer = document.getElementById(containerId);
        if (!mapContainer) {
            console.error('Map container not found');
            return;
        }

        const mapOptions = {
            center: new kakao.maps.LatLng(options.center.lat, options.center.lng),
            level: this.convertZoomToLevel(options.zoom)
        };

        this.map = new kakao.maps.Map(mapContainer, mapOptions);
        this.roadviewClient = new kakao.maps.RoadviewClient();
        this.currentPosition = options.center;
        
        // Set map type
        this.setMapType(options.mapTypeId);
        
        // Create and add the roadview control button
        this.createRoadviewControl(mapContainer);
        
        // Create and add the custom map type controls
        this.createCustomMapTypeControls(mapContainer);

        // Initialize click handler
        this.setupMapClickHandler();
        
        // Ensure overlay is initially off
        this.overlayOn = false;
        if (this.map) {
            this.map.removeOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);
        }
    }

    private createRoadviewControl(mapContainer: HTMLElement): void {
        // Create the roadview control button
        this.roadviewControl = document.createElement('div');
        this.roadviewControl.id = 'roadviewControl';
        this.roadviewControl.style.position = 'absolute';
        this.roadviewControl.style.top = '10px';
        this.roadviewControl.style.left = '10px';
        this.roadviewControl.style.width = '42px';
        this.roadviewControl.style.height = '42px';
        this.roadviewControl.style.zIndex = '2';
        this.roadviewControl.style.cursor = 'pointer';
        this.roadviewControl.style.background = 'url(https://t1.daumcdn.net/localimg/localimages/07/2018/pc/common/img_search.png) 0 -450px no-repeat';
        this.roadviewControl.style.backgroundColor = 'white';
        this.roadviewControl.style.borderRadius = '4px';
        this.roadviewControl.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
        
        this.roadviewControl.addEventListener('click', () => this.toggleRoadviewOverlay());
        mapContainer.appendChild(this.roadviewControl);
    }

    private createCustomMapTypeControls(mapContainer: HTMLElement): void {
        if (!this.map) return;

        // Create container for map type controls
        this.mapTypeControl = document.createElement('div');
        this.mapTypeControl.style.position = 'absolute';
        this.mapTypeControl.style.top = '10px';
        this.mapTypeControl.style.left = '65px'; // Position to the right of roadview control
        this.mapTypeControl.style.backgroundColor = 'white';
        this.mapTypeControl.style.borderRadius = '4px';
        this.mapTypeControl.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
        this.mapTypeControl.style.zIndex = '2';
        this.mapTypeControl.style.padding = '10px';
        this.mapTypeControl.style.display = 'flex';
        this.mapTypeControl.style.flexDirection = 'column';
        
        // Add map/satellite radio buttons
        const mapTypeOptions = document.createElement('div');
        mapTypeOptions.style.marginBottom = '8px';
        
        // Map radio button
        const mapRadio = document.createElement('input');
        mapRadio.type = 'radio';
        mapRadio.id = 'mapType';
        mapRadio.name = 'mapType';
        mapRadio.checked = this.map.getMapTypeId() === kakao.maps.MapTypeId.ROADMAP;
        mapRadio.addEventListener('change', () => {
            this.setMapType('roadmap');
        });
        
        const mapLabel = document.createElement('label');
        mapLabel.htmlFor = 'mapType';
        mapLabel.textContent = 'Map';
        mapLabel.style.marginLeft = '5px';
        mapLabel.style.marginRight = '10px';
        
        // Satellite radio button
        const satelliteRadio = document.createElement('input');
        satelliteRadio.type = 'radio';
        satelliteRadio.id = 'satelliteType';
        satelliteRadio.name = 'mapType';
        satelliteRadio.checked = this.map.getMapTypeId() === kakao.maps.MapTypeId.SKYVIEW;
        satelliteRadio.addEventListener('change', () => {
            this.setMapType('satellite');
        });
        
        const satelliteLabel = document.createElement('label');
        satelliteLabel.htmlFor = 'satelliteType';
        satelliteLabel.textContent = 'Satellite';
        satelliteLabel.style.marginLeft = '5px';
        
        mapTypeOptions.appendChild(mapRadio);
        mapTypeOptions.appendChild(mapLabel);
        mapTypeOptions.appendChild(satelliteRadio);
        mapTypeOptions.appendChild(satelliteLabel);
        
        // Add terrain checkbox
        const terrainOption = document.createElement('div');
        
        this.terrainCheckbox = document.createElement('input');
        this.terrainCheckbox.type = 'checkbox';
        this.terrainCheckbox.id = 'terrainType';
        this.terrainCheckbox.addEventListener('change', (e) => {
            if (!this.map) return;
            
            if ((e.target as HTMLInputElement).checked) {
                this.map.addOverlayMapTypeId(kakao.maps.MapTypeId.TERRAIN);
            } else {
                this.map.removeOverlayMapTypeId(kakao.maps.MapTypeId.TERRAIN);
            }
        });
        
        const terrainLabel = document.createElement('label');
        terrainLabel.htmlFor = 'terrainType';
        terrainLabel.textContent = 'Terrain';
        terrainLabel.style.marginLeft = '5px';
        
        terrainOption.appendChild(this.terrainCheckbox);
        terrainOption.appendChild(terrainLabel);
        
        // Add elements to control container
        this.mapTypeControl.appendChild(mapTypeOptions);
        this.mapTypeControl.appendChild(terrainOption);
        
        // Add to map container
        mapContainer.appendChild(this.mapTypeControl);
    }

    private toggleRoadviewOverlay(): void {
        if (!this.roadviewControl || !this.map) return;
        
        // Toggle the overlay state
        this.overlayOn = !this.overlayOn;
        
        // Toggle button active state
        if (this.overlayOn) {
            this.roadviewControl.className = 'active';
            this.roadviewControl.style.backgroundPosition = '0 -350px';
            this.showCoverage(this.currentPosition || undefined);
        } else {
            this.roadviewControl.className = '';
            this.roadviewControl.style.backgroundPosition = '0 -450px';
            this.hideCoverage();
        }
    }

    public showCoverage(position?: LatLng): void {
        if (!this.map) return;
        
        this.overlayOn = true;
        
        // Update the roadview control appearance
        if (this.roadviewControl) {
            this.roadviewControl.className = 'active';
            this.roadviewControl.style.backgroundPosition = '0 -350px';
        }
        
        // Add roadview overlay to map
        this.map.addOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);
        
        // Show pegman marker on map
        if (this.pegmanMarker) {
            this.pegmanMarker.setMap(this.map);
            
            // Position pegman at map center or provided position
            const targetPosition = position ? 
                new kakao.maps.LatLng(position.lat, position.lng) : 
                this.map.getCenter();
            this.pegmanMarker.setPosition(targetPosition);
        }
    }

    public hideCoverage(): void {
        if (!this.map) return;
        
        this.overlayOn = false;
        
        // Update the roadview control appearance
        if (this.roadviewControl) {
            this.roadviewControl.className = '';
            this.roadviewControl.style.backgroundPosition = '0 -450px';
        }
        
        // Remove roadview overlay
        this.map.removeOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);
        
        // Hide pegman marker
        if (this.pegmanMarker) {
            this.pegmanMarker.setMap(null);
        }
    }

    public initializeStreetView(containerId: string, options: StreetViewOptions): void {
        const roadviewContainer = document.getElementById(containerId);
        if (!roadviewContainer) {
            console.error('Street view container not found');
            return;
        }

        // Create roadview object
        this.roadview = new kakao.maps.Roadview(roadviewContainer);
        
        // Create marker image for pegman
        const markImage = new kakao.maps.MarkerImage(
            'https://t1.daumcdn.net/localimg/localimages/07/2018/pc/roadview_minimap_wk_2018.png',
            new kakao.maps.Size(26, 46),
            {
                spriteSize: new kakao.maps.Size(1666, 168),
                spriteOrigin: new kakao.maps.Point(705, 114),
                offset: new kakao.maps.Point(13, 46)
            }
        );
        
        // Create draggable marker (pegman)
        this.pegmanMarker = new kakao.maps.Marker({
            image: markImage,
            position: new kakao.maps.LatLng(options.position.lat, options.position.lng),
            draggable: true
        });

        // Set initial roadview position
        this.currentPosition = options.position;
        this.setRoadviewPosition(options.position);
        
        // Add position_changed event listener to roadview
        this.setupRoadviewEvents();
        
        // Add dragend event to pegman marker
        this.setupPegmanEvents();
    }

    private setupMapClickHandler(): void {
        if (!this.map) return;
        
        kakao.maps.event.addListener(this.map, 'click', (mouseEvent: any) => {
            // Don't process if we're already handling an event to prevent loops
            if (this.isProcessingEvent) return;
            
            this.isProcessingEvent = true;
            try {
                // Only handle clicks when roadview overlay is active
                if (!this.overlayOn) {
                    return;
                }
                
                const latlng = mouseEvent.latLng;
                
                // Update current position
                this.currentPosition = {
                    lat: latlng.getLat(),
                    lng: latlng.getLng()
                };
                
                if (this.mapClickCallback && latlng) {
                    this.mapClickCallback({
                        lat: latlng.getLat(),
                        lng: latlng.getLng()
                    });
                }
                
                // If pegman marker exists, update its position
                if (this.pegmanMarker) {
                    this.pegmanMarker.setPosition(latlng);
                }
                
                // Try to set street view at clicked position
                this.setRoadviewPosition({
                    lat: latlng.getLat(),
                    lng: latlng.getLng()
                });
            } finally {
                this.isProcessingEvent = false;
            }
        });
    }

    private setupRoadviewEvents(): void {
        if (!this.roadview || this.hasInitializedRoadviewListener) return;
        
        this.hasInitializedRoadviewListener = true;
        
        kakao.maps.event.addListener(this.roadview, 'position_changed', () => {
            // Don't process if we're already handling an event to prevent loops
            if (this.isProcessingEvent) return;
            
            this.isProcessingEvent = true;
            try {
                if (!this.roadview) return;
                
                const rvPosition = this.roadview.getPosition();
                if (!rvPosition) return;
                
                // Update current position
                this.currentPosition = {
                    lat: rvPosition.getLat(),
                    lng: rvPosition.getLng()
                };
                
                // Update map center
                if (this.map) {
                    this.map.setCenter(rvPosition);
                }
                
                // Update pegman marker if overlay is active
                if (this.pegmanMarker && this.overlayOn) {
                    this.pegmanMarker.setPosition(rvPosition);
                }
                
                // Call the callback if it exists
                if (this.roadviewChangeCallback) {
                    const viewpoint = this.roadview.getViewpoint();
                    this.roadviewChangeCallback(
                        { lat: rvPosition.getLat(), lng: rvPosition.getLng() },
                        viewpoint.pan,
                        viewpoint.tilt
                    );
                }
            } finally {
                this.isProcessingEvent = false;
            }
        });
        
        kakao.maps.event.addListener(this.roadview, 'viewpoint_changed', () => {
            // Don't process if we're already handling an event to prevent loops
            if (this.isProcessingEvent) return;
            
            this.isProcessingEvent = true;
            try {
                if (!this.roadview || !this.roadviewChangeCallback) return;
                
                const position = this.roadview.getPosition();
                const viewpoint = this.roadview.getViewpoint();
                
                if (position && viewpoint) {
                    this.roadviewChangeCallback(
                        { lat: position.getLat(), lng: position.getLng() },
                        viewpoint.pan,
                        viewpoint.tilt
                    );
                }
            } finally {
                this.isProcessingEvent = false;
            }
        });
    }

    private setupPegmanEvents(): void {
        if (!this.pegmanMarker) return;
        
        kakao.maps.event.addListener(this.pegmanMarker, 'dragend', () => {
            // Don't process if we're already handling an event to prevent loops
            if (this.isProcessingEvent) return;
            
            this.isProcessingEvent = true;
            try {
                if (!this.pegmanMarker) return;
                
                const position = this.pegmanMarker.getPosition();
                
                // Update current position
                this.currentPosition = {
                    lat: position.getLat(),
                    lng: position.getLng()
                };
                
                this.setRoadviewPosition({
                    lat: position.getLat(),
                    lng: position.getLng()
                });
            } finally {
                this.isProcessingEvent = false;
            }
        });
    }

    private setRoadviewPosition(position: LatLng): void {
        if (!this.roadviewClient || !this.roadview) return;
        
        const kakaoPosition = new kakao.maps.LatLng(position.lat, position.lng);
        
        // Store the position so we can access it later
        this.currentPosition = position;
        
        this.roadviewClient.getNearestPanoId(kakaoPosition, 50, (panoId: string | null) => {
            if (panoId && this.roadview) {
                this.roadview.setPanoId(panoId, kakaoPosition);
                
                // Make sure the roadview container is visible
                const container = document.getElementById('street-view-container');
                if (container) {
                    container.style.display = 'block';
                }
                
                // Update pegman position if it exists and overlay is active
                if (this.pegmanMarker && this.overlayOn) {
                    this.pegmanMarker.setPosition(kakaoPosition);
                }
            } else {
                console.warn('No roadview found at this position');
                // Hide the roadview container if no panorama is available
                const container = document.getElementById('street-view-container');
                if (container) {
                    container.style.display = 'none';
                }
            }
        });
    }

    public setCenter(position: LatLng): void {
        if (this.map) {
            this.map.setCenter(new kakao.maps.LatLng(position.lat, position.lng));
            // Update current position
            this.currentPosition = position;
        }
    }

    public setZoom(zoom: number): void {
        if (this.map) {
            this.map.setLevel(this.convertZoomToLevel(zoom));
        }
    }

    public setMapType(mapTypeId: string): void {
        if (!this.map) return;
        
        // Update the map type based on the input
        switch(mapTypeId.toLowerCase()) {
            case 'satellite':
                this.map.setMapTypeId(kakao.maps.MapTypeId.SKYVIEW);
                // Update radio buttons if they exist
                if (this.mapTypeControl) {
                    const satelliteRadio = document.getElementById('satelliteType') as HTMLInputElement;
                    if (satelliteRadio) satelliteRadio.checked = true;
                }
                break;
            case 'hybrid':
                this.map.setMapTypeId(kakao.maps.MapTypeId.HYBRID);
                break;
            case 'roadmap':
            default:
                this.map.setMapTypeId(kakao.maps.MapTypeId.ROADMAP);
                // Update radio buttons if they exist
                if (this.mapTypeControl) {
                    const mapRadio = document.getElementById('mapType') as HTMLInputElement;
                    if (mapRadio) mapRadio.checked = true;
                }
                break;
        }
    }

    public setStreetViewPosition(position: LatLng): void {
        // Update current position
        this.currentPosition = position;
        
        const kakaoPosition = new kakao.maps.LatLng(position.lat, position.lng);
        if (this.pegmanMarker && this.overlayOn) {
            this.pegmanMarker.setPosition(kakaoPosition);
        }
        this.setRoadviewPosition(position);
    }

    public setStreetViewPOV(heading: number, pitch: number): void {
        if (this.roadview) {
            this.roadview.setViewpoint({
                pan: heading,
                tilt: pitch,
                zoom: 0
            });
        }
    }

    public setPegmanPosition(position: LatLng): void {
        // Update current position
        this.currentPosition = position;
        
        if (this.pegmanMarker && this.overlayOn) {
            this.pegmanMarker.setPosition(new kakao.maps.LatLng(position.lat, position.lng));
        }
    }

    public setPegmanVisible(visible: boolean): void {
        if (this.pegmanMarker && this.map && this.overlayOn) {
            if (visible) {
                this.pegmanMarker.setMap(this.map);
            } else {
                this.pegmanMarker.setMap(null);
            }
        }
    }

    public onMapClick(callback: (position: LatLng) => void): void {
        this.mapClickCallback = callback;
    }

    public onStreetViewChange(callback: (position: LatLng, heading: number, pitch: number) => void): void {
        this.roadviewChangeCallback = callback;
    }

    // Helper method to convert Google's zoom level to Kakao's level
    private convertZoomToLevel(zoom: number): number {
        return Math.max(1, Math.min(14, Math.floor(14 - (zoom / 21) * 13)));
    }
}