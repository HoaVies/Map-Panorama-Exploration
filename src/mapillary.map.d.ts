/**
 * Type definitions for Mapillary API
 */

declare namespace mapillary {
  interface ViewerOptions {
    container: string | HTMLElement;
    accessToken: string;
    imageId?: string;
    component?: {
      cover?: boolean;
      direction?: boolean;
      sequence?: boolean;
      zoom?: boolean;
      attribution?: boolean;
    };
  }

  interface LatLon {
    lat: number;
    lon: number;
  }

  interface ViewerState {
    image: {
      id: string;
      latLon: LatLon;
      capturedAt: string;
    };
    camera: {
      bearing: number;
      tilt: number;
    };
  }

  class Viewer {
    constructor(options: ViewerOptions);
    moveCloseTo(latLon: LatLon): Promise<void>;
    moveTo(imageId: string): Promise<void>;
    setBearing(bearing: number): void;
    setTilt(tilt: number): void;
    getCenter(): LatLon;
    getState(): ViewerState;
    on(event: string, callback: (data: any) => void): void;
    off(event: string, callback: (data: any) => void): void;
    remove(): void;
  }
}

declare global {
  interface Window {
    mapillary: typeof mapillary;
    Mapillary: typeof mapillary;
  }
}

export {};