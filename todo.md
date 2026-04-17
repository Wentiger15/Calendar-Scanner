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
- [x] Fix Vercel deployment: No Output Directory named 'public' - added vercel.json with Expo web export config
- [x] Fix Vercel deployment failure: build command failing on Vercel (GitHub check ✗ 0/2) - pre-generate NativeWind CSS cache before expo export to fix SHA-1 error
- [x] Fix web compatibility: expo-file-system.readAsStringAsync not available on web - replaced with fetch/blob/FileReader approach
- [x] Ensure image picker and event extraction flow works on Vercel-deployed web version
- [x] Fix web error: "The string did not match the expected pattern" - Vercel static site had no backend; configured getApiBaseUrl() to use Manus published API server
- [x] Fix: iPhone photo library image extraction still fails on Vercel web - env var not inlined at build time; moved to module-level env object + injected in vercel.json buildCommand
- [x] Fix: "Add to Calendar" button does nothing on Web - implemented .ics file download for web platform, keeps expo-calendar for native
- [x] Generate custom app icon for Calendar Scanner and update all icon locations
- [x] Ensure web favicon and PWA icon display correctly when added to iPhone home screen - added +html.tsx with apple-touch-icon, apple-mobile-web-app meta tags
- [x] Optimize: Add to Calendar button flow and display UX improvements (loading state, success feedback, better layout)
- [x] Fix: Add to Calendar button not responding on Web version - replaced link.click() with data URI + window.open() for iOS Safari compatibility
- [x] Feature: Support multi-time-slot events - group same-title events, per-slot Add buttons, Add All button, multi-event .ics generation

## Optimization - Round 4

- [x] Fix: iOS .ics preview UX confusion - added modal instruction guide after .ics download explaining to tap "加至日曆" not the checkmark
- [x] Fix: Native calendar silently failing - replaced createEventAsync with createEventInCalendarAsync which opens system calendar UI for user confirmation
- [x] Fix: Multi-time-slot events not extracted separately - added CRITICAL MULTI-TIME-SLOT section to AI prompt with Chinese date examples and explicit instructions
