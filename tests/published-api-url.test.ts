import { describe, it, expect } from "vitest";

describe("EXPO_PUBLIC_PUBLISHED_API_URL", () => {
  it("should be set and reachable", async () => {
    const url = process.env.EXPO_PUBLIC_PUBLISHED_API_URL;
    expect(url).toBeDefined();
    expect(url).toMatch(/^https:\/\/.+\.manus\.space$/);

    // Test that the API server is reachable
    const response = await fetch(`${url}/api/trpc/events.extractFromImage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { imageUrl: "data:image/png;base64,iVBOR" } }),
    });
    // We expect a response (even if it's an error from LLM), not a network failure
    expect(response.status).toBeLessThan(500);
  });
});
