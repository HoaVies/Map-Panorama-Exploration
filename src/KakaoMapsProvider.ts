import { IMapProvider, LatLng, MapOptions, StreetViewOptions } from './IMapProvider.js';

export class KakaoMapsProvider implements IMapProvider {
    private map: kakao.maps.Map | null = null;
    private roadview: kakao.maps.Roadview | null = null;
    private roadviewClient: kakao.maps.RoadviewClient | null = null;
    private pegmanMarker: kakao.maps.Marker | null = null;
    private mapClickCallback: ((position: LatLng) => void) | null = null;
    private roadviewChangeCallback: ((position: LatLng, heading: number, pitch: number) => void) | null = null;
    private mapContainer: HTMLElement | null = null;
    private roadviewContainer: HTMLElement | null = null;
    private overlayOn: boolean = false;
    private isProcessingEvent: boolean = false; // Flag to prevent recursion

    public initializeMap(containerId: string, options: MapOptions): void {
        this.mapContainer = document.getElementById(containerId);
        if (!this.mapContainer) {
            console.error('Map container not found');
            return;
        }

        const mapOptions = {
            center: new kakao.maps.LatLng(options.center.lat, options.center.lng),
            level: this.convertZoomToLevel(options.zoom)
        };

        this.map = new kakao.maps.Map(this.mapContainer, mapOptions);
        this.roadviewClient = new kakao.maps.RoadviewClient();
        
        // Set map type
        this.setMapType(options.mapTypeId);

        // Initialize click handler
        if (this.map) {
            kakao.maps.event.addListener(this.map, 'click', (mouseEvent: any) => {
                if (this.isProcessingEvent) return; // Prevent recursion
                
                this.isProcessingEvent = true;
                try {
                    const latlng = mouseEvent.latLng;
                    if (this.mapClickCallback && latlng) {
                        this.mapClickCallback({
                            lat: latlng.getLat(),
                            lng: latlng.getLng()
                        });
                        
                        // If we have a pegman marker, update its position
                        if (this.pegmanMarker) {
                            this.pegmanMarker.setPosition(latlng);
                        }
                        
                        // Update roadview only if overlay is active
                        if (this.overlayOn) {
                            this.toggleRoadview(latlng);
                        }
                    }
                } finally {
                    this.isProcessingEvent = false;
                }
            });
        }
    }

    public initializeStreetView(containerId: string, options: StreetViewOptions): void {
        this.roadviewContainer = document.getElementById(containerId);
        if (!this.roadviewContainer || !this.map) {
            console.error('Street view container or map not found');
            return;
        }

        // Create roadview object
        this.roadview = new kakao.maps.Roadview(this.roadviewContainer);
        
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
        
        // Create draggable marker (pegman), but don't add to map yet
        this.pegmanMarker = new kakao.maps.Marker({
            image: markImage,
            position: new kakao.maps.LatLng(options.position.lat, options.position.lng),
            draggable: true
        });
        
        // Initially hide the roadview container
        if (this.roadviewContainer) {
            this.roadviewContainer.style.display = 'none';
        }
        
        // Add position_changed event listener to roadview
        if (this.roadview) {
            kakao.maps.event.addListener(this.roadview, 'position_changed', () => {
                if (this.isProcessingEvent) return; // Prevent recursion
                
                this.isProcessingEvent = true;
                try {
                    if (!this.roadview) return;
                    
                    // Get current roadview position
                    const rvPosition = this.roadview.getPosition();
                    if (!rvPosition) return;
                    
                    // Update map center
                    if (this.map) {
                        this.map.setCenter(rvPosition);
                    }
                    
                    // Update pegman marker if visible
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
                if (this.isProcessingEvent) return; // Prevent recursion
                
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
        
        // Add dragend event to pegman marker
        if (this.pegmanMarker) {
            kakao.maps.event.addListener(this.pegmanMarker, 'dragend', () => {
                if (this.isProcessingEvent) return; // Prevent recursion
                
                this.isProcessingEvent = true;
                try {
                    if (!this.pegmanMarker) return;
                    
                    const position = this.pegmanMarker.getPosition();
                    this.toggleRoadview(position);
                } finally {
                    this.isProcessingEvent = false;
                }
            });
        }
    }

    // Function to toggle roadview based on position - following the Kakao example
    private toggleRoadview(position: kakao.maps.LatLng): void {
        if (!this.roadviewClient || !this.roadview || !this.mapContainer || !this.roadviewContainer) return;
        
        this.roadviewClient.getNearestPanoId(position, 50, (panoId: string | null) => {
            if (panoId === null) {
                console.warn('No roadview available at this location');
                // No panorama available - hide roadview container
                this.roadviewContainer!.style.display = 'block';
                this.mapContainer!.style.width = '50%';
                if (this.map) {
                    this.map.relayout();
                }
            } else {
                // Panorama available - show split view
                this.roadviewContainer!.style.display = 'block';
                this.mapContainer!.style.width = '50%';
                
                // Set the roadview to the pano ID
                if (this.roadview) {
                    this.roadview.setPanoId(panoId, position);
                }
                
                if (this.map) {
                    this.map.relayout();
                }
                
                if (this.roadview) {
                    this.roadview.relayout();
                }
            }
        });
    }

    public setCenter(position: LatLng): void {
        if (this.map) {
            this.map.setCenter(new kakao.maps.LatLng(position.lat, position.lng));
        }
    }

    public setZoom(zoom: number): void {
        if (this.map) {
            this.map.setLevel(this.convertZoomToLevel(zoom));
        }
    }

    public setMapType(mapTypeId: string): void {
        if (this.map) {
            let kakaoMapTypeId: kakao.maps.MapTypeId;
            
            switch(mapTypeId.toLowerCase()) {
                case 'satellite':
                    kakaoMapTypeId = kakao.maps.MapTypeId.SKYVIEW;
                    break;
                case 'hybrid':
                    kakaoMapTypeId = kakao.maps.MapTypeId.HYBRID;
                    break;
                case 'terrain':
                    kakaoMapTypeId = kakao.maps.MapTypeId.ROADMAP;
                    this.map.addOverlayMapTypeId(kakao.maps.MapTypeId.TERRAIN);
                    break;
                case 'roadmap':
                default:
                    kakaoMapTypeId = kakao.maps.MapTypeId.ROADMAP;
                    break;
            }
            
            this.map.setMapTypeId(kakaoMapTypeId);
        }
    }

    public setStreetViewPosition(position: LatLng): void {
        const kakaoPosition = new kakao.maps.LatLng(position.lat, position.lng);
        if (this.pegmanMarker) {
            this.pegmanMarker.setPosition(kakaoPosition);
        }
        
        if (this.overlayOn) {
            this.toggleRoadview(kakaoPosition);
        }
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
        if (this.pegmanMarker) {
            this.pegmanMarker.setPosition(new kakao.maps.LatLng(position.lat, position.lng));
        }
    }

    public setPegmanVisible(visible: boolean): void {
        if (this.pegmanMarker && this.map) {
            if (visible) {
                this.pegmanMarker.setMap(this.map);
            } else {
                this.pegmanMarker.setMap(null);
            }
        }
    }

    public showCoverage(position: LatLng): void {
        if (this.map && !this.overlayOn) {
            // Only show coverage if not already shown
            this.overlayOn = true;
            this.map.addOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);
            
            // Show the pegman
            if (this.pegmanMarker && this.map) {
                this.pegmanMarker.setMap(this.map);
            }
            
            // Try to find roadview at the current position
            const kakaoPosition = new kakao.maps.LatLng(position.lat, position.lng);
            if (this.roadviewClient) {
                this.roadviewClient.getNearestPanoId(kakaoPosition, 50, (panoId: string | null) => {
                    if (panoId !== null && this.overlayOn) {
                        this.toggleRoadview(kakaoPosition);
                    }
                });
            }
        }
    }

    public hideCoverage(): void {
        if (this.map && this.overlayOn) {
            this.overlayOn = false;
            this.map.removeOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);
            
            // Hide the pegman
            if (this.pegmanMarker) {
                this.pegmanMarker.setMap(null);
            }
            
            // Hide the roadview
            if (this.roadviewContainer) {
                this.roadviewContainer.style.display = 'none';
                this.mapContainer!.style.width = '100%';
                if (this.map) {
                    this.map.relayout();
                }
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
    // Google zoom: 0 (furthest) to 21 (closest)
    // Kakao level: 14 (furthest) to 1 (closest)
    private convertZoomToLevel(zoom: number): number {
        // Invert the scale and adjust the range
        return Math.max(1, Math.min(14, Math.floor(14 - (zoom / 21) * 13)));
    }
}
