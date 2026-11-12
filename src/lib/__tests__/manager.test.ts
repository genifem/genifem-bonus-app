/** The numbers the GM's Home draws (MG-01, MG-02). */
import { kudosFraction, LOVE_PREVIEW, preview } from "@/lib/manager";

describe("the kudos bar (MG-01)", () => {
  it("is the kudos left out of all there were to give", () => {
    expect(kudosFraction({ left: 300, allowance: 300, bonus: 0 })).toBe(1);
    expect(kudosFraction({ left: 75, allowance: 300, bonus: 0 })).toBe(0.25);
    expect(kudosFraction({ left: 0, allowance: 300 })).toBe(0);
  });

  it("counts extra kudos won on the wheel in the whole", () => {
    expect(kudosFraction({ left: 200, allowance: 300, bonus: 100 })).toBe(0.5);
  });

  it("stays between empty and full, and empty with no allowance at all", () => {
    expect(kudosFraction({ left: 400, allowance: 300, bonus: 0 })).toBe(1);
    expect(kudosFraction({ left: -5, allowance: 300, bonus: 0 })).toBe(0);
    expect(kudosFraction({ left: 0, allowance: 0, bonus: 0 })).toBe(0);
  });
});

describe("a long needs-some-love list (MG-02)", () => {
  const crew = Array.from({ length: 12 }, (_, index) => `crew ${index}`);

  it("shows the first few and counts the rest", () => {
    const { shown, hidden } = preview(crew, false);
    expect(shown).toHaveLength(LOVE_PREVIEW);
    expect(hidden).toBe(12 - LOVE_PREVIEW);
  });

  it("shows everyone once opened, or when there are only a few", () => {
    expect(preview(crew, true)).toEqual({ shown: crew, hidden: 0 });
    expect(preview(crew.slice(0, 3), false)).toEqual({ shown: crew.slice(0, 3), hidden: 0 });
  });
});
