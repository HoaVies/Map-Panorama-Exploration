declare namespace kakao.maps {
    class Map {
        constructor(container: HTMLElement, options?: MapOptions);
        setCenter(latLng: LatLng): void;
        setLevel(level: number): void;
        getLevel(): number;
        setMapTypeId(mapTypeId: MapTypeId): void;
        getMapTypeId(): MapTypeId;
        addOverlayMapTypeId(mapTypeId: MapTypeId): void;
        removeOverlayMapTypeId(mapTypeId: MapTypeId): void;
        getBounds(): LatLngBounds;
        getCenter(): LatLng;
        relayout(): void;
    }

    class LatLng {
        constructor(lat: number, lng: number);
        getLat(): number;
        getLng(): number;
        equals(latlng: LatLng): boolean;
        toString(): string;
        toCoords(): Coords;
    }

    class LatLngBounds {
        constructor(sw: LatLng, ne: LatLng);
        getSouthWest(): LatLng;
        getNorthEast(): LatLng;
        contain(latlng: LatLng): boolean;
    }

    class Coords {
        constructor(x: number, y: number);
        getX(): number;
        getY(): number;
        toLatLng(): LatLng;
    }

    class Marker {
        constructor(options: MarkerOptions);
        setMap(map: Map | null): void;
        getMap(): Map | null;
        setPosition(position: LatLng): void;
        getPosition(): LatLng;
        setVisible(visible: boolean): void;
        getVisible(): boolean;
        setZIndex(zIndex: number): void;
        getZIndex(): number;
        setDraggable(draggable: boolean): void;
        getDraggable(): boolean;
    }

    class MarkerImage {
        constructor(
            src: string,
            size: Size,
            options?: {
                offset?: Point,
                alt?: string,
                coords?: string,
                spriteOrigin?: Point,
                spriteSize?: Size,
                shape?: string
            }
        );
    }

    class Roadview {
        constructor(container: HTMLElement, options?: RoadviewOptions);
        setPanoId(panoId: string, position: LatLng): void;
        getPanoId(): string;
        setViewpoint(viewpoint: Viewpoint): void;
        getViewpoint(): Viewpoint;
        getPosition(): LatLng;
        setVisible(visible: boolean): void;
        getVisible(): boolean;
        relayout(): void;
    }

    class RoadviewClient {
        constructor();
        getNearestPanoId(position: LatLng, radius: number, callback: (panoId: string | null) => void): void;
    }

    class RoadviewOverlay {
        constructor();
        setMap(map: Map | null): void;
        getMap(): Map | null;
    }

    class Size {
        constructor(width: number, height: number);
    }

    class Point {
        constructor(x: number, y: number);
    }

    class CustomOverlay {
        constructor(options: CustomOverlayOptions);
        setMap(map: Map | null): void;
        getMap(): Map | null;
        setPosition(position: LatLng): void;
        getPosition(): LatLng;
        setContent(content: string | HTMLElement): void;
        getContent(): string | HTMLElement;
        setVisible(visible: boolean): void;
        getVisible(): boolean;
        setZIndex(zIndex: number): void;
        getZIndex(): number;
    }

    interface MapOptions {
        center?: LatLng;
        level?: number;
        mapTypeId?: MapTypeId;
        draggable?: boolean;
        scrollwheel?: boolean;
        disableDoubleClick?: boolean;
        disableDoubleClickZoom?: boolean;
        projectionId?: string;
        tileAnimation?: boolean;
        keyboardShortcuts?: boolean | object;
    }

    interface MarkerOptions {
        map?: Map;
        position: LatLng;
        image?: MarkerImage;
        title?: string;
        draggable?: boolean;
        clickable?: boolean;
        zIndex?: number;
        opacity?: number;
        altitude?: number;
        range?: number;
    }

    interface RoadviewOptions {
        panoId?: string;
        panoX?: number;
        panoY?: number;
        pan?: number;
        tilt?: number;
        zoom?: number;
        scrollwheel?: boolean;
    }

    interface CustomOverlayOptions {
        map?: Map;
        position?: LatLng;
        content?: string | HTMLElement;
        xAnchor?: number;
        yAnchor?: number;
        zIndex?: number;
    }

    interface Viewpoint {
        pan: number;
        tilt: number;
        zoom: number;
        panoId?: string;
    }

    const MapTypeId: {
        ROADMAP: MapTypeId;
        SKYVIEW: MapTypeId;
        HYBRID: MapTypeId;
        OVERLAY: MapTypeId;
        TERRAIN: MapTypeId;
        TRAFFIC: MapTypeId;
        BICYCLE: MapTypeId;
        BICYCLE_HYBRID: MapTypeId;
        USE_DISTRICT: MapTypeId;
        ROADVIEW: MapTypeId;
    };

    const event: {
        addListener(target: any, type: string, handler: Function): void;
        removeListener(target: any, type: string, handler: Function): void;
        trigger(target: any, type: string, data?: any): void;
        preventMap(): void;
    };

    // Add MapTypeControl and ZoomControl interfaces
    type MapTypeId = any;
    interface Map {
        addControl(control: MapTypeControl | ZoomControl, position: any): void;
    }

    class MapTypeControl {
        constructor();
    }

    const ControlPosition: {
        TOPLEFT: any;
        TOP: any;
        TOPRIGHT: any;
        LEFT: any;
        RIGHT: any;
        BOTTOMLEFT: any;
        BOTTOM: any;
        BOTTOMRIGHT: any;
    };
}