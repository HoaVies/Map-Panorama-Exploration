import { IMapProvider, LatLng, MapOptions, StreetViewOptions } from './IMapProvider.js';

export class YandexMapsProvider implements IMapProvider {
    private map: ymaps.Map | null = null;
    private panoramaPlayer: ymaps.Player | null = null;
    private pegmanMarker: ymaps.Placemark | null = null;
    private mapClickCallback: ((position: LatLng) => void) | null = null;
    private streetViewChangeCallback: ((position: LatLng, heading: number, pitch: number) => void) | null = null;
    private mapContainer: HTMLElement | null = null;
    private panoramaContainer: HTMLElement | null = null;
    private coverageShown: boolean = false;

    public initializeMap(containerId: string, options: MapOptions): void {
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
            this.map.events.add('click', (e: any) => {
                if (this.mapClickCallback) {
                    const coords = e.get('coords');
                    const latLng: LatLng = {
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

    public initializeStreetView(containerId: string, options: StreetViewOptions): void {
        this.panoramaContainer = document.getElementById(containerId);
        if (!this.panoramaContainer || !this.map) {
            console.error('Street view container or map not found');
            return;
        }

        // Create pegman marker
        this.pegmanMarker = new ymaps.Placemark(
            [options.position.lat, options.position.lng],
            { hintContent: 'Street View Pegman' },
            {
                draggable: true,
                preset: 'islands#redDotIcon'
            }
        );

        // Add marker to map
        this.map.geoObjects.add(this.pegmanMarker);

        // Handle pegman drag events
        this.pegmanMarker.events.add('dragend', () => {
            if (!this.pegmanMarker) return;
            
            const coords = this.pegmanMarker.geometry.getCoordinates();
            this.checkPanoramaAvailability(coords);
        });

        // Try to initialize panorama with given position
        this.checkPanoramaAvailability([options.position.lat, options.position.lng]);
    }

    private checkPanoramaAvailability(coords: number[]): void {
        ymaps.panorama.locate(coords).then((panoramas) => {
            if (panoramas.length > 0) {
                if (!this.panoramaContainer) return;
                
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
                        if (!this.panoramaPlayer || !this.streetViewChangeCallback) return;
                        
                        const position = this.panoramaPlayer.getPosition();
                        const direction = this.panoramaPlayer.getDirection();
                        
                        this.streetViewChangeCallback(
                            { lat: position[0], lng: position[1] },
                            direction[0], // heading
                            direction[1]  // pitch
                        );
                    });
                    
                    // Similar null checks for other event handlers...
                    
                    // Make sure the container exists before modifying its style
                    if (this.panoramaContainer) {
                        this.panoramaContainer.style.display = 'block';
                    }
                });
            } else {
                console.warn('No panorama available at this location');
                if (this.panoramaContainer) {
                    this.panoramaContainer.style.display = 'none';
                }
            }
        });
    }

    public setCenter(position: LatLng): void {
        if (this.map) {
            this.map.setCenter([position.lat, position.lng]);
        }
    }

    public setZoom(zoom: number): void {
        if (this.map) {
            this.map.setZoom(zoom);
        }
    }

    public setMapType(mapTypeId: string): void {
        if (this.map) {
            this.map.setType(this.getYandexMapType(mapTypeId));
        }
    }

    public setStreetViewPosition(position: LatLng): void {
        if (this.pegmanMarker) {
            this.pegmanMarker.geometry.setCoordinates([position.lat, position.lng]);
        }
        
        this.checkPanoramaAvailability([position.lat, position.lng]);
    }

    public setStreetViewPOV(heading: number, pitch: number): void {
        if (this.panoramaPlayer) {
            this.panoramaPlayer.setDirection([heading, pitch]);
        }
    }

    public setPegmanPosition(position: LatLng): void {
        if (this.pegmanMarker) {
            this.pegmanMarker.geometry.setCoordinates([position.lat, position.lng]);
        }
    }

    public setPegmanVisible(visible: boolean): void {
        if (this.pegmanMarker && this.map) {
            if (visible) {
                this.map.geoObjects.add(this.pegmanMarker);
            } else {
                this.map.geoObjects.remove(this.pegmanMarker);
            }
        }
    }

    public showCoverage(position: LatLng): void {
        // Yandex doesn't have a direct equivalent to showing street view coverage
        // Instead, we can try to check if panorama is available at the position
        this.coverageShown = true;
        console.warn('Direct panorama coverage display is not available in Yandex Maps API');
    }

    public hideCoverage(): void {
        this.coverageShown = true;
    }

    public onMapClick(callback: (position: LatLng) => void): void {
        this.mapClickCallback = callback;
    }

    public onStreetViewChange(callback: (position: LatLng, heading: number, pitch: number) => void): void {
        this.streetViewChangeCallback = callback;
    }

    // Helper method to convert generic map types to Yandex map types
    private getYandexMapType(mapTypeId: string): string {
        switch(mapTypeId.toLowerCase()) {
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