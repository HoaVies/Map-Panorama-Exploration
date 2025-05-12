/**
 * Type definitions for Mapy.cz Panorama API
 */

interface PanoramaCamera {
    yaw: number;
    pitch: number;
}

interface PanoramaOptions {
    parent: HTMLElement | string;
    lon: number;
    lat: number;
    apiKey: string;
    yaw?: number;
    pitch?: number;
    showNavigation?: boolean;
    lang?: string;
}

interface PanoramaInfo {
    lat: number;
    lon: number;
    id?: string;
}

interface PanoramaResult {
    info: PanoramaInfo;
    getCamera(): PanoramaCamera;
    setCamera(camera: PanoramaCamera): void;
    destroy(): void;
    addListener(event: string, callback: (e: any) => void): void;
    clearAllListeners?(): void;
    errorCode?: string;
    error?: string;
}

interface PanoramaStatic {
    panoramaFromPosition(options: PanoramaOptions): Promise<PanoramaResult>;
    panoramaExists?(options: { lon: number; lat: number; apiKey: string; radius?: number }): Promise<any>;
}

declare global {
    interface Window {
        Panorama: PanoramaStatic;
        L: any; // Leaflet global
    }
}