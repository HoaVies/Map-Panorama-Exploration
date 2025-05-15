import { Map } from './Map.js';
import { GoogleMapsProvider } from './GoogleMapsProvider.js';
import { KakaoMapsProvider } from './KakaoMapsProvider.js';
import { YandexMapsProvider } from './YandexMapsProvider.js';
import { MapyCzProvider } from './MapyCzProvider.js';
import { LatLng, MapOptions, StreetViewOptions, IMapProvider } from './IMapProvider.js';
import { CoordinateTranslator } from './CoordinateTranslator.js';
import { StreetViewFinder } from './StreetViewFinder.js';

// Common map options (these are the default values, will be updated when switching providers)
const mapOptions: MapOptions = {
    center: { lat: 37.5665, lng: 126.9780 }, // Seoul
    zoom: 10,
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
let currentProviderType: 'google' | 'kakao' | 'yandex' | 'mapycz' = 'google';
let currentState = {
    position: { lat: 37.5665, lng: 126.9780 },
    heading: 0,
    pitch: 0,
    zoom: 10,
    mapTypeId: 'roadmap',
    isCoverageVisible: false
};

// Track provider switch in progress to prevent multiple simultaneous switches
let providerSwitchInProgress = false;

// Function to initialize a map provider with synchronized position
/**
 * This function updates the handling of the isCoverageVisible state when switching providers.
 * It's particularly focused on Kakao which has a different coverage behavior.
 */
async function initializeMap(providerType: 'google' | 'kakao' | 'yandex' | 'mapycz') {
    // Prevent multiple provider switches happening at the same time
    if (providerSwitchInProgress) {
        console.log('Provider switch already in progress, ignoring request');
        return;
    }
    
    providerSwitchInProgress = true;
    
    try {
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
            
            await cleanupCurrentProvider();
        }
        
        // Clear existing map containers with sufficient delay
        const mapContainer = document.getElementById('map-container');
        const streetViewContainer = document.getElementById('street-view-container');
        
        if (mapContainer) {
            mapContainer.innerHTML = '';
        }
        
        if (streetViewContainer) {
            streetViewContainer.innerHTML = '';
            // Reset the display property
            streetViewContainer.style.display = 'block';
        }
        
        // Add delay after clearing containers before initializing new provider
        await new Promise(resolve => setTimeout(resolve, 500));
        
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
                // Fall back to the translated position
            }
            
            // Create the selected map provider
            if (providerType === 'google') {
                // Use the fixed GoogleMapsProvider
                currentProvider = new GoogleMapsProvider();
                console.log('Initializing Google provider with fixed POV tracking');
            } else if (providerType === 'yandex'){
                currentProvider = new YandexMapsProvider();
            } else if (providerType === 'mapycz') {
                currentProvider = new MapyCzProvider();
                console.log('Initializing Mapy.cz provider');
            } else {
                // Use the fixed KakaoMapsProvider
                currentProvider = new KakaoMapsProvider();
                console.log('Initializing Kakao provider with fixed heading/pitch handling');
            }
            
            // Logging to track what's happening
            console.log(`Current state before provider initialization:`, JSON.stringify({
                position: currentState.position,
                heading: currentState.heading,
                pitch: currentState.pitch
            }));

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
            
            map.addStateChangeListener((state) => {
                console.log(`Map state changed:`, JSON.stringify({
                    position: state.position,
                    heading: state.heading,
                    pitch: state.pitch
                }));
            });
            
            // Handle coverage visibility differently based on provider
            if (currentState.isCoverageVisible) {
                if (providerType === 'kakao') {
                    // For Kakao, we need to manually toggle the coverage overlay
                    setTimeout(() => {
                        const roadviewControl = document.getElementById('roadviewControl');
                        if (roadviewControl) {
                            roadviewControl.click();
                        } else {
                            // Fallback to the provider's showCoverage method
                            map.showCoverage(translatedPosition);
                        }
                    }, 800);
                } else {
                    setTimeout(() => {
                        map.showCoverage(translatedPosition);
                    }, 800);
                }
            }
            
            // Explicitly force panorama visibility if it was previously visible
            if (wasPanoramaVisible) {
                if (providerType === 'mapycz') {
                    // Special handling for Mapy.cz
                    setTimeout(() => {
                        // First ensure the container is visible
                        const container = document.getElementById('street-view-container');
                        if (container) {
                            container.style.display = 'block';
                        }
                        
                        // Then set position with a slight delay
                        setTimeout(() => {
                            currentProvider.setStreetViewPosition(streetViewPosition);
                            // Apply POV after position is set
                            setTimeout(() => {
                                currentProvider.setStreetViewPOV(currentState.heading, currentState.pitch);
                            }, 800);
                        }, 500);
                    }, 800);
                } else if (providerType === 'kakao') {
                    // Special handling for Kakao
                    setTimeout(() => {
                        // First set POV so it's stored as pending values
                        currentProvider.setStreetViewPOV(currentState.heading, currentState.pitch);
                        
                        // Then set position which will trigger initialization and apply POV when ready
                        setTimeout(() => {
                            currentProvider.setStreetViewPosition(streetViewPosition);
                            currentProvider.setPegmanVisible(true);
                            
                            // Make sure container is visible
                            const container = document.getElementById('street-view-container');
                            if (container) {
                                container.style.display = 'block';
                            }
                        }, 500);
                    }, 800);
                } else {
                    // For other providers (Google, Yandex)
                    setTimeout(() => {
                        // First set the position
                        currentProvider.setStreetViewPosition(streetViewPosition);
                        currentProvider.setPegmanVisible(true);
                        
                        // Then set the orientation with a small delay
                        setTimeout(() => {
                            currentProvider.setStreetViewPOV(currentState.heading, currentState.pitch);
                            console.log(`Setting orientation: heading=${currentState.heading}, pitch=${currentState.pitch}`);
                            
                            // Make sure container is visible
                            const container = document.getElementById('street-view-container');
                            if (container) {
                                container.style.display = 'block';
                            }
                        }, 1000);
                    }, 800);
                }
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
            
            // Show error notification
            const statusElement = document.getElementById('sync-status');
            if (statusElement) {
                statusElement.textContent = `Error initializing ${providerType} Maps`;
                statusElement.style.display = 'block';
                statusElement.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
                setTimeout(() => {
                    statusElement.style.display = 'none';
                    statusElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                }, 3000);
            }
        }
    } finally {
        // Always reset the provider switch flag when done
        setTimeout(() => {
            providerSwitchInProgress = false;
        }, 1000);
    }
}

// Helper function to clean up the current provider before switching
async function cleanupCurrentProvider(): Promise<void> {
    if (!currentProvider) return;
    
    console.log(`Cleaning up ${currentProviderType} provider`);
    
    try {
        // Special handling for Kakao provider
        if (currentProviderType === 'kakao') {
            const roadviewControl = document.getElementById('roadviewControl');
            if (roadviewControl && roadviewControl.parentNode) {
                roadviewControl.parentNode.removeChild(roadviewControl);
            }
            
            const mapTypeControl = document.getElementById('mapTypeControl');
            if (mapTypeControl && mapTypeControl.parentNode) {
                mapTypeControl.parentNode.removeChild(mapTypeControl);
            }
            
            // Force cleanup of Kakao roadview
            const kakaoProvider = currentProvider as KakaoMapsProvider;
            try {
                kakaoProvider.setPegmanVisible(false);
            } catch (e) {
                console.warn('Error hiding Kakao roadview:', e);
            }
        }
        
        // Regular cleanup for MapyCz provider
        else if (currentProviderType === 'mapycz') {
            const mapyCzProvider = currentProvider as any;
            if (typeof mapyCzProvider.cleanup === 'function') {
                await mapyCzProvider.cleanup();
                console.log('Cleaned up Mapy.cz provider');
            } else if (typeof mapyCzProvider.destroyPanorama === 'function') {
                await mapyCzProvider.destroyPanorama();
                console.log('Destroyed Mapy.cz panorama');
            }
        }
        
        // For other providers, use the cleanup method if available
        try {
            if (typeof (currentProvider as any).cleanup === 'function') {
                await (currentProvider as any).cleanup();
                console.log(`Cleaned up ${currentProviderType} provider`);
            }
        } catch (e) {
            console.warn(`Error cleaning up ${currentProviderType} provider:`, e);
        }
        
        // DOM cleanup by recreating the containers
        const mapContainer = document.getElementById('map-container');
        const streetViewContainer = document.getElementById('street-view-container');
        
        if (mapContainer) {
            const newMapContainer = mapContainer.cloneNode(false);
            if (mapContainer.parentNode) {
                mapContainer.parentNode.replaceChild(newMapContainer, mapContainer);
            }
        }
        
        if (streetViewContainer) {
            const newStreetViewContainer = streetViewContainer.cloneNode(false);
            if (streetViewContainer.parentNode) {
                streetViewContainer.parentNode.replaceChild(newStreetViewContainer, streetViewContainer);
            }
        }
        
        // Delay to ensure cleanup is complete
        if (currentProviderType === 'kakao' && arguments[0] === 'mapycz') {
            await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        console.warn('Error during provider cleanup:', error);
    }
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, setting up provider selector');
    
    // Create a status element for sync notifications if it doesn't exist
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
            const selectedProvider = providerSelector.value as 'google' | 'kakao' | 'yandex' | 'mapycz';
            console.log(`Provider changed to: ${selectedProvider}`);
            initializeMap(selectedProvider);
        });
        
        // Initialize with Google Maps by default
        initializeMap('google');
    } else {
        console.error('Provider selector not found in the DOM');
    }
});