import { describe, expect, it } from "vitest";

import { createTranslator, fill } from "./translate";

describe("createTranslator", () => {
  it("reads dotted keys in the chosen language", () => {
    expect(createTranslator("es")("welcome.signIn")).toBe("Iniciar sesión");
    expect(createTranslator("en")("welcome.signIn")).toBe("Sign in");
  });

  it("fills placeholders", () => {
    expect(createTranslator("en")("home.greeting", { name: "Ava" })).toBe("Hey, Ava! 👋");
    expect(createTranslator("es")("home.greeting", { name: "Ava" })).toBe("¡Hola, Ava! 👋");
    expect(createTranslator("es")("setup.step", { step: 2, total: 3 })).toBe("Paso 2 de 3");
  });

  it("falls back to English for a key a translation is missing", () => {
    const t = createTranslator("es");
    expect(t.has("welcome.signIn")).toBe(true);
    expect(t.has("nothing.here")).toBe(false);
    expect(t("nothing.here")).toBe("nothing.here");
  });

  it("leaves unknown placeholders alone rather than printing undefined", () => {
    expect(fill("Hello, {name} of {store}", { name: "Ava" })).toBe("Hello, Ava of {store}");
  });
});

describe("plurals and selects", () => {
  const days = "{count, plural, one {# day left} other {# days left}}";

  it("picks one or other, and puts the number where # is", () => {
    expect(fill(days, { count: 1 })).toBe("1 day left");
    expect(fill(days, { count: 6 })).toBe("6 days left");
    expect(fill(days, { count: 0 })).toBe("0 days left");
  });

  it("prefers an exact match", () => {
    const digits = "{count, plural, =0 {No digits} one {1 digit} other {# digits}}";
    expect(fill(digits, { count: 0 })).toBe("No digits");
    expect(fill(digits, { count: 3 })).toBe("3 digits");
  });

  it("fills arguments nested inside a branch", () => {
    const late = "{days, plural, one {{name} is # day late} other {{name} is # days late}}";
    expect(fill(late, { days: 3, name: "Luis" })).toBe("Luis is 3 days late");
  });

  it("selects by value", () => {
    expect(fill("{kind, select, sms {Text} other {Email}}", { kind: "sms" })).toBe("Text");
    expect(fill("{kind, select, sms {Text} other {Email}}", { kind: "fax" })).toBe("Email");
  });
});

describe("bold", () => {
  const phone = "(•••) •••-4821";

  it("drops the tags from plain text", () => {
    expect(createTranslator("en")("setup.codeSent", { phone })).toBe(
      `We sent a 6-digit code to ${phone}`,
    );
  });

  it("splits a message into runs", () => {
    expect(createTranslator("es").rich("setup.codeSent", { phone })).toEqual([
      { text: "Enviamos un código de 6 dígitos al ", bold: false },
      { text: phone, bold: true },
    ]);
  });
});
