# Optimization Notes

## Screenshot Analysis

### IMG_4511.PNG - Source image being scanned
- Shows an email about a webinar event
- This is the source image, not a UI issue

### IMG_4517.PNG - Confirm Event screen (event-success.tsx)
- Shows the "Confirm Event" screen with event details
- The "Add to Calendar" green button is visible at the bottom but cut off
- Issue: When user taps "Add to Calendar" on iOS Safari web, nothing happens
- Root cause: `link.click()` in addToCalendarWeb() is blocked by iOS Safari
- The .ics file download approach is correct but the programmatic click doesn't work on mobile Safari

### IMG_4499.jpg - Multi-time-slot event
- Shows a Chinese announcement with TWO time slots for the same event:
  - 4/22 下午 3:00 - 4:00
  - 4/23 上午 10:30 - 11:30
- Same event title: 澳門私退金及央積金客戶提交文件的全新安排 講解會
- Need to group these visually and allow adding each separately

## Implementation Plan

### 1. Fix iOS Safari .ics download (CRITICAL)
- Replace `link.click()` with `window.open()` using data URI
- Or use `window.location.href` with data URI
- Best approach for iOS Safari: use `window.open()` with blob URL, or use data URI directly

### 2. Optimize Add to Calendar flow
- Merge event-preview "Confirm" directly into adding to calendar (skip event-success confirmation page)
- Add inline "Add to Calendar" button on each event card in event-preview
- Show success state inline on the card after adding
- This eliminates the extra navigation step

### 3. Multi-time-slot event handling
- Group events with same title visually
- Show a "group header" with the event title
- Show individual time slots as sub-items
- Each sub-item has its own "Add to Calendar" button
- Add "Add All" button for the group
