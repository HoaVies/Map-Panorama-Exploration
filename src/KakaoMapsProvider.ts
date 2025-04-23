import { IMapProvider, LatLng, MapOptions, StreetViewOptions } from './IMapProvider.js';

export class KakaoMapsProvider implements IMapProvider {
    private map: kakao.maps.Map | null = null;
    private roadview: kakao.maps.Roadview | null = null;
    private roadviewClient: kakao.maps.RoadviewClient | null = null;
    private pegmanMarker: kakao.maps.Marker | null = null;
    private mapClickCallback: ((position: LatLng) => void) | null = null;
    private roadviewChangeCallback: ((position: LatLng, heading: number, pitch: number) => void) | null = null;
    private roadviewControl: HTMLElement | null = null;
    private overlayOn: boolean = false;
    private isProcessingEvent: boolean = false;
    private mapTypeControl: any = null;

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
        
        // Set map type
        this.setMapType(options.mapTypeId);
        
        // Create and add the roadview control button
        this.createRoadviewControl(mapContainer);
        
        // Add map type control to the top left corner
        this.mapTypeControl = new kakao.maps.MapTypeControl();
        this.map.addControl(this.mapTypeControl, kakao.maps.ControlPosition.TOPLEFT);

        // Initialize click handler
        this.setupMapClickHandler();
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

    private toggleRoadviewOverlay(): void {
        if (!this.roadviewControl || !this.map) return;
        
        // Toggle button active state
        if (this.roadviewControl.className.indexOf('active') === -1) {
            this.roadviewControl.className = 'active';
            this.roadviewControl.style.backgroundPosition = '0 -350px';
            this.showCoverage();
        } else {
            this.roadviewControl.className = '';
            this.roadviewControl.style.backgroundPosition = '0 -450px';
            this.hideCoverage();
        }
    }

    public showCoverage(position?: LatLng): void {
        if (!this.map) return;
        
        this.overlayOn = true;
        
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
        this.setRoadviewPosition(options.position);
        
        // Add position_changed event listener to roadview
        this.setupRoadviewEvents();
        
        // Add dragend event to pegman marker
        this.setupPegmanEvents();
    }

    private setupMapClickHandler(): void {
        if (!this.map) return;
        
        kakao.maps.event.addListener(this.map, 'click', (mouseEvent: any) => {
            if (this.isProcessingEvent) return;
            
            this.isProcessingEvent = true;
            try {
                // Only handle clicks when roadview overlay is active
                if (!this.overlayOn) {
                    return;
                }
                
                const latlng = mouseEvent.latLng;
                
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
        if (!this.roadview) return;
        
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
            if (this.isProcessingEvent) return;
            
            this.isProcessingEvent = true;
            try {
                if (!this.pegmanMarker) return;
                
                const position = this.pegmanMarker.getPosition();
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
        
        this.roadviewClient.getNearestPanoId(kakaoPosition, 50, (panoId: string | null) => {
            if (panoId && this.roadview) {
                this.roadview.setPanoId(panoId, kakaoPosition);
                
                // Update pegman position if it exists and overlay is active
                if (this.pegmanMarker && this.overlayOn) {
                    this.pegmanMarker.setPosition(kakaoPosition);
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
            
            // Remove any overlay map types first to avoid stacking them
            this.map.removeOverlayMapTypeId(kakao.maps.MapTypeId.TERRAIN);
            
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