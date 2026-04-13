# Calendar Scanner App - TODO

## Core Features

- [x] Create Home Screen with scan button and recent events list
- [x] Implement Camera/Image Picker functionality
- [x] Integrate OCR and AI event extraction from images
- [x] Create Event Preview Screen for confirmation
- [x] Create Event Details Editor Screen
- [x] Implement Apple Calendar integration (expo-calendar)
- [x] Create Success Screen after event addition
- [ ] Create Settings Screen with calendar selection and permissions

## UI/UX Polish

- [x] Design and implement app logo/icon
- [x] Add loading indicators and progress feedback
- [x] Implement error handling and user-friendly error messages
- [x] Add tips section on home screen
- [x] Add back navigation buttons on all screens
- [x] Add reminder info on confirmation screen
- [ ] Add haptic feedback for button interactions
- [ ] Implement smooth transitions between screens
- [ ] Test dark mode appearance

## Permissions & Integration

- [x] Request and handle Camera permissions
- [x] Request and handle Calendar permissions
- [ ] Test iOS Calendar event creation
- [ ] Handle permission denial gracefully

## Testing & Quality

- [x] Write comprehensive unit tests (35 tests passing)
- [ ] Test image scanning with various schedule formats
- [ ] Test event extraction accuracy
- [ ] Test calendar integration on iOS device
- [ ] Verify all user flows work end-to-end
- [ ] Test dark/light mode switching

## Deployment

- [ ] Create checkpoint before publishing
- [ ] Generate APK/IPA for testing
- [ ] Verify app works on iOS and Android

## Optimization - Round 2

- [x] Optimize AI prompt for better time format recognition (8PM → 20:00, etc.)
- [x] Support Chinese time formats (下午3點, 上午9時, 晚上8點, etc.)
- [x] Support multiple date formats (MM/DD, YYYY/MM/DD, 3月15日, etc.)
- [x] Improve AI prompt to handle various date formats (March 15, 3/15, 15th Mar, etc.)
- [x] Add native date picker in event editor
- [x] Add native time picker in event editor
- [x] Add toggle for end date/time (optional)
- [x] Add location field with icon
- [x] Add notes/description field
- [x] Add form validation (title required, end after start)
- [x] Improve event preview → edit → confirm flow
- [x] Support multiple events extraction from single image
- [x] Add confidence scoring display for extracted events
- [x] Add Edit and Confirm buttons for each extracted event
- [x] Improve loading state with better animation
- [x] Improve error state with retry option
- [x] Improve recent events list with better formatting
- [x] Add better validation and error messages for extracted data
- [ ] Polish UI transitions between screens

## Bug Fixes

- [x] Fix Uncaught Error: 6000ms timeout exceeded in react-native-gesture-handler deepEqual (Expo Go)
- [x] Fix expo-file-system readAsStringAsync deprecated error - migrate to expo-file-system/legacy
- [x] Fix react-native-gesture-handler 6000ms timeout on Expo Go (Gestures.js HammerHandlers) - root cause: expo-font timeout in web/iframe, fixed with Font.loadAsync preload
