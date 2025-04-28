var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export class CoordinateTranslator {
    static translateCoordinates(position, fromProvider, toProvider) {
        // If same provider, no translation needed
        if (fromProvider === toProvider) {
            return position;
        }
        // For Kakao Maps specifically, you might need WGS84 to WCONGNAMUL conversion
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
     * In reality, both use WGS84, but this is a placeholder for any potential adjustments.
     */
    static googleToKakao(position) {
        return position;
    }
    /**
     * Convert Kakao Maps coordinates to Google Maps coordinates.
     */
    static kakaoToGoogle(position) {
        // Inverse of googleToKakao
        return position;
    }
    static findNearestStreetViewPosition(position_1, provider_1) {
        return __awaiter(this, arguments, void 0, function* (position, provider, radius = 50) {
            return position;
        });
    }
}
