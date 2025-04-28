import { Map } from './Map.js';
import { GoogleMapsProvider } from './GoogleMapsProvider.js';
import { KakaoMapsProvider } from './KakaoMapsProvider.js';
import { YandexMapsProvider } from './YandexMapsProvider.js';
import { LatLng, MapOptions, StreetViewOptions, IMapProvider } from './IMapProvider.js';
import { CoordinateTranslator } from './CoordinateTranslator.js';
import { StreetViewFinder } from './StreetViewFinder.js';

// Common map options (default values, will be updated when switching providers)
const mapOptions: MapOptions = {
    center: { lat: 37.5665, lng: 126.9780 }, // Seoul
    zoom: 12,
    mapTypeId: 'roadmap'
};

const streetViewOptions: StreetViewOptions = {
    position: { lat: 37.5665, lng: 126.9780 },
    pov: {
        heading: 0,
        pitch: 0
    }
};

// Create map providers
let currentProvider: IMapProvider;
let map: Map;
let currentProviderType: 'google' | 'kakao' = 'google';
let currentState = {
    position: { lat: 37.5665, lng: 126.9780 },
    heading: 0,
    pitch: 0,
    zoom: 12,
    mapTypeId: 'roadmap',
    isCoverageVisible: false
};

// Initialize a map provider with synchronized position
async function initializeMap(providerType: 'google' | 'kakao') {
    console.log(`Initializing ${providerType} Maps provider`);
    
    // Store current state if map exists
    let wasPanoramaVisible = false;
    if (map) {
        currentState = map.getCurrentState();
        console.log('Preserving current state:', currentState);
        
        // Check if we're coming from a provider with an active panorama
        const panoramaElement = document.getElementById('street-view-container');
        if (panoramaElement) {
            wasPanoramaVisible = panoramaElement.style.display !== 'none';
            console.log('Panorama was visible:', wasPanoramaVisible);
        }
    }
    
    // Clear existing map containers
    const mapContainer = document.getElementById('map-container');
    const streetViewContainer = document.getElementById('street-view-container');
    
    if (mapContainer) {
        mapContainer.innerHTML = '';
    }
    
    if (streetViewContainer) {
        streetViewContainer.innerHTML = '';
        streetViewContainer.style.display = 'block';
    }
    
    try {
        // Translate the coordinates from current provider to new provider
        const translatedPosition = CoordinateTranslator.translateCoordinates(
            currentState.position,
            currentProviderType,
            providerType
        );
        
        // Find the nearest street view position in the new provider
        let streetViewPosition = translatedPosition;
        try {
            const nearestPosition = await StreetViewFinder.findNearestStreetViewPosition(
                translatedPosition,
                providerType
            );
            
            if (nearestPosition) {
                streetViewPosition = nearestPosition;
                console.log('Found nearest street view position:', streetViewPosition);
            }
        } catch (error) {
            console.warn('Could not find nearest street view position:', error);
        }
        
        // Create the selected map provider
        if (providerType === 'google') {
            currentProvider = new GoogleMapsProvider();
        } else {
            currentProvider = new KakaoMapsProvider();
        }

        // Update current provider type
        currentProviderType = providerType;

        // Update options with translated/nearest position
        const updatedMapOptions: MapOptions = {
            center: translatedPosition, 
            zoom: currentState.zoom,
            mapTypeId: currentState.mapTypeId
        };
        
        const updatedStreetViewOptions: StreetViewOptions = {
            position: streetViewPosition, // Use the nearest street view position
            pov: {
                heading: currentState.heading,
                pitch: currentState.pitch
            }
        };

        // Create a new map instance with the provider and preserved state
        map = new Map(
            currentProvider,
            'map-container',
            'street-view-container',
            updatedMapOptions,
            updatedStreetViewOptions
        );

        // Initialize the map
        map.initialize();
        
        // Restore coverage visibility if it was visible
        if (currentState.isCoverageVisible) {
            map.showCoverage(translatedPosition);
        }
        
        // Explicitly force panorama visibility if it was previously visible
        if (wasPanoramaVisible) {
            // Ensure the coverage is shown
            map.showCoverage(currentState.position);
            
            // Force panorama at the current position
            setTimeout(() => {
                currentProvider.setStreetViewPosition(currentState.position);
                currentProvider.setPegmanVisible(true);
                
                if (providerType === 'kakao') {
                    tryForceKakaoPanorama(currentState.position);
                }
            }, 500);
        }
        
        // Display a notification about position synchronization
        const statusElement = document.getElementById('sync-status');
        if (statusElement) {
            statusElement.textContent = `Synchronized to ${providerType} Maps at ${translatedPosition.lat.toFixed(6)}, ${translatedPosition.lng.toFixed(6)}`;
            statusElement.style.display = 'block';
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 3000);
        }
        
        console.log(`${providerType} Maps provider initialized successfully`);
    } catch (error) {
        console.error(`Error initializing ${providerType} Maps provider:`, error);
    }
}

// Force Kakao panorama specifically
function tryForceKakaoPanorama(position: LatLng) {
    if (window.kakao && window.kakao.maps) {
        const roadviewClient = new kakao.maps.RoadviewClient();
        roadviewClient.getNearestPanoId(
            new kakao.maps.LatLng(position.lat, position.lng),
            50,
            (panoId: string | null) => {
                if (panoId) {
                    const container = document.getElementById('street-view-container');
                    if (container) {
                        const roadview = new kakao.maps.Roadview(container);
                        roadview.setPanoId(panoId, new kakao.maps.LatLng(position.lat, position.lng));
                        container.style.display = 'block';
                    }
                }
            }
        );
    }
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, setting up provider selector');
    
    // Create a status element for sync notifications
    if (!document.getElementById('sync-status')) {
        const statusElement = document.createElement('div');
        statusElement.id = 'sync-status';
        statusElement.style.position = 'fixed';
        statusElement.style.top = '75px';
        statusElement.style.left = '50%';
        statusElement.style.transform = 'translateX(-50%)';
        statusElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        statusElement.style.color = 'white';
        statusElement.style.padding = '10px';
        statusElement.style.borderRadius = '5px';
        statusElement.style.zIndex = '1000';
        statusElement.style.display = 'none';
        document.body.appendChild(statusElement);
    }
    
    const providerSelector = document.getElementById('provider-select') as HTMLSelectElement;
    
    if (providerSelector) {
        providerSelector.addEventListener('change', () => {
            const selectedProvider = providerSelector.value as 'google' | 'kakao';
            console.log(`Provider changed to: ${selectedProvider}`);
            initializeMap(selectedProvider);
        });
        
        // Initialize with Google Maps by default
        initializeMap('google');
    } else {
        console.error('Provider selector not found in the DOM');
    }
});

// Add keyboard shortcuts
let isShiftPressed = false;

document.addEventListener('keydown', (event) => {
    if (event.key === 'Shift') {
        isShiftPressed = true;
    }
});

document.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') {
        isShiftPressed = false;
    }
});

document.addEventListener('contextmenu', (event) => {
    if (isShiftPressed) {
        event.preventDefault();
    }
});

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