declare namespace ymaps {
    class Map {
        constructor(container: string | HTMLElement, options?: MapOptions);
        setCenter(center: number[], zoom?: number, options?: any): Promise<void>;
        getCenter(): number[];
        setZoom(zoom: number): void;
        getZoom(): number;
        setType(type: string | MapType): void;
        getType(): string;
        events: IEventManager;
        controls: any;
        geoObjects: any;
        destroy(): void;
    }

    interface MapOptions {
        center?: number[];
        zoom?: number;
        type?: string | MapType;
        controls?: string[];
        behaviors?: string[];
    }

    class MapType {
        constructor(name: string, options: any);
    }

    class Placemark {
        constructor(geometry: number[], properties?: any, options?: any);
        events: IEventManager;
        geometry: IGeometry;
        options: IOptionManager;
        properties: IDataManager;
        setMap(map: Map | null): void;
    }

    class SuggestView {
        constructor(element: string | HTMLElement, options?: any);
        events: IEventManager;
    }

    interface IEventManager {
        add(types: string | string[], callback: Function, context?: any, priority?: number): this;
        remove(types: string | string[], callback: Function, context?: any, priority?: number): this;
        fire(type: string, event?: object | IEvent): this;
    }

    interface IEvent {
        originalEvent: any;
        get(name: string): any;
    }

    interface IGeometry {
        getCoordinates(): number[];
        setCoordinates(coordinates: number[]): void;
    }

    interface IOptionManager {
        set(key: string | object, value?: any): this;
        get(key: string, defaultValue?: any): any;
    }

    interface IDataManager {
        set(key: string | object, value?: any): this;
        get(key: string, defaultValue?: any): any;
    }

    // Panorama classes and interfaces
    class panorama {
        static Player: {
            new(element: string | HTMLElement, point: string | number[], options?: PlayerOptions): Player;
        };
        static createPlayer(element: string | HTMLElement, point: string | number[], options?: PlayerOptions): Promise<Player>;
        static locate(point: number[]): Promise<any[]>;
        static isSupported(): boolean;
    }

    interface PlayerOptions {
        direction?: number[];
        span?: number[];
        layer?: string;
        controls?: string[];
    }

    interface Player {
        events: IEventManager;
        getPosition(): number[];
        setPosition(point: number[]): Promise<void>;
        getDirection(): number[];
        setDirection(direction: number[]): void;
        destroy(): void;
    }

    function ready(callback: Function): Promise<void>;
    function geocode(request: string | number[], options?: any): Promise<any>;
}