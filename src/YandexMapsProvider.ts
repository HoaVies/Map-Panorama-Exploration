import { IMapProvider, LatLng, MapOptions, StreetViewOptions } from './IMapProvider';

export class YandexMapsProvider implements IMapProvider {
    private map: ymaps.Map | null = null;
    private panoramaPlayer: ymaps.panorama.Player | null = null;
    private pegman: ymaps.Placemark | null = null;
    private mapClickCallback: ((position: LatLng) => void) | null = null;
    private streetViewChangeCallback: ((position: LatLng, heading: number, pitch: number) => void) | null = null;
    private currentPanoramaPosition: LatLng | null = null;
    private coverageLayer: any = null;
    private isCoverageVisible: boolean = false;

    private pendingHeading: number | null = null;
    private pendingPitch: number | null = null;
    private pendingPovInterval: any = null;
    private forceNextPov: boolean = false;
    constructor() {
        // Constructor doesn't need parameters as the API key is loaded in the HTML
    }

    public initializeMap(containerId: string, options: MapOptions): void {
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
            let mapType: string;
            switch (options.mapTypeId) {
                case 'roadmap':
                    mapType = 'yandex#map';  // FIXED: Added 'yandex#' prefix
                    break;
                case 'satellite':
                    mapType = 'yandex#satellite';  // FIXED: Added 'yandex#' prefix
                    break;
                case 'hybrid':
                    mapType = 'yandex#hybrid';  // FIXED: Added 'yandex#' prefix
                    break;
                default:
                    mapType = 'yandex#map';  // FIXED: Added 'yandex#' prefix
            }

            // Add short delay to ensure DOM is ready
            setTimeout(() => {
                try {
                    // Initialize Yandex Map
                    this.map = new ymaps.Map(container, {
                        center: center,
                        zoom: options.zoom,
                        type: mapType,  // FIXED: Using correct map type
                        controls: ['zoomControl', 'fullscreenControl', 'typeSelector']
                    });

                    console.log("Yandex Map created successfully");

                    // Create pegman marker
                    this.pegman = new ymaps.Placemark(center, {
                        hintContent: 'Pegman - Drag to view street panorama'
                    }, {
                        iconLayout: 'default#image',
                        iconImageHref: './src/pegman.png', // Path to the custom pegman image
                        iconImageSize: [26, 46],
                        iconImageOffset: [13, 23],
                        draggable: true
                    });

                    // Add pegman to the map
                    this.map.geoObjects.add(this.pegman);

                    // Set up event listeners for the map
                    this.setupMapEventListeners();
                } catch (error) {
                    console.error("Error creating Yandex map:", error);
                }
            }, 100); // Small delay to ensure DOM is ready
        });
    }

    public setCenter(position: LatLng): void {
        if (!this.map) return;
        this.map.setCenter([position.lat, position.lng]);
    }

    public setZoom(zoom: number): void {
        if (!this.map) return;
        this.map.setCenter(this.map.getCenter(), zoom);
    }

    public setMapType(mapTypeId: string): void {
        if (!this.map) return;
        
        // Map the mapTypeId to Yandex equivalent
        let mapType: string;
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

    public async initializeStreetView(containerId: string, options: StreetViewOptions): Promise<void> {
        return new Promise((resolve) => {
            ymaps.ready(async () => {
                // Get container element and ensure it has dimensions
                const container = document.getElementById(containerId);
                if (!container) {
                    throw new Error(`Container element with ID "${containerId}" not found`);
                }
                
                // Set explicit dimensions to avoid null offsetWidth error
                container.style.width = '100%';
                container.style.height = '100%';
                container.style.minHeight = '300px';
                container.style.display = 'block';
                
                // Make sure the container is visible in the DOM before creating the panorama
                // This helps avoid the offsetWidth null error
                setTimeout(async () => {
                    try {
                        // Convert position format
                        const position = [options.position.lat, options.position.lng];
                        
                        // Store the pending POV values
                        this.pendingHeading = options.pov.heading;
                        this.pendingPitch = options.pov.pitch;
                        this.forceNextPov = true;
                        
                        console.log(`Storing pending POV for Yandex: heading=${this.pendingHeading}, pitch=${this.pendingPitch}`);
                        
                        // Find available panoramas at the specified position
                        const panoramas = await ymaps.panorama.locate(position);
                        
                        if (panoramas && panoramas.length > 0) {
                            // Create panorama player with explicit initial direction
                            this.panoramaPlayer = new ymaps.panorama.Player(
                                container,
                                panoramas[0],
                                {
                                    direction: [options.pov.heading, options.pov.pitch],
                                    controls: ['zoomControl', 'fullscreenControl'],
                                    // Force a specific size to avoid dimension issues
                                    width: container.offsetWidth || 640,
                                    height: container.offsetHeight || 480
                                }
                            );
                            
                            // Store the current panorama position
                            this.currentPanoramaPosition = options.position;
                            
                            // Set up event listeners for the panorama
                            this.setupPanoramaEventListeners();
                            
                            // Create pegman if it doesn't exist
                            if (!this.pegman && this.map) {
                                this.pegman = new ymaps.Placemark([options.position.lat, options.position.lng], {
                                    hintContent: 'Pegman - Drag to view street panorama'
                                }, {
                                    preset: 'islands#bluePersonIcon',
                                    draggable: true
                                });
                                
                                this.map.geoObjects.add(this.pegman);
                            }
                        }
                    } catch (error) {
                        console.error('Error initializing Yandex panorama:', error);
                        container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; background:#f5f5f5;">
                            <p>Error loading street view</p>
                        </div>`;
                    }
                    resolve();
                }, 100); // Small delay to ensure container is ready in the DOM
            });
        });
    }

    public async setStreetViewPosition(position: LatLng): Promise<void> {
        // Store any current direction if available
        if (this.panoramaPlayer && !this.pendingHeading && !this.pendingPitch) {
            const currentDirection = this.panoramaPlayer.getDirection();
            this.pendingHeading = currentDirection[0];
            this.pendingPitch = currentDirection[1];
        }
    
        const yandexPosition = [position.lat, position.lng];
        
        try {
            // Find available panoramas at the new position
            const panoramas = await ymaps.panorama.locate(yandexPosition);
            
            if (panoramas && panoramas.length > 0) {
                if (this.panoramaPlayer) {
                    // Update existing panorama
                    await this.panoramaPlayer.setPanorama(panoramas[0]);
                } else {
                    // Create new panorama player
                    const container = document.getElementById('street-view-container');
                    if (container) {
                        this.panoramaPlayer = new ymaps.panorama.Player(
                            container,
                            panoramas[0],
                            {
                                direction: this.pendingHeading && this.pendingPitch ? 
                                    [this.pendingHeading, this.pendingPitch] : 'auto',
                                controls: ['zoomControl', 'fullscreenControl']
                            }
                        );
                        
                        // Set up event listeners for the panorama
                        this.setupPanoramaEventListeners();
                    }
                }
                
                // Store the current panorama position
                this.currentPanoramaPosition = position;
                
                // Apply pending POV if available
                if (this.pendingHeading !== null && this.pendingPitch !== null) {
                    setTimeout(() => {
                        this.applyPendingPov();
                    }, 500);
                }
            } else {
                console.log('No panorama available at the requested position');
                
                // Display appropriate message in container
                const container = document.getElementById('street-view-container');
                if (container) {
                    container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; background:#f5f5f5;">
                        <p>No street view available at this location</p>
                    </div>`;
                }
            }
        } catch (error) {
            console.error('Error updating Yandex panorama position:', error);
        }
    }

    public setStreetViewPOV(heading: number, pitch: number): void {
        console.log(`Yandex: setStreetViewPOV heading=${heading}, pitch=${pitch}`);
        
        // Always store as pending, regardless of player state
        this.pendingHeading = heading;
        this.pendingPitch = pitch;
        this.forceNextPov = true;
        
        if (this.panoramaPlayer) {
            // If panorama player exists, apply immediately and set up repeated attempts
            this.applyPendingPov();
        } else {
            console.log(`Yandex: Stored POV heading=${heading}, pitch=${pitch} as pending`);
        }
    }

    public setPegmanPosition(position: LatLng): void {
        if (!this.pegman) return;
        this.pegman.geometry.setCoordinates([position.lat, position.lng]);
    }

    public setPegmanVisible(visible: boolean): void {
        if (!this.pegman) return;
        
        // Yandex Maps doesn't directly support changing visibility of a placemark
        // As a workaround, we add or remove it from the map
        if (visible) {
            if (this.map) {
                this.map.geoObjects.add(this.pegman);
            }
        } else {
            if (this.map) {
                this.map.geoObjects.remove(this.pegman);
            }
        }
    }

    public showCoverage(position: LatLng): void {
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

    public hideCoverage(): void {
        this.isCoverageVisible = false;
        
        // If you implemented a custom coverage visualization, you would hide it here
        console.log('Hiding coverage layer');
    }

    public onMapClick(callback: (position: LatLng) => void): void {
        this.mapClickCallback = callback;
    }

    public onStreetViewChange(callback: (position: LatLng, heading: number, pitch: number) => void): void {
        this.streetViewChangeCallback = callback;
    }

    private setupMapEventListeners(): void {
        if (!this.map) return;
        
        // Handle map clicks
        this.map.events.add('click', (e: any) => {
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
            this.pegman.events.add('dragend', (e: any) => {
                if (!this.pegman) return;
                
                const coords = this.pegman.geometry.getCoordinates();
                const position = { lat: coords[0], lng: coords[1] };
                
                // Update street view to the dragged position
                this.setStreetViewPosition(position);
            });
        }
    }

    private setupPanoramaEventListeners(): void {
        if (!this.panoramaPlayer) return;
        
        // Listen for position changes
        this.panoramaPlayer.events.add('position_changed', () => {
            if (!this.panoramaPlayer || !this.currentPanoramaPosition) return;
            
            try {
                // Use safe access to panorama data
                const panorama = this.panoramaPlayer.getPanorama();
                if (!panorama) return;
                
                // Safely extract the position data
                let position;
                try {
                    position = panorama.getPosition();
                } catch (e) {
                    console.warn('Error getting panorama position:', e);
                    return;
                }
                
                if (!position || position.length < 2) return;
                
                // Create a LatLng object from the position array
                const latLng = { 
                    lat: position[0], 
                    lng: position[1] 
                };
                
                console.log('Yandex panorama position changed:', latLng);
                
                // Update stored position
                this.currentPanoramaPosition = latLng;
                
                // Update pegman marker position
                if (this.map && this.pegman) {
                    this.pegman.geometry.setCoordinates([latLng.lat, latLng.lng]);
                }
                
                // Update map center
                if (this.map) {
                    this.map.setCenter([latLng.lat, latLng.lng]);
                }
                
                // Call the registered callback
                if (this.streetViewChangeCallback) {
                    const direction = this.panoramaPlayer.getDirection();
                    this.streetViewChangeCallback(
                        latLng,
                        direction[0], // heading
                        direction[1]  // pitch
                    );
                }
            } catch (error) {
                console.error('Error handling Yandex panorama position change:', error);
            }
        });
        
        // The Yandex API apparently uses 'panoramachange' instead of 'position_changed'
        // Let's also listen for this event for better compatibility
        this.panoramaPlayer.events.add('panoramachange', () => {
            if (!this.panoramaPlayer) return;
            
            try {
                // Delay to ensure the panorama is fully loaded
                setTimeout(() => {
                    // Check if panoramaPlayer still exists
                    if (!this.panoramaPlayer) return;
                    
                    // Get the new panorama
                    const panorama = this.panoramaPlayer.getPanorama();
                    if (!panorama) return;
                    
                    // Get position data safely
                    let position;
                    try {
                        position = panorama.getPosition();
                    } catch (e) {
                        console.warn('Error getting panorama position after change:', e);
                        return;
                    }
                    
                    if (!position || position.length < 2) return;
                    
                    const latLng = { 
                        lat: position[0], 
                        lng: position[1] 
                    };
                    
                    console.log('Yandex panorama changed to:', latLng);
                    
                    // Update stored position
                    this.currentPanoramaPosition = latLng;
                    
                    // Update pegman marker position
                    if (this.map && this.pegman) {
                        this.pegman.geometry.setCoordinates([latLng.lat, latLng.lng]);
                    }
                    
                    // Apply any pending POV
                    if (this.pendingHeading !== null && this.pendingPitch !== null && this.forceNextPov) {
                        this.applyPendingPov();
                    }
                }, 200); // Short delay to ensure panorama is loaded
            } catch (error) {
                console.error('Error handling Yandex panorama change:', error);
            }
        });
        
        // Listen for direction changes
        this.panoramaPlayer.events.add('directionchange', () => {
            if (!this.panoramaPlayer || !this.currentPanoramaPosition) return;
            
            // Get current direction
            const direction = this.panoramaPlayer.getDirection();
            
            // Call the registered callback
            if (this.streetViewChangeCallback) {
                this.streetViewChangeCallback(
                    this.currentPanoramaPosition,
                    direction[0], // heading
                    direction[1]  // pitch
                );
            }
        });
    }

    private applyPendingPov(): void {
        if (!this.panoramaPlayer || this.pendingHeading === null || this.pendingPitch === null) return;
    
        console.log(`Applying pending POV to Yandex panorama: heading=${this.pendingHeading}, pitch=${this.pendingPitch}`);
        
        // Clear any existing interval
        if (this.pendingPovInterval) {
            clearInterval(this.pendingPovInterval);
        }
        
        // Set POV immediately
        try {
            this.panoramaPlayer.setDirection([this.pendingHeading, this.pendingPitch]);
        } catch (e) {
            console.warn('Error setting initial direction:', e);
        }
        
        // Set up an interval to reapply the POV several times to overcome any internal resets
        let attempts = 0;
        this.pendingPovInterval = setInterval(() => {
            if (!this.panoramaPlayer) {
                clearInterval(this.pendingPovInterval);
                this.pendingPovInterval = null;
                return;
            }
            
            try {
                // Check current POV against what we want
                const currentDirection = this.panoramaPlayer.getDirection();
                const headingDiff = Math.abs(currentDirection[0] - this.pendingHeading!);
                const pitchDiff = Math.abs(currentDirection[1] - this.pendingPitch!);
                
                // If the POV is close enough to what we want, stop trying
                if (headingDiff < 2 && pitchDiff < 2) {
                    console.log('Yandex panorama POV successfully set to desired values');
                    clearInterval(this.pendingPovInterval);
                    this.pendingPovInterval = null;
                    this.forceNextPov = false;
                    return;
                }
                
                // Otherwise, try again
                if (attempts < 5) {
                    console.log(`Retrying Yandex panorama POV (attempt ${attempts+1}): heading=${this.pendingHeading}, pitch=${this.pendingPitch}`);
                    this.panoramaPlayer.setDirection([this.pendingHeading!, this.pendingPitch!]);
                    attempts++;
                } else {
                    console.log('Max POV setting attempts reached for Yandex panorama');
                    clearInterval(this.pendingPovInterval);
                    this.pendingPovInterval = null;
                    this.forceNextPov = false;
                }
            } catch (e) {
                console.warn('Error in pending POV application:', e);
                clearInterval(this.pendingPovInterval);
                this.pendingPovInterval = null;
            }
        }, 300); // Try every 300ms
    }
}