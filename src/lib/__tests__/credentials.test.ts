/**
 * The EID and password rules the forms apply before anything is sent (CR-02, CR-03, CR-05).
 * The API checks the same things; these keep the app from offering a button that can only
 * fail.
 */
import { isEid, normaliseEid, passwordChecks, passwordReady } from "@/lib/credentials";

describe("an EID as typed", () => {
  it("is kept as the roster stores it: no spaces or punctuation, letters upper-cased", () => {
    expect(normaliseEid(" 274 1001 ")).toBe("2741001");
    expect(normaliseEid("e-2741001")).toBe("E2741001");
    expect(normaliseEid("2741\n001")).toBe("2741001");
  });

  it("keeps letters, which some payroll systems print", () => {
    expect(normaliseEid("ab12cd")).toBe("AB12CD");
  });

  it("stops at the longest EID the roster allows", () => {
    expect(normaliseEid("1".repeat(30))).toHaveLength(20);
  });

  it("is ready to send at 3 to 20 letters and digits", () => {
    expect(isEid("12")).toBe(false);
    expect(isEid("123")).toBe(true);
    expect(isEid("E2741001")).toBe(true);
    expect(isEid("1".repeat(20))).toBe(true);
    expect(isEid("1".repeat(21))).toBe(false);
    expect(isEid("e2741001")).toBe(false); // not normalised yet
    expect(isEid("")).toBe(false);
  });
});

describe("the new-password checklist (CR-05)", () => {
  it("ticks nothing for empty fields", () => {
    expect(passwordChecks("", "")).toEqual({ length: false, number: false, match: false });
  });

  it("ticks each line on its own", () => {
    expect(passwordChecks("abcdefgh", "")).toEqual({ length: true, number: false, match: false });
    expect(passwordChecks("abc1", "")).toEqual({ length: false, number: true, match: false });
    expect(passwordChecks("abc", "abc")).toEqual({ length: false, number: false, match: true });
  });

  it("counts exactly 8 characters as enough, and 7 as not", () => {
    expect(passwordChecks("abcdefg1", "").length).toBe(true);
    expect(passwordChecks("abcdef1", "").length).toBe(false);
  });

  it("says the passwords match only when the confirmation is filled in and the same", () => {
    expect(passwordChecks("shift2024", "shift2024").match).toBe(true);
    expect(passwordChecks("shift2024", "shift2025").match).toBe(false);
    expect(passwordChecks("shift2024", "Shift2024").match).toBe(false);
    expect(passwordChecks("", "").match).toBe(false);
  });

  it("lets the form be sent only when all three are ticked", () => {
    expect(passwordReady(passwordChecks("shift2024", "shift2024"))).toBe(true);
    expect(passwordReady(passwordChecks("shiftwork", "shiftwork"))).toBe(false);
    expect(passwordReady(passwordChecks("shift1", "shift1"))).toBe(false);
    expect(passwordReady(passwordChecks("shift2024", "shift2024 "))).toBe(false);
  });
});
