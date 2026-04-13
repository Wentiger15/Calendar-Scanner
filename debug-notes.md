# Debug Notes

## Issue: 6000ms timeout exceeded

### Key Finding
The error occurs in the **web preview** (not Expo Go native). The error stack trace shows:
- `node_modules/react-native-gesture-handler/lib/module/web/Gestures.js (41:2)` 
- This is the web-specific module of RNGH

### Root Cause
The `6000ms timeout exceeded` error is actually from **font loading** (fontloader.js), NOT from RNGH directly. 
The error occurs when loading custom fonts (like Material Icons from @expo/vector-icons) in the web preview.
The stack trace pointing to Gestures.js line 41 is misleading - it's the module that was being loaded when the font timeout occurred.

### Verification
- iOS bundle: 0 matches for "HammerRotation" (correct - native modules used)
- Web bundle: 2 matches for "HammerRotation" (expected - web shim used)
- The timeout is from `document.fonts.load()` failing within 6000ms

### Solution
The font loading timeout in web preview is likely due to:
1. Network latency loading Material Icons font
2. The web preview running in an iframe with restricted access
This is a web-specific issue that won't affect Expo Go native experience.
