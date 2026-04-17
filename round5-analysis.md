# Round 5 Analysis

## Issue 1: Multi-time-slot image returns "Untitled Event"
- The AI prompt is correct, but the image (澳門講解會 with 4/22 and 4/23 times) was not properly extracted
- The result shows "Untitled Event" with Medium 80% confidence and no date/time
- This means the LLM failed to parse the image content
- Root cause: The image has complex Chinese text with emoji decorations, the LLM may struggle
- Fix: Improve the prompt to be more aggressive about extracting Chinese content

## Issue 2: .ics download doesn't actually add to calendar on iOS Safari
- iOS Safari downloads the .ics file, then shows a preview with a checkmark (dismiss) and "加至日曆" button
- Users consistently press the checkmark instead of "加至日曆"
- The .ics guide modal doesn't help because users don't read it
- **NEW STRATEGY**: Replace .ics download with Google Calendar URL scheme
  - Google Calendar: `https://calendar.google.com/calendar/r/eventedit?text=TITLE&dates=START/END&location=LOC&details=DESC`
  - This opens Google Calendar directly and creates the event - no .ics confusion
  - Also offer Apple Calendar URL as alternative
  - The user clicks "Add to Google Calendar" or "Add to Apple Calendar"
  - Google Calendar URL works perfectly in any browser
  - For Apple Calendar on iOS, we can use `webcal://` scheme or just the .ics approach but with better UX

## Issue 3: ".ics Downloaded" button is confusing
- After saving in editor, shows green ".ics Downloaded" button
- User doesn't know what to do next
- Fix: Replace with clear "Open in Google Calendar" / "Open in Apple Calendar" buttons

## New Strategy for Web Calendar Add:
1. Show two buttons: "Open in Google Calendar" and "Open in Apple Calendar"  
2. Google Calendar: Opens URL directly, event is created in browser
3. Apple Calendar: Use webcal:// protocol which auto-opens Apple Calendar app
4. Remove .ics download approach entirely
5. Remove the confusing .ics guide modal
