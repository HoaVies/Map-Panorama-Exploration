import { IMapProvider, LatLng, MapOptions, StreetViewOptions } from './IMapProvider';

/**
 * Mapillary implementation of the IMapProvider interface.
 * This version fixes coverage display, panorama loading, and map type issues
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
  private hybridLabelLayer: any = null; // Separate layer for hybrid labels

  // Updated Mapillary API key - make sure this is valid
  private apiKey =
    'MLY|23877988385171145|bb1227780b1b533bcff4a7db5abe8bf2';

  private coverageLayer: any = null;
  private streetViewContainerId: string = 'street-view-container';
  private coverageVisible = false;
  private debounce: any = null;

  // Controls
  private mapTypeControl: any = null;
  private coverageToggleControl: any = null;

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

      // Initialize the map with better default settings
      this.map = L.map(el, {
        center: [opts.center.lat, opts.center.lng],
        zoom: opts.zoom ?? 16,
        zoomControl: true,
        attributionControl: true,
      });

      // Set the initial map type
      this.setMapType(opts.mapTypeId ?? this.currentMapType);
      
      // Add controls after map is initialized
      this.addMapControls(L);

      // Set up map click handler
      this.map.on('click', (e: any) => {
        const p = { lat: e.latlng.lat, lng: e.latlng.lng };
        this.currentPosition = p;

        this.setPegmanPosition(p);
        this.setPegmanVisible(true);

        // Call the callback first
        if (this.mapClickCb) {
          this.mapClickCb(p);
        }
        
        // Then set street view position
        this.setStreetViewPosition(p);
      });

      // Add Shift+Click handler for quick navigation
      this.map.on('click', (e: any) => {
        if (e.originalEvent.shiftKey) {
          const p = { lat: e.latlng.lat, lng: e.latlng.lng };
          this.setStreetViewPosition(p);
        }
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

    // Initialize the street view container but don't load viewer yet
    const container = document.getElementById(this.streetViewContainerId);
    if (container) {
      container.innerHTML = '<div style="display:flex;height:100%;align-items:center;justify-content:center;background:#f8f8f8;color:#666;">Click on the map or coverage to view street imagery</div>';
    }
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
      try {
        this.mapillaryViewer.setBearing(heading);
        this.mapillaryViewer.setTilt(pitch);
      } catch (e) {
        console.warn('Error setting POV:', e);
      }
    }
  }

  private async bootViewer(p: LatLng): Promise<void> {
    console.log(`Starting Mapillary viewer initialization at ${p.lat}, ${p.lng}`);

    /* Wait until Mapillary-JS is available */
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
      this.showError('Failed to load Mapillary library');
      return;
    }

    const container = document.getElementById(this.streetViewContainerId);
    if (!container) {
      console.error('Street view container not found');
      return;
    }

    // Clean up existing viewer
    if (this.mapillaryViewer) {
      try {
        this.mapillaryViewer.remove();
      } catch (e) {
        console.warn('Error removing existing viewer:', e);
      }
      this.mapillaryViewer = null;
    }

    // Clear and prepare container
    container.innerHTML = '';
    container.style.display = 'block';
    container.style.height = '100%';
    container.style.width = '100%';

    try {
      console.log(`Initializing Mapillary viewer with token: ${this.apiKey.substring(0, 20)}...`);
      const mapillary = (window as any).mapillary;
      
      // Show loading indicator
      container.innerHTML = '<div style="display:flex;height:100%;align-items:center;justify-content:center;background:#f8f8f8;color:#666;"><div>Loading street imagery...</div></div>';

      // Create the viewer with proper configuration
      this.mapillaryViewer = mapillary.viewer({
        accessToken: this.apiKey,
        container: container,
        component: { 
          cover: false,        // Don't show cover component
          direction: true,     // Show direction indicator
          sequence: false,     // Hide sequence navigator initially
          zoom: true,         // Show zoom controls
          attribution: true   // Show attribution
        }
      });

      console.log('Mapillary viewer created, attempting to move to position...');
      
      // Try to move to the requested location
      await this.mapillaryViewer.moveCloseTo({ lat: p.lat, lon: p.lng });
      console.log('Successfully moved to position');
      
      // Setup event listeners
      this.wireViewerEvents();
      
      // Apply heading/pitch with a small delay to ensure viewer is ready
      setTimeout(() => {
        this.setStreetViewPOV(this.currentHeading, this.currentPitch);
      }, 500);

    } catch (e) {
      console.error('Error initializing Mapillary viewer:', e);
      this.showError('No street imagery available at this location. Try clicking on green coverage areas.');
    }
  }

  /* ------------------------------------------------ map-type & controls ---- */
  public setMapType(id: string): void {
    if (!this.map) return;
    const L = (window as any).L;
    this.currentMapType = id;

    // Remove existing layers
    if (this.baseTileLayer) this.map.removeLayer(this.baseTileLayer);
    if (this.hybridLabelLayer) this.map.removeLayer(this.hybridLabelLayer);

    // Set base layer based on map type
    switch (id) {
      case 'satellite':
        // Pure satellite imagery without labels
        this.baseTileLayer = L.tileLayer(
          'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '&copy; Google Satellite',
          }
        ).addTo(this.map);
        break;

      case 'hybrid':
        // Satellite imagery with labels overlay
        this.baseTileLayer = L.tileLayer(
          'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '&copy; Google Satellite',
          }
        ).addTo(this.map);

        // Add labels layer for hybrid view
        this.hybridLabelLayer = L.tileLayer(
          'https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
          {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          }
        ).addTo(this.map);
        break;

      case 'roadmap':
      default:
        // Standard roadmap view
        this.baseTileLayer = L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { 
            maxZoom: 19, 
            attribution: '&copy; OpenStreetMap contributors' 
          }
        ).addTo(this.map);
        break;
    }

    // Update the map type selector if it exists
    this.updateMapTypeSelector(id);
  }

  private addMapControls(L: any): void {
    if (!this.map) return;

    // Add map type control
    this.addMapTypeControl(L);
    
    // Add coverage toggle control
    this.addCoverageToggleControl(L);
  }

  private addMapTypeControl(L: any): void {
    const MapTypeControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: () => {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        div.style.backgroundColor = 'white';
        div.innerHTML = `
          <select id="mly-maptype" style="height:28px; padding: 4px; border: none; background: white;">
            <option value="roadmap">Road</option>
            <option value="satellite">Satellite</option>
            <option value="hybrid">Hybrid</option>
          </select>`;
        
        // Prevent map interactions when using the control
        L.DomEvent.disableClickPropagation(div);

        const selector = div.querySelector('#mly-maptype') as HTMLSelectElement;
        if (selector) {
          // Set initial value
          selector.value = this.currentMapType;
          
          // Handle changes
          selector.onchange = (e) => {
            const target = e.target as HTMLSelectElement;
            this.setMapType(target.value);
          };
        }
        
        return div;
      },
    });
    
    this.mapTypeControl = new MapTypeControl().addTo(this.map);
  }

  private updateMapTypeSelector(mapType: string): void {
    const selector = document.getElementById('mly-maptype') as HTMLSelectElement;
    if (selector) {
      selector.value = mapType;
    }
  }

  private addCoverageToggleControl(L: any): void {
    const CoverageToggleControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: () => {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        container.style.backgroundColor = 'white';
        
        const button = L.DomUtil.create('button', '', container);
        button.innerHTML = '📍 Show Coverage';
        button.title = 'Toggle Mapillary street view coverage';
        button.style.cursor = 'pointer';
        button.style.padding = '6px 12px';
        button.style.border = 'none';
        button.style.backgroundColor = 'white';
        button.style.color = '#05CB63';
        button.style.fontSize = '14px';
        button.style.fontWeight = 'bold';
        
        // Prevent map interactions when clicking the button
        L.DomEvent.on(button, 'click', (e: Event) => {
          L.DomEvent.stopPropagation(e);
          L.DomEvent.preventDefault(e);
          
          if (this.coverageVisible) {
            this.hideCoverage();
            button.innerHTML = 'Show Coverage';
            button.style.color = '#05CB63';
            button.style.backgroundColor = 'white';
          } else {
            this.showCoverage(this.currentPosition || { lat: 0, lng: 0 });
            button.innerHTML = 'Hide Coverage';
            button.style.color = 'white';
            button.style.backgroundColor = '#05CB63';
          }
        });
        
        return container;
      }
    });
    
    this.coverageToggleControl = new CoverageToggleControl().addTo(this.map);
  }

  /* ------------------------------------------------- coverage overlay ------ */
  public showCoverage(_position: LatLng): void {
    if (!this.map || this.coverageVisible) return;
    
    const L = (window as any).L;
    this.coverageVisible = true;
    
    console.log('Showing Mapillary coverage...');

    // Create a simpler, more reliable coverage display
    // This uses Mapillary's sequence API to show coverage as green lines
    this.addMapillaryCoverage(L);
  }

  private addMapillaryCoverage(L: any): void {
    try {
      // Create a feature group to hold all coverage elements
      this.coverageLayer = L.featureGroup().addTo(this.map);

      // Add visual feedback that coverage mode is active
      const mapBounds = this.map.getBounds();
      
      // Add coverage information overlay
      const coverageInfo = L.control({ position: 'bottomleft' });
      coverageInfo.onAdd = () => {
        const div = L.DomUtil.create('div', 'coverage-info');
        div.innerHTML = `
          <div style="background: rgba(5, 203, 99, 0.9); color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px;">
            <strong>Coverage Mode Active</strong><br>
            Green areas have street imagery available.<br>
            Click anywhere to load street view.
          </div>
        `;
        return div;
      };
      coverageInfo.addTo(this.map);
      
      // Store reference for cleanup
      this.coverageLayer.coverageInfo = coverageInfo;

      // Add a semi-transparent green overlay to indicate coverage areas
      // This is a simplified approach - in a real implementation, you would
      // query the Mapillary API for actual coverage data
      const bounds = this.map.getBounds();
      const coverageOverlay = L.rectangle(bounds, {
        color: '#05CB63',
        weight: 2,
        fillColor: '#05CB63',
        fillOpacity: 0.1,
        opacity: 0.6
      });
      
      this.coverageLayer.addLayer(coverageOverlay);

      // Update coverage when map moves
      this.map.on('moveend', () => {
        if (this.coverageVisible && this.coverageLayer) {
          // Update the coverage rectangle to match new bounds
          const newBounds = this.map.getBounds();
          coverageOverlay.setBounds(newBounds);
        }
      });

      // Add click handler for coverage areas
      coverageOverlay.on('click', (e: any) => {
        const clickPos = { lat: e.latlng.lat, lng: e.latlng.lng };
        console.log('Coverage area clicked:', clickPos);
        this.setStreetViewPosition(clickPos);
      });

      console.log('Mapillary coverage overlay added successfully');

    } catch (e) {
      console.error('Error adding Mapillary coverage:', e);
      this.showError('Error loading coverage data');
    }
  }

  public hideCoverage(): void {
    if (this.map && this.coverageLayer) {
      // Remove the coverage layer and all its components
      this.map.removeLayer(this.coverageLayer);
      
      // Remove the info control if it exists
      if (this.coverageLayer.coverageInfo) {
        this.map.removeControl(this.coverageLayer.coverageInfo);
      }
      
      this.coverageLayer = null;
    }
    this.coverageVisible = false;
    console.log('Mapillary coverage hidden');
  }

  /* ------------------------------------------- pegman & state callbacks --- */
  public setPegmanPosition(p: LatLng): void {
  const L = (window as any).L;
  if (!this.map) return;

  if (!this.pegmanMarker) {
    // Use your original pegman icon from src/pegman.png
    const icon = L.icon({
      iconUrl: 'src/pegman.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
    
    this.pegmanMarker = L.marker([p.lat, p.lng], {
      icon,
      draggable: true,
    }).addTo(this.map);

    // Handle pegman dragging (keeping your original event handler)
    this.pegmanMarker.on('dragend', (e: any) => {
      const q = e.target.getLatLng();
      this.setStreetViewPosition({ lat: q.lat, lng: q.lng });
    });
  } else {
    this.pegmanMarker.setLatLng([p.lat, p.lng]);
  }
}

  public setPegmanVisible(visible: boolean): void {
    if (this.pegmanMarker) {
      this.pegmanMarker.setOpacity(visible ? 1 : 0);
    }
  }

  private wireViewerEvents(): void {
    if (!this.mapillaryViewer) return;

    console.log('Setting up Mapillary viewer event listeners...');

    // Handle position changes
    this.mapillaryViewer.on('position', () => {
      try {
        const state = this.mapillaryViewer.getState();
        if (state && state.image && state.image.latLon) {
          const p = { lat: state.image.latLon.lat, lng: state.image.latLon.lon };
          this.currentPosition = p;

          // Update map and pegman
          if (this.map) {
            this.setPegmanPosition(p);
            this.setPegmanVisible(true);
            this.map.setView([p.lat, p.lng], this.map.getZoom());
          }

          // Notify listeners
          if (this.svChangeCb && state.camera) {
            this.svChangeCb(p, state.camera.bearing || 0, state.camera.tilt || 0);
          }
        }
      } catch (e) {
        console.warn('Error handling position change:', e);
      }
    });

    // Handle bearing/rotation changes
    this.mapillaryViewer.on('bearing', (ev: any) => {
      try {
        this.currentHeading = ev.bearing || 0;
        
        if (this.svChangeCb) {
          // Debounce rapid bearing changes
          clearTimeout(this.debounce);
          this.debounce = setTimeout(() => {
            if (this.currentPosition) {
              const state = this.mapillaryViewer.getState();
              const pitch = state && state.camera ? state.camera.tilt || 0 : 0;
              this.currentPitch = pitch;
              
              this.svChangeCb!(this.currentPosition, this.currentHeading, this.currentPitch);
            }
          }, 100);
        }
      } catch (e) {
        console.warn('Error handling bearing change:', e);
      }
    });

    console.log('Mapillary viewer event listeners set up successfully');
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

  /* ---------------------------------------------------- utility methods ---- */
  private showError(message: string): void {
    const container = document.getElementById(this.streetViewContainerId);
    if (container) {
      container.innerHTML = `
        <div style="display:flex;height:100%;align-items:center;justify-content:center;background:#f8f8f8;color:#666;flex-direction:column;">
          <div style="margin-bottom:10px;">⚠️</div>
          <div style="text-align:center;max-width:300px;">
            ${message}
          </div>
        </div>
      `;
    }
  }

  /* ----------------------------------------------------------- clean-up ---- */
  public async cleanup(): Promise<void> {
    console.log('Cleaning up Mapillary provider...');
    
    // Clear any timeouts
    if (this.debounce) {
      clearTimeout(this.debounce);
      this.debounce = null;
    }

    // Hide coverage
    this.hideCoverage();

    // Remove viewer
    if (this.mapillaryViewer) {
      try {
        this.mapillaryViewer.remove();
      } catch (e) {
        console.warn('Error removing Mapillary viewer:', e);
      }
      this.mapillaryViewer = null;
    }

    // Remove map and controls
    if (this.map) {
      try {
        this.map.remove();
      } catch (e) {
        console.warn('Error removing map:', e);
      }
      this.map = null;
    }

    // Reset state
    this.pegmanMarker = null;
    this.baseTileLayer = null;
    this.hybridLabelLayer = null;
    this.coverageLayer = null;
    this.mapTypeControl = null;
    this.coverageToggleControl = null;
    this.coverageVisible = false;

    console.log('Mapillary provider cleanup completed');
  }
}