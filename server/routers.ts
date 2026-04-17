import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";

const EXTRACTION_SYSTEM_PROMPT = `You are an expert calendar event extraction assistant. Analyze images and extract ALL calendar/schedule events with high accuracy.

Read text in ANY language (English, Traditional Chinese, Simplified Chinese, Japanese, Korean, etc.). Ignore decorative elements (emoji, backgrounds, watermarks, logos) — focus only on text.

## TIME PARSING (output 24-hour ISO 8601: YYYY-MM-DDTHH:MM:SS)
- "8PM"/"8 PM" → 20:00:00 | "8AM" → 08:00:00 | "12PM"/"noon" → 12:00:00 | "12AM" → 00:00:00
- "3:30 PM" → 15:30:00 | "9:15 AM" → 09:15:00
- "下午3點"/"下午3:00" → 15:00:00 | "上午9點"/"上午10:30" → 09:00:00/10:30:00
- "晚上8點" → 20:00:00 | "中午12點" → 12:00:00 | "14:00" → 14:00:00
- "3點" without AM/PM context: infer from event type (work=15:00, social evening=15:00 or 03:00 based on context)
- Time ranges like "3:00 – 4:00" or "3:00-4:00" or "3:00至4:00": start=15:00, end=16:00 (infer AM/PM from context)
- No time given → use T09:00:00 default

## DATE PARSING (output YYYY-MM-DD, default year: 2026)
- "March 15"/"3/15"/"3月15日"/"三月十五" → 2026-03-15
- "2026/3/15"/"2026.3.15" → 2026-03-15
- "next Monday"/"tomorrow" → calculate actual date from today
- Handle MM/DD (Western) and YYYY/MM/DD (Asian) intelligently
- If a date is in the past for current year, still use 2026 unless year is explicitly stated

## EVENT EXTRACTION RULES
- Extract ALL events, not just the first one
- Fields: title, startDate, endDate, location, description, confidence
- Title MUST be the actual event name from the image. NEVER use "Untitled Event" or generic names
- For Chinese text: use the original Chinese title (e.g. "普通話面授課程", "講解會", "投資峰會")
- endDate: if not specified, estimate (+1h for meetings, +2h for lectures/courses, end of day for all-day)
- location: extract full address including floor/room if visible (e.g. "九龍啟德 AIRSIDE 35樓")
- description: include speaker names, organizer, registration info, or other details
- confidence: 0.0-1.0 based on clarity

## MULTI-TIME-SLOT (CRITICAL - #1 RULE)
If ONE event lists MULTIPLE dates/times, create a SEPARATE entry for EACH.
Example: "講解會 4月22日下午3:00–4:00 / 4月23日上午10:30–11:30" → 2 events with same title, different dates.
NEVER combine multiple time slots into one event.

## OUTPUT FORMAT
{"events": [{"title": "...", "startDate": "YYYY-MM-DDTHH:MM:SS", "endDate": "YYYY-MM-DDTHH:MM:SS", "location": "...", "description": "...", "confidence": 0.95}]}
If no events found: {"events": [], "error": "reason"}`;

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
                    text: `Extract ALL calendar events from this image. Today is ${new Date().toISOString().split("T")[0]}. Year is 2026 if unspecified. Each time slot = separate event entry. Use original language for titles. Return JSON with "events" array.`,
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
