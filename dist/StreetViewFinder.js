var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/**
 * This class implements the actual street view position finding for each provider.
 */
export class StreetViewFinder {
    static findNearestStreetViewPosition(position_1, provider_1) {
        return __awaiter(this, arguments, void 0, function* (position, provider, radius = 50) {
            switch (provider) {
                case 'google':
                    return yield this.findGoogleStreetViewPosition(position, radius);
                case 'kakao':
                    return yield this.findKakaoStreetViewPosition(position, radius);
                default:
                    return position;
            }
        });
    }
    /*
     * Find the nearest Google Street View position.
     */
    static findGoogleStreetViewPosition(position, radius) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                // Create a Street View service if it exists in the window scope
                if (window.google && window.google.maps && window.google.maps.StreetViewService) {
                    const streetViewService = new google.maps.StreetViewService();
                    streetViewService.getPanorama({
                        location: new google.maps.LatLng(position.lat, position.lng),
                        radius: radius,
                        preference: google.maps.StreetViewPreference.NEAREST
                    }, (data, status) => {
                        if (status === google.maps.StreetViewStatus.OK && data) {
                            // Add explicit null check for data.location and data.location.latLng
                            const locationData = data.location;
                            if (locationData && locationData.latLng) {
                                const latLngObj = locationData.latLng;
                                resolve({
                                    lat: latLngObj.lat(),
                                    lng: latLngObj.lng()
                                });
                            }
                            else {
                                // Location data is incomplete
                                console.warn('Street View data found but location information is incomplete');
                                resolve(null);
                            }
                        }
                        else {
                            // No street view found
                            resolve(null);
                        }
                    });
                }
                else {
                    console.warn('Google Maps API not available');
                    resolve(position);
                }
            });
        });
    }
    /**
     * Find the nearest Kakao Road View position.
     */
    static findKakaoStreetViewPosition(position, radius) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                // Check if Kakao Maps API is loaded
                if (window.kakao && window.kakao.maps && window.kakao.maps.RoadviewClient) {
                    const roadviewClient = new kakao.maps.RoadviewClient();
                    roadviewClient.getNearestPanoId(new kakao.maps.LatLng(position.lat, position.lng), radius, (panoId) => {
                        if (panoId) {
                            // We have a valid panorama ID, but we also need its position
                            // Create a temporary Roadview to get the position
                            const tempContainer = document.createElement('div');
                            tempContainer.style.display = 'none';
                            document.body.appendChild(tempContainer);
                            const roadview = new kakao.maps.Roadview(tempContainer);
                            // Set up a listener for when the position changes
                            kakao.maps.event.addListener(roadview, 'position_changed', () => {
                                const rvPosition = roadview.getPosition();
                                document.body.removeChild(tempContainer);
                                resolve({
                                    lat: rvPosition.getLat(),
                                    lng: rvPosition.getLng()
                                });
                            });
                            // Set the panorama ID to trigger the position_changed event
                            roadview.setPanoId(panoId, new kakao.maps.LatLng(position.lat, position.lng));
                            // Add a fallback in case the event doesn't fire
                            setTimeout(() => {
                                if (document.body.contains(tempContainer)) {
                                    document.body.removeChild(tempContainer);
                                    resolve(position); // Fall back to the original position
                                }
                            }, 1000);
                        }
                        else {
                            resolve(null);
                        }
                    });
                }
                else {
                    // Kakao Maps API not available
                    resolve(position);
                }
            });
        });
    }
}
