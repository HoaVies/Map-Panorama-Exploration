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
 * It extends the CoordinateTranslator with concrete implementations.
 */
export class StreetViewFinder {
    /**
     * Find the nearest valid street view position to the given position.
     *
     * @param position The target position
     * @param provider The map provider to check ('google', 'kakao', 'yandex')
     * @param radius Search radius in meters (default: 50)
     * @returns A promise that resolves to the nearest valid street view position or null if none found
     */
    static findNearestStreetViewPosition(position_1, provider_1) {
        return __awaiter(this, arguments, void 0, function* (position, provider, radius = 50) {
            switch (provider) {
                case 'google':
                    return yield this.findGoogleStreetViewPosition(position, radius);
                case 'kakao':
                    return yield this.findKakaoStreetViewPosition(position, radius);
                case 'yandex':
                    return yield this.findYandexStreetViewPosition(position);
                default:
                    return position;
            }
        });
    }
    /**
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
                    // Google Maps API not available
                    console.warn('Google Maps API not available');
                    resolve(position);
                }
            });
        });
    }
    /**
     * Find the nearest Kakao Road View position.
     */
    // private static async findKakaoStreetViewPosition(position: LatLng, radius: number): Promise<LatLng | null> {
    //     return new Promise((resolve, reject) => {
    //         // Check if Kakao Maps API is loaded
    //         if (window.kakao && window.kakao.maps && window.kakao.maps.RoadviewClient) {
    //             const roadviewClient = new kakao.maps.RoadviewClient();
    //             roadviewClient.getNearestPanoId(
    //                 new kakao.maps.LatLng(position.lat, position.lng),
    //                 radius,
    //                 (panoId: string | null) => {
    //                     if (panoId) {
    //                         // We found a valid panorama ID
    //                         // Instead of using a temporary container and events, we'll use a simpler approach
    //                         // to avoid the DOM removal errors
    //                         // Create a hidden div that we'll never attach to the DOM
    //                         const dummyDiv = document.createElement('div');
    //                         // Get the position using the RoadviewClient
    //                         // In most cases, the position will be very close to the original position
    //                         // This is safer than creating temporary DOM elements
    //                         resolve({
    //                             lat: position.lat,
    //                             lng: position.lng
    //                         });
    //                     } else {
    //                         // No panorama found
    //                         resolve(null);
    //                     }
    //                 }
    //             );
    //         } else {
    //             // Kakao Maps API not available
    //             console.warn('Kakao Maps API not available');
    //             resolve(position);
    //         }
    //     });
    // }
    static findKakaoStreetViewPosition(position, radius) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                // Check if Kakao Maps API is loaded
                if (window.kakao && window.kakao.maps && window.kakao.maps.RoadviewClient) {
                    const roadviewClient = new kakao.maps.RoadviewClient();
                    roadviewClient.getNearestPanoId(new kakao.maps.LatLng(position.lat, position.lng), radius, (panoId) => {
                        if (panoId) {
                            // If a panorama is found, we'll return the original position
                            // The actual panorama position will be handled by the Kakao provider
                            resolve(position);
                        }
                        else {
                            // No panorama found
                            resolve(null);
                        }
                    });
                }
                else {
                    // Kakao Maps API not available
                    console.warn('Kakao Maps API not available');
                    resolve(position);
                }
            });
        });
    }
    /**
     * Find the nearest Yandex Panorama position.
     */
    static findYandexStreetViewPosition(position) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                // Check if Yandex Maps API is loaded
                if (window.ymaps && window.ymaps.panorama) {
                    // Yandex uses [lat, lng] in its API
                    ymaps.panorama.locate([position.lat, position.lng])
                        .then((panoramas) => {
                        if (panoramas && panoramas.length > 0) {
                            // Get the first panorama
                            const panorama = panoramas[0];
                            // In YandexMapsProvider, panoramaPlayer.getPosition() is used, which returns [lat, lng]
                            // So we'll maintain the same format
                            resolve({
                                lat: position.lat, // Use original position but update when panorama player is created
                                lng: position.lng
                            });
                        }
                        else {
                            // No panorama found
                            resolve(null);
                        }
                    })
                        .catch((error) => {
                        console.error('Error finding Yandex panorama:', error);
                        resolve(null);
                    });
                }
                else {
                    // Yandex Maps API not available
                    console.warn('Yandex Maps API not available');
                    resolve(position);
                }
            });
        });
    }
    static isWithinKakaoCoverage(position) {
        // Approximate bounding box for South Korea and some surrounding areas
        const bounds = {
            north: 43.0, // North Korea border
            south: 33.0, // South of Jeju Island
            east: 132.0, // East Sea
            west: 124.0 // Yellow Sea
        };
        return position.lat >= bounds.south &&
            position.lat <= bounds.north &&
            position.lng >= bounds.west &&
            position.lng <= bounds.east;
    }
}
//# sourceMappingURL=StreetViewFinder.js.map