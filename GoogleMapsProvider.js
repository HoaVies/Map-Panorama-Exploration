var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export class GoogleMapsProvider {
    constructor() {
        this.map = null;
        this.streetView = null;
        this.pegmanMarker = null;
        this.coveragePolygon = null;
        this.streetViewChangeCallback = null;
    }
    initializeMap(containerId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const mapOptions = {
                center: new google.maps.LatLng(options.center.lat, options.center.lng),
                zoom: options.zoom,
                mapTypeId: options.mapTypeId
            };
            this.map = new google.maps.Map(document.getElementById(containerId), mapOptions);
        });
    }
    initializeStreetView(containerId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const streetViewOptions = {
                position: new google.maps.LatLng(options.position.lat, options.position.lng),
                pov: {
                    heading: options.pov.heading,
                    pitch: options.pov.pitch
                },
                addressControl: true,
                enableCloseButton: true,
                linksControl: false,
                panControl: true,
                zoomControl: true,
                fullscreenControl: true,
                visible: true
            };
            this.streetView = new google.maps.StreetViewPanorama(document.getElementById(containerId), streetViewOptions);
            if (this.map) {
                this.map.setStreetView(this.streetView);
            }
            // Set up event listeners for position and POV changes
            this.setupStreetViewEventListeners();
        });
    }
    // New method to set up event listeners for the street view
    setupStreetViewEventListeners() {
        if (!this.streetView)
            return;
        // Listen for position changes
        this.streetView.addListener('position_changed', () => {
            this.notifyStreetViewChange();
        });
        // IMPORTANT: Listen for POV changes
        this.streetView.addListener('pov_changed', () => {
            this.notifyStreetViewChange();
        });
    }
    // Helper method to notify about street view changes
    notifyStreetViewChange() {
        if (!this.streetView || !this.streetViewChangeCallback)
            return;
        const position = this.streetView.getPosition();
        const pov = this.streetView.getPov();
        if (position) {
            this.streetViewChangeCallback({ lat: position.lat(), lng: position.lng() }, pov.heading, pov.pitch);
            console.log(`Google: Street view updated - heading=${pov.heading}, pitch=${pov.pitch}`);
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
                position: new google.maps.LatLng(position.lat, position.lng),
                visible: false,
            });
        }
        else {
            this.pegmanMarker.setPosition(new google.maps.LatLng(position.lat, position.lng));
        }
    }
    setPegmanVisible(visible) {
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
        this.streetViewChangeCallback = callback;
        // If street view is already initialized, set up the listeners
        if (this.streetView) {
            this.setupStreetViewEventListeners();
        }
    }
}
//# sourceMappingURL=GoogleMapsProvider.js.map