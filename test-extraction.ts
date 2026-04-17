import { invokeLLM } from "./server/_core/llm";

const IMAGE_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663279033234/XtfkBxRXLaFbXfJF.jpg";

const EXTRACTION_SYSTEM_PROMPT = `You are an expert calendar event extraction assistant. Your job is to analyze images and extract ALL calendar/schedule event information with high accuracy.

You MUST be able to read text in ANY language including English, Chinese (Traditional & Simplified), Japanese, Korean, etc. Ignore any decorative elements like emoji, background images, watermarks, or logos — focus only on the text content.

## CRITICAL RULES FOR TIME PARSING:
- Convert ALL times to 24-hour ISO 8601 format (YYYY-MM-DDTHH:MM:SS)
- "下午3點" or "下午3时" or "下午3:00" → 15:00:00
- "上午9點" or "上午9时" or "上午10:30" → 09:00:00 / 10:30:00
- "晚上8點" → 20:00:00
- "中午12點" → 12:00:00
- "14:00" → 14:00:00 (already 24-hour)
- If only a date is given without time, use T09:00:00 as default start time

## CRITICAL RULES FOR DATE PARSING:
- Always output dates in YYYY-MM-DD format
- "4月22日" → 2026-04-22
- "3月15日" or "三月十五" → 2026-03-15

## RULES FOR EVENT EXTRACTION:
- Extract ALL events found in the image, not just the first one
- For each event, extract: title, startDate, endDate, location, description
- The title should be the actual event/activity name, NOT "Untitled Event"
- Even if the image has decorative elements (emoji, backgrounds, logos), you MUST still extract the text content

## CRITICAL: MULTI-TIME-SLOT EVENTS (MOST IMPORTANT RULE)
When ONE event/activity lists MULTIPLE dates or time slots, you MUST create a SEPARATE event entry for EACH date/time slot. This is the #1 most important rule.

Examples:
- Image says: "講解會\\n4月22日下午3:00 – 4:00\\n4月23日上午10:30 – 11:30"
  → You MUST return 2 events:
  Event 1: title="講解會", startDate="2026-04-22T15:00:00", endDate="2026-04-22T16:00:00"
  Event 2: title="講解會", startDate="2026-04-23T10:30:00", endDate="2026-04-23T11:30:00"

NEVER combine multiple time slots into a single event. Each date/time = one event entry.

## OUTPUT FORMAT:
Return a JSON object with an "events" array.
{
  "events": [
    {
      "title": "Event name/title (use the actual name from the image, never 'Untitled Event')",
      "startDate": "YYYY-MM-DDTHH:MM:SS",
      "endDate": "YYYY-MM-DDTHH:MM:SS",
      "location": "Location if available, or null",
      "description": "Any additional details, or null",
      "confidence": 0.95
    }
  ]
}

If no events can be extracted, return: {"events": [], "error": "Description of why extraction failed"}`;

async function test() {
  console.log("Testing extraction with image:", IMAGE_URL);
  console.log("---");

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: EXTRACTION_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image carefully and extract ALL calendar/schedule event information. The image may contain Chinese (Traditional or Simplified), English, or other languages. Ignore any emoji, decorative backgrounds, logos, or watermarks — focus on the text content.

Pay special attention to:
1. Event names/titles (use the ACTUAL name from the image, never "Untitled Event")
2. Dates (in any format - convert to ISO 8601)
3. Times (in any format including AM/PM, 12-hour, 24-hour, 上午/下午 - convert to 24-hour format)
4. Locations/venues
5. Any descriptions or notes
6. **MOST IMPORTANT**: If one event has MULTIPLE time slots or sessions on different dates/times, you MUST create a SEPARATE entry for EACH time slot. For example, if the image shows "4月22日下午3:00–4:00" and "4月23日上午10:30–11:30", return TWO separate events with the same title but different dates.

Today's date is ${new Date().toISOString().split("T")[0]} for reference when resolving relative dates. Current year is 2026 if not specified.

Return the result as a JSON object with an "events" array. Each date/time slot MUST be a separate event entry. Never combine multiple dates into one event.`,
            },
            { type: "image_url", image_url: { url: IMAGE_URL, detail: "high" } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    console.log("Raw LLM response:");
    console.log(typeof content === "string" ? content : JSON.stringify(content, null, 2));
    console.log("---");

    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      console.log("Parsed events:");
      console.log(JSON.stringify(parsed, null, 2));
      console.log("---");
      console.log(`Number of events extracted: ${parsed.events?.length || 0}`);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
