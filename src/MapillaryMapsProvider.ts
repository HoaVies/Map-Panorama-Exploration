// import { IMapProvider, LatLng, MapOptions, StreetViewOptions } from './IMapProvider';

// export class MapillaryMapsProvider implements IMapProvider {
//     private map: any = null;
//     private mapContainer: HTMLElement | null = null;
//     private mapillaryViewer: any = null;
//     private pegmanMarker: any = null;
//     private clickMarker: any = null;
//     private mapClickCallback: ((position: LatLng) => void) | null = null;
//     private streetViewChangeCallback: ((position: LatLng, heading: number, pitch: number) => void) | null = null;
//     private currentPosition: LatLng | null = null;
//     private currentHeading: number = 0;
//     private currentPitch: number = 0;
//     private currentMapType: string = 'roadmap';
//     private baseTileLayer: any = null;
//     private apiKey: string = 'MLY|23877988385171145|bb1227780b1b533bcff4a7db5abe8bf2';
//     private coverageVisible: boolean = false;
//     private coverageLayer: any = null;
//     private debounceTimer: any = null;
//     private povApplicationInterval: any = null;

//     constructor(apiKey?: string) {
//         if (apiKey) {
//             this.apiKey = apiKey;
//         }

//         // Load Leaflet if not already loaded
//         this.loadLeaflet(() => {
//             console.log('Leaflet loaded successfully for Mapillary provider');
//         });
//     }

//     private loadLeaflet(callback: () => void): void {
//         if ((window as any).L) {
//             callback();
//             return;
//         }

//         const checkInterval = setInterval(() => {
//             if ((window as any).L) {
//                 clearInterval(checkInterval);
//                 callback();
//             }
//         }, 100);
//     }

//     public initializeMap(containerId: string, options: MapOptions): void {
//         this.loadLeaflet(() => {
//             const L = (window as any).L;
//             const container = document.getElementById(containerId);
//             if (!container) {
//                 throw new Error(`Container element with ID "${containerId}" not found`);
//             }

//             this.mapContainer = container;
//             this.currentPosition = options.center;

//             // Create the map
//             this.map = L.map(container, {
//                 center: [options.center.lat, options.center.lng], 
//                 zoom: options.zoom || 16
//             });

//             // Set map type
//             this.setMapType(options.mapTypeId || this.currentMapType);

//             // Add map type controls
//             this.addMapTypeControl();

//             // Click listener for the map
//             this.map.on('click', (e: any) => {
//                 const position = {
//                     lat: e.latlng.lat,
//                     lng: e.latlng.lng
//                 };
                
//                 // Update current position
//                 this.currentPosition = position;
                
//                 // Add or update marker
//                 if (!this.clickMarker) {
//                     this.clickMarker = L.marker([position.lat, position.lng]).addTo(this.map);
//                 } else {
//                     this.clickMarker.setLatLng([position.lat, position.lng]);
//                 }
                
//                 // Call the map click callback if set
//                 if (this.mapClickCallback) {
//                     this.mapClickCallback(position);
//                 }
                
//                 // Initialize panorama at this position
//                 this.setStreetViewPosition(position);
//             });

//             // Place initial marker at start position
//             if (this.currentPosition) {
//                 this.clickMarker = L.marker(
//                     [this.currentPosition.lat, this.currentPosition.lng]
//                 ).addTo(this.map);
//             }
//         });
//     }

//     // Create and add map type control
//     private addMapTypeControl(): void {
//         if (!this.map) return;
        
//         const L = (window as any).L;
        
//         const MapTypeControl = L.Control.extend({
//             options: {
//                 position: 'topleft'
//             },
            
//             onAdd: (map: any) => {
//                 const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
//                 container.style.backgroundColor = 'white';
//                 container.style.padding = '5px';
                
//                 // Create roadmap button
//                 const roadmapButton = L.DomUtil.create('button', '', container);
//                 roadmapButton.innerHTML = 'Map';
//                 roadmapButton.style.marginRight = '5px';
//                 roadmapButton.style.cursor = 'pointer';
//                 roadmapButton.style.padding = '5px 10px';
//                 roadmapButton.style.border = this.currentMapType === 'roadmap' ? '2px solid #3388ff' : '1px solid #ccc';
                
//                 // Create satellite button
//                 const satelliteButton = L.DomUtil.create('button', '', container);
//                 satelliteButton.innerHTML = 'Satellite';
//                 satelliteButton.style.marginRight = '5px';
//                 satelliteButton.style.cursor = 'pointer';
//                 satelliteButton.style.padding = '5px 10px';
//                 satelliteButton.style.border = this.currentMapType === 'satellite' ? '2px solid #3388ff' : '1px solid #ccc';
                
//                 // Create hybrid button
//                 const hybridButton = L.DomUtil.create('button', '', container);
//                 hybridButton.innerHTML = 'Hybrid';
//                 hybridButton.style.cursor = 'pointer';
//                 hybridButton.style.padding = '5px 10px';
//                 hybridButton.style.border = this.currentMapType === 'hybrid' ? '2px solid #3388ff' : '1px solid #ccc';
                
//                 // Add event listeners
//                 L.DomEvent.on(roadmapButton, 'click', (e: Event) => {
//                     L.DomEvent.stopPropagation(e);
//                     this.setMapType('roadmap');
//                     roadmapButton.style.border = '2px solid #3388ff';
//                     satelliteButton.style.border = '1px solid #ccc';
//                     hybridButton.style.border = '1px solid #ccc';
//                 });
                
//                 L.DomEvent.on(satelliteButton, 'click', (e: Event) => {
//                     L.DomEvent.stopPropagation(e);
//                     this.setMapType('satellite');
//                     roadmapButton.style.border = '1px solid #ccc';
//                     satelliteButton.style.border = '2px solid #3388ff';
//                     hybridButton.style.border = '1px solid #ccc';
//                 });
                
//                 L.DomEvent.on(hybridButton, 'click', (e: Event) => {
//                     L.DomEvent.stopPropagation(e);
//                     this.setMapType('hybrid');
//                     roadmapButton.style.border = '1px solid #ccc';
//                     satelliteButton.style.border = '1px solid #ccc';
//                     hybridButton.style.border = '2px solid #3388ff';
//                 });
                
//                 return container;
//             }
//         });
        
//         new MapTypeControl().addTo(this.map);
//     }

//     public setMapType(mapTypeId: string): void {
//         if (!this.map) return;
        
//         const L = (window as any).L;
        
//         // Store the current map type
//         this.currentMapType = mapTypeId;
//         console.log(`Changing map type to: ${mapTypeId}`);
        
//         // Remove existing tile layers
//         if (this.baseTileLayer) {
//             this.map.removeLayer(this.baseTileLayer);
//             this.baseTileLayer = null;
//         }
        
//         if (mapTypeId === 'satellite' || mapTypeId === 'hybrid') {
//             // Use satellite imagery
//             this.baseTileLayer = L.tileLayer(
//                 'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',
//                 {
//                     maxZoom: 20,
//                     subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
//                     attribution: '&copy; <a href="https://www.google.com/">Google Maps</a>'
//                 }
//             ).addTo(this.map);
            
//             if (mapTypeId === 'hybrid') {
//                 // Add labels for hybrid mode
//                 L.tileLayer(
//                     'https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
//                     {
//                         maxZoom: 20,
//                         subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
//                     }
//                 ).addTo(this.map);
//             }
//         } else {
//             // Default to OpenStreetMap for roadmap
//             this.baseTileLayer = L.tileLayer(
//                 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
//                 {
//                     maxZoom: 19,
//                     attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//                 }
//             ).addTo(this.map);
//         }
//     }

//     public initializeStreetView(containerId: string, options: StreetViewOptions): void {
//         // Store the initial position and orientation
//         this.currentPosition = options.position;
//         this.currentHeading = options.pov.heading;
//         this.currentPitch = options.pov.pitch;
        
//         this.loadMapillaryScript(() => {
//             this.setStreetViewPosition(options.position);
//         });
//     }

//     private loadMapillaryScript(callback: () => void): void {
//         if (window.Mapillary) {
//             callback();
//             return;
//         }
        
//         const script = document.createElement('script');
//         script.type = 'text/javascript';
//         script.src = 'https://unpkg.com/mapillary-js@4.1.2/dist/mapillary.js';
//         script.onload = callback;
        
//         const link = document.createElement('link');
//         link.rel = 'stylesheet';
//         link.href = 'https://unpkg.com/mapillary-js@4.1.2/dist/mapillary.css';
        
//         document.head.appendChild(link);
//         document.head.appendChild(script);
//     }

//     private async initializeMapillaryViewer(position: LatLng): Promise<void> {
//         // Wait for Mapillary to load if not already loaded
//         if (!(window as any).Mapillary) {
//             console.log('Waiting for Mapillary library to load...');
//             await new Promise<void>((resolve) => {
//                 const checkInterval = setInterval(() => {
//                     if ((window as any).Mapillary) {
//                         console.log('Mapillary library loaded!');
//                         clearInterval(checkInterval);
//                         resolve();
//                     }
//                 }, 100);
                
//                 // Timeout after 10 seconds
//                 setTimeout(() => {
//                     clearInterval(checkInterval);
//                     console.error('Timeout waiting for Mapillary library');
//                     resolve();
//                 }, 10000);
//             });
//         }
        
//         // Check again after waiting
//         if (!(window as any).Mapillary) {
//             console.error('Mapillary library still not loaded');
//             this.showError('Failed to load Mapillary viewer');
//             return;
//         }

//         const container = document.getElementById('street-view-container');
//         if (!container) {
//             console.error('Street view container not found');
//             return;
//         }

//         // Destroy any existing viewer
//         if (this.mapillaryViewer) {
//             this.mapillaryViewer.remove();
//             this.mapillaryViewer = null;
//         }

//         // Clear the container
//         container.innerHTML = '';
//         container.style.display = 'block';

//         try {
//             // Create a new viewer with type assertion
//             const Mapillary = (window as any).Mapillary;
//             this.mapillaryViewer = Mapillary.viewer({
//                 accessToken: this.apiKey,
//                 container: container,
//                 component: {
//                     cover: false,
//                     direction: true,
//                     sequence: true,
//                     zoom: true
//                 }
//             });

//             // Try to find and move to a panorama near the requested position
//             await this.mapillaryViewer.moveCloseTo({
//                 lat: position.lat,
//                 lon: position.lng
//             });

//             // Set up event listeners
//             this.setupMapillaryEventListeners();

//             // Apply the saved heading/pitch
//             if (this.currentHeading !== undefined && this.currentPitch !== undefined) {
//                 this.mapillaryViewer.setBearing(this.currentHeading);
//                 this.mapillaryViewer.setTilt(this.currentPitch);
//             }
//         } catch (error) {
//             console.error('Failed to initialize Mapillary viewer:', error);
//             this.showError('No imagery available at this location');
//         }
//     }

//     private setupMapillaryEventListeners(): void {
//         if (!this.mapillaryViewer) return;

//         // Listen for position changes
//         this.mapillaryViewer.on('position', (event: any) => {
//             if (!this.mapillaryViewer) return;

//             try {
//                 const state = this.mapillaryViewer.getState();
//                 const newPosition = {
//                     lat: state.image.latLon.lat,
//                     lng: state.image.latLon.lon
//                 };

//                 console.log(`Mapillary position changed to: ${newPosition.lat}, ${newPosition.lng}`);

//                 // Update pegman position
//                 this.setPegmanPosition(newPosition);
//                 this.setPegmanVisible(true);

//                 // Update map center
//                 if (this.map) {
//                     this.map.setView([newPosition.lat, newPosition.lng], this.map.getZoom());
//                 }

//                 // Update current position
//                 this.currentPosition = newPosition;

//                 // Call the change callback with the new position
//                 if (this.streetViewChangeCallback) {
//                     this.streetViewChangeCallback(
//                         newPosition,
//                         state.camera.bearing,
//                         state.camera.tilt
//                     );
//                 }
//             } catch (e) {
//                 console.error('Error handling Mapillary position change:', e);
//             }
//         });

//         // Listen for bearing changes
//         this.mapillaryViewer.on('bearing', (event: any) => {
//             if (!this.mapillaryViewer || !this.currentPosition) return;

//             try {
//                 this.currentHeading = event.bearing;
//                 const state = this.mapillaryViewer.getState();
//                 this.currentPitch = state.camera.tilt;

//                 if (this.streetViewChangeCallback) {
//                     if (this.debounceTimer) clearTimeout(this.debounceTimer);
//                     this.debounceTimer = setTimeout(() => {
//                         this.streetViewChangeCallback!(
//                             this.currentPosition!,
//                             this.currentHeading,
//                             this.currentPitch
//                         );
//                     }, 300);
//                 }
//             } catch (e) {
//                 console.warn('Error handling Mapillary bearing change:', e);
//             }
//         });
//     }

//     private showError(message: string): void {
//         const container = document.getElementById('street-view-container');
//         if (container) {
//             container.innerHTML = `
//                 <div style="display:flex; height:100%; align-items:center; justify-content:center; text-align:center; background-color:#f8f8f8; color:#666;">
//                     <div>
//                         <p>${message}</p>
//                         <p>Try another location</p>
//                     </div>
//                 </div>
//             `;
//         }
//     }

//     public setCenter(position: LatLng): void {
//         // Store the position
//         this.currentPosition = position;
        
//         // Update the map center if the map is initialized
//         if (this.map) {
//             this.map.setView([position.lat, position.lng], this.map.getZoom());
//         }
//     }

//     public setZoom(zoom: number): void {
//         // Update the map zoom if the map is initialized
//         if (this.map) {
//             this.map.setZoom(zoom);
//         }
//     }

//     public setStreetViewPosition(position: LatLng): void {
//         // Store the position
//         this.currentPosition = position;
        
//         // Update marker on map if available
//         if (this.map && this.clickMarker) {
//             this.setPegmanPosition(position);
//             this.setPegmanVisible(true);
//         }
        
//         // Initialize/update the Mapillary viewer
//         this.initializeMapillaryViewer(position);
//     }

//     public setStreetViewPOV(heading: number, pitch: number): void {
//         // Store the orientation
//         this.currentHeading = heading;
//         this.currentPitch = pitch;
        
//         // Update the panorama
//         if (this.mapillaryViewer) {
//             console.log(`Setting POV: heading=${heading}, pitch=${pitch}`);
//             this.mapillaryViewer.setBearing(heading);
//             this.mapillaryViewer.setTilt(pitch);
//         }
//     }

//     // Get the current position
//     public getCurrentPosition(): LatLng {
//         if (this.mapillaryViewer) {
//             try {
//                 const state = this.mapillaryViewer.getState();
//                 return {
//                     lat: state.image.latLon.lat,
//                     lng: state.image.latLon.lon
//                 };
//             } catch (e) {
//                 console.error('Error getting current position:', e);
//             }
//         }
        
//         // Otherwise return the stored position
//         return this.currentPosition || { lat: 0, lng: 0 };
//     }

//     // Get current street view state (for provider switching)
//     public getStreetViewState(): any {
//         return {
//             position: this.getCurrentPosition(),
//             heading: this.currentHeading,
//             pitch: this.currentPitch
//         };
//     }

//     public setPegmanPosition(position: LatLng): void {
//         const L = (window as any).L;
//         if (!this.map) return;
        
//         if (!this.pegmanMarker) {
//             // Create pegman icon
//             const pegmanIcon = L.icon({
//                 iconUrl: 'src/pegman.png',
//                 iconSize: [32, 32],
//                 iconAnchor: [16, 32],
//             });
            
//             // Add pegman marker
//             this.pegmanMarker = L.marker([position.lat, position.lng], {
//                 icon: pegmanIcon,
//                 draggable: true
//             }).addTo(this.map);
            
//             // Add drag event handler
//             this.pegmanMarker.on('dragend', (event: any) => {
//                 const marker = event.target;
//                 const position = marker.getLatLng();
                
//                 this.setStreetViewPosition({
//                     lat: position.lat,
//                     lng: position.lng
//                 });
//             });
//         } else {
//             // Update existing pegman position
//             this.pegmanMarker.setLatLng([position.lat, position.lng]);
//         }
//     }

//     public setPegmanVisible(visible: boolean): void {
//         if (!this.pegmanMarker) return;
        
//         if (visible) {
//             this.pegmanMarker.setOpacity(1);
//         } else {
//             this.pegmanMarker.setOpacity(0);
//         }
//     }

//     public showCoverage(position?: LatLng): void {
//         // Mapillary doesn't have a direct API for coverage display
//         // Could implement a custom solution with their API for coverage tiles
//         this.coverageVisible = true;
//         console.log('Coverage display is not directly supported by Mapillary API');
//     }

//     public hideCoverage(): void {
//         // Remove coverage layer if implemented
//         this.coverageVisible = false;
//         if (this.coverageLayer && this.map) {
//             this.map.removeLayer(this.coverageLayer);
//             this.coverageLayer = null;
//         }
//     }

//     public onMapClick(callback: (position: LatLng) => void): void {
//         this.mapClickCallback = callback;
//     }

//     public onStreetViewChange(callback: (position: LatLng, heading: number, pitch: number) => void): void {
//         this.streetViewChangeCallback = callback;
//     }

//     public async cleanup(): Promise<void> {
//         if (this.mapillaryViewer) {
//             this.mapillaryViewer.remove();
//             this.mapillaryViewer = null;
//         }
        
//         if (this.map) {
//             this.map.remove();
//             this.map = null;
//         }
//     }
// }

import { IMapProvider, LatLng, MapOptions, StreetViewOptions } from './IMapProvider';

/**
 * Mapillary implementation of the IMapProvider interface.
 * – loads Leaflet once (Mapillary JS is injected by index.html)
 * – v4 Viewer API
 * – vector-tile coverage overlay
 */
export class MapillaryMapsProvider implements IMapProvider {
  /* ---------------------------------------------------------------- private */
  private map: any = null;
  private mapillaryViewer: any = null;

  private pegmanMarker: any = null;
  private clickMarker: any = null;

  private mapClickCb: ((p: LatLng) => void) | null = null;
  private svChangeCb:
    | ((p: LatLng, h: number, k: number) => void)
    | null = null;

  private currentPosition: LatLng | null = null;
  private currentHeading = 0;
  private currentPitch = 0;

  private currentMapType = 'roadmap';
  private baseTileLayer: any = null;

  private apiKey =
    'MLY|23877988385171145|bb1227780b1b533bcff4a7db5abe8bf2';          // <-- replace (or pass it in the ctor)

  private coverageLayer: any = null;
  private coverageVisible = false;
  private debounce: any = null;

  constructor(apiKey?: string) {
    if (apiKey) this.apiKey = apiKey;
    this.waitForLeaflet(() => console.log('Leaflet ready (Mapillary)'));
  }

  /* ---------------------------------------------------- Leaflet bootstrap -- */
  private waitForLeaflet(cb: () => void): void {
    if ((window as any).L) return cb();
    const id = setInterval(() => {
      if ((window as any).L) {
        clearInterval(id);
        cb();
      }
    }, 100);
  }

  /* ----------------------------------------------------------- map section -- */
  public initializeMap(containerId: string, opts: MapOptions): void {
    this.waitForLeaflet(() => {
      const L = (window as any).L;
      const el = document.getElementById(containerId);
      if (!el) throw new Error(`#${containerId} not found`);

      this.currentPosition = opts.center;

      this.map = L.map(el, {
        center: [opts.center.lat, opts.center.lng],
        zoom: opts.zoom ?? 16,
      });

      this.setMapType(opts.mapTypeId ?? this.currentMapType);
      this.addMapTypeControl(L);

      this.map.on('click', (e: any) => {
        const p = { lat: e.latlng.lat, lng: e.latlng.lng };
        this.currentPosition = p;

        this.setPegmanPosition(p);
        this.setPegmanVisible(true);

        this.mapClickCb?.(p);
        this.setStreetViewPosition(p);
      });
    });
  }

  public setCenter(p: LatLng): void {
    this.currentPosition = p;
    if (this.map) this.map.setView([p.lat, p.lng], this.map.getZoom());
  }

  public setZoom(z: number): void {
    if (this.map) this.map.setZoom(z);
  }

  /* ------------------------------------------------------- Street View API -- */
  public initializeStreetView(
    _containerId: string,
    opts: StreetViewOptions,
  ): void {
    this.currentPosition = opts.position;
    this.currentHeading = opts.pov.heading;
    this.currentPitch = opts.pov.pitch;

    this.setStreetViewPosition(opts.position);
  }

  public setStreetViewPosition(p: LatLng): void {
    this.currentPosition = p;

    if (this.map) {
      this.setPegmanPosition(p);
      this.setPegmanVisible(true);
    }
    this.bootViewer(p);
  }

  public setStreetViewPOV(heading: number, pitch: number): void {
    this.currentHeading = heading;
    this.currentPitch = pitch;
    if (this.mapillaryViewer) {
      this.mapillaryViewer.setBearing(heading);
      this.mapillaryViewer.setTilt(pitch);
    }
  }

  private async bootViewer(p: LatLng): Promise<void> {
    /* wait until Mapillary-JS is on window (index.html loads it) */
    if (!(window as any).Mapillary) {
      await new Promise<void>((resolve) => {
        const id = setInterval(() => {
          if ((window as any).Mapillary) {
            clearInterval(id);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(id);
          resolve();
        }, 10_000);
      });
    }
    if (!(window as any).Mapillary) {
      this.error('Failed to load Mapillary');
      return;
    }

    const container = document.getElementById('street-view-container');
    if (!container) return;

    if (this.mapillaryViewer) {
      this.mapillaryViewer.remove();
      this.mapillaryViewer = null;
    }
    container.innerHTML = '';
    container.style.display = 'block';

    try {
      const Mapillary = (window as any).Mapillary;
      this.mapillaryViewer = new Mapillary.Viewer({
        container,
        accessToken: this.apiKey,
        component: { cover: false, direction: true, sequence: true, zoom: true },
      });

      await this.mapillaryViewer.moveCloseTo({ lat: p.lat, lon: p.lng });
      this.wireViewerEvents();
      this.setStreetViewPOV(this.currentHeading, this.currentPitch);
    } catch (e) {
      console.error(e);
      this.error('No imagery available here');
    }
  }

  /* ------------------------------------------------ map-type & controls ---- */
  public setMapType(id: string): void {
    if (!this.map) return;
    const L = (window as any).L;
    this.currentMapType = id;

    if (this.baseTileLayer) this.map.removeLayer(this.baseTileLayer);

    if (id === 'satellite' || id === 'hybrid') {
      this.baseTileLayer = L.tileLayer(
        'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',
        {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '&copy; Google Maps',
        },
      ).addTo(this.map);

      if (id === 'hybrid') {
        L.tileLayer('https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        }).addTo(this.map);
      }
    } else {
      this.baseTileLayer = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' },
      ).addTo(this.map);
    }
  }

  private addMapTypeControl(L: any): void {
    if (!this.map) return;
    const MapType = L.Control.extend({
      options: { position: 'topright' },
      onAdd: () => {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        div.innerHTML = `
          <select id="mly-maptype" style="height:28px">
            <option value="roadmap">Road</option>
            <option value="satellite">Satellite</option>
            <option value="hybrid">Hybrid</option>
          </select>`;
        L.DomEvent.disableClickPropagation(div);

        /* ✨ no generic on querySelector – avoids TS 2347 */
        const sel = div.querySelector('#mly-maptype') as HTMLSelectElement;
        sel.onchange = (e) =>
          this.setMapType((e.target as HTMLSelectElement).value);
        return div;
      },
    });
    new MapType().addTo(this.map);
  }

  /* ------------------------------------------------- coverage overlay ------ */
  public showCoverage(_position: LatLng): void {
    if (!this.map || this.coverageLayer) return;
    const L = (window as any).L;

    const url =
      `https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}` +
      `?access_token=${this.apiKey}`;

    this.coverageLayer = L.tileLayer(url, {
      maxZoom: 20,
      attribution: '&copy; Mapillary',
    }).addTo(this.map);

    this.coverageVisible = true;
  }

  public hideCoverage(): void {
    if (this.coverageLayer && this.map) {
      this.map.removeLayer(this.coverageLayer);
      this.coverageLayer = null;
    }
    this.coverageVisible = false;
  }

  /* ------------------------------------------- pegman & state callbacks --- */
  public setPegmanPosition(p: LatLng): void {
    const L = (window as any).L;
    if (!this.map) return;

    if (!this.pegmanMarker) {
      const icon = L.icon({
        iconUrl: 'src/pegman.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      this.pegmanMarker = L.marker([p.lat, p.lng], {
        icon,
        draggable: true,
      }).addTo(this.map);

      this.pegmanMarker.on('dragend', (e: any) => {
        const q = e.target.getLatLng();
        this.setStreetViewPosition({ lat: q.lat, lng: q.lng });
      });
    } else {
      this.pegmanMarker.setLatLng([p.lat, p.lng]);
    }
  }

  public setPegmanVisible(v: boolean): void {
    if (this.pegmanMarker) this.pegmanMarker.setOpacity(v ? 1 : 0);
  }

  private wireViewerEvents(): void {
    if (!this.mapillaryViewer) return;

    this.mapillaryViewer.on('position', () => {
      const st = this.mapillaryViewer.getState();
      const p = { lat: st.image.latLon.lat, lng: st.image.latLon.lon };
      this.currentPosition = p;

      this.setPegmanPosition(p);
      this.setPegmanVisible(true);
      if (this.map) this.map.setView([p.lat, p.lng], this.map.getZoom());

      this.svChangeCb?.(p, st.camera.bearing, st.camera.tilt);
    });

    this.mapillaryViewer.on('bearing', (ev: any) => {
      this.currentHeading = ev.bearing;
      this.currentPitch = this.mapillaryViewer.getState().camera.tilt;

      if (this.svChangeCb) {
        clearTimeout(this.debounce);
        this.debounce = setTimeout(() => {
          if (this.currentPosition)
            this.svChangeCb?.(
              this.currentPosition,
              this.currentHeading,
              this.currentPitch,
            );
        }, 300);
      }
    });
  }

  /* ----------------------------------------------------- event plumbing ---- */
  public onMapClick(cb: (p: LatLng) => void): void {
    this.mapClickCb = cb;
  }

  public onStreetViewChange(
    cb: (p: LatLng, h: number, k: number) => void,
  ): void {
    this.svChangeCb = cb;
  }

  /* ---------------------------------------------------- state getters ------ */
  public getCurrentPosition(): LatLng {
    if (this.mapillaryViewer) {
      const st = this.mapillaryViewer.getState();
      return { lat: st.image.latLon.lat, lng: st.image.latLon.lon };
    }
    return this.currentPosition ?? { lat: 0, lng: 0 };
  }

  public getStreetViewState(): any {
    return {
      position: this.getCurrentPosition(),
      heading: this.currentHeading,
      pitch: this.currentPitch,
    };
  }

  /* ----------------------------------------------------------- clean-up ---- */
  public async cleanup(): Promise<void> {
    if (this.mapillaryViewer) {
      this.mapillaryViewer.remove();
      this.mapillaryViewer = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  /* ----------------------------------------------------------- misc ----- */
  private error(msg: string): void {
    const c = document.getElementById('street-view-container');
    if (!c) return;
    c.innerHTML = `<div style="display:flex;height:100%;align-items:center;
      justify-content:center;background:#f8f8f8;color:#666;">${msg}</div>`;
  }
}