/**
 * The wheel's angle maths (plan §8, §17): the server picks `segment_index`, and the wheel must
 * always land on exactly that segment (acceptance test 14), wherever it rested before.
 */
import {
  baseFontSize,
  fitLabel,
  isSegment,
  landingRotation,
  lineWidth,
  lineY,
  restingAngle,
  segmentAngle,
  segmentAt,
  segmentCentre,
  segmentPath,
  TURNS,
  wrapWords,
} from "@/lib/wheel";

describe("segments", () => {
  it("splits the circle evenly, clockwise from 12 o'clock", () => {
    expect(segmentAngle(8)).toBe(45);
    expect(segmentAngle(3)).toBe(120);
    expect(segmentCentre(0, 8)).toBe(22.5);
    expect(segmentCentre(7, 8)).toBe(337.5);
    expect(segmentCentre(1, 3)).toBe(180);
  });

  it("knows which segments the wheel has", () => {
    expect(isSegment(0, 8)).toBe(true);
    expect(isSegment(7, 8)).toBe(true);
    expect(isSegment(8, 8)).toBe(false);
    expect(isSegment(-1, 8)).toBe(false);
    expect(isSegment(1.5, 8)).toBe(false);
  });
});

describe("landingRotation", () => {
  it("turns five times and then (360 - segment centre) from rest", () => {
    expect(landingRotation(0, 0, 8)).toBe(5 * 360 + (360 - 22.5));
    expect(landingRotation(0, 3, 8)).toBe(5 * 360 + (360 - 157.5));
    expect(landingRotation(0, 2, 3)).toBe(5 * 360 + (360 - 300));
  });

  it("lands every segment of every wheel the owners can make under the pointer", () => {
    for (let count = 3; count <= 10; count++) {
      for (let index = 0; index < count; index++) {
        expect(segmentAt(landingRotation(0, index, count), count)).toBe(index);
      }
    }
  });

  it("lands on the server's segment wherever the last spin left the wheel", () => {
    const resting = [0, 22.5, 157.5, 337.5, 359.9, 1800 + 45, 7200 + 300];
    for (const current of resting) {
      for (let index = 0; index < 8; index++) {
        const target = landingRotation(current, index, 8);
        expect(segmentAt(target, 8)).toBe(index);
        // The pointer sits on the segment's centre, not near an edge.
        expect(restingAngle(target)).toBeCloseTo(restingAngle(360 - segmentCentre(index, 8)), 6);
      }
    }
  });

  it("always turns forward, by at least four whole turns", () => {
    for (const current of [0, 10, 180, 359, 720 + 90]) {
      for (let index = 0; index < 10; index++) {
        const travel = landingRotation(current, index, 10) - current;
        expect(travel).toBeGreaterThanOrEqual(360 * (TURNS - 1));
        expect(travel).toBeLessThanOrEqual(360 * (TURNS + 1));
      }
    }
  });

  it("rests within one turn afterwards without moving the wheel", () => {
    const target = landingRotation(0, 5, 8);
    expect(restingAngle(target)).toBe(target - 5 * 360);
    expect(segmentAt(restingAngle(target), 8)).toBe(5);
    expect(restingAngle(-90)).toBe(270);
  });
});

describe("segmentPath", () => {
  it("draws a wedge from the centre along the arc", () => {
    expect(segmentPath(0, 4)).toBe("M150 150L150 10A140 140 0 0 1 290 150Z");
    expect(segmentPath(1, 4)).toBe("M150 150L290 150A140 140 0 0 1 150 290Z");
  });

  it("uses the large arc only for a segment wider than half the wheel", () => {
    expect(segmentPath(0, 3)).toContain(" 0 0 1 ");
    expect(segmentPath(0, 1)).toContain(" 0 1 1 ");
  });
});

describe("labels", () => {
  it("wraps words to the width and keeps a long word whole", () => {
    expect(wrapWords("Lucky Star badge", 10)).toEqual(["Lucky Star", "badge"]);
    expect(wrapWords("  Free   drink ", 12)).toEqual(["Free drink"]);
    expect(wrapWords("Supercalifragilistic fries", 8)).toEqual(["Supercalifragilistic", "fries"]);
    expect(wrapWords("", 8)).toEqual([]);
  });

  it("keeps the prototype's sizes: 13, or 11 past eight prizes", () => {
    expect(baseFontSize(8)).toBe(13);
    expect(baseFontSize(9)).toBe(11);
    expect(lineY(0, 13)).toBe(48);
    expect(lineY(1, 13)).toBe(64);
  });

  it("is narrower toward the hub and on a crowded wheel", () => {
    expect(lineWidth(102, 8)).toBeGreaterThan(lineWidth(80, 8));
    expect(lineWidth(102, 10)).toBeLessThan(lineWidth(102, 8));
    // A wide segment is held in by the rim, not its edges.
    expect(lineWidth(102, 3)).toBeLessThan(2 * 140);
  });

  it("fits the default prizes on one line at full size", () => {
    for (const label of ["+10 coins", "+100 coins", "Free drink", "Free fries", "+10 kudos"]) {
      expect(fitLabel(label, 8)).toEqual({ lines: [label], fontSize: 13 });
    }
  });

  it("wraps and shrinks a long Spanish label rather than spilling into the next segment", () => {
    const fitted = fitLabel("Insignia Estrella de la suerte", 8);
    expect(fitted.lines.length).toBeLessThanOrEqual(3);
    expect(fitted.lines.join(" ")).toBe("Insignia Estrella de la suerte");
    expect(fitted.fontSize).toBeLessThanOrEqual(13);
    expect(fitted.fontSize).toBeGreaterThanOrEqual(8);
  });

  it("never uses more than three lines, even for a 40-character label on ten segments", () => {
    const fitted = fitLabel("a b c d e f g h i j k l m n o p q r s t", 10);
    expect(fitted.lines.length).toBeLessThanOrEqual(3);
  });
});
