# Calendar Scanner App - Design Document

## Overview

A mobile application that allows users to scan images containing calendar/schedule information, automatically extract event details (name, date, time), and add them to Apple Calendar after user confirmation.

## Screen List

1. **Home Screen** - Main entry point with scan button
2. **Camera/Image Picker Screen** - Capture or select image with schedule
3. **Event Preview Screen** - Display extracted event details for confirmation
4. **Event Details Editor Screen** - Allow user to edit extracted information before adding
5. **Success Screen** - Confirmation that event was added to calendar
6. **Settings Screen** - App preferences and permissions

## Primary Content and Functionality

### Home Screen
- **Content**: Welcome message, quick action button, recent events list
- **Functionality**: 
  - Primary CTA: "Scan Schedule" button (large, prominent)
  - Display last 3-5 recently added events
  - Quick access to settings

### Camera/Image Picker Screen
- **Content**: Camera viewfinder or image picker interface
- **Functionality**:
  - Capture photo from camera
  - Pick image from photo library
  - Crop/adjust image before processing
  - Loading indicator during OCR processing

### Event Preview Screen
- **Content**: Extracted event information in card format
  - Event name/title
  - Date (formatted clearly)
  - Start time
  - End time (if available)
  - Location (if available)
  - Description/notes (if available)
- **Functionality**:
  - Display confidence level of extracted data
  - "Confirm & Add" button (primary action)
  - "Edit Details" button (secondary action)
  - "Cancel" button to discard

### Event Details Editor Screen
- **Content**: Editable form fields
  - Event title (text input)
  - Date picker
  - Start time picker
  - End time picker
  - Location (optional text input)
  - Description/notes (optional text area)
- **Functionality**:
  - Edit any extracted field
  - Save changes
  - Cancel and return to preview

### Success Screen
- **Content**: Confirmation message with event details
  - "✓ Event Added Successfully"
  - Event summary
  - "View in Calendar" button
  - "Scan Another" button
- **Functionality**:
  - Navigate to Apple Calendar app
  - Return to home to scan another image

### Settings Screen
- **Content**: App configuration options
  - Calendar selection (which Apple Calendar to add to)
  - Notification preferences
  - App permissions status
  - About/version info
- **Functionality**:
  - Toggle notifications
  - Select target calendar
  - Manage permissions

## Key User Flows

### Flow 1: Scan and Add Event
1. User taps "Scan Schedule" on Home Screen
2. App opens Camera/Image Picker Screen
3. User captures photo or selects image from library
4. App processes image with OCR and AI to extract event details
5. Event Preview Screen displays extracted information
6. User reviews and taps "Confirm & Add"
7. App adds event to Apple Calendar
8. Success Screen confirms completion
9. User can "Scan Another" or return to Home

### Flow 2: Edit Event Before Adding
1. User follows Flow 1 up to Event Preview Screen
2. User taps "Edit Details"
3. Event Details Editor Screen opens with form
4. User modifies any fields (title, date, time, location, etc.)
5. User taps "Save & Add"
6. App adds modified event to Apple Calendar
7. Success Screen confirms completion

### Flow 3: Manage Permissions and Settings
1. User taps Settings icon
2. Settings Screen displays current configuration
3. User can:
   - Select which Apple Calendar to add events to
   - Toggle notifications on/off
   - Check and request calendar permissions
4. Changes are saved automatically

## Color Choices

- **Primary Color**: #0a7ea4 (Blue) - Used for primary buttons, highlights, and key actions
- **Background**: #ffffff (Light) / #151718 (Dark) - Main screen background
- **Surface**: #f5f5f5 (Light) / #1e2022 (Dark) - Card and elevated surfaces
- **Foreground**: #11181C (Light) / #ECEDEE (Dark) - Primary text
- **Muted**: #687076 (Light) / #9BA1A6 (Dark) - Secondary text
- **Border**: #E5E7EB (Light) / #334155 (Dark) - Dividers and borders
- **Success**: #22C55E (Green) - Success states and confirmations
- **Warning**: #F59E0B (Amber) - Warnings and cautions
- **Error**: #EF4444 (Red) - Error states

## Technical Considerations

- **Image Processing**: Use Expo Camera + Image Picker for capture/selection
- **OCR**: Integrate with server-side AI/LLM for text extraction and event parsing
- **Calendar Integration**: Use expo-calendar for iOS Calendar access
- **State Management**: React Context for app state, AsyncStorage for local preferences
- **Permissions**: Request Camera and Calendar permissions on first use
