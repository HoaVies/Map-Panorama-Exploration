declare global {
    interface Window {
        apiLoadStatus: {
            google: boolean;
            kakao: boolean;
            yandex: boolean;
            mapycz: boolean;
            mapillary:boolean;
        };
        activeProvider: string;
        googleMap: any;
        kakaoMap: any;
        yandexMap: any;
        mapyczMap: any;
        kakao: any;
        ymaps: any;
        google: any;
        mapycz_api_key: string;
        Panorama: any;
        L: any;
        Mapillary: any;
    }
}
export {};