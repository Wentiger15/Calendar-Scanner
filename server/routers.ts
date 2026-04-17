import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";

const EXTRACTION_SYSTEM_PROMPT = `You are an expert calendar event extraction assistant. Your job is to analyze images and extract ALL calendar/schedule event information with high accuracy.

You MUST be able to read text in ANY language including English, Chinese (Traditional & Simplified), Japanese, Korean, etc. Ignore any decorative elements like emoji, background images, watermarks, or logos — focus only on the text content.

## CRITICAL RULES FOR TIME PARSING:
- Convert ALL times to 24-hour ISO 8601 format (YYYY-MM-DDTHH:MM:SS)
- "8PM" or "8 PM" or "8pm" → 20:00:00
- "8AM" or "8 AM" or "8am" → 08:00:00
- "12PM" or "noon" → 12:00:00
- "12AM" or "midnight" → 00:00:00
- "3:30 PM" → 15:30:00
- "9:15 AM" → 09:15:00
- "下午3點" or "下午3时" or "下午3:00" → 15:00:00
- "上午9點" or "上午9时" or "上午10:30" → 09:00:00 / 10:30:00
- "晚上8點" → 20:00:00
- "中午12點" → 12:00:00
- "14:00" → 14:00:00 (already 24-hour)
- If only a date is given without time, use T09:00:00 as default start time

## CRITICAL RULES FOR DATE PARSING:
- Always output dates in YYYY-MM-DD format
- "March 15" or "Mar 15" or "3/15" → determine year from context (use current year 2026 if not specified)
- "15th March" or "15 Mar" → same as above
- "3月15日" or "三月十五" → 2026-03-15
- "4月22日" → 2026-04-22
- "2026/3/15" or "2026.3.15" → 2026-03-15
- "next Monday" → calculate the actual date
- "tomorrow" → calculate the actual date
- Handle both Western (MM/DD) and Asian (YYYY/MM/DD) date formats intelligently based on context

## RULES FOR EVENT EXTRACTION:
- Extract ALL events found in the image, not just the first one
- For each event, extract: title, startDate, endDate, location, description
- If endDate is not specified, estimate based on event type (meetings: +1 hour, all-day: end of day, conferences: check context)
- If location is visible anywhere in the image, include it
- Include any additional notes or details in the description field
- Set confidence based on how clearly the information is presented (0.0 to 1.0)
- The title should be the actual event/activity name, NOT "Untitled Event"
- Even if the image has decorative elements (emoji, backgrounds, logos), you MUST still extract the text content

## CRITICAL: MULTI-TIME-SLOT EVENTS (MOST IMPORTANT RULE)
When ONE event/activity lists MULTIPLE dates or time slots, you MUST create a SEPARATE event entry for EACH date/time slot. This is the #1 most important rule.

Examples:
- Image says: "講解會\n4月22日下午3:00 – 4:00\n4月23日上午10:30 – 11:30"
  → You MUST return 2 events:
  Event 1: title="講解會", startDate="2026-04-22T15:00:00", endDate="2026-04-22T16:00:00"
  Event 2: title="講解會", startDate="2026-04-23T10:30:00", endDate="2026-04-23T11:30:00"

- Image says: "Training Day 1: Mar 15 9AM-5PM, Day 2: Mar 16 9AM-3PM"
  → 2 separate events with same title but different dates

- Image says: "每週二和四 下午2-3點"
  → Create entries for the next Tuesday and Thursday

NEVER combine multiple time slots into a single event. Each date/time = one event entry.

## OUTPUT FORMAT:
Return a JSON object with an "events" array. Each event object must have:
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

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  events: router({
    extractFromImage: publicProcedure
      .input(z.object({ imageUrl: z.string() }))
      .mutation(async ({ input }) => {
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
                  { type: "image_url", image_url: { url: input.imageUrl, detail: "high" } },
                ],
              },
            ],
            response_format: { type: "json_object" },
          });

          const content = response.choices[0].message.content;
          if (!content) throw new Error("No response from LLM");

          const contentStr = typeof content === "string" ? content : JSON.stringify(content);
          const parsed = JSON.parse(contentStr);

          // Handle both single event and multiple events response
          if (parsed.events && Array.isArray(parsed.events)) {
            // Multiple events extracted
            const events = parsed.events.map((evt: any) => ({
              title: evt.title || "Untitled Event",
              startDate: normalizeDateTime(evt.startDate),
              endDate: evt.endDate ? normalizeDateTime(evt.endDate) : undefined,
              location: evt.location || undefined,
              description: evt.description || undefined,
              confidence: typeof evt.confidence === "number" ? Math.min(1, Math.max(0, evt.confidence)) : 0.8,
            }));

            if (events.length === 0) {
              return {
                success: false,
                error: parsed.error || "No events found in the image",
              };
            }

            return {
              success: true,
              events,
              event: events[0], // backward compatibility
            };
          }

          // Fallback: single event format
          const event = {
            title: parsed.title || "Untitled Event",
            startDate: normalizeDateTime(parsed.startDate),
            endDate: parsed.endDate ? normalizeDateTime(parsed.endDate) : undefined,
            location: parsed.location || undefined,
            description: parsed.description || undefined,
            confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.8,
          };

          return {
            success: true,
            events: [event],
            event,
          };
        } catch (error) {
          console.error("Event extraction error:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to extract event",
          };
        }
      }),
  }),
});

/**
 * Normalize various date/time string formats to ISO 8601.
 * Handles edge cases from LLM output.
 */
function normalizeDateTime(dateStr: string | undefined): string {
  if (!dateStr) return new Date().toISOString();

  // Already valid ISO format
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateStr)) {
    return dateStr;
  }

  // Date only: YYYY-MM-DD → add default time
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `${dateStr}T09:00:00`;
  }

  // Try parsing with Date constructor
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().replace("Z", "").split(".")[0];
    }
  } catch {
    // Fall through
  }

  return dateStr;
}

export type AppRouter = typeof appRouter;
