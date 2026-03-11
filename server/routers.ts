import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
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
      .input(z.object({ imageUrl: z.string().url() }))
      .mutation(async ({ input }) => {
        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "Extract calendar event details from the image. Return JSON with: title, startDate, endDate, location, description, confidence (0-1).",
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "Extract all calendar event information from this image." },
                  { type: "image_url", image_url: { url: input.imageUrl, detail: "high" } },
                ],
              },
            ],
            response_format: { type: "json_object" },
          });

          const content = response.choices[0].message.content;
          if (!content) throw new Error("No response from LLM");

          const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
          const parsed = JSON.parse(contentStr);
          return {
            success: true,
            event: {
              title: parsed.title || "Untitled Event",
              startDate: parsed.startDate,
              endDate: parsed.endDate,
              location: parsed.location,
              description: parsed.description,
              confidence: parsed.confidence || 0.8,
            },
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

export type AppRouter = typeof appRouter;
