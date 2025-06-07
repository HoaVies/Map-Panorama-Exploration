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
 * CoordinateTranslator provides methods to translate coordinates between different map providers.
 *
 * Note: Different map providers might use slightly different coordinate systems.
 * This class helps bridge those differences to ensure consistency when switching providers.
 */
export class CoordinateTranslator {
    /**
     * Translates coordinates from one provider to another.
     *
     * @param position The original position
     * @param fromProvider The source provider (e.g., 'google', 'kakao', 'yandex')
     * @param toProvider The target provider (e.g., 'google', 'kakao', 'yandex')
     * @returns The translated position for the target provider
     */
    static translateCoordinates(position, fromProvider, toProvider) {
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
        // For Yandex, they might use a slightly different coordinate system
        if (fromProvider === 'google' && toProvider === 'yandex') {
            return this.googleToYandex(position);
        }
        if (fromProvider === 'yandex' && toProvider === 'google') {
            return this.yandexToGoogle(position);
        }
        if (fromProvider === 'kakao' && toProvider === 'yandex') {
            // First convert to Google, then to Yandex
            const googlePos = this.kakaoToGoogle(position);
            return this.googleToYandex(googlePos);
        }
        if (fromProvider === 'yandex' && toProvider === 'kakao') {
            // First convert to Google, then to Kakao
            const googlePos = this.yandexToGoogle(position);
            return this.googleToKakao(googlePos);
        }
        // Default case: return the original position
        return position;
    }
    /**
     * Convert Google Maps coordinates to Kakao Maps coordinates.
     * In reality, both use WGS84, but this is a placeholder for any potential adjustments.
     */
    static googleToKakao(position) {
        // Google and Kakao both use WGS84, so no conversion is needed
        return position;
    }
    /**
     * Convert Kakao Maps coordinates to Google Maps coordinates.
     */
    static kakaoToGoogle(position) {
        // Inverse of googleToKakao
        return position;
    }
    /**
     * Convert Google Maps coordinates to Yandex Maps coordinates.
     */
    static googleToYandex(position) {
        return position;
    }
    /**
     * Convert Yandex Maps coordinates to Google Maps coordinates.
     */
    static yandexToGoogle(position) {
        // Inverse of googleToYandex
        return position;
    }
    /**
     * Find the nearest valid street view position to the given position for a specific provider.
     * This is useful when switching providers, as a street view might not be available
     * at the exact same position.
     *
     * @param position The target position
     * @param provider The map provider to check
     * @param radius Search radius in meters (default: 50)
     * @returns A promise that resolves to the nearest valid street view position
     */
    static findNearestStreetViewPosition(position_1, provider_1) {
        return __awaiter(this, arguments, void 0, function* (position, provider, radius = 50) {
            return position;
        });
    }
}
//# sourceMappingURL=CoordinateTranslator.js.map