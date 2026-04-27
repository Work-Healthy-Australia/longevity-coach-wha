import { describe, expect, it } from "vitest";
import { splitFullName } from "@/lib/profiles/name";

describe("splitFullName", () => {
  it("returns nulls for null/undefined/empty", () => {
    expect(splitFullName(null)).toEqual({ firstName: null, lastName: null });
    expect(splitFullName(undefined)).toEqual({ firstName: null, lastName: null });
    expect(splitFullName("")).toEqual({ firstName: null, lastName: null });
    expect(splitFullName("   ")).toEqual({ firstName: null, lastName: null });
  });

  it("returns single token as firstName, no lastName", () => {
    expect(splitFullName("James")).toEqual({ firstName: "James", lastName: null });
  });

  it("splits two tokens into first/last", () => {
    expect(splitFullName("James Smith")).toEqual({
      firstName: "James",
      lastName: "Smith",
    });
  });

  it("treats every token after the first as lastName (compound surnames)", () => {
    expect(splitFullName("Mary Jo van der Berg")).toEqual({
      firstName: "Mary",
      lastName: "Jo van der Berg",
    });
  });

  it("collapses multiple spaces", () => {
    expect(splitFullName("  James   Smith  ")).toEqual({
      firstName: "James",
      lastName: "Smith",
    });
  });
});
