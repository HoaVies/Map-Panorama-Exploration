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
    private overlayOn: boolean = true;

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
        
        // Add the roadview overlay to the map
        if (this.map) {
            this.map.addOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);
        }
        
        this.setMapType(options.mapTypeId);

        // Initialize click handler
        if (this.map) {
            kakao.maps.event.addListener(this.map, 'click', (mouseEvent: any) => {
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
                    
                    // Update roadview
                    this.toggleRoadview(latlng);
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
        
        // Create draggable marker (pegman)
        this.pegmanMarker = new kakao.maps.Marker({
            image: markImage,
            position: new kakao.maps.LatLng(options.position.lat, options.position.lng),
            draggable: true,
            map: this.map
        });
        
        // Set initial position in roadview
        const kakaoPosition = new kakao.maps.LatLng(options.position.lat, options.position.lng);
        this.toggleRoadview(kakaoPosition);
        
        // Add position_changed event listener to roadview
        if (this.roadview) {
            kakao.maps.event.addListener(this.roadview, 'position_changed', () => {
                if (!this.roadview) return;
                
                // Get current roadview position
                const rvPosition = this.roadview.getPosition();
                if (!rvPosition) return;
                
                // Update map center
                if (this.map) {
                    this.map.setCenter(rvPosition);
                }
                
                // Update pegman marker if visible
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
            });
            
            kakao.maps.event.addListener(this.roadview, 'viewpoint_changed', () => {
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
            });
        }
        
        // Add dragend event to pegman marker
        if (this.pegmanMarker) {
            kakao.maps.event.addListener(this.pegmanMarker, 'dragend', () => {
                if (!this.pegmanMarker) return;
                
                const position = this.pegmanMarker.getPosition();
                this.toggleRoadview(position);
            });
        }
    }

    // Function to toggle roadview based on position - following the Kakao example
    private toggleRoadview(position: kakao.maps.LatLng): void {
        if (!this.roadviewClient || !this.roadview || !this.mapContainer || !this.roadviewContainer) return;
        
        this.roadviewClient.getNearestPanoId(position, 50, (panoId: string | null) => {
            if (panoId === null) {
                console.warn('No roadview available at this location');
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
        if (this.pegmanMarker) {
            this.pegmanMarker.setPosition(new kakao.maps.LatLng(position.lat, position.lng));
        }
        
        this.toggleRoadview(new kakao.maps.LatLng(position.lat, position.lng));
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
        if (this.map) {
            this.map.addOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);
            this.overlayOn = true;
        }
    }

    public hideCoverage(): void {
        if (this.map) {
            this.map.removeOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);
            this.overlayOn = false;
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