import { describe, expect, it } from "vitest";

import { contrastRatio } from "./color";
import { crewStars, light, schemes, textContrast, uiContrast } from "./tokens";

/**
 * The palette is the one place a contrast mistake reaches every screen at once. These
 * assertions cover the contract itself, so a token edit fails here rather than on a device.
 */
describe("tokens", () => {
  for (const [name, scheme] of Object.entries(schemes)) {
    describe(name, () => {
      it.each(textContrast)("%s on %s reaches 4.5:1", (text, background) => {
        const ratio = contrastRatio(scheme[text], scheme[background]);
        expect(ratio, `${text} (${scheme[text]}) on ${background} (${scheme[background]})`)
          .toBeGreaterThanOrEqual(4.5);
      });

      it.each(uiContrast)("%s against %s reaches 3:1", (mark, background) => {
        const ratio = contrastRatio(scheme[mark], scheme[background]);
        expect(ratio, `${mark} (${scheme[mark]}) on ${background} (${scheme[background]})`)
          .toBeGreaterThanOrEqual(3);
      });
    });
  }

  it("keeps every colour a six-digit hex, which the generators and React Native both assume", () => {
    for (const [key, value] of Object.entries({ ...crewStars, ...light })) {
      expect(value, key).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("never lets the decorative red carry text (D17)", () => {
    // The reason redAction exists: white on the decorative red, and the red on cream, fail AA.
    expect(contrastRatio("#FFFFFF", crewStars.red)).toBeLessThan(4.5);
    expect(contrastRatio(crewStars.red, crewStars.cream)).toBeLessThan(4.5);
    expect(light.brandInk).toBe(crewStars.redAction);
  });

  it("keeps every tinted pair readable, ink on its own tint", () => {
    const pairs: ReadonlyArray<readonly [string, string, string]> = [
      ["mint", crewStars.mintInk, crewStars.mint],
      ["sky", crewStars.skyInk, crewStars.sky],
      ["lilac", crewStars.lilacInk, crewStars.lilac],
      ["peach", crewStars.peachInk, crewStars.peach],
      ["amber", crewStars.amberInk, crewStars.amber],
      ["butter", crewStars.goldInk, crewStars.butter],
    ];
    for (const [pair, fg, bg] of pairs) {
      expect(contrastRatio(fg, bg), pair).toBeGreaterThanOrEqual(4.5);
    }
  });
});
