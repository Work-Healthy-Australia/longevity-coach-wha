import { describe, expect, it } from "vitest";
import { getAnthropicModel } from "@/lib/ai/providers";

describe("getAnthropicModel", () => {
  it("throws when provider is not anthropic", () => {
    expect(() =>
      getAnthropicModel({ model: "gpt-4o", provider: "openrouter" }),
    ).toThrow(/provider='anthropic'/);
  });

  it("returns a model object when provider is anthropic", () => {
    const model = getAnthropicModel({
      model: "claude-sonnet-4-6",
      provider: "anthropic",
    });
    expect(model).toBeDefined();
  });
});
