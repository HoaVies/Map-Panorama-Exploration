import { IMapProvider, LatLng, MapOptions, StreetViewOptions } from './IMapProvider';

export class GoogleMapsProvider implements IMapProvider {
    private map: google.maps.Map | null = null;
    private streetView: google.maps.StreetViewPanorama | null = null;
    private pegmanMarker: google.maps.Marker | null = null;
    private coveragePolygon: google.maps.Polygon | null = null;
    private streetViewChangeCallback: ((position: LatLng, heading: number, pitch: number) => void) | null = null;

    public initializeMap(containerId: string, options: MapOptions): void {
        const mapOptions: google.maps.MapOptions = {
            center: new google.maps.LatLng(options.center.lat, options.center.lng),
            zoom: options.zoom,
            mapTypeId: options.mapTypeId as google.maps.MapTypeId
        };

        this.map = new google.maps.Map(document.getElementById(containerId)!, mapOptions);
    }

    public initializeStreetView(containerId: string, options: StreetViewOptions): void {
        const streetViewOptions: any = {
            position: new google.maps.LatLng(options.position.lat, options.position.lng),
            pov: {
                heading: options.pov.heading,
                pitch: options.pov.pitch
            },
            addressControl: true,
            enableCloseButton: true,
            linksControl: true,
            panControl: true,
            zoomControl: true,
            fullscreenControl: true,
            visible: true
        };
    
        this.streetView = new google.maps.StreetViewPanorama(
            document.getElementById(containerId)!,
            streetViewOptions
        );
    
        if (this.map) {
            this.map.setStreetView(this.streetView);
        }
        
        // Set up event listeners for position and POV changes
        this.setupStreetViewEventListeners();
    }

    // New method to set up event listeners for the street view
    private setupStreetViewEventListeners(): void {
        if (!this.streetView) return;
        
        // Listen for position changes
        this.streetView.addListener('position_changed', () => {
            this.notifyStreetViewChange();
        });
        
        // IMPORTANT: Listen for POV changes
        this.streetView.addListener('pov_changed', () => {
            this.notifyStreetViewChange();
        });
    }
    
    // Helper method to notify about street view changes
    private notifyStreetViewChange(): void {
        if (!this.streetView || !this.streetViewChangeCallback) return;
            
        const position = this.streetView.getPosition();
        const pov = this.streetView.getPov();
        
        if (position) {
            this.streetViewChangeCallback(
                { lat: position.lat(), lng: position.lng() },
                pov.heading,
                pov.pitch
            );
            
            console.log(`Google: Street view updated - heading=${pov.heading}, pitch=${pov.pitch}`);
        }
    }

    public setCenter(position: LatLng): void {
        if (this.map) {
            this.map.setCenter(new google.maps.LatLng(position.lat, position.lng));
        }
    }

    public setZoom(zoom: number): void {
        if (this.map) {
            this.map.setZoom(zoom);
        }
    }

    public setMapType(mapTypeId: string): void {
        if (this.map) {
            this.map.setMapTypeId(mapTypeId as google.maps.MapTypeId);
        }
    }

    public setStreetViewPosition(position: LatLng): void {
        if (this.streetView) {
            this.streetView.setPosition(new google.maps.LatLng(position.lat, position.lng));
        }
    }

    public setStreetViewPOV(heading: number, pitch: number): void {
        if (this.streetView) {
            this.streetView.setPov({ heading, pitch });
        }
    }

    public setPegmanPosition(position: LatLng): void {
        if (!this.pegmanMarker) {
            this.pegmanMarker = new google.maps.Marker({
                map: this.map ?? undefined,
                position: new google.maps.LatLng(position.lat, position.lng),
                visible: false,
            });
        } else {
            this.pegmanMarker.setPosition(new google.maps.LatLng(position.lat, position.lng));
        }
    }

    public setPegmanVisible(visible: boolean): void {
    }

    public showCoverage(position: LatLng): void {
        this.hideCoverage();
    }

    public hideCoverage(): void {
        if (this.coveragePolygon) {
            this.coveragePolygon.setMap(null);
        }
    }

    public onMapClick(callback: (position: LatLng) => void): void {
        if (this.map) {
            this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
                const lat = event.latLng?.lat() || 0;
                const lng = event.latLng?.lng() || 0;
                callback({ lat, lng });
            });
        }
    }

    public onStreetViewChange(callback: (position: LatLng, heading: number, pitch: number) => void): void {
        this.streetViewChangeCallback = callback;
        
        // If street view is already initialized, set up the listeners
        if (this.streetView) {
            this.setupStreetViewEventListeners();
        }
    }
}