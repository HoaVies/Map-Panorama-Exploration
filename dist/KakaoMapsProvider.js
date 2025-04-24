export class KakaoMapsProvider {
    constructor() {
        this.map = null;
        this.roadview = null;
        this.roadviewClient = null;
        this.pegmanMarker = null;
        this.mapClickCallback = null;
        this.roadviewChangeCallback = null;
        this.roadviewControl = null;
        this.mapTypeControl = null;
        this.terrainCheckbox = null;
        this.overlayOn = false;
        this.isProcessingEvent = false;
    }
    initializeMap(containerId, options) {
        const mapContainer = document.getElementById(containerId);
        if (!mapContainer) {
            console.error('Map container not found');
            return;
        }
        const mapOptions = {
            center: new kakao.maps.LatLng(options.center.lat, options.center.lng),
            level: this.convertZoomToLevel(options.zoom)
        };
        this.map = new kakao.maps.Map(mapContainer, mapOptions);
        this.roadviewClient = new kakao.maps.RoadviewClient();
        // Set map type
        this.setMapType(options.mapTypeId);
        // Create and add the roadview control button
        this.createRoadviewControl(mapContainer);
        // Create and add the custom map type controls
        this.createCustomMapTypeControls(mapContainer);
        // Create pegman marker immediately with the initial position
        this.createPegmanMarker(options.center);
        // Initialize click handler
        this.setupMapClickHandler();
    }
    createPegmanMarker(position) {
        if (!this.map)
            return;
        // Create marker image for pegman
        const markImage = new kakao.maps.MarkerImage('https://t1.daumcdn.net/localimg/localimages/07/2018/pc/roadview_minimap_wk_2018.png', new kakao.maps.Size(26, 46), {
            spriteSize: new kakao.maps.Size(1666, 168),
            spriteOrigin: new kakao.maps.Point(705, 114),
            offset: new kakao.maps.Point(13, 46)
        });
        // Create draggable marker (pegman)
        this.pegmanMarker = new kakao.maps.Marker({
            map: this.map, // Add to map immediately
            image: markImage,
            position: new kakao.maps.LatLng(position.lat, position.lng),
            draggable: true
        });
        // Setup drag events for pegman marker
        this.setupPegmanEvents();
    }
    createRoadviewControl(mapContainer) {
        // Create the roadview control button
        this.roadviewControl = document.createElement('div');
        this.roadviewControl.id = 'roadviewControl';
        this.roadviewControl.style.position = 'absolute';
        this.roadviewControl.style.top = '10px';
        this.roadviewControl.style.left = '10px';
        this.roadviewControl.style.width = '42px';
        this.roadviewControl.style.height = '42px';
        this.roadviewControl.style.zIndex = '2';
        this.roadviewControl.style.cursor = 'pointer';
        this.roadviewControl.style.background = 'url(https://t1.daumcdn.net/localimg/localimages/07/2018/pc/common/img_search.png) 0 -450px no-repeat';
        this.roadviewControl.style.backgroundColor = 'white';
        this.roadviewControl.style.borderRadius = '4px';
        this.roadviewControl.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
        this.roadviewControl.addEventListener('click', () => this.toggleRoadviewOverlay());
        mapContainer.appendChild(this.roadviewControl);
    }
    createCustomMapTypeControls(mapContainer) {
        if (!this.map)
            return;
        // Create container for map type controls
        this.mapTypeControl = document.createElement('div');
        this.mapTypeControl.style.position = 'absolute';
        this.mapTypeControl.style.top = '10px';
        this.mapTypeControl.style.left = '65px'; // Position to the right of roadview control
        this.mapTypeControl.style.backgroundColor = 'white';
        this.mapTypeControl.style.borderRadius = '4px';
        this.mapTypeControl.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
        this.mapTypeControl.style.zIndex = '2';
        this.mapTypeControl.style.padding = '10px';
        this.mapTypeControl.style.display = 'flex';
        this.mapTypeControl.style.flexDirection = 'column';
        // Add map/satellite radio buttons
        const mapTypeOptions = document.createElement('div');
        mapTypeOptions.style.marginBottom = '8px';
        // Map radio button
        const mapRadio = document.createElement('input');
        mapRadio.type = 'radio';
        mapRadio.id = 'mapType';
        mapRadio.name = 'mapType';
        mapRadio.checked = this.map.getMapTypeId() === kakao.maps.MapTypeId.ROADMAP;
        mapRadio.addEventListener('change', () => {
            this.setMapType('roadmap');
        });
        const mapLabel = document.createElement('label');
        mapLabel.htmlFor = 'mapType';
        mapLabel.textContent = 'Map';
        mapLabel.style.marginLeft = '5px';
        mapLabel.style.marginRight = '10px';
        // Satellite radio button
        const satelliteRadio = document.createElement('input');
        satelliteRadio.type = 'radio';
        satelliteRadio.id = 'satelliteType';
        satelliteRadio.name = 'mapType';
        satelliteRadio.checked = this.map.getMapTypeId() === kakao.maps.MapTypeId.SKYVIEW;
        satelliteRadio.addEventListener('change', () => {
            this.setMapType('satellite');
        });
        const satelliteLabel = document.createElement('label');
        satelliteLabel.htmlFor = 'satelliteType';
        satelliteLabel.textContent = 'Satellite';
        satelliteLabel.style.marginLeft = '5px';
        mapTypeOptions.appendChild(mapRadio);
        mapTypeOptions.appendChild(mapLabel);
        mapTypeOptions.appendChild(satelliteRadio);
        mapTypeOptions.appendChild(satelliteLabel);
        // Add terrain checkbox
        const terrainOption = document.createElement('div');
        this.terrainCheckbox = document.createElement('input');
        this.terrainCheckbox.type = 'checkbox';
        this.terrainCheckbox.id = 'terrainType';
        this.terrainCheckbox.addEventListener('change', (e) => {
            if (!this.map)
                return;
            if (e.target.checked) {
                this.map.addOverlayMapTypeId(kakao.maps.MapTypeId.TERRAIN);
            }
            else {
                this.map.removeOverlayMapTypeId(kakao.maps.MapTypeId.TERRAIN);
            }
        });
        const terrainLabel = document.createElement('label');
        terrainLabel.htmlFor = 'terrainType';
        terrainLabel.textContent = 'Terrain';
        terrainLabel.style.marginLeft = '5px';
        terrainOption.appendChild(this.terrainCheckbox);
        terrainOption.appendChild(terrainLabel);
        // Add elements to control container
        this.mapTypeControl.appendChild(mapTypeOptions);
        this.mapTypeControl.appendChild(terrainOption);
        // Add to map container
        mapContainer.appendChild(this.mapTypeControl);
    }
    toggleRoadviewOverlay() {
        if (!this.roadviewControl || !this.map)
            return;
        // Toggle button active state
        if (this.roadviewControl.className.indexOf('active') === -1) {
            this.roadviewControl.className = 'active';
            this.roadviewControl.style.backgroundPosition = '0 -350px';
            this.showCoverage();
        }
        else {
            this.roadviewControl.className = '';
            this.roadviewControl.style.backgroundPosition = '0 -450px';
            this.hideCoverage();
        }
    }
    showCoverage(position) {
        if (!this.map)
            return;
        this.overlayOn = true;
        // Add roadview overlay to map
        this.map.addOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);
        // Position pegman at provided position or current center if needed
        if (position && this.pegmanMarker) {
            this.pegmanMarker.setPosition(new kakao.maps.LatLng(position.lat, position.lng));
        }
    }
    hideCoverage() {
        if (!this.map)
            return;
        this.overlayOn = false;
        // Remove roadview overlay
        this.map.removeOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);
    }
    initializeStreetView(containerId, options) {
        const roadviewContainer = document.getElementById(containerId);
        if (!roadviewContainer) {
            console.error('Street view container not found');
            return;
        }
        // Create roadview object
        this.roadview = new kakao.maps.Roadview(roadviewContainer);
        // Set initial roadview position
        this.setRoadviewPosition(options.position);
        // Add position_changed event listener to roadview
        this.setupRoadviewEvents();
    }
    setupMapClickHandler() {
        if (!this.map)
            return;
        kakao.maps.event.addListener(this.map, 'click', (mouseEvent) => {
            if (this.isProcessingEvent)
                return;
            this.isProcessingEvent = true;
            try {
                const latlng = mouseEvent.latLng;
                if (this.mapClickCallback && latlng) {
                    this.mapClickCallback({
                        lat: latlng.getLat(),
                        lng: latlng.getLng()
                    });
                }
                // Update pegman position regardless of overlay status
                if (this.pegmanMarker) {
                    this.pegmanMarker.setPosition(latlng);
                }
                // If overlay is on, try to set street view at clicked position
                if (this.overlayOn) {
                    this.setRoadviewPosition({
                        lat: latlng.getLat(),
                        lng: latlng.getLng()
                    });
                }
            }
            finally {
                this.isProcessingEvent = false;
            }
        });
    }
    setupRoadviewEvents() {
        if (!this.roadview)
            return;
        kakao.maps.event.addListener(this.roadview, 'position_changed', () => {
            if (this.isProcessingEvent)
                return;
            this.isProcessingEvent = true;
            try {
                if (!this.roadview)
                    return;
                const rvPosition = this.roadview.getPosition();
                if (!rvPosition)
                    return;
                // Update map center
                if (this.map) {
                    this.map.setCenter(rvPosition);
                }
                // Update pegman marker regardless of overlay status
                if (this.pegmanMarker) {
                    this.pegmanMarker.setPosition(rvPosition);
                }
                // Call the callback if it exists
                if (this.roadviewChangeCallback) {
                    const viewpoint = this.roadview.getViewpoint();
                    this.roadviewChangeCallback({ lat: rvPosition.getLat(), lng: rvPosition.getLng() }, viewpoint.pan, viewpoint.tilt);
                }
            }
            finally {
                this.isProcessingEvent = false;
            }
        });
        kakao.maps.event.addListener(this.roadview, 'viewpoint_changed', () => {
            if (this.isProcessingEvent)
                return;
            this.isProcessingEvent = true;
            try {
                if (!this.roadview || !this.roadviewChangeCallback)
                    return;
                const position = this.roadview.getPosition();
                const viewpoint = this.roadview.getViewpoint();
                if (position && viewpoint) {
                    this.roadviewChangeCallback({ lat: position.getLat(), lng: position.getLng() }, viewpoint.pan, viewpoint.tilt);
                }
            }
            finally {
                this.isProcessingEvent = false;
            }
        });
    }
    setupPegmanEvents() {
        if (!this.pegmanMarker)
            return;
        kakao.maps.event.addListener(this.pegmanMarker, 'dragend', () => {
            if (this.isProcessingEvent)
                return;
            this.isProcessingEvent = true;
            try {
                if (!this.pegmanMarker)
                    return;
                const position = this.pegmanMarker.getPosition();
                // Only set roadview position if overlay is active
                if (this.overlayOn) {
                    this.setRoadviewPosition({
                        lat: position.getLat(),
                        lng: position.getLng()
                    });
                }
                else if (this.mapClickCallback) {
                    // Otherwise just call the map click callback
                    this.mapClickCallback({
                        lat: position.getLat(),
                        lng: position.getLng()
                    });
                }
            }
            finally {
                this.isProcessingEvent = false;
            }
        });
    }
    setRoadviewPosition(position) {
        if (!this.roadviewClient || !this.roadview)
            return;
        const kakaoPosition = new kakao.maps.LatLng(position.lat, position.lng);
        this.roadviewClient.getNearestPanoId(kakaoPosition, 50, (panoId) => {
            if (panoId && this.roadview) {
                this.roadview.setPanoId(panoId, kakaoPosition);
                // Update pegman position (now always visible)
                if (this.pegmanMarker) {
                    this.pegmanMarker.setPosition(kakaoPosition);
                }
            }
        });
    }
    setCenter(position) {
        if (this.map) {
            this.map.setCenter(new kakao.maps.LatLng(position.lat, position.lng));
            // Update pegman position when center changes
            if (this.pegmanMarker) {
                this.pegmanMarker.setPosition(new kakao.maps.LatLng(position.lat, position.lng));
            }
        }
    }
    setZoom(zoom) {
        if (this.map) {
            this.map.setLevel(this.convertZoomToLevel(zoom));
        }
    }
    setMapType(mapTypeId) {
        if (!this.map)
            return;
        // Remove any overlay map types first to avoid stacking them
        this.map.removeOverlayMapTypeId(kakao.maps.MapTypeId.TERRAIN);
        // Update the map type based on the input
        switch (mapTypeId.toLowerCase()) {
            case 'satellite':
                this.map.setMapTypeId(kakao.maps.MapTypeId.SKYVIEW);
                // Update radio buttons if they exist
                if (this.mapTypeControl) {
                    const satelliteRadio = document.getElementById('satelliteType');
                    if (satelliteRadio)
                        satelliteRadio.checked = true;
                }
                break;
            case 'hybrid':
                this.map.setMapTypeId(kakao.maps.MapTypeId.HYBRID);
                break;
            case 'terrain':
                this.map.setMapTypeId(kakao.maps.MapTypeId.ROADMAP);
                this.map.addOverlayMapTypeId(kakao.maps.MapTypeId.TERRAIN);
                // Update radio buttons and check terrain checkbox
                if (this.mapTypeControl) {
                    const mapRadio = document.getElementById('mapType');
                    if (mapRadio)
                        mapRadio.checked = true;
                    if (this.terrainCheckbox) {
                        this.terrainCheckbox.checked = true;
                    }
                }
                break;
            case 'roadmap':
            default:
                this.map.setMapTypeId(kakao.maps.MapTypeId.ROADMAP);
                // Update radio buttons if they exist
                if (this.mapTypeControl) {
                    const mapRadio = document.getElementById('mapType');
                    if (mapRadio)
                        mapRadio.checked = true;
                }
                break;
        }
    }
    setStreetViewPosition(position) {
        // Update pegman marker (now always visible)
        if (this.pegmanMarker) {
            this.pegmanMarker.setPosition(new kakao.maps.LatLng(position.lat, position.lng));
        }
        // Only update actual roadview if overlay is active
        if (this.overlayOn) {
            this.setRoadviewPosition(position);
        }
    }
    setStreetViewPOV(heading, pitch) {
        if (this.roadview) {
            this.roadview.setViewpoint({
                pan: heading,
                tilt: pitch,
                zoom: 0
            });
        }
    }
    setPegmanPosition(position) {
        // Always update pegman position regardless of overlay status
        if (this.pegmanMarker) {
            this.pegmanMarker.setPosition(new kakao.maps.LatLng(position.lat, position.lng));
        }
    }
    setPegmanVisible(visible) {
        // Show/hide pegman regardless of overlay status
        if (this.pegmanMarker && this.map) {
            if (visible) {
                this.pegmanMarker.setMap(this.map);
            }
            else {
                this.pegmanMarker.setMap(null);
            }
        }
    }
    onMapClick(callback) {
        this.mapClickCallback = callback;
    }
    onStreetViewChange(callback) {
        this.roadviewChangeCallback = callback;
    }
    // Helper method to convert Google's zoom level to Kakao's level
    convertZoomToLevel(zoom) {
        return Math.max(1, Math.min(14, Math.floor(14 - (zoom / 21) * 13)));
    }
}
