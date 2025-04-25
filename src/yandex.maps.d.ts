declare namespace ymaps {
    function ready(callback: () => void): Promise<void>;
  
    class Map {
      constructor(element: HTMLElement | string, options: MapOptions);
      events: EventManager;
      geoObjects: GeoObjectCollection;
      setCenter(center: number[], zoom?: number, options?: any): void;
      getCenter(): number[];
      getZoom(): number;
      setType(type: string): void;
      getType(): string;
      destroy(): void;
      behaviors: any;
    }
  
    interface MapOptions {
      center: number[];
      zoom: number;
      controls?: string[];
      type?: string;
    }
  
    class GeoObjectCollection {
      add(object: any): this;
      remove(object: any): this;
      getLength(): number;
      get(index: number): any;
      getAll(): any[];
      removeAll(): this;
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
        setDirection(direction: number[] | string): void;
        getDirection(): number[];
        setZoom(zoom: number): void;
        getZoom(): number;
        events: EventManager;
        destroy(): void;
      }
  
      interface PlayerOptions {
        direction?: number[] | string;
        controls?: string[];
        zoom?: number;
        [key: string]: any;
      }
    }
  }