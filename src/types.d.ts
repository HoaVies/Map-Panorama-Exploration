declare namespace google.maps {
    class Map {
        constructor(element: HTMLElement, options?: MapOptions);
        setCenter(latLng: LatLng): void;
        setZoom(zoom: number): void;
        setMapTypeId(mapTypeId: MapTypeId): void;
        setStreetView(panorama: StreetViewPanorama): void;
        addListener(eventName: string, handler: Function): void;
    }

    class LatLng {
        constructor(lat: number, lng: number);
        lat(): number;
        lng(): number;
    }

    class Marker {
        constructor(options?: MarkerOptions);
        setPosition(latLng: LatLng): void;
        setVisible(visible: boolean): void;
    }

    class StreetViewPanorama {
        constructor(element: HTMLElement, options?: StreetViewPanoramaOptions);
        setPosition(latLng: LatLng): void;
        setPov(pov: StreetViewPov): void;
        getPosition(): LatLng;
        getPov(): StreetViewPov;
        addListener(eventName: string, handler: Function): void;
    }

    class StreetViewService {
        getPanorama(request: StreetViewLocationRequest, callback: (data: StreetViewPanoramaData | null, status: string) => void): void;
    }

    class Polygon {
        constructor(options?: PolygonOptions);
        setMap(map: Map | null): void;
    }

    class Point {
        constructor(x: number, y: number);
    }

    interface MapOptions {
        center?: LatLng;
        zoom?: number;
        mapTypeId?: MapTypeId;
    }

    interface MarkerOptions {
        map?: Map;
        position?: LatLng;
        icon?: Icon;
    }

    interface Icon {
        url: string;
        anchor?: Point;
    }

    interface StreetViewPanoramaOptions {
        position?: LatLng;
        pov?: StreetViewPov;
        zoom?: number;
        visible?: boolean;
        
        // Navigation controls
        addressControl?: true;
        enableCloseButton?: boolean;
        fullscreenControl?: boolean;
        fullscreenControlOptions?: {
            position: ControlPosition;
        };
        linksControl?: boolean;
        motionTracking?: boolean;
        motionTrackingControl?: boolean;
        motionTrackingControlOptions?: {
            position: ControlPosition;
        };
        panControl?: boolean;
        panControlOptions?: {
            position: ControlPosition;
        };
        zoomControl?: boolean;
        zoomControlOptions?: {
            position: ControlPosition;
        };
        clickToGo?: boolean;
        disableDefaultUI?: boolean;
        disableDoubleClickZoom?: boolean;
        imageDateControl?: boolean;
        scrollwheel?: boolean;
    }

    interface StreetViewPov {
        heading: number;
        pitch: number;
    }

    interface StreetViewLocationRequest {
        location?: LatLng;
        radius?: number;
    }

    interface StreetViewPanoramaData {
        location?: StreetViewLocation;
        coverage?: LatLng[][];
    }

    interface StreetViewLocation {
        latLng?: LatLng;
    }

    interface PolygonOptions {
        paths?: LatLng[][];
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
        fillColor?: string;
        fillOpacity?: number;
        map?: Map;
    }

    interface MapMouseEvent {
        latLng?: LatLng;
    }

    type MapTypeId = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';

    // Type definitions for various global objects used in the project
    interface Window {
        // Mapy.cz API
        Panorama: any;
        // Leaflet
        L: any;
        // Other mapping APIs you're using
        google: any;
        kakao: any;
        ymaps: any;
    }
}