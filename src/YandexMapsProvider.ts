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
    private _originalOpenPlayer: any = null;
    
    // For POV management
    private pendingHeading: number | null = null;
    private pendingPitch: number | null = null;
    private pendingPovInterval: any = null;
    private coverageToggleButton: HTMLButtonElement | null = null;
    
    private createCoverageToggleButton(): void {
        if (!this.map) return;
        
        const mapContainer = this.map.container.getElement();
        if (!mapContainer) return;
        
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'yandex-map-controls';
        controlsContainer.style.position = 'absolute';
        controlsContainer.style.top = '10px';
        controlsContainer.style.left = '10px';
        controlsContainer.style.zIndex = '10000';
        
        mapContainer.appendChild(controlsContainer);
        
        this.coverageToggleButton = document.createElement('button');
        this.coverageToggleButton.innerText = this.coverageVisible ? 
            'Turn on coverage Map' : 'Turn on coverage Map';
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
            } else {
                this.showCoverage();
            }
        });
        
        controlsContainer.appendChild(this.coverageToggleButton);
    }
    
    public initializeMap(containerId: string, options: MapOptions): void {
        ymaps.ready(() => {
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Container element with ID "${containerId}" not found`);
            }
    
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.minHeight = '300px';
    
            const center = [options.center.lat, options.center.lng];
            
            let mapType: string;
            switch (options.mapTypeId) {
                case 'satellite': mapType = 'yandex#satellite'; break;
                case 'hybrid': mapType = 'yandex#hybrid'; break;
                default: mapType = 'yandex#map';
            }
    
            setTimeout(() => {
                try {
                    this.map = new ymaps.Map(container, {
                        center: center,
                        zoom: options.zoom,
                        type: mapType,
                        controls: ['zoomControl', 'fullscreenControl', 'typeSelector'],
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
    
                    // Use the correct type for getPanoramaManager
                    (this.map.getPanoramaManager() as unknown as Promise<any>).then((manager: any) => {
                        this.panoramaManager = manager;
                        this.createCoverageToggleButton();
                        
                        // Set up event handling for the panorama manager
                        this.setupPanoramaManagerEvents();
                        this.setupMapEventListeners();
                        
                        // Add the pegman event handlers
                        this.setupPegmanEvents();
                    }).catch((error: any) => {
                        console.error("Error getting panorama manager:", error);
                    });
                } catch (error) {
                    console.error("Error creating Yandex map:", error);
                }
            }, 100);
        });
    }
    
private setupPanoramaManagerEvents(): void {
    if (!this.panoramaManager) return;
    
    // 1. Intercept BOTH before it tries to open and when it opens
    this.panoramaManager.events.add(['openplayer', 'beforeopenplayer'], (e: any) => {
        if (this.coverageVisible) {
            // Forcefully prevent the default panorama
            e.preventDefault();
            
            // Get panorama position - try multiple approaches
            let position: LatLng | null = null;
            
            // Try to get panorama from event
            const panorama = e.get('panorama');
            if (panorama && typeof panorama.getPosition === 'function') {
                try {
                    const coords = panorama.getPosition();
                    if (coords && coords.length >= 2) {
                        position = {
                            lat: coords[0],
                            lng: coords[1]
                        };
                    }
                } catch (err) {
                    console.warn('Error getting panorama position:', err);
                }
            }
            
            // If we couldn't get position from panorama, try event data
            if (!position) {
                const point = e.get('point');
                if (point && point.length >= 2) {
                    position = {
                        lat: point[0],
                        lng: point[1]
                    };
                }
            }
            
            // If we got a position, use it
            if (position) {
                // Update pegman position
                this.setPegmanPosition(position);
                this.setPegmanVisible(true);
                
                // Open our own panorama view
                this.setStreetViewPosition(position);
                
                // Call the map click callback
                if (this.mapClickCallback) {
                    this.mapClickCallback(position);
                }
            }
            
            return false; // Ensure we explicitly return false to prevent default
        }
    });
    
    // 2. Monitor when a player is already opened and intercept it
    this.panoramaManager.events.add('closeplayer', () => {
        // If our custom panorama is active, prevent closing it
        if (this.coverageVisible && this.panoramaPlayer) {
            console.log('Intercepted panorama close event');
            // Optional: handle any cleanup needed
        }
    });
    
    // 3. Also intercept the locate event which happens before opening
    this.panoramaManager.events.add('locate', (e: any) => {
        if (this.coverageVisible) {
            console.log('Panorama locate event intercepted');
            
            // Get the point from the event
            const point = e.get('point');
            if (point && point.length >= 2) {
                const position = {
                    lat: point[0],
                    lng: point[1]
                };
                
                // Synchronize our pegman to this position
                this.setPegmanPosition(position);
                
                // Optionally notify about the click
                if (this.mapClickCallback) {
                    this.mapClickCallback(position);
                }
                
                // Prevent the default panorama lookup
                e.preventDefault();
            }
        }
    });
}
    
private setupPegmanEvents(): void {
    if (!this.pegman) return;
    
    this.pegman.events.add('dragend', () => {
        if (!this.pegman) return;
        
        const coords = this.pegman.geometry.getCoordinates();
        const position = {
            lat: coords[0],
            lng: coords[1]
        };
        
        this.setStreetViewPosition(position);
    });
    
    this.pegman.events.add('click', (e: any) => {
        if (!this.pegman) return;
        
        // Prevent the event from bubbling up to the map
        e.preventDefault();
        
        const coords = this.pegman.geometry.getCoordinates();
        const position = {
            lat: coords[0],
            lng: coords[1]
        };
        
        // Open street view at the pegman's position
        this.setStreetViewPosition(position);
        
        // If you have a callback registered, notify it
        if (this.mapClickCallback) {
            this.mapClickCallback(position);
        }
        
        return false; // Explicitly return false to prevent default behavior
    });
}
    
    private setupMapEventListeners(): void {
        if (!this.map) return;
        
        // Handle all map-related events that could trigger a panorama
        ['click', 'dblclick'].forEach(eventName => {
            this.map!.events.add(eventName, (e: any) => {
                if (this.coverageVisible) {
                    // Always prevent default for these events when coverage is on
                    e.preventDefault();
                    
                    // Get click coordinates
                    const coords = e.get('coords');
                    const position = { lat: coords[0], lng: coords[1] };
                    
                    // Check if there's a panorama at this position
                    ymaps.panorama.locate(coords).then((panoramas: any[]) => {
                        if (panoramas && panoramas.length > 0) {
                            // Move pegman to this location and update our panorama
                            this.setPegmanPosition(position);
                            this.setPegmanVisible(true);
                            this.setStreetViewPosition(position);
                            
                            // Notify callback
                            if (this.mapClickCallback) {
                                this.mapClickCallback(position);
                            }
                        }
                    }).catch((error: any) => {
                        console.error('Error checking for panorama at location:', error);
                    });
                    
                    return false; // Explicitly return false to prevent default behavior
                }
                
            });
        });
        
        // Additionally, completely block the map's actiontick event when coverage is on
        // This event is often used for internal state updates in Yandex
        this.map.events.add('actiontick', (e: any) => {
            if (this.coverageVisible) {
                e.preventDefault();
                return false;
            }
        });
    }

    public setCenter(position: LatLng): void {
        if (!this.map) return;
        this.map.setCenter([position.lat, position.lng]);
    }

    public setZoom(zoom: number): void {
        if (!this.map) return;
        this.map.setZoom(zoom);
    }

    public setMapType(mapTypeId: string): void {
        if (!this.map) return;
        
        let mapType: string;
        switch (mapTypeId) {
            case 'satellite': mapType = 'yandex#satellite'; break;
            case 'hybrid': mapType = 'yandex#hybrid'; break;
            default: mapType = 'yandex#map';
        }
        
        this.map.setType(mapType);
    }

    public async initializeStreetView(containerId: string, options: StreetViewOptions): Promise<void> {
        return new Promise((resolve) => {
            ymaps.ready(async () => {
                const container = document.getElementById(containerId);
                if (!container) {
                    throw new Error(`Container element with ID "${containerId}" not found`);
                }
                
                container.style.width = '100%';
                container.style.height = '100%';
                container.style.minHeight = '300px';
                container.style.display = 'block';
                
                setTimeout(async () => {
                    try {
                        const position = [options.position.lat, options.position.lng];
                        
                        this.pendingHeading = options.pov.heading;
                        this.pendingPitch = options.pov.pitch;
                        
                        const panoramas = await ymaps.panorama.locate(position);
                        
                        if (panoramas && panoramas.length > 0) {
                            this.panoramaPlayer = new ymaps.panorama.Player(
                                container,
                                panoramas[0],
                                {
                                    direction: [options.pov.heading, options.pov.pitch],
                                    controls: ['zoomControl', 'fullscreenControl'],
                                    suppressMapOpenBlock: true, // Suppress the "Open in Yandex" link
                                    width: container.offsetWidth || 640,
                                    height: container.offsetHeight || 480
                                }
                            );
                            
                            this.currentPanoramaPosition = options.position;
                            this.setupPanoramaEventListeners();
                            this.setPegmanPosition(options.position);
                            this.setPegmanVisible(true);
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
        if (this.panoramaPlayer) {
            const currentDirection = this.panoramaPlayer.getDirection();
            this.pendingHeading = currentDirection[0];
            this.pendingPitch = currentDirection[1];
        }

        const yandexPosition = [position.lat, position.lng];
        
        try {
            const panoramas = await ymaps.panorama.locate(yandexPosition);
            
            if (panoramas && panoramas.length > 0) {
                if (this.panoramaPlayer) {
                    await this.panoramaPlayer.setPanorama(panoramas[0]);
                } else {
                    const container = document.getElementById('street-view-container');
                    if (container) {
                        this.panoramaPlayer = new ymaps.panorama.Player(
                            container,
                            panoramas[0],
                            {
                                direction: this.pendingHeading !== null && this.pendingPitch !== null ? 
                                    [this.pendingHeading, this.pendingPitch] : 'auto',
                                controls: ['zoomControl', 'fullscreenControl'],
                                suppressMapOpenBlock: true
                            }
                        );
                        
                        this.setupPanoramaEventListeners();
                    }
                }
                
                this.currentPanoramaPosition = position;
                
                if (this.pendingHeading !== null && this.pendingPitch !== null) {
                    setTimeout(() => this.applyPendingPov(), 500);
                }
                
                if (this.streetViewChangeCallback && this.panoramaPlayer) {
                    const direction = this.panoramaPlayer.getDirection();
                    this.streetViewChangeCallback(
                        position,
                        direction[0],
                        direction[1]
                    );
                }
                
                const container = document.getElementById('street-view-container');
                if (container) {
                    container.style.display = 'block';
                }
                
                this.setPegmanVisible(true);
            } else {
                console.log('No panorama available at the requested position');
                
                if (this.panoramaPlayer) {
                    try {
                        if (typeof this.panoramaPlayer.destroy === 'function') {
                            this.panoramaPlayer.destroy();
                        }
                    } catch (e) {
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
        } catch (error) {
            console.error('Error updating Yandex panorama position:', error);
        }
    }

    public setStreetViewPOV(heading: number, pitch: number): void {
        this.pendingHeading = heading;
        this.pendingPitch = pitch;
        
        if (this.panoramaPlayer) {
            this.applyPendingPov();
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
                this.pegman.options.set('visible', true);
                
                if (this.map && !this.pegman.getMap()) {
                    this.map.geoObjects.add(this.pegman);
                }
            } else {
                this.pegman.options.set('visible', false);
            }
        } catch (e) {
            console.warn('Error setting pegman visibility:', e);
        }
    }

public showCoverage(position?: LatLng): void {
    if (!this.map || !this.panoramaManager) return;
    
    // Enable panorama lookup to show the blue lines
    this.panoramaManager.enableLookup();
    this.coverageVisible = true;
    
    // Immediately after enabling lookup, check if there's already a player open
    const currentPlayer = this.panoramaManager.getPlayer();
    if (currentPlayer) {
        // Force close any existing panorama player
        this.panoramaManager.closePlayer();
    }

    
    // Add an extra protection - monitor for player creation
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
    
    public hideCoverage(): void {
        if (!this.map || !this.panoramaManager) return;
        
        this.coverageVisible = false;
        this.panoramaManager.disableLookup();
        
        if (this.coverageToggleButton) {
            this.coverageToggleButton.innerText = 'Click to enable coverage Map';
        }
        
        console.log('Panorama coverage disabled');
    }

    public onMapClick(callback: (position: LatLng) => void): void {
        this.mapClickCallback = callback;
    }

    public onStreetViewChange(callback: (position: LatLng, heading: number, pitch: number) => void): void {
        this.streetViewChangeCallback = callback;
    }

    private setupPanoramaEventListeners(): void {
        if (!this.panoramaPlayer) return;
        
        // Handle position changes
        this.panoramaPlayer.events.add('position_changed', () => {
            if (!this.panoramaPlayer || !this.currentPanoramaPosition) return;
            
            try {
                const panorama = this.panoramaPlayer.getPanorama();
                if (!panorama) return;
                
                let position;
                try {
                    position = panorama.getPosition();
                } catch (e) {
                    console.warn('Error getting panorama position:', e);
                    return;
                }
                
                if (!position || position.length < 2) return;
                
                const latLng = { 
                    lat: position[0], 
                    lng: position[1] 
                };
                
                this.currentPanoramaPosition = latLng;
                
                if (this.map && this.pegman) {
                    this.pegman.geometry.setCoordinates([latLng.lat, latLng.lng]);
                }
                
                if (this.map) {
                    this.map.setCenter([latLng.lat, latLng.lng]);
                }
                
                if (this.streetViewChangeCallback) {
                    const direction = this.panoramaPlayer.getDirection();
                    this.streetViewChangeCallback(
                        latLng,
                        direction[0],
                        direction[1]
                    );
                }
            } catch (error) {
                console.error('Error handling panorama position change:', error);
            }
        });
        
        // Handle direction changes
        this.panoramaPlayer.events.add('directionchange', () => {
            if (!this.panoramaPlayer || !this.currentPanoramaPosition) return;
            
            const direction = this.panoramaPlayer.getDirection();
            
            if (this.streetViewChangeCallback) {
                this.streetViewChangeCallback(
                    this.currentPanoramaPosition,
                    direction[0],
                    direction[1]
                );
            }
        });
    }

    private applyPendingPov(): void {
        if (!this.panoramaPlayer || this.pendingHeading === null || this.pendingPitch === null) return;
        
        // Clear existing interval
        if (this.pendingPovInterval) {
            clearInterval(this.pendingPovInterval);
            this.pendingPovInterval = null;
        }
        
        // Apply the POV immediately
        try {
            this.panoramaPlayer.setDirection([this.pendingHeading, this.pendingPitch]);
        } catch (e) {
            console.warn('Error setting panorama direction:', e);
        }
        
        // Set up a retry
        let attempts = 0;
        this.pendingPovInterval = setInterval(() => {
            if (!this.panoramaPlayer) {
                clearInterval(this.pendingPovInterval);
                this.pendingPovInterval = null;
                return;
            }
            
            try {
                const currentDirection = this.panoramaPlayer.getDirection();
                const headingDiff = Math.abs(currentDirection[0] - this.pendingHeading!);
                const pitchDiff = Math.abs(currentDirection[1] - this.pendingPitch!);
                
                if (headingDiff < 2 && pitchDiff < 2 || attempts >= 5) {
                    clearInterval(this.pendingPovInterval);
                    this.pendingPovInterval = null;
                    return;
                }
                
                this.panoramaPlayer.setDirection([this.pendingHeading!, this.pendingPitch!]);
                attempts++;
            } catch (e) {
                clearInterval(this.pendingPovInterval);
                this.pendingPovInterval = null;
            }
        }, 300);
    }
}