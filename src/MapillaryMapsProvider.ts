import { IMapProvider, LatLng, MapOptions, StreetViewOptions } from './IMapProvider';

/**
 * Mapillary implementation with real coverage tiles and Graph API integration
 */
export class MapillaryMapsProvider implements IMapProvider {
  private map: any = null;
  private mapillaryViewer: any = null;
  private pegmanMarker: any = null;

  private mapClickCb: ((p: LatLng) => void) | null = null;
  private svChangeCb: ((p: LatLng, h: number, k: number) => void) | null = null;

  private currentPosition: LatLng | null = null;
  private currentHeading = 0;
  private currentPitch = 0;
  private currentMapType = 'roadmap';
  private baseTileLayer: any = null;
  private hybridLabelLayer: any = null;

  // Mapillary API configuration
  private apiKey = 'MLY|23877988385171145|bb1227780b1b533bcff4a7db5abe8bf2';
  
  // Coverage layers
  private coverageLayers: any = {};
  private coverageVisible = false;
  private streetViewContainerId: string = 'street-view-container';

  constructor(apiKey?: string) {
    if (apiKey) this.apiKey = apiKey;
    this.waitForLeaflet(() => console.log('Leaflet ready (Mapillary)'));
  }

  private waitForLeaflet(cb: () => void): void {
    if ((window as any).L) return cb();
    const id = setInterval(() => {
      if ((window as any).L) {
        clearInterval(id);
        cb();
      }
    }, 100);
  }

  /* ----------------------------------------------------------- Map Section */
  public initializeMap(containerId: string, opts: MapOptions): void {
    this.waitForLeaflet(() => {
      const L = (window as any).L;
      const el = document.getElementById(containerId);
      if (!el) throw new Error(`#${containerId} not found`);

      this.currentPosition = opts.center;

      this.map = L.map(el, {
        center: [opts.center.lat, opts.center.lng],
        zoom: opts.zoom ?? 16,
        zoomControl: true,
        attributionControl: true,
      });

      this.setMapType(opts.mapTypeId ?? this.currentMapType);
      this.addMapControls(L);

      // Map click handler
      this.map.on('click', (e: any) => {
        const p = { lat: e.latlng.lat, lng: e.latlng.lng };
        this.handleMapClick(p);
      });

      // Add zoom change handler to update coverage layers
      this.map.on('zoomend', () => {
        if (this.coverageVisible) {
          this.updateCoverageLayers();
        }
      });
    });
  }

  private async handleMapClick(p: LatLng): Promise<void> {
    this.currentPosition = p;
    this.setPegmanPosition(p);
    this.setPegmanVisible(true);

    if (this.mapClickCb) {
      this.mapClickCb(p);
    }

    // If coverage is visible, try to find and load street view
    if (this.coverageVisible) {
      await this.findAndLoadNearestImage(p);
    }
  }

  public setCenter(p: LatLng): void {
    this.currentPosition = p;
    if (this.map) this.map.setView([p.lat, p.lng], this.map.getZoom());
  }

  public setZoom(z: number): void {
    if (this.map) this.map.setZoom(z);
  }

  /* ------------------------------------------------- Street View Section */
  public initializeStreetView(containerId: string, opts: StreetViewOptions): void {
    this.streetViewContainerId = containerId;
    this.currentPosition = opts.position;
    this.currentHeading = opts.pov.heading;
    this.currentPitch = opts.pov.pitch;

    const container = document.getElementById(this.streetViewContainerId);
    if (container) {
      container.innerHTML = '<div style="display:flex;height:100%;align-items:center;justify-content:center;background:#f8f8f8;color:#666;">Click on green coverage dots to view street imagery</div>';
    }
  }

  public setStreetViewPosition(p: LatLng): void {
    this.currentPosition = p;
    this.setPegmanPosition(p);
    this.setPegmanVisible(true);
    this.findAndLoadNearestImage(p);
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

  /* -------------------------------------------- Real Coverage Implementation */
  public showCoverage(_position: LatLng): void {
    if (!this.map || this.coverageVisible) return;
    
    console.log('Loading real Mapillary coverage...');
    this.coverageVisible = true;
    this.loadCoverageTiles();
  }

  private loadCoverageTiles(): void {
    const L = (window as any).L;
    if (!this.map) return;

    const zoom = this.map.getZoom();
    try {
      // Clear existing coverage layers
      this.clearCoverageLayers();

      // Load appropriate coverage layer based on zoom level
      if (zoom <= 5) {
        // Overview layer (zoom 0-5) - Points
        this.addOverviewLayer(L);
      } else if (zoom >= 6 && zoom <= 13) {
        // Sequence layer (zoom 6-14) - LineStrings
        this.addSequenceLayer(L);
      } else if (zoom >= 14) {
        // Image layer (zoom 14+) - Points
        this.addImageLayer(L);
      }
    } catch (error) {
      console.error('Error loading coverage tiles:', error);
      this.showError('Failed to load coverage data');
    }
  }

  private addOverviewLayer(L: any): void {
    // Simplified overview layer - just use the sequence loading approach
    this.loadSequenceVectorGrid(L);
  }

  private addSequenceLayer(L: any): void {
    // Use Leaflet vector grid for better performance with sequence data
    this.loadSequenceVectorGrid(L);
  }

  private loadSequenceVectorGrid(L: any): void {
    // Create a feature group for sequences
    this.coverageLayers.sequences = L.featureGroup().addTo(this.map);

    const bounds = this.map.getBounds();
    const zoom = Math.min(Math.max(this.map.getZoom(), 6), 14);
    
    // Get tile coordinates for current view
    const tiles = this.getTileCoordinatesForBounds(bounds, zoom);
    
    tiles.forEach((tileCoord: any) => {
      this.loadSequenceTile(tileCoord, L);
    });
  }

  private async loadSequenceTile(tileCoord: any, L: any): Promise<void> {
    try {
      const url = `https://tiles.mapillary.com/maps/vtp/mly1_public/2/${tileCoord.z}/${tileCoord.x}/${tileCoord.y}?access_token=${this.apiKey}`;
      
      // For now, we'll use a simpler approach and load sequences via Graph API
      // In a production app, you'd want to use a proper vector tile library
      const bounds = this.map.getBounds();
      const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
      
      const imageResponse = await fetch(
        `https://graph.mapillary.com/images?access_token=${this.apiKey}&fields=id,computed_geometry,sequence,captured_at&bbox=${bbox}&limit=200`
      );
      
      const imageData = await imageResponse.json();
      
      if (imageData.data && imageData.data.length > 0) {
        this.renderSequenceFeatures(imageData.data, L);
      }
      
    } catch (error: any) {
      console.error('Error loading sequence tile:', error);
    }
  }

  private renderSequenceFeatures(images: any[], L: any): void {
    // Group images by sequence
    const sequences: { [key: string]: any[] } = {};
    
    images.forEach(image => {
      if (image.sequence && image.computed_geometry) {
        if (!sequences[image.sequence]) {
          sequences[image.sequence] = [];
        }
        sequences[image.sequence].push(image);
      }
    });

    // Render each sequence as a polyline with points
    Object.keys(sequences).forEach(sequenceId => {
      const sequenceImages = sequences[sequenceId].sort((a, b) => a.captured_at - b.captured_at);
      
      // Create polyline for sequence
      const coordinates = sequenceImages.map(img => [
        img.computed_geometry.coordinates[1], // lat
        img.computed_geometry.coordinates[0]  // lng
      ]);

      if (coordinates.length > 1) {
        const polyline = L.polyline(coordinates, {
          color: '#05CB63',
          weight: 2,
          opacity: 0.7
        });
        this.coverageLayers.sequences.addLayer(polyline);
      }

      // Add clickable points for each image
      sequenceImages.forEach(image => {
        const point = L.circleMarker([
          image.computed_geometry.coordinates[1],
          image.computed_geometry.coordinates[0]
        ], {
          radius: 4,
          fillColor: image.is_pano ? '#1E90FF' : '#05CB63',
          color: '#ffffff',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        });

        // Add click handler to load this specific image
        point.on('click', (e: any) => {
          L.DomEvent.stopPropagation(e);
          this.loadImageById(image.id);
        });

        // Add tooltip
        point.bindTooltip(`Image: ${image.id}<br>Captured: ${new Date(image.captured_at).toLocaleDateString()}`, {
          direction: 'top'
        });

        this.coverageLayers.sequences.addLayer(point);
      });
    });
  }

  private addImageLayer(L: any): void {
    // For zoom 14+, show individual image points
    this.loadImagePoints(L);
  }

  private async loadImagePoints(L: any): Promise<void> {
    const bounds = this.map.getBounds();
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
    
    try {
      const response = await fetch(
        `https://graph.mapillary.com/images?access_token=${this.apiKey}&fields=id,computed_geometry,compass_angle,is_pano,captured_at&bbox=${bbox}&limit=1000`
      );
      
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        this.renderImagePoints(data.data, L);
      }
      
    } catch (error) {
      console.error('Error loading image points:', error);
    }
  }

  private renderImagePoints(images: any[], L: any): void {
    this.coverageLayers.images = L.featureGroup().addTo(this.map);

    images.forEach(image => {
      if (image.computed_geometry) {
        const point = L.circleMarker([
          image.computed_geometry.coordinates[1],
          image.computed_geometry.coordinates[0]
        ], {
          radius: 6,
          fillColor: image.is_pano ? '#1E90FF' : '#05CB63',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        });

        // Add click handler
        point.on('click', (e: any) => {
          L.DomEvent.stopPropagation(e);
          console.log('Loading image:', image.id);
          this.loadImageById(image.id);
          
          // Update pegman position
          const position = {
            lat: image.computed_geometry.coordinates[1],
            lng: image.computed_geometry.coordinates[0]
          };
          this.setPegmanPosition(position);
        });

        // Add direction indicator if compass angle is available
        if (image.compass_angle !== undefined) {
          const directionIcon = L.divIcon({
            html: `<div style="width:0;height:0;border-left:3px solid transparent;border-right:3px solid transparent;border-bottom:8px solid #05CB63;transform:rotate(${image.compass_angle}deg);"></div>`,
            className: 'direction-arrow',
            iconSize: [6, 8],
            iconAnchor: [3, 4]
          });
          
          const directionMarker = L.marker([
            image.computed_geometry.coordinates[1],
            image.computed_geometry.coordinates[0]
          ], { icon: directionIcon });
          
          this.coverageLayers.images.addLayer(directionMarker);
        }

        // Add tooltip
        point.bindTooltip(`
          Image: ${image.id}<br>
          Type: ${image.is_pano ? 'Panorama' : 'Regular'}<br>
          Captured: ${new Date(image.captured_at).toLocaleDateString()}
        `, {
          direction: 'top'
        });

        this.coverageLayers.images.addLayer(point);
      }
    });
  }

  public hideCoverage(): void {
    this.coverageVisible = false;
    this.clearCoverageLayers();
  }

  private clearCoverageLayers(): void {
    Object.keys(this.coverageLayers).forEach(key => {
      if (this.coverageLayers[key] && this.map) {
        if (key === 'overviewMarker') {
          // Handle marker separately
          this.map.removeLayer(this.coverageLayers[key]);
        } else if (typeof this.coverageLayers[key].removeFrom === 'function') {
          // Handle layer groups
          this.coverageLayers[key].removeFrom(this.map);
        } else {
          // Handle regular layers
          this.map.removeLayer(this.coverageLayers[key]);
        }
        delete this.coverageLayers[key];
      }
    });
  }

  private updateCoverageLayers(): void {
    if (this.coverageVisible) {
      if ((this as any).coverageUpdateTimeout) clearTimeout((this as any).coverageUpdateTimeout);
      (this as any).coverageUpdateTimeout = setTimeout(() => {
        this.clearCoverageLayers();
        this.loadCoverageTiles();
      }, 300); // 300ms debounce
    }
  }

  /* ----------------------------------------- Image Loading and Viewer */
  private async findAndLoadNearestImage(position: LatLng): Promise<void> {
    try {
      console.log(`Finding nearest image to ${position.lat}, ${position.lng}`);
      
      // Search for images near the clicked position
      const radius = 0.001; // Approximately 100 meters
      const bbox = `${position.lng - radius},${position.lat - radius},${position.lng + radius},${position.lat + radius}`;
      
      const response = await fetch(
        `https://graph.mapillary.com/images?access_token=${this.apiKey}&fields=id,computed_geometry,compass_angle&bbox=${bbox}&limit=1`
      );
      
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const nearestImage = data.data[0];
        console.log('Found nearest image:', nearestImage.id);
        await this.loadImageById(nearestImage.id);
      } else {
        this.showError('No street imagery available at this location. Try clicking on green coverage dots.');
      }
      
    } catch (error) {
      console.error('Error finding nearest image:', error);
      this.showError('Error loading street imagery');
    }
  }

  private async loadImageById(imageId: string): Promise<void> {
    console.log(`Attempting to load Mapillary image: ${imageId}`);
    
    // Check if Mapillary API is available
    let MapillaryAPI = null;
    
    if ((window as any).mapillary && (window as any).mapillary.Viewer) {
      MapillaryAPI = (window as any).mapillary;
      console.log('Using mapillary.Viewer');
    } else if ((window as any).Mapillary && (window as any).Mapillary.Viewer) {
      MapillaryAPI = (window as any).Mapillary;
      console.log('Using Mapillary.Viewer');
    } else {
      console.error('Mapillary API not available or incorrect structure');
      this.showError('Mapillary library not properly loaded');
      return;
    }

    const container = document.getElementById(this.streetViewContainerId);
    if (!container) {
      console.error('Street view container not found');
      return;
    }

    try {
      // Clean up existing viewer
      if (this.mapillaryViewer) {
        try {
          this.mapillaryViewer.remove();
        } catch (e) {
          console.warn('Error removing existing viewer:', e);
        }
        this.mapillaryViewer = null;
      }

      // Prepare container
      container.innerHTML = '';
      container.style.display = 'block';
      container.style.width = '100%';
      container.style.height = '100%';

      // Create viewer using the correct constructor pattern
      console.log('Creating Mapillary viewer with constructor');
      this.mapillaryViewer = new MapillaryAPI.Viewer({
        accessToken: this.apiKey,
        container: container,
        imageId: imageId,
        component: { 
          cover: false,
          direction: true,
          sequence: true,
          zoom: true,
          attribution: true
        }
      });

      // Setup event listeners
      this.wireViewerEvents();
      
      console.log(`Successfully loaded Mapillary image: ${imageId}`);
      
    } catch (error) {
      console.error('Error creating Mapillary viewer:', error);
      // Type-safe error handling
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred';
      this.showError(`Failed to load street imagery: ${errorMessage}`);
    }
  }

  private wireViewerEvents(): void {
    if (!this.mapillaryViewer) return;

    this.mapillaryViewer.on('position', () => {
      try {
        const state = this.mapillaryViewer.getState();
        if (state?.image?.latLon) {
          const p = { lat: state.image.latLon.lat, lng: state.image.latLon.lon };
          this.currentPosition = p;
          this.setPegmanPosition(p);
          this.setPegmanVisible(true);
          
          if (this.map) {
            this.map.setView([p.lat, p.lng], this.map.getZoom());
          }

          if (this.svChangeCb && state.camera) {
            this.svChangeCb(p, state.camera.bearing || 0, state.camera.tilt || 0);
          }
        }
      } catch (e) {
        console.warn('Error handling position change:', e);
      }
    });

    this.mapillaryViewer.on('bearing', (ev: any) => {
      try {
        this.currentHeading = ev.bearing || 0;
        if (this.svChangeCb && this.currentPosition) {
          const state = this.mapillaryViewer.getState();
          const pitch = state?.camera?.tilt || 0;
          this.currentPitch = pitch;
          this.svChangeCb(this.currentPosition, this.currentHeading, this.currentPitch);
        }
      } catch (e) {
        console.warn('Error handling bearing change:', e);
      }
    });
  }

  /* ---------------------------------------------- Helper Methods */
  private getTileCoordinatesForBounds(bounds: any, zoom: number): any[] {
    // Simple tile coordinate calculation
    const tiles = [];
    const nwTile = this.latLngToTile(bounds.getNorthWest(), zoom);
    const seTile = this.latLngToTile(bounds.getSouthEast(), zoom);
    
    for (let x = nwTile.x; x <= seTile.x; x++) {
      for (let y = nwTile.y; y <= seTile.y; y++) {
        tiles.push({ x, y, z: zoom });
      }
    }
    
    return tiles;
  }

  private latLngToTile(latLng: any, zoom: number): { x: number, y: number } {
    const lat = latLng.lat * Math.PI / 180;
    const n = Math.pow(2, zoom);
    const x = Math.floor((latLng.lng + 180) / 360 * n);
    const y = Math.floor((1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2 * n);
    return { x, y };
  }

  /* -------------------------------------------- Map Controls */
  public setMapType(id: string): void {
    if (!this.map) return;
    const L = (window as any).L;
    this.currentMapType = id;

    if (this.baseTileLayer) this.map.removeLayer(this.baseTileLayer);
    if (this.hybridLabelLayer) this.map.removeLayer(this.hybridLabelLayer);

    switch (id) {
      case 'satellite':
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
        this.baseTileLayer = L.tileLayer(
          'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '&copy; Google Satellite',
          }
        ).addTo(this.map);

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
        this.baseTileLayer = L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { 
            maxZoom: 19, 
            attribution: '&copy; OpenStreetMap contributors' 
          }
        ).addTo(this.map);
        break;
    }
  }

  private addMapControls(L: any): void {
    this.addMapTypeControl(L);
    this.addCoverageToggleControl(L);
  }

  private addMapTypeControl(L: any): void {
    const MapTypeControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: () => {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        div.innerHTML = `
          <select id="mly-maptype" style="height:28px; padding: 4px; border: none;">
            <option value="roadmap">Road</option>
            <option value="satellite">Satellite</option>
            <option value="hybrid">Hybrid</option>
          </select>`;
        
        L.DomEvent.disableClickPropagation(div);
        const selector = div.querySelector('#mly-maptype') as HTMLSelectElement;
        if (selector) {
          selector.value = this.currentMapType;
          selector.onchange = (e) => {
            this.setMapType((e.target as HTMLSelectElement).value);
          };
        }
        return div;
      },
    });
    new MapTypeControl().addTo(this.map);
  }

  private addCoverageToggleControl(L: any): void {
    const CoverageControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: () => {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        const button = L.DomUtil.create('button', '', container);
        button.innerHTML = '📍 Show Coverage';
        button.style.cssText = 'cursor:pointer;padding:6px 12px;border:none;background:white;color:#05CB63;font-weight:bold;';
        
        L.DomEvent.on(button, 'click', (e: Event) => {
          L.DomEvent.stopPropagation(e);
          L.DomEvent.preventDefault(e);
          
          if (this.coverageVisible) {
            this.hideCoverage();
            button.innerHTML = '📍 Show Coverage';
            button.style.color = '#05CB63';
            button.style.backgroundColor = 'white';
          } else {
            this.showCoverage(this.currentPosition || { lat: 0, lng: 0 });
            button.innerHTML = '❌ Hide Coverage';
            button.style.color = 'white';
            button.style.backgroundColor = '#05CB63';
          }
        });
        return container;
      }
    });
    new CoverageControl().addTo(this.map);
  }

  /* -------------------------------------------- Pegman */
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

  public setPegmanVisible(visible: boolean): void {
    if (this.pegmanMarker) {
      this.pegmanMarker.setOpacity(visible ? 1 : 0);
    }
  }

  /* -------------------------------------------- Event Handlers */
  public onMapClick(cb: (p: LatLng) => void): void {
    this.mapClickCb = cb;
  }

  public onStreetViewChange(cb: (p: LatLng, h: number, k: number) => void): void {
    this.svChangeCb = cb;
  }

  /* -------------------------------------------- Utilities */
  private showError(message: string): void {
    const container = document.getElementById(this.streetViewContainerId);
    if (container) {
      container.innerHTML = `
        <div style="display:flex;height:100%;align-items:center;justify-content:center;background:#f8f8f8;color:#666;flex-direction:column;padding:20px;text-align:center;">
          <div style="margin-bottom:10px;font-size:24px;">⚠️</div>
          <div>${message}</div>
        </div>
      `;
    }
  }

  public async cleanup(): Promise<void> {
    this.hideCoverage();
    if (this.mapillaryViewer) {
      this.mapillaryViewer.remove();
      this.mapillaryViewer = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}