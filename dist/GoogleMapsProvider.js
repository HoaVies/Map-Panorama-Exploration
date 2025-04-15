export class GoogleMapsProvider {
    constructor() {
        this.map = null;
        this.streetView = null;
        this.pegmanMarker = null;
        this.coveragePolygon = null;
    }
    initializeMap(containerId, options) {
        const mapOptions = {
            center: new google.maps.LatLng(options.center.lat, options.center.lng),
            zoom: options.zoom,
            mapTypeId: options.mapTypeId
        };
        this.map = new google.maps.Map(document.getElementById(containerId), mapOptions);
    }
    initializeStreetView(containerId, options) {
        const streetViewOptions = {
            position: new google.maps.LatLng(options.position.lat, options.position.lng),
            pov: {
                heading: options.pov.heading,
                pitch: options.pov.pitch
            },
            addressControl: true,
            enableCloseButton: true,
            linksControl: true,
            panControl: true,
            zoomControl: true,
            fullscreenControl: true,
            visible: true
        };
        this.streetView = new google.maps.StreetViewPanorama(document.getElementById(containerId), streetViewOptions);
        if (this.map) {
            this.map.setStreetView(this.streetView);
        }
    }
    setCenter(position) {
        if (this.map) {
            this.map.setCenter(new google.maps.LatLng(position.lat, position.lng));
        }
    }
    setZoom(zoom) {
        if (this.map) {
            this.map.setZoom(zoom);
        }
    }
    setMapType(mapTypeId) {
        if (this.map) {
            this.map.setMapTypeId(mapTypeId);
        }
    }
    setStreetViewPosition(position) {
        if (this.streetView) {
            this.streetView.setPosition(new google.maps.LatLng(position.lat, position.lng));
        }
    }
    setStreetViewPOV(heading, pitch) {
        if (this.streetView) {
            this.streetView.setPov({ heading, pitch });
        }
    }
    setPegmanPosition(position) {
        var _a;
        if (!this.pegmanMarker) {
            this.pegmanMarker = new google.maps.Marker({
                map: (_a = this.map) !== null && _a !== void 0 ? _a : undefined,
                position: new google.maps.LatLng(position.lat, position.lng)
            });
        }
        else {
            this.pegmanMarker.setPosition(new google.maps.LatLng(position.lat, position.lng));
        }
    }
    setPegmanVisible(visible) {
        if (this.pegmanMarker) {
            this.pegmanMarker.setVisible(visible);
        }
    }
    showCoverage(position) {
        this.hideCoverage();
    }
    hideCoverage() {
        if (this.coveragePolygon) {
            this.coveragePolygon.setMap(null);
        }
    }
    onMapClick(callback) {
        if (this.map) {
            this.map.addListener('click', (event) => {
                var _a, _b;
                const lat = ((_a = event.latLng) === null || _a === void 0 ? void 0 : _a.lat()) || 0;
                const lng = ((_b = event.latLng) === null || _b === void 0 ? void 0 : _b.lng()) || 0;
                callback({ lat, lng });
            });
        }
    }
    onStreetViewChange(callback) {
        if (this.streetView) {
            this.streetView.addListener('position_changed', () => {
                if (this.streetView) {
                    const position = this.streetView.getPosition();
                    const pov = this.streetView.getPov();
                    if (position) {
                        callback({ lat: position.lat(), lng: position.lng() }, pov.heading, pov.pitch);
                    }
                }
            });
        }
    }
}
