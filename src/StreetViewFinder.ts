import { LatLng } from './IMapProvider';

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
    public static async findNearestStreetViewPosition(
        position: LatLng, 
        provider: string,
        radius: number = 50
    ): Promise<LatLng | null> {
        switch (provider) {
            case 'google':
                return await this.findGoogleStreetViewPosition(position, radius);
            case 'kakao':
                return await this.findKakaoStreetViewPosition(position, radius);
            case 'yandex':
                return await this.findYandexStreetViewPosition(position);
            default:
                return position;
        }
    }
    
    /**
     * Find the nearest Google Street View position.
     */
    private static async findGoogleStreetViewPosition(position: LatLng, radius: number): Promise<LatLng | null> {
        return new Promise((resolve, reject) => {
            // Create a Street View service if it exists in the window scope
            if (window.google && window.google.maps && window.google.maps.StreetViewService) {
                const streetViewService = new google.maps.StreetViewService();
                
                streetViewService.getPanorama({
                    location: new google.maps.LatLng(position.lat, position.lng),
                    radius: radius,
                    preference: google.maps.StreetViewPreference.NEAREST
                }, (data: any, status: string) => {
                    if (status === google.maps.StreetViewStatus.OK && data) {
                        // Add explicit null check for data.location and data.location.latLng
                        const locationData = data.location;
                        if (locationData && locationData.latLng) {
                            const latLngObj = locationData.latLng;
                            resolve({
                                lat: latLngObj.lat(),
                                lng: latLngObj.lng()
                            });
                        } else {
                            // Location data is incomplete
                            console.warn('Street View data found but location information is incomplete');
                            resolve(null);
                        }
                    } else {
                        // No street view found
                        resolve(null);
                    }
                });
            } else {
                // Google Maps API not available
                console.warn('Google Maps API not available');
                resolve(position);
            }
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

    private static async findKakaoStreetViewPosition(position: LatLng, radius: number): Promise<LatLng | null> {
    return new Promise((resolve, reject) => {
        // Check if Kakao Maps API is loaded
        if (window.kakao && window.kakao.maps && window.kakao.maps.RoadviewClient) {
            const roadviewClient = new kakao.maps.RoadviewClient();
            
            roadviewClient.getNearestPanoId(
                new kakao.maps.LatLng(position.lat, position.lng),
                radius,
                (panoId: string | null) => {
                    if (panoId) {
                        // If a panorama is found, we'll return the original position
                        // The actual panorama position will be handled by the Kakao provider
                        resolve(position);
                    } else {
                        // No panorama found
                        resolve(null);
                    }
                }
            );
        } else {
            // Kakao Maps API not available
            console.warn('Kakao Maps API not available');
            resolve(position);
        }
    });
}  
    
    /**
     * Find the nearest Yandex Panorama position.
     */
    private static async findYandexStreetViewPosition(position: LatLng): Promise<LatLng | null> {
        return new Promise<LatLng | null>((resolve, reject) => {
            // Check if Yandex Maps API is loaded
            if (window.ymaps && window.ymaps.panorama) {
                // Yandex uses [lat, lng] in its API
                ymaps.panorama.locate([position.lat, position.lng])
                    .then((panoramas: any[]) => {
                        if (panoramas && panoramas.length > 0) {
                            // Get the first panorama
                            const panorama = panoramas[0];
                            // In YandexMapsProvider, panoramaPlayer.getPosition() is used, which returns [lat, lng]
                            // So we'll maintain the same format
                            resolve({
                                lat: position.lat, // Use original position but update when panorama player is created
                                lng: position.lng
                            });
                        } else {
                            // No panorama found
                            resolve(null);
                        }
                    })
                    .catch((error: any) => {
                        console.error('Error finding Yandex panorama:', error);
                        resolve(null);
                    });
            } else {
                // Yandex Maps API not available
                console.warn('Yandex Maps API not available');
                resolve(position);
            }
        });
    }
}

// Add type definitions for global objects
declare global {
    interface Window {
        google?: {
            maps?: {
                StreetViewService?: any;
                StreetViewStatus?: {
                    OK: string;
                };
                StreetViewPreference?: {
                    NEAREST: string;
                };
                LatLng?: any;
            };
        };
        kakao?: {
            maps?: {
                RoadviewClient?: any;
                LatLng?: any;
                Roadview?: any;
                event?: {
                    addListener: Function;
                };
            };
        };
        ymaps?: {
            panorama?: {
                locate: (point: number[]) => Promise<any[]>;
                createPlayer: (container: HTMLElement | string, point: number[], options?: any) => Promise<any>;
            };
        };
    }
}