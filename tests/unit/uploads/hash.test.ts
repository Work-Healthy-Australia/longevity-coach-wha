import { describe, expect, it } from "vitest";
import { hashFile } from "@/lib/uploads/hash";

describe("hashFile", () => {
  it("returns a 64-character string", async () => {
    const buf = new TextEncoder().encode("hello world").buffer as ArrayBuffer;
    const hash = await hashFile(buf);
    expect(hash).toHaveLength(64);
  });

  it("returns lowercase hex", async () => {
    const buf = new TextEncoder().encode("hello world").buffer as ArrayBuffer;
    const hash = await hashFile(buf);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches known SHA-256 for 'hello world'", async () => {
    const buf = new TextEncoder().encode("hello world").buffer as ArrayBuffer;
    const hash = await hashFile(buf);
    expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
  });

  it("returns different hashes for different content", async () => {
    const a = new TextEncoder().encode("file-a").buffer as ArrayBuffer;
    const b = new TextEncoder().encode("file-b").buffer as ArrayBuffer;
    expect(await hashFile(a)).not.toBe(await hashFile(b));
  });
});
