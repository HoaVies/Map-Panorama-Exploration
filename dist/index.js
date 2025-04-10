import { Map } from './Map';
import { GoogleMapsProvider } from './GoogleMapsProvider';
// Initialize the map with default options
const mapOptions = {
    center: { lat: 37.5665, lng: 126.9780 }, // Seoul
    zoom: 12,
    mapTypeId: 'roadmap'
};
const streetViewOptions = {
    position: { lat: 37.5665, lng: 126.9780 },
    pov: {
        heading: 0,
        pitch: 0
    }
};
// Create the Google Maps provider
const mapProvider = new GoogleMapsProvider();
// Create a new map instance with the provider
const map = new Map(mapProvider, 'map-container', 'street-view-container', mapOptions, streetViewOptions);
// Initialize the map
map.initialize();
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
