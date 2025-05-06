import { IMapProvider, LatLng, MapOptions, StreetViewOptions } from './IMapProvider';

export class YandexMapsProvider implements IMapProvider {
    private map: ymaps.Map | null = null;
    private panoramaPlayer: ymaps.panorama.Player | null = null;
    private pegman: ymaps.Placemark | null = null;
    private mapClickCallback: ((position: LatLng) => void) | null = null;
    private streetViewChangeCallback: ((position: LatLng, heading: number, pitch: number) => void) | null = null;
    private currentPanoramaPosition: LatLng | null = null;
    private panoramaManager: any = null;
    private coverageVisible: boolean = false;
    private isPreventingDefaultPanorama: boolean = false;
    
    // For POV management
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

            // Ensure container has proper dimensions
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.minHeight = '300px';

            const center = [options.center.lat, options.center.lng];
            console.log("Initializing Yandex Map with center:", center);

            // Use CORRECT Yandex map type format
            let mapType: string;
            switch (options.mapTypeId) {
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

            // Add short delay to ensure DOM is ready
            setTimeout(() => {
                try {
                    // Initialize Yandex Map
                    this.map = new ymaps.Map(container, {
                        center: center,
                        zoom: options.zoom,
                        type: mapType,
                        controls: ['zoomControl', 'fullscreenControl', 'typeSelector']
                    });

                    console.log("Yandex Map created successfully");

                    // Create pegman marker
                    this.pegman = new ymaps.Placemark(center, {
                        hintContent: 'Pegman - Drag to view street panorama'
                    }, {
                        iconLayout: 'default#image',
                        iconImageHref: 'src/pegman.png',
                        iconImageSize: [32, 32],
                        iconImageOffset: [-16, -32],
                        draggable: true,
                    });

                    // Add pegman to the map
                    this.map.geoObjects.add(this.pegman);

                    // Get panorama manager
                    this.panoramaManager = this.map.getPanoramaManager();
                    
                    // Setup custom panorama handling to prevent default behavior
                    this.setupCustomPanoramaHandling();

                    // Set up event listeners for the map
                    this.setupMapEventListeners();
                } catch (error) {
                    console.error("Error creating Yandex map:", error);
                }
            }, 100); // Small delay to ensure DOM is ready
        });
    }

    private setupCustomPanoramaHandling(): void {
        if (!this.map || !this.panoramaManager) return;
        
        // Directly replace the openPlayer method of the panorama manager
        // This is a more reliable approach than trying to intercept events
        const originalOpenPlayer = this.panoramaManager.openPlayer;
        this.panoramaManager.openPlayer = (panorama: any, options: any) => {
            console.log('Intercepted panorama manager openPlayer call');
            
            if (this.isPreventingDefaultPanorama) {
                // Instead of using default player, use our custom implementation
                if (panorama) {
                    // Get the current map center as the position
                    const mapCenter = this.map?.getCenter();
                    if (mapCenter) {
                        const position = {
                            lat: mapCenter[0],
                            lng: mapCenter[1]
                        };
                        
                        // Update pegman
                        this.setPegmanPosition(position);
                        this.setPegmanVisible(true);
                        
                        // Open panorama in our container
                        const container = document.getElementById('street-view-container');
                        if (container) {
                            container.style.display = 'block';
                            
                            if (this.panoramaPlayer) {
                                this.panoramaPlayer.setPanorama(panorama);
                            } else {
                                // Create panorama player
                                this.panoramaPlayer = new ymaps.panorama.Player(
                                    container,
                                    panorama,
                                    {
                                        direction: this.pendingHeading !== null && this.pendingPitch !== null ? 
                                            [this.pendingHeading, this.pendingPitch] : 'auto',
                                        controls: ['zoomControl', 'fullscreenControl']
                                    }
                                );
                                
                                // Set up panorama event listeners
                                this.setupPanoramaEventListeners();
                            }
                            
                            // Store current position
                            if (panorama.getPosition) {
                                try {
                                    const panoPosition = panorama.getPosition();
                                    if (panoPosition && panoPosition.length >= 2) {
                                        this.currentPanoramaPosition = {
                                            lat: panoPosition[0],
                                            lng: panoPosition[1]
                                        };
                                        
                                        // Update pegman to actual panorama position
                                        this.setPegmanPosition(this.currentPanoramaPosition);
                                    }
                                } catch (e) {
                                    console.warn('Error getting panorama position', e);
                                }
                            }
                        }
                    }
                }
                return Promise.resolve(); // Return a resolved promise
            } else {
                // Call original method when not preventing
                return originalOpenPlayer.call(this.panoramaManager, panorama, options);
            }
        };
        
        // Also handle locate event to intercept the search for panoramas
        this.map.events.add('click', (e: any) => {
            if (this.isPreventingDefaultPanorama && this.coverageVisible) {
                // Prevent default click behavior for panorama
                e.preventDefault();
                
                // Get click coordinates
                const coords = e.get('coords');
                if (!coords) return;
                
                // Create position object
                const position = {
                    lat: coords[0],
                    lng: coords[1]
                };
                
                // Check if this is a panorama click
                ymaps.panorama.locate(coords).then((panoramas: any) => {
                    if (panoramas && panoramas.length > 0) {
                        // Update pegman
                        this.setPegmanPosition(position);
                        this.setPegmanVisible(true);
                        
                        // Open panorama in our container
                        this.setStreetViewPosition(position);
                        
                        // Call the registered click callback
                        if (this.mapClickCallback) {
                            this.mapClickCallback(position);
                        }
                    }
                });
            }
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
                            
                            // Update pegman position and make visible
                            this.setPegmanPosition(options.position);
                            this.setPegmanVisible(true);
                        } else {
                            // No panorama available - show a message
                            container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; background:#f5f5f5;">
                                <p>No street view available at this location</p>
                            </div>`;
                        }
                    } catch (error) {
                        console.error('Error initializing Yandex panorama:', error);
                        container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; background:#f5f5f5;">
                            <p>Error loading street view</p>
                        </div>`;
                    }
                    resolve();
                }, 100);
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
                
                // Notify about street view change if callback is registered
                if (this.streetViewChangeCallback && this.panoramaPlayer) {
                    const direction = this.panoramaPlayer.getDirection();
                    this.streetViewChangeCallback(
                        position,
                        direction[0], // heading
                        direction[1]  // pitch
                    );
                }
                
                // Show container
                const container = document.getElementById('street-view-container');
                if (container) {
                    container.style.display = 'block';
                }
                
                // Make pegman visible
                this.setPegmanVisible(true);
            } else {
                console.log('No panorama available at the requested position');
                
                // Clean up existing panorama player
                if (this.panoramaPlayer) {
                    try {
                        // Destroy the player if possible
                        if (typeof this.panoramaPlayer.destroy === 'function') {
                            this.panoramaPlayer.destroy();
                        }
                    } catch (e) {
                        console.warn('Error destroying panorama player:', e);
                    }
                    // Set the player reference to null
                    this.panoramaPlayer = null;
                }
                
                // Get the container element
                const container = document.getElementById('street-view-container');
                if (container) {
                    // Clear the container - don't show any message
                    container.innerHTML = '';
                    
                    // Keep the container visible but empty
                    container.style.display = 'block';
                    
                    // Optional: Make the container have a light background so it's not just blank
                    container.style.backgroundColor = '#f5f5f5';
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
        if (!this.pegman || !this.map) return;
        
        try {
            if (visible) {
                // Make sure pegman is added to the map and visible
                this.pegman.options.set('visible', true);
                
                // Ensure pegman is added to the map
                if (this.map && !this.pegman.getMap()) {
                    this.map.geoObjects.add(this.pegman);
                }
            } else {
                // Hide pegman
                this.pegman.options.set('visible', false);
            }
        } catch (e) {
            console.warn('Error setting pegman visibility:', e);
        }
    }

    public showCoverage(position?: LatLng): void {
        if (!this.map || !this.panoramaManager) return;
        
        this.coverageVisible = true;
        this.isPreventingDefaultPanorama = true;
        
        // Enable lookup mode to show blue lines on the map
        this.panoramaManager.enableLookup();
        
        // Update pegman position if position is provided
        if (position) {
            this.setPegmanPosition(position);
        }
        
        // Make pegman visible
        this.setPegmanVisible(true);
        
        console.log('Yandex panorama coverage shown');
    }

    public hideCoverage(): void {
        if (!this.map || !this.panoramaManager) return;
        
        this.coverageVisible = false;
        this.isPreventingDefaultPanorama = false;
        
        // Disable lookup mode to hide blue lines
        this.panoramaManager.disableLookup();
        
        // Hide pegman
        this.setPegmanVisible(false);
        
        console.log('Yandex panorama coverage hidden');
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
            // Don't process if this is being handled by our custom panorama interceptor
            if (this.isPreventingDefaultPanorama && this.coverageVisible) {
                return;
            }
            
            const coords = e.get('coords');
            const position = { lat: coords[0], lng: coords[1] };
            
            // Call the registered callback
            if (this.mapClickCallback) {
                this.mapClickCallback(position);
            }

            // Handle Shift+click directly (as specified in requirements)
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
        
        // The Yandex API might use different event names
        // Try both 'panoramachange' and 'panorama_changed'
        ['panoramachange', 'panorama_changed'].forEach(eventName => {
            try {
                this.panoramaPlayer?.events.add(eventName, () => {
                    if (!this.panoramaPlayer) return;
                    
                    try {
                        // Delay to ensure the panorama is fully loaded
                        setTimeout(() => {
                            // Get the new panorama
                            const panorama = this.panoramaPlayer?.getPanorama();
                            if (!panorama) return;
                            
                            // Get position data safely
                            let position;
                            try {
                                position = panorama.getPosition();
                            } catch (e) {
                                console.warn(`Error getting panorama position after ${eventName}:`, e);
                                return;
                            }
                            
                            if (!position || position.length < 2) return;
                            
                            const latLng = { 
                                lat: position[0], 
                                lng: position[1] 
                            };
                            
                            console.log(`Yandex panorama ${eventName} to:`, latLng);
                            
                            // Update stored position
                            this.currentPanoramaPosition = latLng;
                            
                            // Update pegman marker position
                            if (this.map && this.pegman) {
                                this.pegman.geometry.setCoordinates([latLng.lat, latLng.lng]);
                                this.setPegmanVisible(true);
                            }
                            
                            // Apply any pending POV
                            if (this.pendingHeading !== null && this.pendingPitch !== null && this.forceNextPov) {
                                this.applyPendingPov();
                            }
                        }, 200);
                    } catch (error) {
                        console.error(`Error handling Yandex ${eventName}:`, error);
                    }
                });
            } catch (e) {
                console.warn(`Could not add ${eventName} listener:`, e);
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
            this.pendingPovInterval = null;
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