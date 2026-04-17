# Analysis Notes - Round 4 Fixes

## Issue 1: iOS .ics preview UX confusion
- The iOS .ics preview shows a checkmark (dismiss) at top-right and "加至日曆" at bottom
- Users tap checkmark thinking it's "confirm/add" but it actually dismisses the preview
- Solution: After .ics download, show a clear instruction modal/banner explaining:
  "The calendar preview has opened. Tap the '加至日曆' button at the BOTTOM to add the event."

## Issue 2: Native Calendar shows "Added" but event not created
- From the screenshot (IMG_4537), this is running in Expo Go on iOS
- The code calls Calendar.createEventAsync and catches errors, but the event isn't appearing
- Possible causes:
  1. getDefaultCalendarAsync might return a read-only calendar on iOS
  2. The event might be created in a different calendar than expected
  3. The date parsing might create invalid dates
- Key insight from docs: `createEventInCalendarAsync` launches system UI and doesn't need permissions
- Better approach: Use `createEventInCalendarAsync` which shows the native iOS event creation UI
  - This gives the user visual confirmation
  - No permission issues
  - User can choose which calendar to add to
  - Returns DialogEventResult with action and id

## Issue 3: Multi-time-slot events not extracted
- The image shows: 4月22日下午3:00-4:00 and 4月23日上午10:30-11:30
- AI prompt already says "Extract ALL events" but doesn't explicitly mention multi-time-slot
- Need to add explicit instruction about same-event-different-times pattern
