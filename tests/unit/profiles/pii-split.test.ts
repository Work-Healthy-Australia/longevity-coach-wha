import { describe, expect, it } from "vitest";
import { splitPii } from "@/lib/profiles/pii-split";

describe("splitPii", () => {
  it("routes DOB / phone / address to the profile patch and strips them from responses", () => {
    const result = splitPii({
      basics: {
        date_of_birth: "1990-04-15",
        phone_mobile: " +61 400 000 000 ",
        address_postal: "1 Test St",
        sex: "Male",
        height_cm: 180,
      },
      medical: { conditions: ["None"] },
    });

    expect(result.profilePatch).toEqual({
      date_of_birth: "1990-04-15",
      phone: "+61 400 000 000",
      address_postal: "1 Test St",
    });

    expect(result.cleanedResponses.basics).toEqual({ sex: "Male", height_cm: 180 });
    expect(result.cleanedResponses.medical).toEqual({ conditions: ["None"] });
  });

  it("omits keys not present in input rather than nulling them", () => {
    const result = splitPii({ basics: { sex: "Female" } });
    expect(result.profilePatch).toEqual({});
  });

  it("treats empty string as an explicit clear (null)", () => {
    const result = splitPii({
      basics: { date_of_birth: "", phone_mobile: "", address_postal: "" },
    });
    expect(result.profilePatch).toEqual({
      date_of_birth: null,
      phone: null,
      address_postal: null,
    });
  });

  it("does not mutate the input object", () => {
    const input = { basics: { date_of_birth: "1990-01-01", sex: "Male" } };
    const before = JSON.parse(JSON.stringify(input));
    splitPii(input);
    expect(input).toEqual(before);
  });
});
