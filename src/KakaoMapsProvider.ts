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
    private isRoadviewInitialized: boolean = false;
    private currentPosition: LatLng | null = null;
    
    // Store pending POV settings that should be applied after initialization
    private pendingHeading: number | null = null;
    private pendingPitch: number | null = null;
    private pendingPovInterval: any = null; // For repeated attempts to set POV
    private forceNextPov: boolean = false; // Flag to force POV on next pano load
    
    // Coverage warning elements
    private coverageWarningElement: HTMLElement | null = null;
    private lastKnownValidPosition: LatLng | null = null;

    public initializeMap(containerId: string, options: MapOptions): void {
        const mapContainer = document.getElementById(containerId);
        if (!mapContainer) {
            console.error('Map container not found');
            return;
        }

        // Check if the initial position is within Kakao's coverage
        if (!this.isWithinKakaoCoverage(options.center)) {
            console.warn('Initial position is outside Kakao Maps coverage');
            // Use a default position within Korea if outside coverage
            options.center = { lat: 37.5665, lng: 126.9780 }; // Seoul
        }

        const mapOptions = {
            center: new kakao.maps.LatLng(options.center.lat, options.center.lng),
            level: this.convertZoomToLevel(options.zoom)
        };

        this.map = new kakao.maps.Map(mapContainer, mapOptions);
        this.roadviewClient = new kakao.maps.RoadviewClient();
        this.currentPosition = options.center;
        this.lastKnownValidPosition = options.center;
        
        // Create coverage warning element
        this.createCoverageWarning(mapContainer);
        
        // Set map type
        this.setMapType(options.mapTypeId);
        
        // Create and add the roadview control button
        this.createRoadviewControl(mapContainer);
        
        // Create and add the custom map type controls
        this.createCustomMapTypeControls(mapContainer);

        // Create pegman marker that's always visible
        this.createPegmanMarker(options.center);
        
        // Initialize click handler
        this.setupMapClickHandler();
        
        // Set up map event listeners to detect when moving outside coverage
        this.setupMapBoundsListener();
        
        // Ensure overlay is initially off
        this.overlayOn = false;
        if (this.map) {
            this.map.removeOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);
        }
    }

    private createCoverageWarning(mapContainer: HTMLElement): void {
        this.coverageWarningElement = document.createElement('div');
        this.coverageWarningElement.id = 'kakao-coverage-warning';
        this.coverageWarningElement.style.position = 'absolute';
        this.coverageWarningElement.style.top = '50%';
        this.coverageWarningElement.style.left = '50%';
        this.coverageWarningElement.style.transform = 'translate(-50%, -50%)';
        this.coverageWarningElement.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        this.coverageWarningElement.style.padding = '20px 30px';
        this.coverageWarningElement.style.borderRadius = '8px';
        this.coverageWarningElement.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        this.coverageWarningElement.style.zIndex = '1000';
        this.coverageWarningElement.style.textAlign = 'center';
        this.coverageWarningElement.style.display = 'none';
        this.coverageWarningElement.style.maxWidth = '400px';
        
        this.coverageWarningElement.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #333;">Outside Kakao Maps Coverage</h3>
            <p style="margin: 0 0 15px 0; color: #666;">Kakao Maps only covers Korea and nearby regions.</p>
            <button id="return-to-coverage" style="
                background-color: #FEE500;
                color: #000;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            ">Return to Coverage Area</button>
        `;
        
        mapContainer.appendChild(this.coverageWarningElement);
        
        // Add click handler to return button
        const returnButton = this.coverageWarningElement.querySelector('#return-to-coverage');
        if (returnButton) {
            returnButton.addEventListener('click', () => {
                this.returnToCoverageArea();
            });
        }
    }

    private setupMapBoundsListener(): void {
        if (!this.map) return;
        
        // Listen for map drag end and zoom changes
        kakao.maps.event.addListener(this.map, 'dragend', () => {
            this.checkMapCoverage();
        });
        
        kakao.maps.event.addListener(this.map, 'zoom_changed', () => {
            this.checkMapCoverage();
        });
        
        // Also check when bounds change
        kakao.maps.event.addListener(this.map, 'bounds_changed', () => {
            this.checkMapCoverage();
        });
    }

    private checkMapCoverage(): void {
        if (!this.map) return;
        
        const center = this.map.getCenter();
        const position = {
            lat: center.getLat(),
            lng: center.getLng()
        };
        
        if (!this.isWithinKakaoCoverage(position)) {
            this.showCoverageWarning();
        } else {
            this.hideCoverageWarning();
            // Store this as the last known valid position
            this.lastKnownValidPosition = position;
        }
    }

    private showCoverageWarning(): void {
        if (this.coverageWarningElement) {
            this.coverageWarningElement.style.display = 'block';
        }
    }

    private hideCoverageWarning(): void {
        if (this.coverageWarningElement) {
            this.coverageWarningElement.style.display = 'none';
        }
    }

    private returnToCoverageArea(): void {
        if (!this.map) return;
        
        // Return to the last known valid position, or Seoul if none exists
        const targetPosition = this.lastKnownValidPosition || { lat: 37.5665, lng: 126.9780 };
        
        this.map.setCenter(new kakao.maps.LatLng(targetPosition.lat, targetPosition.lng));
        this.hideCoverageWarning();
        
        // Also update the pegman position
        if (this.pegmanMarker) {
            this.pegmanMarker.setPosition(new kakao.maps.LatLng(targetPosition.lat, targetPosition.lng));
        }
    }

    private isWithinKakaoCoverage(position: LatLng): boolean {
        // Kakao Maps primarily covers Korea and some nearby areas
        // This is an approximate bounding box for their coverage
        const bounds = {
            north: 43.0,  // North of North Korea
            south: 33.0,  // South of Jeju Island
            east: 132.0,  // East Sea
            west: 124.0   // Yellow Sea
        };
        
        return position.lat >= bounds.south && 
               position.lat <= bounds.north && 
               position.lng >= bounds.west && 
               position.lng <= bounds.east;
    }

    private createPegmanMarker(position: LatLng): void {
        if (!this.map) return;

        // Create marker image for pegman
        const markImage = new kakao.maps.MarkerImage(
            './src/pegman.png',
            new kakao.maps.Size(26, 46),
            {
                spriteSize: new kakao.maps.Size(26, 46),
                spriteOrigin: new kakao.maps.Point(0, 0),
                offset: new kakao.maps.Point(13, 23)
            }
        );
        
        // Create draggable marker (pegman) that's always visible
        this.pegmanMarker = new kakao.maps.Marker({
            image: markImage,
            position: new kakao.maps.LatLng(position.lat, position.lng),
            draggable: true,
            map: this.map // Always add to map
        });

        // Setup pegman events
        this.setupPegmanEvents();
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

    public initializeStreetView(containerId: string, options: StreetViewOptions): void {
        // Clear any existing interval for POV setting
        if (this.pendingPovInterval) {
            clearInterval(this.pendingPovInterval);
            this.pendingPovInterval = null;
        }

        const roadviewContainer = document.getElementById(containerId);
        if (!roadviewContainer) {
            console.error('Street view container not found');
            return;
        }

        // Reset initialization flag
        this.isRoadviewInitialized = false;

        // Create roadview object
        this.roadview = new kakao.maps.Roadview(roadviewContainer);
        
        // Set initial roadview position
        this.currentPosition = options.position;
        
        // IMPORTANT: Store the initial POV settings to apply after initialization
        this.pendingHeading = options.pov.heading;
        this.pendingPitch = options.pov.pitch;
        this.forceNextPov = true; // Force POV on first pano load
        
        console.log(`Kakao init: Storing initial POV heading=${this.pendingHeading}, pitch=${this.pendingPitch}, forcing next POV`);
        
        // Setup roadview events before setting position to catch initialization
        this.setupRoadviewEvents();
        
        // Now set the position which will trigger initialization
        this.setRoadviewPosition(options.position);
    }

    private setupRoadviewEvents(): void {
        if (!this.roadview) return;
        
        // Listen for the init event to know when the roadview is ready
        kakao.maps.event.addListener(this.roadview, 'init', () => {
            console.log('Kakao roadview initialized');
            this.isRoadviewInitialized = true;
            
            // Set up a timer to repeatedly try to apply the pending POV
            // This helps overcome any internal Kakao defaults that might override our settings
            if (this.pendingHeading !== null && this.pendingPitch !== null) {
                this.applyPendingPov();
            }
        });

        // Also listen for pano_changed to catch when a new panorama is loaded
        kakao.maps.event.addListener(this.roadview, 'pano_changed', () => {
            console.log('Kakao panorama changed, force next POV:', this.forceNextPov);
            if (this.forceNextPov && this.pendingHeading !== null && this.pendingPitch !== null) {
                // When a new panorama is loaded and we have pending POV, apply it with a delay
                setTimeout(() => {
                    this.applyPendingPov();
                }, 500);
            }
        });
        
        kakao.maps.event.addListener(this.roadview, 'position_changed', () => {
            if (this.isProcessingEvent) return;
            
            this.isProcessingEvent = true;
            try {
                if (!this.roadview) return;
                
                const rvPosition = this.roadview.getPosition();
                if (!rvPosition) return;
                
                // Update map center
                if (this.map) {
                    this.map.setCenter(rvPosition);
                }
                
                // Update pegman marker position (always update, regardless of overlay state)
                if (this.pegmanMarker) {
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

    // New method to apply pending POV with multiple attempts
    private applyPendingPov(): void {
        if (!this.roadview || this.pendingHeading === null || this.pendingPitch === null) return;

        console.log(`Applying pending POV: heading=${this.pendingHeading}, pitch=${this.pendingPitch}`);
        
        // Clear any existing interval
        if (this.pendingPovInterval) {
            clearInterval(this.pendingPovInterval);
        }
        
        // Set POV immediately
        this.roadview.setViewpoint({
            pan: this.pendingHeading,
            tilt: this.pendingPitch,
            zoom: 0
        });
        
        // Set up an interval to reapply the POV several times to overcome any internal resets
        let attempts = 0;
        this.pendingPovInterval = setInterval(() => {
            if (!this.roadview || !this.isRoadviewInitialized) {
                clearInterval(this.pendingPovInterval);
                this.pendingPovInterval = null;
                return;
            }
            
            // Check current POV against what we want
            const currentViewpoint = this.roadview.getViewpoint();
            const headingDiff = Math.abs(currentViewpoint.pan - this.pendingHeading!);
            const pitchDiff = Math.abs(currentViewpoint.tilt - this.pendingPitch!);
            
            // If the POV is close enough to what we want, stop trying
            if (headingDiff < 1 && pitchDiff < 1) {
                console.log('POV successfully set to desired values');
                clearInterval(this.pendingPovInterval);
                this.pendingPovInterval = null;
                this.forceNextPov = false; // We've successfully set the POV
                return;
            }
            
            // Otherwise, try again
            if (attempts < 5) {
                console.log(`Retrying POV (attempt ${attempts+1}): heading=${this.pendingHeading}, pitch=${this.pendingPitch}`);
                this.roadview.setViewpoint({
                    pan: this.pendingHeading!,
                    tilt: this.pendingPitch!,
                    zoom: 0
                });
                attempts++;
            } else {
                console.log('Max POV setting attempts reached');
                clearInterval(this.pendingPovInterval);
                this.pendingPovInterval = null;
                this.forceNextPov = false; // Give up after 5 attempts
            }
        }, 300); // Try every 300ms
    }

    private setupPegmanEvents(): void {
        if (!this.pegmanMarker) return;
        
        // Handle pegman drag end
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

        // Handle pegman click - show panorama regardless of coverage visibility
        kakao.maps.event.addListener(this.pegmanMarker, 'click', () => {
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
                
                // Open street view at pegman position
                this.setRoadviewPosition({
                    lat: position.getLat(),
                    lng: position.getLng()
                });
                
                // Make sure the street view container is visible
                const container = document.getElementById('street-view-container');
                if (container) {
                    container.style.display = 'block';
                }
            } finally {
                this.isProcessingEvent = false;
            }
        });
    }

    private setRoadviewPosition(position: LatLng, heading?: number, pitch?: number): void {
        if (!this.roadviewClient || !this.roadview) return;
        
        const kakaoPosition = new kakao.maps.LatLng(position.lat, position.lng);
        
        // MODIFIED: If heading and pitch are provided, store them as pending
        if (heading !== undefined && pitch !== undefined) {
            this.pendingHeading = heading;
            this.pendingPitch = pitch;
            this.forceNextPov = true; // Force POV application when pano changes
            console.log(`Setting pending POV for next position: heading=${heading}, pitch=${pitch}`);
        }
        
        this.roadviewClient.getNearestPanoId(kakaoPosition, 50, (panoId: string | null) => {
            if (panoId && this.roadview) {
                // First set the panorama ID and position
                this.roadview.setPanoId(panoId, kakaoPosition);
                
                // Make sure the roadview container is visible
                const container = document.getElementById('street-view-container');
                if (container) {
                    container.style.display = 'block';
                }
                
                // Update pegman position
                if (this.pegmanMarker) {
                    this.pegmanMarker.setPosition(kakaoPosition);
                }
            } else {
                console.warn('No roadview found at this position');
                // Hide the roadview container if no panorama is available
                const container = document.getElementById('street-view-container');
                if (container) {
                    container.style.display = 'none';
                }
                
                // Clear pending POV since we couldn't set a panorama
                this.pendingHeading = null;
                this.pendingPitch = null;
                this.forceNextPov = false;
                
                if (this.pendingPovInterval) {
                    clearInterval(this.pendingPovInterval);
                    this.pendingPovInterval = null;
                }
            }
        });
    }

    public setCenter(position: LatLng): void {
        if (!this.map) return;
        
        // Check if the new position is within coverage
        if (!this.isWithinKakaoCoverage(position)) {
            console.warn('Attempted to set center outside Kakao Maps coverage');
            this.showCoverageWarning();
            // Still allow the center to be set, but show the warning
        }
        
        this.map.setCenter(new kakao.maps.LatLng(position.lat, position.lng));
        // Update current position
        this.currentPosition = position;
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
        // Check if the position is within Kakao's coverage
        if (!this.isWithinKakaoCoverage(position)) {
            console.warn('Street view position is outside Kakao Maps coverage');
            // You might want to show a different message or handle this differently
            return;
        }
        
        const kakaoPosition = new kakao.maps.LatLng(position.lat, position.lng);
        if (this.pegmanMarker) {
            this.pegmanMarker.setPosition(kakaoPosition);
        }
        
        // For Kakao, we need to preserve the current orientation when changing position
        if (this.roadview && this.isRoadviewInitialized) {
            const currentViewpoint = this.roadview.getViewpoint();
            this.setRoadviewPosition(position, currentViewpoint.pan, currentViewpoint.tilt);
        } else {
            // If there are pending heading/pitch values, use those
            if (this.pendingHeading !== null && this.pendingPitch !== null) {
                this.setRoadviewPosition(position, this.pendingHeading, this.pendingPitch);
            } else {
                this.setRoadviewPosition(position);
            }
        }
    }

    public setStreetViewPOV(heading: number, pitch: number): void {
        console.log(`Kakao: setStreetViewPOV heading=${heading}, pitch=${pitch}`);
        
        // Always store as pending, regardless of initialization state
        this.pendingHeading = heading;
        this.pendingPitch = pitch;
        this.forceNextPov = true;
        
        if (this.roadview && this.isRoadviewInitialized) {
            // If roadview is already initialized, apply immediately and set up repeated attempts
            this.applyPendingPov();
        } else {
            console.log(`Kakao: Stored POV heading=${heading}, pitch=${pitch} as pending`);
        }
    }

    public setPegmanPosition(position: LatLng): void {
        // Update current position
        this.currentPosition = position;
        
        if (this.pegmanMarker) {
            this.pegmanMarker.setPosition(new kakao.maps.LatLng(position.lat, position.lng));
        }
    }

    public setPegmanVisible(visible: boolean): void {
        if (!this.pegmanMarker || !this.map) return;
        
        // Pegman should always be visible, regardless of overlay state
        // So we always set it to the map when requested to be visible
        if (visible) {
            this.pegmanMarker.setMap(this.map);
        } else {
            this.pegmanMarker.setMap(null);
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
        
        // Note: We no longer control pegman visibility here
        // The pegman is always visible as it's managed independently
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
        
        // Note: We don't hide the pegman here anymore
        // The pegman remains visible regardless of coverage state
    }

    private setupMapClickHandler(): void {
        if (!this.map) return;
        
        kakao.maps.event.addListener(this.map, 'click', (mouseEvent: any) => {
            // Don't process if we're already handling an event to prevent loops
            if (this.isProcessingEvent) return;
            
            this.isProcessingEvent = true;
            try {
                const latlng = mouseEvent.latLng;
                
                // Update current position
                this.currentPosition = {
                    lat: latlng.getLat(),
                    lng: latlng.getLng()
                };
                
                // Always call the map click callback
                if (this.mapClickCallback && latlng) {
                    this.mapClickCallback({
                        lat: latlng.getLat(),
                        lng: latlng.getLng()
                    });
                }
                
                // Only handle street view opening when overlay is active
                if (this.overlayOn) {
                    // If pegman marker exists, update its position
                    if (this.pegmanMarker) {
                        this.pegmanMarker.setPosition(latlng);
                    }
                    
                    // Try to set street view at clicked position
                    this.setRoadviewPosition({
                        lat: latlng.getLat(),
                        lng: latlng.getLng()
                    });
                }
            } finally {
                this.isProcessingEvent = false;
            }
        });
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