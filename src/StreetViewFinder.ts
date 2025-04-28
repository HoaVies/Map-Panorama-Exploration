import { LatLng } from './IMapProvider';

/**
 * This class implements the actual street view position finding for each provider.
 */
export class StreetViewFinder {
    
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
            default:
                return position;
        }
    }
/*
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
            console.warn('Google Maps API not available');
            resolve(position);
        }
    });
}
    
    /**
     * Find the nearest Kakao Road View position.
     */
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
                        } else {
                            resolve(null);
                        }
                    }
                );
            } else {
                // Kakao Maps API not available
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
    }
}