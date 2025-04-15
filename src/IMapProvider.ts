export interface LatLng {
    lat: number;
    lng: number;
}

export interface MapOptions {
    center: LatLng;
    zoom: number;
    mapTypeId: string;
}

export interface StreetViewOptions {
    position: LatLng;
    pov: {
        heading: number;
        pitch: number;
    };
}

export interface IMapProvider {
    initializeMap(containerId: string, options: MapOptions): void;
    
    setCenter(position: LatLng): void;
    setZoom(zoom: number): void;
    setMapType(mapTypeId: string): void;
    
    initializeStreetView(containerId: string, options: StreetViewOptions): void;
    setStreetViewPosition(position: LatLng): void;
    setStreetViewPOV(heading: number, pitch: number): void;
    
    setPegmanPosition(position: LatLng): void;
    setPegmanVisible(visible: boolean): void;
    
    showCoverage(position: LatLng): void;
    hideCoverage(): void;
    
    onMapClick(callback: (position: LatLng) => void): void;
    onStreetViewChange(callback: (position: LatLng, heading: number, pitch: number) => void): void;
} 