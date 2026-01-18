import { describe, it, expect } from "vitest";
import { POST } from "../route";

describe("Compatibility Gate – smoke test", () => {
    it("attaches response.meta.compatibility on analyze response", async () => {
        const req = new Request("http://localhost/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: "I feel a bit overwhelmed today",
                analysisMode: "api",
                emotionInsightsEnabled: true,
            }),
        });

        const res = await POST(req as any);
        expect(res.status).toBe(200);

        const data = await (res as any).json();

        // 🔒 Only contract we assert
        expect(data?.response?.meta?.compatibility ?? data?.meta?.compatibility).toBeDefined();
    });
});
