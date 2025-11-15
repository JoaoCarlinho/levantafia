# Levantafia Mobile

React Native mobile application for the Levantafia photo upload system.

## Overview

This is the mobile frontend for Levantafia, providing feature parity with the web frontend for photo upload, management, and viewing capabilities with offline-first architecture.

## Tech Stack

- **React Native** with Expo SDK 54.0.0
- **TypeScript** for type safety
- **React Navigation** for routing
- **Axios** for API calls
- **AsyncStorage** for offline queue management
- **Expo Image Picker** for camera and photo library access

## Project Structure

```
mobile/
├── src/
│   ├── components/       # Reusable UI components
│   ├── screens/          # Screen components
│   │   └── HomeScreen.tsx
│   ├── navigation/       # React Navigation setup
│   │   └── AppNavigator.tsx
│   ├── services/         # API client, storage
│   │   ├── api.ts       # Backend API client
│   │   └── storage.ts   # AsyncStorage utilities
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript definitions
│   │   └── index.ts     # Core type definitions
│   ├── utils/            # Helper functions
│   └── constants/        # App constants
│       └── api.ts       # API configuration
├── assets/               # Images, fonts
├── App.tsx               # Root component
├── app.json              # Expo configuration
├── tsconfig.json         # TypeScript config
└── package.json          # Dependencies
```

## Prerequisites

- Node.js 18+ and npm
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac only) or Android Emulator
- Expo Go app (for testing on physical devices)

## Getting Started

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Configure API Endpoint

Update the backend URL in [src/constants/api.ts](src/constants/api.ts):

```typescript
// For iOS Simulator
const API_BASE_URL = 'http://localhost:8080';

// For Android Emulator
const API_BASE_URL = 'http://10.0.2.2:8080';

// For physical device (use your computer's local IP)
const API_BASE_URL = 'http://192.168.1.XXX:8080';
```

### 3. Start Development Server

```bash
npx expo start
```

This will:
- Start Metro Bundler on `http://localhost:8081`
- Show QR code to scan with Expo Go app
- Provide options to run on iOS/Android simulator

### 4. Run on Devices

**iOS Simulator (Mac only):**
```bash
npx expo start --ios
```

**Android Emulator:**
```bash
npx expo start --android
```

**Physical Device:**
1. Install Expo Go app from App Store or Google Play
2. Scan the QR code from terminal
3. Ensure your phone and computer are on the same network

## API Integration

The mobile app connects to the backend API with the following endpoints:

- **GET** `/api/v1/photos` - Fetch all photos
- **DELETE** `/api/v1/photos` - Delete selected photos
- **POST** `/api/v1/upload` - Upload photos to S3

API client is configured in [src/services/api.ts](src/services/api.ts).

## Core Services

### API Client (`src/services/api.ts`)
- Axios-based HTTP client
- Request/response interceptors
- Upload progress tracking
- Error handling

### Storage Services (`src/services/storage.ts`)
- **UploadQueueStorage** - Manages offline upload queue
- **PhotosCacheStorage** - Caches photos for offline viewing
- **StorageUtils** - General storage utilities

## Type Definitions

Core types are defined in [src/types/index.ts](src/types/index.ts):

```typescript
interface Photo {
  id: string;
  filename: string;
  url: string;
  sizeBytes: number;
  width: number;
  height: number;
  createdAt: string;
  uploadComplete?: boolean;
}

interface UploadQueueItem {
  queueId: string;
  localUri: string;
  filename: string;
  status: UploadStatus;
  progress: number;
  // ... more fields
}
```

## Development Roadmap

### Sprint 0: Foundation (COMPLETED)
- [x] Initialize Expo project
- [x] Set up project structure
- [x] Install core dependencies
- [x] Create TypeScript types
- [x] Create API client
- [x] Create storage utilities
- [x] Set up React Navigation

### Sprint 1: Photo Gallery (NEXT)
- [ ] Implement PhotoGallery screen
- [ ] Fetch and display photos from backend
- [ ] Add pull-to-refresh
- [ ] Add loading states
- [ ] Cache photos locally

### Sprint 2: Photo Upload
- [ ] Implement camera integration
- [ ] Implement photo library picker
- [ ] Add batch upload UI
- [ ] Implement upload progress tracking
- [ ] Add upload queue management

### Sprint 3: Photo Management
- [ ] Add photo selection
- [ ] Implement delete functionality
- [ ] Add confirmation dialogs
- [ ] Implement optimistic UI updates

### Sprint 4: Offline Support
- [ ] Implement offline queue
- [ ] Add network state detection
- [ ] Queue uploads when offline
- [ ] Process queue when online

### Sprint 5: Performance & Polish
- [ ] Image optimization
- [ ] Background upload
- [ ] Error handling improvements
- [ ] UI/UX refinements

### Sprint 6: Testing & Beta
- [ ] Integration tests
- [ ] E2E tests
- [ ] Beta testing
- [ ] Bug fixes

## Testing

```bash
# Run type checking
npx tsc --noEmit

# Run linting
npm run lint
```

## Building for Production

### iOS (requires Mac + Apple Developer account)

```bash
# Build development client
npx expo build:ios

# Build for App Store
eas build --platform ios
```

### Android

```bash
# Build APK
npx expo build:android -t apk

# Build AAB for Google Play
eas build --platform android
```

## Environment Variables

Create a `.env` file in the mobile directory:

```env
API_BASE_URL=http://localhost:8080
CLOUDFRONT_DOMAIN=your-cloudfront-domain.com
```

## Troubleshooting

### Metro Bundler Issues
```bash
# Clear cache and restart
npx expo start -c
```

### iOS Simulator not connecting to localhost
- Use your computer's local IP instead of `localhost`
- Ensure backend is accessible on the network

### Android Emulator connection issues
- Use `10.0.2.2` instead of `localhost`
- Check that backend port 8080 is open

## Documentation

- [Architecture Overview](../docs/architecture/architecture_overview.md)
- [Mobile Requirements](../docs/mobile/MOBILE_REQUIREMENTS.md)
- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)

## Contributing

1. Create a feature branch from `main`
2. Implement your feature following the project structure
3. Test on both iOS and Android
4. Submit a pull request

## License

Proprietary - Levantafia Project
