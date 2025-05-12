declare namespace ymaps {
  function ready(callback: () => void): Promise<void>;
  namespace modules {
    function require(modules: string[], callback: Function): void;
  }
  
  class Layer {
    constructor(tileUrlTemplate: string, options?: any);
    options: any;
  }

  interface GeoObject {
    geometry: any;
    properties: any;
    options: any;
    events: EventManager;
  }

  class Map {
    constructor(element: HTMLElement | string, options: MapOptions);
    events: EventManager;
    geoObjects: GeoObjectCollection;
    panorama?: panorama.Manager;

    container: { 
        getElement(): HTMLElement;
        getSize(): number[];
    };

    setCenter(center: number[], zoom?: number, options?: any): void;
    getCenter(): number[];
    getZoom(): number;
    setZoom(zoom: number): void;
    setType(type: string): void;
    getType(): string;
    destroy(): void;
    behaviors: any;
    getPanoramaManager(): Promise<panorama.Manager>;
    relayout(): void;
    getBounds(): number[][];
}
  namespace event {
    function preventMap(): void;
  }
  interface MapOptions {
    center: number[];
    zoom: number;
    controls?: string[];
    type?: string;
    suppressMapOpenBlock?: boolean; // Add this property to fix the error
  }
  namespace control {
    class Button {
        constructor(options: any);
        events: EventManager;
        select(): void;
        deselect(): void;
        isSelected(): boolean;
        data: {
            get(key: string): any;
            set(key: string, value: any): void;
        };
        options: {
            set(key: string, value: any): void;
        };
    }
}
  class Placemark {
    constructor(geometry: number[], properties?: PlacemarkProperties, options?: PlacemarkOptions);
    geometry: { 
      getCoordinates(): number[]; 
      setCoordinates(coords: number[]): void; 
    };
    properties: any;
    options: any;
    events: EventManager;
    getMap(): Map | null;
  }

  namespace panorama {
    function locate(point: number[]): Promise<any[]>;
    function createPlayer(element: string | HTMLElement, point: number[], options?: PlayerOptions): Promise<Player>;
    function isSupported(): boolean;

    class Player {
      constructor(element: string | HTMLElement, panorama: any, options?: PlayerOptions);
      getPanorama(): any;
      setPanorama(panorama: any): Promise<void>;
      setDirection(direction: number[] | string): Player;
      getDirection(): number[];
      setZoom(zoom: number): Player;
      getZoom(): number;
      setSpan(span: number[] | string): Player;
      getSpan(): number[];
      events: EventManager;
      destroy(): void;
      fitToViewport(): void;
      lookAt(point: number[]): Player;
      moveTo(point: number[], options?: any): Promise<void>;
    }
  }
}