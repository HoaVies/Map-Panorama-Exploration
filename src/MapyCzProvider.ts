import { IMapProvider, LatLng, MapOptions, StreetViewOptions } from './IMapProvider';

export class MapyCzProvider implements IMapProvider {
    private mapClickCallback: ((position: LatLng) => void) | null = null;
    private streetViewChangeCallback: ((position: LatLng, heading: number, pitch: number) => void) | null = null;
    private currentPosition: LatLng | null = null;
    private currentHeading: number = 0;
    private currentPitch: number = 0;
    private map: any = null;
    private clickMarker: any = null;
    private panoramaInstance: any = null;
    private apiKey: string = 'PpgOEdY7F0t99ALvSN08G_iDtEivZTdcamXY67Jc6-A';
    private debounceTimer: any = null;
    private povApplicationInterval: any = null;
    private pegmanIcon: any = null;
    private panoramaContainer: HTMLElement | null = null;
    private isDestroying: boolean = false;
    private initializationPromise: Promise<void> | null = null;
    private activityInterval: any = null;
    private errorHandlerInstalled: boolean = false;
    private currentMapType: string = 'roadmap';
    private baseTileLayer: any = null;
    private namesOverlayLayer: any = null;

    constructor(apiKey?: string) {
        if (apiKey) {
            this.apiKey = apiKey;
        }
        
        // Install global error handler for panorama issues
        this.installGlobalErrorHandler();
        
        // Load Leaflet if not already loaded
        this.loadLeaflet(() => {
            console.log('Leaflet loaded successfully');
            this.initializePegmanIcon();
        });
    }
    
    private installGlobalErrorHandler(): void {
        if (this.errorHandlerInstalled) return;
        
        // Override the global error handler to catch panorama errors
        const originalErrorHandler = window.onerror;
        window.onerror = (message, source, lineno, colno, error) => {
            // Check if this is a panorama-related error
            if (source && source.includes('panorama.js') && 
                message && typeof message === 'string' && message.includes('Cannot read properties of null')) {
                console.warn('Caught panorama error, preventing propagation:', message);
                // Attempt to recover
                this.recoverFromError();
                // Prevent the error from propagating
                return true;
            }
            
            // Call original error handler if it exists
            if (originalErrorHandler) {
                return originalErrorHandler(message, source, lineno, colno, error);
            }
            return false;
        };
        
        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason && event.reason.message && 
                event.reason.message.includes('Cannot read properties of null') &&
                event.reason.stack && event.reason.stack.includes('panorama.js')) {
                console.warn('Caught unhandled panorama promise rejection:', event.reason);
                event.preventDefault();
                this.recoverFromError();
            }
        });
        
        this.errorHandlerInstalled = true;
    }
    
    private recoverFromError(): void {
        console.log('Attempting to recover from panorama error');
        
        // Clear the current panorama instance
        this.panoramaInstance = null;
        
        // Try to reinitialize if we have a position
        if (this.currentPosition) {
            setTimeout(() => {
                this.initializePanorama(this.currentPosition!);
            }, 500);
        }
    }
    
    private setupActivitySimulation(): void {
        // Clear any existing interval
        if (this.activityInterval) {
            clearInterval(this.activityInterval);
        }
        
        // Simulate user activity to prevent inactivity timeout
        this.activityInterval = setInterval(() => {
            if (this.panoramaInstance) {
                try {
                    // Try to get current camera to simulate activity
                    const camera = this.panoramaInstance.getCamera();
                    if (camera) {
                        // Make a tiny adjustment to simulate activity
                        this.panoramaInstance.setCamera({
                            yaw: camera.yaw + 0.00001,
                            pitch: camera.pitch
                        });
                    }
                } catch (e) {
                    // Ignore errors in activity simulation
                }
            }
        }, 30000); // Every 30 seconds
    }
    
    private initializePegmanIcon(): void {
        // Create custom pegman icon
        if (window.L) {
            this.pegmanIcon = L.icon({
                iconUrl: 'src/pegman.png',
                iconSize: [32, 32],    
                iconAnchor: [16, 32],   
                popupAnchor: [0, -32]  
            });
            console.log('Custom pegman icon initialized');
        }
    }

    private loadLeaflet(callback: () => void): void {
        // Check if Leaflet is already loaded
        if (window.L) {
            callback();
            return;
        }

        if (document.querySelector('link[href*="leaflet.css"]') && 
            document.querySelector('script[src*="leaflet.js"]')) {
            const checkInterval = setInterval(() => {
                if (window.L) {
                    clearInterval(checkInterval);
                    callback();
                }
            }, 100);
            return;
        }

        // Load Leaflet CSS
        const linkElement = document.createElement('link');
        linkElement.rel = 'stylesheet';
        linkElement.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        linkElement.crossOrigin = '';
        document.head.appendChild(linkElement);

        // Load Leaflet JS
        const scriptElement = document.createElement('script');
        scriptElement.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        scriptElement.crossOrigin = '';
        scriptElement.onload = callback;
        document.head.appendChild(scriptElement);
    }

    private loadPanoramaScript(callback: () => void): void {
        if (window.Panorama) {
            callback();
            return;
        }
        
        if (document.querySelector('script[src*="panorama.js"]')) {
            const checkInterval = setInterval(() => {
                if (window.Panorama) {
                    clearInterval(checkInterval);
                    callback();
                }
            }, 100);
            return;
        }
        
        // Load the panorama script
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://api.mapy.cz/js/panorama/v1/panorama.js';
        script.onload = () => {
            this.patchPanoramaLibrary();
            setTimeout(callback, 100);
        };
        document.head.appendChild(script);
    }
    
    private patchPanoramaLibrary(): void {
        // Patch the problematic functions in the panorama library
        if (window.Panorama) {
            const originalPanoramaFromPosition = window.Panorama.panoramaFromPosition;
            window.Panorama.panoramaFromPosition = async function(opts: any) {
                try {
                    const result = await originalPanoramaFromPosition.call(window.Panorama, opts);
                    
                    // Patch the result to handle errors better
                    if (result && result.destroy) {
                        const originalDestroy = result.destroy;
                        result.destroy = function() {
                            try {
                                originalDestroy.call(this);
                            } catch (e) {
                                console.warn('Error in panorama destroy, handling gracefully:', e);
                            }
                        };
                    }
                    
                    return result;
                } catch (e) {
                    console.error('Error in patched panoramaFromPosition:', e);
                    throw e;
                }
            };
        }
    }

    public initializeMap(containerId: string, options: MapOptions): void {
        // Store the initial position
        this.currentPosition = options.center;
        
        // Load Leaflet and initialize map
        this.loadLeaflet(() => {
            // Get the map container
            const container = document.getElementById(containerId);
            if (!container) {
                console.error('Map container not found');
                return;
            }
            
            // Clean up existing map instance if it exists
            if (this.map) {
                console.log('Removing existing map instance');
                this.map.off(); 
                this.map.remove();
                this.map = null;
            }
            
            // Reset the _leaflet_id property on the container
            const leafletContainer = L.DomUtil.get(containerId) as HTMLElement & { _leaflet_id?: number };
            if (leafletContainer && leafletContainer._leaflet_id) {
                leafletContainer._leaflet_id = undefined;
            }
            
            // Initialize the map
            this.map = L.map(container).setView(
                [options.center.lat, options.center.lng], 
                options.zoom || 16
            );

            // Map type
            this.setMapType(options.mapTypeId || this.currentMapType);

            // Required attribution logo
            const logoContainer = document.createElement('div');
            logoContainer.innerHTML = `<img src="https://mapy.com/img/logo/com/logo.svg" alt="Mapy.cz" style="width:80px;height:auto;"/>`;
            logoContainer.style.position = 'absolute';
            logoContainer.style.bottom = '8px';
            logoContainer.style.left = '8px';
            logoContainer.style.zIndex = '1000';
            container.appendChild(logoContainer);

            // Map type control
            this.addMapTypeControl();

            // Click listener to the map
            this.map.on('click', (e: any) => {
                const position = {
                    lat: e.latlng.lat,
                    lng: e.latlng.lng
                };
                
                // Update current position
                this.currentPosition = position;
                
                // Add or update marker
                if (!this.clickMarker) {
                    this.clickMarker = L.marker([position.lat, position.lng]).addTo(this.map);
                } else {
                    this.clickMarker.setLatLng([position.lat, position.lng]);
                }
                
                // Call the map click callback if set
                if (this.mapClickCallback) {
                    this.mapClickCallback(position);
                }
                
                // Initialize panorama at this position
                this.setStreetViewPosition(position);
            });

            // Place initial marker at start position if provided
            if (this.currentPosition) {
                this.clickMarker = L.marker(
                    [this.currentPosition.lat, this.currentPosition.lng]
                ).addTo(this.map);
            }
        });
    }

    // Add a new method to create and add map type control
    private addMapTypeControl(): void {
        if (!this.map) return;
        
        const MapTypeControl = L.Control.extend({
            options: {
                position: 'topleft'
            },
            
            onAdd: (map: any) => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                container.style.backgroundColor = 'white';
                container.style.padding = '5px';
                
                // Create roadmap button
                const roadmapButton = L.DomUtil.create('button', '', container);
                roadmapButton.innerHTML = 'Map';
                roadmapButton.style.marginRight = '5px';
                roadmapButton.style.cursor = 'pointer';
                roadmapButton.style.padding = '5px 10px';
                roadmapButton.style.border = this.currentMapType === 'roadmap' ? '2px solid #3388ff' : '1px solid #ccc';
                roadmapButton.style.backgroundColor = this.currentMapType === 'roadmap' ? '#e6f2ff' : 'white';
                roadmapButton.style.borderRadius = '3px';
                
                // Create hybrid button
                const hybridButton = L.DomUtil.create('button', '', container);
                hybridButton.innerHTML = 'Satellite';
                hybridButton.style.cursor = 'pointer';
                hybridButton.style.padding = '5px 10px';
                hybridButton.style.border = this.currentMapType === 'hybrid' ? '2px solid #3388ff' : '1px solid #ccc';
                hybridButton.style.backgroundColor = this.currentMapType === 'hybrid' ? '#e6f2ff' : 'white';
                hybridButton.style.borderRadius = '3px';
                
                // Add click listeners
                L.DomEvent.on(roadmapButton, 'click', (e) => {
                    L.DomEvent.stop(e);
                    this.setMapType('roadmap');
                    roadmapButton.style.border = '2px solid #3388ff';
                    roadmapButton.style.backgroundColor = '#e6f2ff';
                    hybridButton.style.border = '1px solid #ccc';
                    hybridButton.style.backgroundColor = 'white';
                });
                
                L.DomEvent.on(hybridButton, 'click', (e) => {
                    L.DomEvent.stop(e);
                    this.setMapType('hybrid');
                    hybridButton.style.border = '2px solid #3388ff';
                    hybridButton.style.backgroundColor = '#e6f2ff';
                    roadmapButton.style.border = '1px solid #ccc';
                    roadmapButton.style.backgroundColor = 'white';
                });
                
                // Prevent map click events when interacting with the control
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);
                
                return container;
            }
        });
        
        new MapTypeControl().addTo(this.map);
    }

    public setMapType(mapTypeId: string): void {
        if (!this.map) return;
        
        // Store the current map type
        this.currentMapType = mapTypeId;
        console.log(`Changing map type to: ${mapTypeId}`);
        // Remove existing tile layers
        if (this.baseTileLayer) {
            this.map.removeLayer(this.baseTileLayer);
            this.baseTileLayer = null;
        }
        
        if (this.namesOverlayLayer) {
            this.map.removeLayer(this.namesOverlayLayer);
            this.namesOverlayLayer = null;
        }
        
        // Tile layer based on map type
        if (mapTypeId === 'hybrid') {
            // Satellite imagery base layer
            this.baseTileLayer = L.tileLayer(
                `https://api.mapy.cz/v1/maptiles/aerial/256/{z}/{x}/{y}?apikey=${this.apiKey}`,
                {
                    tileSize: 256,
                    minZoom: 0,
                    maxZoom: 20,
                    detectRetina: true,
                    attribution: '&copy; <a href="https://mapy.cz/">Mapy.cz</a>, © <a href="https://www.openstreetmap.org/copyright">OSM contributors</a>'
                }
            ).addTo(this.map);
            
            // Add names overlay layer on top of satellite imagery
            this.namesOverlayLayer = L.tileLayer(
                `https://api.mapy.cz/v1/maptiles/names-overlay/256/{z}/{x}/{y}?apikey=${this.apiKey}`,
                {
                    tileSize: 256,
                    minZoom: 0,
                    maxZoom: 20,
                    detectRetina: true
                }
            ).addTo(this.map);
        } else {
            // Default to basic road map
            this.baseTileLayer = L.tileLayer(
                `https://api.mapy.cz/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${this.apiKey}`,
                {
                    tileSize: 256,
                    maxZoom: 20,
                    detectRetina: true,
                    attribution: '&copy; <a href="https://mapy.cz/">Mapy.cz</a>, © <a href="https://www.openstreetmap.org/copyright">OSM contributors</a>'
                }
            ).addTo(this.map);
        }
    }

    public initializeStreetView(containerId: string, options: StreetViewOptions): void {
        // Store the initial position and orientation
        this.currentPosition = options.position;
        this.currentHeading = options.pov.heading;
        this.currentPitch = options.pov.pitch;
        
        // Load the panorama script and initialize
        this.loadPanoramaScript(() => {
            // Initialize the panorama at the given position
            this.setStreetViewPosition(options.position);
        });
    }

    private async initializePanorama(position: LatLng): Promise<void> {
        // Prevent concurrent initializations
        if (this.initializationPromise) {
            console.log('Panorama initialization already in progress, waiting...');
            await this.initializationPromise;
            return;
        }

        // Validate panorama API
        if (!window.Panorama) {
            console.error('Panorama API not loaded');
            this.loadPanoramaScript(() => {
                this.initializePanorama(position);
            });
            return;
        }
        
        const container = document.getElementById('street-view-container');
        if (!container) {
            console.error('Street view container not found');
            return;
        }

        // Promise to track initialization
        this.initializationPromise = new Promise<void>(async (resolve) => {
            try {
                // Destroy any existing panorama
                await this.destroyPanorama();
                await new Promise(res => setTimeout(res, 200));
                
                console.log(`Initializing panorama at position: ${position.lat}, ${position.lng}`);
                
                // Clear the container completely
                container.innerHTML = '';
                
                // Create a single panorama container that will be reused
                this.panoramaContainer = document.createElement('div');
                this.panoramaContainer.id = 'mapy-panorama-container';
                this.panoramaContainer.style.width = '100%';
                this.panoramaContainer.style.height = '100%';
                container.appendChild(this.panoramaContainer);
                
                // Initialize the panorama
                try {
                    const result = await window.Panorama.panoramaFromPosition({
                        parent: this.panoramaContainer,
                        lon: position.lng,
                        lat: position.lat,
                        apiKey: this.apiKey,
                        yaw: this.currentHeading * (Math.PI / 180),
                        pitch: this.currentPitch * (Math.PI / 180),
                        showNavigation: true,
                        lang: 'en',
                        hideErrors: true
                    });

                    if (result.errorCode && result.errorCode !== 'NONE') {
                        console.warn(`Panorama error: ${result.errorCode} - ${result.error}`);
                        this.showError(result.error || result.errorCode);
                        resolve();
                        return;
                    }
                    
                    // Store the panorama instance
                    this.panoramaInstance = result;
                    this.isDestroying = false;
                    
                    // Start activity simulation to prevent inactivity
                    this.setupActivitySimulation();
                    
                    // Set up event listeners
                    this.setupPanoramaEventListeners();
                    
                    resolve();
                } catch (error) {
                    console.error('Failed to initialize panorama:', error);
                    this.showError('Failed to load panorama');
                    resolve();
                }
            } catch (error) {
                console.error('Failed to initialize panorama:', error);
                resolve();
            } finally {
                this.initializationPromise = null;
            }
        });

        return this.initializationPromise;
    }

    private showError(message: string): void {
        const container = document.getElementById('street-view-container');
        if (container) {
            container.innerHTML = `
                <div style="display:flex;justify-content:center;align-items:center;height:100%;background:#f5f5f5;flex-direction:column;">
                    <p>${message}</p>
                </div>
            `;
        }
    }
    
    public async destroyPanorama(): Promise<void> {
        // Clear activity simulation
        if (this.activityInterval) {
            clearInterval(this.activityInterval);
            this.activityInterval = null;
        }
        
        // Prevent concurrent destruction
        if (this.isDestroying) {
            console.log('Panorama destruction already in progress');
            return;
        }

        this.isDestroying = true;
        
        // Clear any debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        
        // Clear POV application interval
        if (this.povApplicationInterval) {
            clearInterval(this.povApplicationInterval);
            this.povApplicationInterval = null;
        }
        
        // Destroy panorama instance
        if (this.panoramaInstance) {
            try {
                // First remove all event listeners to prevent callbacks
                if (typeof this.panoramaInstance.removeListener === 'function') {
                    try {
                        this.panoramaInstance.removeListener('pano-view');
                        this.panoramaInstance.removeListener('pano-place');
                    } catch (e) {
                        console.warn('Error removing specific listeners:', e);
                    }
                }
                
                // Now destroy the panorama itself - with error handling
                if (typeof this.panoramaInstance.destroy === 'function') {
                    try {
                        this.panoramaInstance.destroy();
                        console.log('Successfully destroyed panorama instance');
                    } catch (e) {
                        console.warn('Error destroying panorama, continuing anyway:', e);
                    }
                }
            } catch (e) {
                console.warn('Error during panorama cleanup:', e);
            }
            
            // Always null the reference even if errors occurred
            this.panoramaInstance = null;
        }

        // Clear the panorama container
        if (this.panoramaContainer && this.panoramaContainer.parentNode) {
            this.panoramaContainer.parentNode.removeChild(this.panoramaContainer);
            this.panoramaContainer = null;
        }

        this.isDestroying = false;
    }
    
    private setupPanoramaEventListeners(): void {
        if (!this.panoramaInstance) return;
        
        console.log('Setting up panorama event listeners');
        
        // Listen for view changes (rotation, tilt)
        this.panoramaInstance.addListener('pano-view', (e: any) => {
            if (!this.panoramaInstance) return;
            
            try {
                // Get current camera info
                const camera = this.panoramaInstance.getCamera();
                if (!camera) return;
                
                // Update current heading and pitch
                this.currentHeading = camera.yaw * (180 / Math.PI);
                this.currentPitch = camera.pitch * (180 / Math.PI);
                
                if (this.streetViewChangeCallback && this.currentPosition) {
                    // Use debouncing to reduce callback frequency
                    if (this.debounceTimer) clearTimeout(this.debounceTimer);
                    
                    this.debounceTimer = setTimeout(() => {
                        this.streetViewChangeCallback!(
                            this.currentPosition!,
                            this.currentHeading,
                            this.currentPitch
                        );
                    }, 300);
                }
            } catch (e) {
                console.warn('Error handling panorama view change:', e);
            }
        });
        
        // Listen for location changes
        this.panoramaInstance.addListener('pano-place', (placeData: any) => {
            console.log('Panorama place changed', placeData);
            
            try {
                // Extract position directly from event data
                let newPosition: LatLng;
                
                if (placeData && placeData.info) {
                    // Get position from event data - primary source of truth
                    newPosition = {
                        lat: placeData.info.lat,
                        lng: placeData.info.lon
                    };
                    console.log(`Using position FROM EVENT: ${newPosition.lat}, ${newPosition.lng}`);
                } else if (this.panoramaInstance && this.panoramaInstance.info) {
                    // Fallback to panorama instance info
                    newPosition = {
                        lat: this.panoramaInstance.info.lat,
                        lng: this.panoramaInstance.info.lon
                    };
                    console.log(`Using position FROM PANORAMA: ${newPosition.lat}, ${newPosition.lng}`);
                } else {
                    console.warn('No position data available in event or panorama');
                    return;
                }
                
                console.log(`Processing panorama move to: ${newPosition.lat}, ${newPosition.lng}`);
                
                // Update pegman position with this exact position
                this.setPegmanPosition(newPosition);
                this.setPegmanVisible(true);
                
                // Update map center
                if (this.map) {
                    this.map.setView([newPosition.lat, newPosition.lng], this.map.getZoom());
                }
                
                // Update current position
                this.currentPosition = {...newPosition};
                
                // Call the change callback with the new position
                if (this.streetViewChangeCallback) {
                    this.streetViewChangeCallback(
                        newPosition,
                        this.currentHeading,
                        this.currentPitch
                    );
                }
                
                console.log(`Position successfully updated to: ${newPosition.lat}, ${newPosition.lng}`);
            } catch (e) {
                console.error('Error handling panorama place change:', e);
            }
        });
    }

    public setCenter(position: LatLng): void {
        // Store the position
        this.currentPosition = position;
        
        // Update the map center if the map is initialized
        if (this.map) {
            this.map.setView([position.lat, position.lng], this.map.getZoom());
        }
    }

    public setZoom(zoom: number): void {
        // Update the map zoom if the map is initialized
        if (this.map) {
            this.map.setZoom(zoom);
        }
    }

    public setStreetViewPosition(position: LatLng): void {
        // Store the position
        this.currentPosition = position;
        
        // Update marker on map if available
        if (this.map && this.clickMarker) {
            this.setPegmanPosition(position);
            this.setPegmanVisible(true);
        }
        
        // Initialize/update the panorama
        this.initializePanorama(position);
    }

    // Method to get the current position - always returns the most up-to-date position
    public getCurrentPosition(): LatLng {
        // If we have a panorama instance with info, use that as the most authoritative source
        if (this.panoramaInstance && this.panoramaInstance.info) {
            return {
                lat: this.panoramaInstance.info.lat,
                lng: this.panoramaInstance.info.lon
            };
        }
        
        // Otherwise return the stored position
        return this.currentPosition || { lat: 0, lng: 0 };
    }

    // Get current street view state (for provider switching)
    public getStreetViewState(): any {
        return {
            position: this.getCurrentPosition(),
            heading: this.currentHeading,
            pitch: this.currentPitch
        };
    }

    private applyPov(heading: number, pitch: number): void {
        if (!this.panoramaInstance) return;
        
        console.log(`Applying POV: heading=${heading}, pitch=${pitch}`);
        
        try {
            // Clear any existing interval
            if (this.povApplicationInterval) {
                clearInterval(this.povApplicationInterval);
                this.povApplicationInterval = null;
            }
            
            // Store these values
            this.currentHeading = heading;
            this.currentPitch = pitch;
            
            // Apply POV immediately
            this.panoramaInstance.setCamera({
                yaw: heading * (Math.PI / 180),
                pitch: pitch * (Math.PI / 180)
            });
            
            // Set up interval to verify POV was applied correctly
            let attempts = 0;
            this.povApplicationInterval = setInterval(() => {
                if (!this.panoramaInstance) {
                    clearInterval(this.povApplicationInterval);
                    this.povApplicationInterval = null;
                    return;
                }
                
                try {
                    const camera = this.panoramaInstance.getCamera();
                    if (!camera) return;
                    
                    // Check if POV is close to what we wanted
                    const currentHeading = camera.yaw * (180 / Math.PI);
                    const currentPitch = camera.pitch * (180 / Math.PI);
                    
                    const headingDiff = Math.abs(currentHeading - heading);
                    const pitchDiff = Math.abs(currentPitch - pitch);
                    
                    if (headingDiff < 2 && pitchDiff < 2) {
                        console.log('POV successfully applied');
                        clearInterval(this.povApplicationInterval);
                        this.povApplicationInterval = null;
                        return;
                    }
                    
                    if (attempts < 5) {
                        // Retry applying POV
                        console.log(`Retrying POV application (attempt ${attempts+1}): heading=${heading}, pitch=${pitch}`);
                        this.panoramaInstance.setCamera({
                            yaw: heading * (Math.PI / 180),
                            pitch: pitch * (Math.PI / 180)
                        });
                        attempts++;
                    } else {
                        console.log('Failed to apply POV after multiple attempts');
                        clearInterval(this.povApplicationInterval);
                        this.povApplicationInterval = null;
                    }
                } catch (e) {
                    console.warn('Error in POV verification:', e);
                    clearInterval(this.povApplicationInterval);
                    this.povApplicationInterval = null;
                }
            }, 300);
        } catch (e) {
            console.warn('Error applying POV:', e);
        }
    }

    public setStreetViewPOV(heading: number, pitch: number): void {
        // Store the orientation
        this.currentHeading = heading;
        this.currentPitch = pitch;
        
        // Update the panorama if it's initialized
        if (this.panoramaInstance) {
            console.log(`Setting POV: heading=${heading}, pitch=${pitch}`);
            this.applyPov(heading, pitch);
        }
    }

    public setPegmanPosition(position: LatLng): void {
        if (!position) {
            console.warn('Invalid position provided to setPegmanPosition');
            return;
        }
        
        console.log(`Setting pegman position to: ${position.lat}, ${position.lng}`);
        
        // Store the position
        this.currentPosition = position;
        
        // Update marker on map
        if (this.map) {
            try {
                if (!this.clickMarker) {
                    this.clickMarker = L.marker(
                        [position.lat, position.lng],
                        { icon: this.pegmanIcon || undefined }
                    ).addTo(this.map);
                } else {
                    try {
                        if (this.map.hasLayer && this.map.hasLayer(this.clickMarker)) {
                            this.map.removeLayer(this.clickMarker);
                        }
                    } catch (e) {
                        // Ignore errors if marker wasn't on map
                    }
                    
                    // Create new marker with custom icon
                    this.clickMarker = L.marker(
                        [position.lat, position.lng],
                        { icon: this.pegmanIcon || undefined }
                    ).addTo(this.map);
                }
            } catch (e) {
                console.warn('Error updating pegman position:', e);
                
                // Fallback: Create a new marker entirely with custom icon
                try {
                    if (this.clickMarker && this.map.hasLayer && this.map.hasLayer(this.clickMarker)) {
                        this.map.removeLayer(this.clickMarker);
                    }
                    this.clickMarker = L.marker(
                        [position.lat, position.lng],
                        { icon: this.pegmanIcon || undefined }
                    ).addTo(this.map);
                } catch (e2) {
                    console.error('Critical error updating pegman position:', e2);
                }
            }
        }
    }

    public setPegmanVisible(visible: boolean): void {
        // Show/hide the marker
        if (this.clickMarker && this.map) {
            try {
                if (visible) {
                    if (this.map.hasLayer && !this.map.hasLayer(this.clickMarker)) {
                        this.clickMarker.addTo(this.map);
                    }
                } else {
                    if (this.map.hasLayer && this.map.hasLayer(this.clickMarker)) {
                        this.map.removeLayer(this.clickMarker);
                    }
                }
            } catch (e) {
                console.warn('Error setting pegman visibility:', e);
            }
        }
    }

    public showCoverage(position?: LatLng): void {
    }

    public hideCoverage(): void {
    }

    public onMapClick(callback: (position: LatLng) => void): void {
        this.mapClickCallback = callback;
    }

    public onStreetViewChange(callback: (position: LatLng, heading: number, pitch: number) => void): void {
        this.streetViewChangeCallback = callback;
    }
    
    public async cleanup(): Promise<void> {
        console.log('Performing full MapyCzProvider cleanup');
        
        // Clear activity simulation
        if (this.activityInterval) {
            clearInterval(this.activityInterval);
            this.activityInterval = null;
        }
        
        // Clean up panorama
        await this.destroyPanorama();
        
        // Clean up tile layers
        if (this.map) {
            if (this.baseTileLayer) {
                this.map.removeLayer(this.baseTileLayer);
                this.baseTileLayer = null;
            }
            
            if (this.namesOverlayLayer) {
                this.map.removeLayer(this.namesOverlayLayer);
                this.namesOverlayLayer = null;
            }
            
            try {
                this.map.off(); 
                this.map.remove(); 
            } catch (e) {
                console.warn('Error removing Leaflet map:', e);
            }
            this.map = null;
        }
        
        // Reset markers
        if (this.clickMarker) {
            try {
                if (this.map && this.map.hasLayer && this.map.hasLayer(this.clickMarker)) {
                    this.map.removeLayer(this.clickMarker);
                }
            } catch (e) {
                console.warn('Error removing click marker:', e);
            }
            this.clickMarker = null;
        }
        
        // Clear callbacks
        this.mapClickCallback = null;
        this.streetViewChangeCallback = null;
    }
}

// Define window interface for TypeScript
declare global {
    interface Window {
        Panorama?: any;
        L?: any;
        currentMapProvider?: any;
    }
}