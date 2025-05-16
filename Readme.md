# Map Panorama Exploration Web Application

A vendor-neutral web application for exploring street panorama views across multiple map providers. The application displays a 2D map alongside a street view panorama, with synchronized navigation between the two views.

## 👥 Authors:

This project was developed as part of an 8-week internship period under the supervision of Professor **Frederic Claux**.

### Developer Contributions

**Contribution Rules:** Base map with marker: 0.5 points, Synchronization between pegman and panorama: 0.25 points, Coverage Map: 0.25 points

- **Hoang Viet**: 
  - Google implementation (reference provider, 0.5 points)
  - Kakao Maps full implementation (1 point)
  - Yandex Maps implementation (pegman synchronization and coverage map, 0.5 points)
  - MapyCZ implementation (base functionality without coverage map, 0.75 points)
  - Provider-neutral architecture design and Cross-provider position and POV synchronization system (1 point)
  - Total: 3.75 points

- **Tran Quang Ha**:
  - Yandex Maps implementation (base map with marker functionality, 0.5 points)
  - Mapillary: ?/1
  - Total: 0.5 points

## 🌟 Features

- **Multi-Provider Support**: Google Maps, Kakao Maps, Yandex Maps, and Mapy.cz
- **Synchronized Views**: Updates between 2D map and panorama view
- **Pegman Navigation**: Visual indicator of position and orientation on the 2D map
- **Coverage Map**: Display of areas where street view is available
- **Seamless Provider Switching**: Position and orientation preservation when changing providers
- **Responsive Layout**: Toggle between horizontal and vertical layouts

## 🗺️ Supported Map Providers

| Provider | Base Map | Panorama | Pegman Sync | Coverage Map |
|----------|:--------:|:--------:|:-----------:|:------------:|
| Google Maps | ✅ | ✅ | ✅ | ✅ |
| Kakao Maps | ✅ | ✅ | ✅ | ✅ |
| Yandex Maps | ✅ | ✅ | ✅ | ✅ |
| Mapy.cz | ✅ | ✅ | ✅ | ❌ |

## ⚙️ Installation and Setup

### Prerequisites

- Modern web browser with JavaScript enabled
- API keys for each map provider (see below)
- Node.js and npm (for development)

### API Keys

The application requires API keys for each map provider:

- Google Maps API key
- Kakao Maps API key
- Yandex Maps API key
- Mapy.cz API key

Add these keys to the respective script tags in `index.html`.

### Setting Up for Development

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/vendor_neutral_map_api_internship.git
   cd vendor_neutral_map_api_internship
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the TypeScript compiler in watch mode:
   ```bash
   npm start
   ```

4. In a separate terminal, start the local development server:
   ```bash
   npm run serve
   ```

5. Open your browser and navigate to `http://localhost:8080`

## 🚀 Usage

### Basic Navigation

- **Pan/Zoom Map**: Use the standard map controls or mouse/touch gestures
- **Navigate Panorama**: Click on arrows or drag to look around in panorama view
- **Move Pegman**: Drag the pegman to a new location to update the panorama view
- **Toggle Layout**: Use the layout toggle button to switch between horizontal and vertical layouts

### Switching Map Providers

Use the dropdown menu in the top navigation bar to switch between different map providers. The application will automatically:

1. Preserve your current position
2. Translate coordinates between providers if needed
3. Find the nearest available street view panorama
4. Maintain orientation (heading and pitch)

### Coverage Map

For supported providers (Google, Kakao, Yandex), you can view areas where street view is available:

- In Google Maps: Coverage is shown automatically when dragging pegman
- In Kakao Maps: Click the roadview control button to toggle coverage
- In Yandex Maps: Use the coverage toggle button to show available areas

## 🔧 Architecture

The application follows a provider-based architecture with a common interface, designed to achieve vendor neutrality and code maintainability:

```
IMapProvider (interface)
    |
    ├── GoogleMapsProvider
    ├── KakaoMapsProvider
    ├── YandexMapsProvider
    └── MapyCzProvider
```

### Interface Design Pattern

Each provider implements the common `IMapProvider` interface, which defines methods for:

- Initializing the map and street view
- Setting positions and orientations
- Managing pegman visibility and position
- Showing/hiding coverage maps
- Event handling for user interactions

This pattern allows the application to interact with different map providers through a standardized API, isolating provider-specific implementations and making it easier to add new providers in the future.

### Coordination Layer

The `Map` class acts as a facade, encapsulating the complexity of working with different map providers:

- It maintains the application state (position, orientation, zoom level)
- It handles event delegation between the UI and the active provider
- It coordinates state transitions when switching between providers
- It ensures UI components reflect the current state regardless of the provider

### Synchronization Mechanism

The application implements several synchronization mechanisms:

1. **Position Synchronization**: When the user navigates in either the 2D map or the panorama view, both components are updated to reflect the new position.

2. **Orientation Synchronization**: The pegman marker on the 2D map indicates the current view direction of the panorama.

3. **Provider Switching**: When switching between providers, the application:
   - Preserves the current position and orientation
   - Translates coordinates if needed (using `CoordinateTranslator`)
   - Finds the nearest available street view panorama (using `StreetViewFinder`)
   - Restores the UI state (coverage visibility, layout mode, etc.)

4. **Event Handling**: Each provider implements custom event listeners that are normalized through the interface to provide consistent behavior across all providers.

## 📱 Responsive Design

The application supports two layout modes:

- **Vertical**: Map on top, panorama on bottom (default)
- **Horizontal**: Map on left, panorama on right

Toggle between these layouts using the layout button in the top control bar.

## 🔍 Debugging

### Chrome Debug Profile

The application is configured with VSCode launch settings that create an isolated Chrome profile for debugging:

1. The `.vscode/launch.json` file includes settings for a dedicated Chrome debugging profile
2. This isolated profile prevents interference from Chrome extensions or cached data
3. Debug mode enables breakpoints, variable inspection, and step-through debugging
4. Source maps are properly configured to map compiled JavaScript back to TypeScript

To start debugging:
1. Open the project in VSCode
2. Press F5 or select "Launch Chrome against localhost" from the Run menu
3. Chrome will launch with the custom debug profile and open the application
4. Use the VSCode debugger controls to set breakpoints and inspect execution


### Synchronization Methodology

The project implements a sophisticated cross-provider synchronization system:

1. **State Preservation**: Uses a central state management approach to maintain position, heading, pitch, zoom, and map type settings.

2. **Position Translation**: The `CoordinateTranslator` class handles coordinate system differences between providers.

3. **Panorama Location Finding**: The `StreetViewFinder` class locates the nearest valid street view position when switching providers or navigating.

4. **Event Normalization**: Provider-specific events are normalized through the common interface, ensuring consistent behavior.

5. **POV Synchronization**: Special handling for panorama point-of-view (POV) ensures the heading and pitch are properly maintained across provider switches.

## 🙏 Acknowledgements

- Google Maps API
- Kakao Maps API
- Yandex Maps API
- Mapy.cz API
- https://github.com/sk-zk/streetlevel