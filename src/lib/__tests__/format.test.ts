/**
 * The countdowns the sign-in and setup screens show: "Resend code (0:30)", "Try again in 15
 * minutes", and the time a lock ends.
 */
import { clockTime, minutesLeft } from "@/lib/format";
import { formatCountdown } from "@/lib/useCountdown";

describe("formatCountdown", () => {
  it("writes the resend wait as minutes and seconds", () => {
    expect(formatCountdown(30)).toBe("0:30");
    expect(formatCountdown(9)).toBe("0:09");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(600)).toBe("10:00");
  });

  it("never shows a negative or fractional second", () => {
    expect(formatCountdown(-3)).toBe("0:00");
    expect(formatCountdown(29.7)).toBe("0:29");
  });
});

describe("minutesLeft", () => {
  it("rounds up, so a lock never says 0 minutes while it still holds", () => {
    expect(minutesLeft(900)).toBe(15);
    expect(minutesLeft(899)).toBe(15);
    expect(minutesLeft(61)).toBe(2);
    expect(minutesLeft(60)).toBe(1);
    expect(minutesLeft(1)).toBe(1);
    expect(minutesLeft(0)).toBe(1);
  });
});

describe("clockTime", () => {
  it("writes the hour and minute a lock ends, in the phone's own clock", () => {
    const at = new Date(2026, 10, 11, 15, 5).getTime();
    const english = clockTime(at, "en");
    expect(english).toMatch(/3:05/);
    expect(clockTime(at, "es")).toMatch(/(3|15):05/);
  });

  it("still writes a time where the locale is unknown to the engine", () => {
    const at = new Date(2026, 10, 11, 9, 7).getTime();
    expect(clockTime(at, "not-a-locale!")).toMatch(/9:07/);
  });
});
