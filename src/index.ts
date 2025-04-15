import { Map } from './Map.js';
import { GoogleMapsProvider } from './GoogleMapsProvider.js';
import { KakaoMapsProvider } from './KakaoMapsProvider.js';
import { LatLng, MapOptions, StreetViewOptions, IMapProvider } from './IMapProvider.js';

// Common map options
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

// Function to initialize a map provider
function initializeMap(providerType: 'google' | 'kakao') {
    console.log(`Initializing ${providerType} Maps provider`);
    
    // Clear existing map containers
    const mapContainer = document.getElementById('map-container');
    const streetViewContainer = document.getElementById('street-view-container');
    
    if (mapContainer) {
        mapContainer.innerHTML = '';
    }
    
    if (streetViewContainer) {
        streetViewContainer.innerHTML = '';
    }
    
    try {
        // Create the selected map provider
        if (providerType === 'google') {
            currentProvider = new GoogleMapsProvider();
        } else {
            currentProvider = new KakaoMapsProvider();
        }

        // Create a new map instance with the provider
        map = new Map(
            currentProvider,
            'map-container',
            'street-view-container',
            mapOptions,
            streetViewOptions
        );

        // Initialize the map
        map.initialize();
        console.log(`${providerType} Maps provider initialized successfully`);
    } catch (error) {
        console.error(`Error initializing ${providerType} Maps provider:`, error);
    }
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, setting up provider selector');
    
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
        // Handle quick drop functionality
    }
});