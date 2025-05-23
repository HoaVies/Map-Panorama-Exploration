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
    'MLY|23877988385171145|bb1227780b1b533bcff4a7db5abe8bf2';

  private coverageLayer: any = null;
  private streetViewContainerId: string = 'street-view-container'; // xoa neu ko chay
  private coverageTextMarker: any = null;
  private coverageToggleButton: HTMLButtonElement | null = null;
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
    containerId: string,
    opts: StreetViewOptions,
  ): void {
    this.streetViewContainerId = containerId;
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
    if (!(window as any).mapillary) {
      console.log('Waiting for Mapillary library to load...');
      await new Promise<void>((resolve) => {
        const id = setInterval(() => {
          if ((window as any).mapillary) {
            console.log('Mapillary library detected!');
            clearInterval(id);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(id);
          console.warn('Timeout waiting for Mapillary, continuing anyway');
          resolve();
        }, 10000);
      });
    }
    if (!(window as any).mapillary) {
      console.error('Failed to load Mapillary library');
      this.error('Failed to load Mapillary');
      return;
    }

    const container = document.getElementById(this.streetViewContainerId);
    if (!container) return;

    if (this.mapillaryViewer) {
      this.mapillaryViewer.remove();
      this.mapillaryViewer = null;
    }
    container.innerHTML = '';
    container.style.display = 'block';

    try {
      console.log(`Initializing Mapillary viewer at ${p.lat}, ${p.lng} with token: ${this.apiKey}`);
      const mapillary = (window as any).mapillary;
      
      // Create a viewer - this is the proper way to initialize in v4+
      this.mapillaryViewer = mapillary.viewer({
        accessToken: this.apiKey,
        container,
        component: { 
          cover: false,
          direction: true,
          sequence: true,
          zoom: true,
          attribution: true
        }
      });

      // Try to move to the requested location
      console.log('Moving to position...');
      await this.mapillaryViewer.moveCloseTo({ lat: p.lat, lon: p.lng });
      console.log('Successfully moved to position');
      
      // Setup event listeners
      this.wireViewerEvents();
      
      // Apply heading/pitch
      this.setStreetViewPOV(this.currentHeading, this.currentPitch);
    } catch (e) {
      console.error('Error initializing Mapillary viewer:', e);
      this.error('No imagery available at this location');
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
    
    // Add the coverage toggle button
    this.addCoverageToggleButton(L);
  }

  private addCoverageToggleButton(L: any): void {
    const CoverageToggle = L.Control.extend({
      options: { position: 'topright' },
      onAdd: () => {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        container.style.backgroundColor = 'white';
        
        const button = L.DomUtil.create('button', '', container);
        button.innerHTML = 'Show Coverage';
        button.title = 'Toggle Mapillary coverage';
        button.style.cursor = 'pointer';
        button.style.padding = '5px 10px';
        button.style.width = '100%';
        button.style.border = '1px solid #ccc';
        button.style.backgroundColor = 'white';
        button.style.color = '#05CB63';
        
        L.DomEvent.on(button, 'click', (e: Event) => {
          L.DomEvent.stopPropagation(e);
          L.DomEvent.preventDefault(e);
          
          if (this.coverageVisible) {
            this.hideCoverage();
            button.innerHTML = 'Show Coverage';
            button.style.backgroundColor = 'white';
            button.style.color = '#05CB63';
          } else {
            this.showCoverage(this.currentPosition || { lat: 0, lng: 0 });
            button.innerHTML = 'Hide Coverage';
            button.style.backgroundColor = '#05CB63';
            button.style.color = 'white';
          }
        });
        
        // Store a reference to update its state
        this.coverageToggleButton = button;
        
        return container;
      }
    });
    
    new CoverageToggle().addTo(this.map);
  }

  /* ------------------------------------------------- coverage overlay ------ */
  public showCoverage(_position: LatLng): void {
    if (!this.map) return;
    if (this.coverageLayer) {
      // If already visible, just return
      return;
    }
    
    const L = (window as any).L;
    this.coverageVisible = true;
    
    // First, let's check if we can add the proper Mapillary vector tiles
    try {
      // We need to load the Mapbox GL Leaflet plugin if not already loaded
      this.loadMapboxGLPlugin(() => {
        // Add the Mapillary vector tile layer
        const coverageUrl = `https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=${this.apiKey}`;
        
        if (L.mapboxGL) {
          // Using Mapbox GL for vector tile rendering
          this.coverageLayer = L.mapboxGL({
            accessToken: 'pk.eyJ1IjoicXVhbmdoYXRyYW4iLCJhIjoiY21iMGp6eWZ3MHR1bDJrc2Noa3gwYmNwbiJ9.cMaYEdb4yY54myrmV1_3Qw',
            style: {
              version: 8,
              sources: {
                'mapillary-sequences': {
                  type: 'vector',
                  tiles: [coverageUrl],
                  minzoom: 0,
                  maxzoom: 14
                }
              },
              layers: [
                {
                  id: 'mapillary-sequences',
                  type: 'line',
                  source: 'mapillary-sequences',
                  'source-layer': 'sequence',
                  layout: {
                    'line-cap': 'round',
                    'line-join': 'round'
                  },
                  paint: {
                    'line-opacity': 0.6,
                    'line-color': '#05CB63',
                    'line-width': 2
                  }
                },
                {
                  id: 'mapillary-images',
                  type: 'circle',
                  source: 'mapillary-sequences',
                  'source-layer': 'image',
                  paint: {
                    'circle-radius': 3,
                    'circle-opacity': 0.8,
                    'circle-color': '#05CB63'
                  }
                }
              ]
            }
          }).addTo(this.map);
          
          console.log("Added Mapillary coverage layer with Mapbox GL");
        } else {
          // Fallback to simpler coverage representation if Mapbox GL isn't available
          console.warn("MapboxGL plugin not available, using simple coverage indicator");
          this.addSimpleCoverageIndicator();
        }
      });
    } catch (e) {
      console.error("Error adding coverage layer:", e);
      this.addSimpleCoverageIndicator();
    }
  }

  private loadMapboxGLPlugin(callback: () => void): void {
    // Check if the plugin is already loaded
    if ((window as any).L && (window as any).L.mapboxGL) {
      return callback();
    }
    
    // Load Mapbox GL JS
    if (!(window as any).mapboxgl) {
      const mapboxScript = document.createElement('script');
      mapboxScript.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
      document.head.appendChild(mapboxScript);
      
      const mapboxStyles = document.createElement('link');
      mapboxStyles.rel = 'stylesheet';
      mapboxStyles.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
      document.head.appendChild(mapboxStyles);
    }
    
    // Load the Mapbox GL Leaflet plugin
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/mapbox-gl-leaflet/leaflet-mapbox-gl.js';
    script.onload = callback;
    document.head.appendChild(script);
  }

  private addSimpleCoverageIndicator(): void {
    // If advanced coverage isn't available, add a simpler indicator
    // This is a fallback solution when vector tiles can't be properly displayed
    const L = (window as any).L;
    
    if (this.map && !this.coverageLayer) {
      // Create a semi-transparent overlay to indicate coverage mode
      this.coverageLayer = L.rectangle(
        this.map.getBounds(),
        { 
          color: '#05CB63',
          weight: 2,
          fillOpacity: 0.05,
          opacity: 0.3
        }
      ).addTo(this.map);
      
      // Update the bounds when the map moves
      this.map.on('moveend', () => {
        if (this.coverageLayer && this.coverageVisible) {
          this.coverageLayer.setBounds(this.map.getBounds());
        }
      });
      
      // Add a text indicator
      const center = this.map.getCenter();
      const coverageText = L.marker(
        [center.lat, center.lng],
        {
          icon: L.divIcon({
            html: '<div style="background-color:rgba(5,203,99,0.7);color:white;padding:5px 10px;border-radius:3px;">Coverage Mode Active</div>',
            className: 'mapillary-coverage-text'
          })
        }
      ).addTo(this.map);
      
      // Store the text marker for later removal
      this.coverageTextMarker = coverageText;
    }
  }

  public hideCoverage(): void {
    if (this.map) {
      if (this.coverageLayer) {
        this.map.removeLayer(this.coverageLayer);
        this.coverageLayer = null;
      }
      
      if (this.coverageTextMarker) {
        this.map.removeLayer(this.coverageTextMarker);
        this.coverageTextMarker = null;
      }
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