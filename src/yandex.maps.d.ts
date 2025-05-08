declare namespace ymaps {
  function ready(callback: () => void): Promise<void>;
  namespace modules {
    function require(modules: string[], callback: Function): void;
  }
  
  // Add Layer class definition
  class Layer {
    constructor(tileUrlTemplate: string, options?: any);
    options: any;
  }
  
  // Add projection namespace
  namespace projection {
    const sphericalMercator: any;
    const wgs84Mercator: any;
    const cartesian: any;
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
    options: {
        get(key: string): any;
        set(key: string, value: any): void;
    };
    container: { 
        getElement(): HTMLElement;
        getSize(): number[]; // Add this method
    };
    converter: {
        clientToGlobal(clientPixelPoint: number[]): number[];
        globalToClient(globalPixelPoint: number[]): number[];
    };
    layers: {
        add(layer: any): void;
        remove(layer: any): void;
    };
    controls: {
        add(control: any, options?: {float?: string, floatIndex?: number}): void;
        remove(control: any): void;
        get(index: number): any;
        getLength(): number;
        getAll(): any[];
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
  class GeoObject implements GeoObject {
    constructor(geometry: any, properties?: any, options?: any);
    geometry: any;
    properties: any;
    options: any;
    events: EventManager;
  }
  class Circle extends GeoObject {
    constructor(geometry: [number[], number], properties?: any, options?: any);
  }
  class GeoObjectCollection {
    add(object: any): this;
    remove(object: any): this;
    getLength(): number;
    get(index: number): any;
    getAll(): any[];
    removeAll(): this;
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
    
    // Add TypeSelector class
    class TypeSelector {
        constructor(options?: any);
        events: EventManager;
        options: any;
    }
    
    class ListBox {
      constructor(parameters: any);
      events: EventManager;
      data: any;
      options: any;
    }
    
    class ListBoxItem {
      constructor(parameters: any);
      events: EventManager;
      data: any;
      options: any;
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

  interface PlacemarkProperties {
    hintContent?: string;
    balloonContent?: string;
    iconContent?: string;
    [key: string]: any;
  }

  interface PlacemarkOptions {
    preset?: string;
    iconLayout?: string;
    iconImageHref?: string;
    iconImageSize?: number[];
    iconImageOffset?: number[];
    draggable?: boolean;
    visible?: boolean;
    [key: string]: any;
  }

  interface EventManager {
    add(type: string, callback: (e: any) => void): this;
    remove(type: string, callback: (e: any) => void): this;
    fire(type: string, event?: any): this;
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

    class Manager {
      closePlayer(): void;
      disableLookup(): void;
      enableLookup(): void;
      getPlayer(): Player | null;
      isLookupEnabled(): boolean;
      openPlayer(panorama: any, locateOptions?: any, options?: any): Promise<void>;
      events: EventManager;
    }
    
    interface PlayerOptions {
      direction?: number[] | string;
      controls?: string[];
      zoom?: number;
      span?: number[] | string;
      autoFitToViewport?: string;
      hotkeysEnabled?: boolean;
      scrollZoomBehavior?: boolean;
      suppressMapOpenBlock?: boolean;
      [key: string]: any;
    }

    interface IPanorama {
      getPosition(): number[];
      getCoordSystem(): any;
      getAngularBBox(): number[];
      getTileSize(): number[];
      getTileLevels(): any[];
      getConnectionArrows(): any[];
      getConnectionMarkers(): any[];
      getDefaultDirection(): number[];
      getDefaultSpan(): number[];
    }

    class Base implements IPanorama {
      getPosition(): number[];
      getCoordSystem(): any;
      getAngularBBox(): number[];
      getTileSize(): number[];
      getTileLevels(): any[];
      getConnectionArrows(): any[];
      getConnectionMarkers(): any[];
      getDefaultDirection(): number[];
      getDefaultSpan(): number[];
      validate(): void;
    }
  }

  // Control positions for panorama player
  namespace ControlPosition {
    const TOP: string;
    const BOTTOM: string;
    const LEFT: string;
    const RIGHT: string;
    const LEFT_TOP: string;
    const RIGHT_TOP: string;
    const LEFT_BOTTOM: string;
    const RIGHT_BOTTOM: string;
  }
  
  class Polyline {
    constructor(coordinates: number[][], properties?: any, options?: any);
    geometry: any;
    properties: any;
    options: any;
    events: EventManager;
  }
}