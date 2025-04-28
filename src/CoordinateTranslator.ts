import { LatLng } from './IMapProvider';
export class CoordinateTranslator {
    
    public static translateCoordinates(
        position: LatLng, 
        fromProvider: string, 
        toProvider: string
    ): LatLng {
        // If same provider, no translation needed
        if (fromProvider === toProvider) {
            return position;
        }
        
        if (fromProvider === 'google' && toProvider === 'kakao') {
            return this.googleToKakao(position);
        }
        
        if (fromProvider === 'kakao' && toProvider === 'google') {
            return this.kakaoToGoogle(position);
        }
        
        // Default case: return the original position
        return position;
    }
    
    /**
     * Convert Google Maps coordinates to Kakao Maps coordinates.
     * both use WGS84, but this is a placeholder for any potential adjustments.
     */
    private static googleToKakao(position: LatLng): LatLng {
        return position;
    }
    
    /**
     * Convert Kakao Maps coordinates to Google Maps coordinates.
     */
    private static kakaoToGoogle(position: LatLng): LatLng {
        // Inverse of googleToKakao
        return position;
    }
    
    public static async findNearestStreetViewPosition(
        position: LatLng, 
        provider: string,
        radius: number = 50
    ): Promise<LatLng | null> {
        return position;
    }
}