import { describe, expect, it } from "vitest";

import { brandInk, contrastRatio, readableOn, relativeLuminance } from "./color";

describe("color", () => {
  it("computes WCAG contrast", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });

  it("picks readable text for brand colours", () => {
    expect(readableOn("#DA291C")).toBe("#FFFFFF"); // red
    expect(readableOn("#F5B700")).toBe("#111827"); // yellow
    expect(readableOn("#0F766E")).toBe("#FFFFFF"); // teal
  });

  it("rejects malformed colours", () => {
    expect(() => readableOn("red")).toThrow();
    expect(() => readableOn("#ff")).toThrow();
  });

  it("reads the short form a CSS minifier produces", () => {
    // The built stylesheet ships --background: #fff, and the browser hands that straight back.
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 5);
    expect(relativeLuminance("#fff")).toBeCloseTo(relativeLuminance("#FFFFFF"), 10);
    expect(readableOn("#f5b700")).toBe(readableOn("#F5B700"));
  });
});

describe("brandInk", () => {
  const light = ["#FFFFFF", "#F3F4F6"];

  it("leaves a brand that already passes alone", () => {
    expect(brandInk("#1D4ED8", light)).toBe("#1D4ED8");
  });

  it("darkens a brand that fails on the grey surface", () => {
    // A typical brand red: 4.87 on white, 4.42 on a grey surface. The second one is the failure.
    expect(contrastRatio("#DA291C", "#F3F4F6")).toBeLessThan(4.5);
    const ink = brandInk("#DA291C", light);
    expect(ink).not.toBe("#DA291C");
    for (const bg of light) expect(contrastRatio(ink, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("handles brands that are nowhere near readable", () => {
    for (const brand of ["#F5B700", "#16A34A", "#FFFFFF", "#FDE68A"]) {
      const ink = brandInk(brand, light);
      for (const bg of light) expect(contrastRatio(ink, bg), `${brand} → ${ink}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("lightens instead when the backgrounds are dark", () => {
    const dark = ["#111827", "#1F2937"];
    const ink = brandInk("#1D4ED8", dark);
    for (const bg of dark) expect(contrastRatio(ink, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("is deterministic and returns a normalised hex", () => {
    expect(brandInk("#da291c", light)).toBe(brandInk("#DA291C", light));
    expect(brandInk("#da291c", light)).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("rejects malformed colours and an empty background list", () => {
    expect(() => brandInk("nope", light)).toThrow();
    expect(() => brandInk("#DA291C", [])).toThrow();
  });
});
