/**
 * Type definitions for Mapillary API
 */

declare namespace mapillary {
  interface ViewerOptions {
    container: string | HTMLElement;
    accessToken: string;
    component?: {
      cover?: boolean;
      direction?: boolean;
      sequence?: boolean;
      zoom?: boolean;
      attribution?: boolean;
    };
    imageId?: string;
  }

  interface LatLon {
    lat: number;
    lon: number;
  }

  interface Bearing {
    bearing: number;
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

  interface ViewerBearingEvent {
    bearing: number;
  }

  interface ViewerPositionEvent {
    latLon: LatLon;
  }

  interface Viewer {
    moveTo(imageId: string): Promise<void>;
    moveCloseTo(latLon: LatLon): Promise<void>;
    setBearing(bearing: number): void;
    setFieldOfView(fov: number): void;
    setTilt(tilt: number): void;
    getCenter(): LatLon;
    getState(): ViewerState;
    on(event: string, callback: (data: any) => void): void;
    off(event: string, callback: (data: any) => void): void;
    remove(): void;
  }

  function viewer(options: ViewerOptions): Viewer;
}

declare module 'mapillary-js' {
  export = mapillary;
}

declare namespace Mapillary {
  let mapillary: typeof mapillary;
}

declare global {
  interface Window {
    mapillary: typeof mapillary;
  }
}

export {};