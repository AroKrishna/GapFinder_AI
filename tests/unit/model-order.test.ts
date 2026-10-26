import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { modelOrder } = await import("@/lib/ai/gemini");

describe("modelOrder", () => {
  it("puts the primary first and de-duplicates fallbacks", () => {
    expect(modelOrder("a", ["b", "a", "c"], 0, new Map())).toEqual(["a", "b", "c"]);
  });
  it("moves models in cooldown to the back", () => {
    const cooling = new Map([["a", 1000]]);
    expect(modelOrder("a", ["b"], 500, cooling)).toEqual(["b", "a"]);
    expect(modelOrder("a", ["b"], 1500, cooling)).toEqual(["a", "b"]);
  });
});
