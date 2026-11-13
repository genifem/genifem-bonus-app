/**
 * What the sign-in and setup screens say when a step fails, in both languages. The API's
 * error codes are the contract; the words are the app's (NF-02).
 */
import { createTranslator } from "@crewstars/i18n";

import { ApiError } from "@/lib/apiError";
import {
  companyProblem,
  explain,
  isOffline,
  keepsSession,
  type Problem,
  say,
  sendProblem,
  setupProblem,
  signInProblem,
  tenantProblemOf,
  waitSeconds,
} from "@/lib/errors";

const en = createTranslator("en");
const es = createTranslator("es");

const NOW = Date.parse("2026-11-11T15:00:00Z");
const minutesFromNow = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

function fail(status: number, code: string, details?: unknown): ApiError {
  return new ApiError(status, code, code.replace(/_/g, " "), details);
}

/** The message as the screen first shows it, before its countdown has ticked. */
function first(problem: Problem, t = en): string | null {
  return say(t, problem, null);
}

describe("a failed sign-in (CR-02, CR-07, CR-09)", () => {
  it("says one thing for a wrong EID, a wrong password or an account never set up", () => {
    const message = "That EID and password don't match. Try again.";
    expect(first(signInProblem(fail(401, "credentials_invalid"), NOW))).toBe(message);
    // An EID too long for the API to look up is still a combination that does not match.
    expect(first(signInProblem(fail(422, "http_422"), NOW))).toBe(message);
    expect(first(signInProblem(fail(401, "credentials_invalid"), NOW), es)).toBe(
      "Ese EID y esa contraseña no coinciden. Inténtalo de nuevo.",
    );
  });

  it("counts the lock down in whole minutes from details.until", () => {
    const problem = signInProblem(fail(403, "account_locked", { until: minutesFromNow(15) }), NOW);
    expect(problem.until).toBe(NOW + 15 * 60_000);
    expect(first(problem)).toBe("Too many tries. Try again in 15 minutes.");
    expect(first(problem, es)).toBe("Demasiados intentos. Inténtalo de nuevo en 15 minutos.");
    // Later, as the countdown ticks.
    expect(say(en, problem, 61)).toBe("Too many tries. Try again in 2 minutes.");
    expect(say(en, problem, 60)).toBe("Too many tries. Try again in 1 minute.");
    expect(say(es, problem, 5)).toBe("Demasiados intentos. Inténtalo de nuevo en 1 minuto.");
    // Over: nothing left to say.
    expect(say(en, problem, 0)).toBeNull();
  });

  it("rounds a part-minute up, so it never says 0 minutes while still locked", () => {
    const problem = signInProblem(fail(403, "account_locked", { until: minutesFromNow(14.2) }), NOW);
    expect(first(problem)).toBe("Too many tries. Try again in 15 minutes.");
  });

  it("does not trust a phone clock that is far out from the server's", () => {
    // The phone is 20 minutes fast: the lock looks over already, but the server still holds it.
    const fast = signInProblem(fail(403, "account_locked", { until: minutesFromNow(-5) }), NOW);
    expect(fast.until).toBeGreaterThan(NOW);
    expect(first(fast)).toBe("Too many tries. Try again in 1 minute.");
    // The phone is an hour slow: never more than the lock's own 15 minutes.
    const slow = signInProblem(fail(403, "account_locked", { until: minutesFromNow(75) }), NOW);
    expect(first(slow)).toBe("Too many tries. Try again in 15 minutes.");
    // No deadline at all: the lock's full length.
    expect(first(signInProblem(fail(403, "account_locked"), NOW))).toBe("Too many tries. Try again in 15 minutes.");
  });

  it("tells a terminated account to talk to the manager", () => {
    expect(first(signInProblem(fail(403, "account_inactive"), NOW))).toBe(
      "This account is no longer active. Talk to your manager.",
    );
  });

  it("tells a dead connection apart, since trying again is the fix", () => {
    expect(first(signInProblem(new ApiError(0, "network", "no connection"), NOW))).toBe(
      "You're offline. Check your connection and try again.",
    );
  });

  it("sends an owner to the portal (CR-08)", () => {
    expect(first(signInProblem(fail(403, "owner_use_portal"), NOW))).toBe(
      "Owners sign in on the web portal, not in the app.",
    );
  });

  it("does not blame what was typed for a server fault", () => {
    expect(first(signInProblem(fail(503, "service_unavailable"), NOW))).toBe("Something went wrong. Try again.");
    expect(first(signInProblem(new Error("boom"), NOW))).toBe("Something went wrong. Try again.");
  });
});

describe("a failed setup step (CR-03 to CR-05)", () => {
  it("says which EID problem it is: not on the roster, no phone, no longer active", () => {
    expect(first(setupProblem(en, fail(404, "eid_unknown"), NOW))).toBe(
      "We can't find that EID. Check it, or ask your manager.",
    );
    expect(first(setupProblem(en, fail(409, "no_phone_on_file"), NOW))).toBe(
      "We don't have a phone number for you. Ask your manager to add one.",
    );
    expect(first(setupProblem(es, fail(409, "no_phone_on_file"), NOW), es)).toBe(
      "No tenemos un número de teléfono tuyo. Pídele a tu gerente que lo agregue.",
    );
    expect(first(setupProblem(en, fail(403, "account_inactive"), NOW))).toBe(
      "This account is no longer active. Talk to your manager.",
    );
  });

  it("counts the tries left after a wrong code", () => {
    expect(first(setupProblem(en, fail(401, "code_invalid", { attempts_left: 3 }), NOW))).toBe(
      "That code isn't right. You have 3 tries left.",
    );
    expect(first(setupProblem(en, fail(401, "code_invalid", { attempts_left: 1 }), NOW))).toBe(
      "That code isn't right. You have 1 try left.",
    );
    expect(first(setupProblem(es, fail(401, "code_invalid", { attempts_left: 1 }), NOW), es)).toBe(
      "Ese código no es correcto. Te queda 1 intento.",
    );
    expect(first(setupProblem(en, fail(401, "code_invalid"), NOW))).toBe(
      "That code isn't right. Check the text and try again.",
    );
  });

  it("gives the minutes and the time a code lock ends", () => {
    const problem = setupProblem(en, fail(403, "code_locked", { until: minutesFromNow(15) }), NOW);
    const message = first(problem);
    expect(message).toMatch(/^Too many wrong codes\. Try again in 15 minutes \(.+\)\.$/);
    expect(message).not.toContain("{time}");
  });

  it("counts the seconds before another code can be sent", () => {
    const problem = setupProblem(en, fail(429, "resend_too_soon", { retry_after_s: 23 }), NOW);
    expect(problem.until).toBe(NOW + 23_000);
    expect(first(problem)).toBe("Wait 23 seconds before asking for another code.");
    expect(say(en, problem, 1)).toBe("Wait 1 second before asking for another code.");
    expect(say(es, problem, 12)).toBe("Espera 12 segundos antes de pedir otro código.");
    expect(say(en, problem, 0)).toBeNull();
    // Without a number from the API, CR-04's 30 seconds.
    expect(first(setupProblem(en, fail(429, "resend_too_soon"), NOW))).toBe(
      "Wait 30 seconds before asking for another code.",
    );
  });

  it("sends the person back to step 1 when the receipt is spent or stale", () => {
    for (const code of ["token_expired", "token_used", "token_invalid"]) {
      const problem = setupProblem(en, fail(401, code), NOW);
      expect(problem.restart).toBe(true);
      expect(first(problem)).toMatch(/start again/i);
    }
    expect(setupProblem(en, fail(401, "code_invalid"), NOW).restart).toBeUndefined();
  });

  it("explains a weak password and a text that could not be sent", () => {
    expect(first(setupProblem(en, fail(422, "password_weak", { rules: ["needs_number"] }), NOW))).toBe(
      "Use 8 or more characters, with at least one number.",
    );
    expect(first(setupProblem(en, fail(502, "sms_failed"), NOW))).toBe(
      "We couldn't send the text. Try again in a moment.",
    );
  });

  it("falls back to the generic message for a code the catalog does not know", () => {
    expect(first(setupProblem(en, fail(400, "something_new"), NOW))).toBe("Something went wrong. Try again.");
    expect(first(setupProblem(en, fail(422, "http_422"), NOW))).toBe("Something went wrong. Try again.");
  });
});

describe("every error code the auth API sends", () => {
  const codes = [
    "credentials_invalid",
    "account_locked",
    "account_inactive",
    "owner_use_portal",
    "eid_unknown",
    "no_phone_on_file",
    "code_locked",
    "resend_too_soon",
    "rate_limited",
    "sms_failed",
    "code_invalid",
    "code_expired",
    "password_weak",
    "token_used",
    "token_expired",
    "tenant_not_found",
    "tenant_suspended",
  ];

  it.each(codes)("%s has its own words in English and Spanish", (code) => {
    expect(en.has(`errors.${code}`)).toBe(true);
    expect(es.has(`errors.${code}`)).toBe(true);
    expect(explain(es, fail(400, code))).not.toBe(explain(en, fail(400, code)));
  });
});

describe("waitSeconds", () => {
  it("prefers the API's own count, then the deadline, then nothing", () => {
    expect(waitSeconds(fail(429, "x", { retry_after_s: 12, until: minutesFromNow(5) }), NOW)).toBe(12);
    expect(waitSeconds(fail(403, "x", { until: minutesFromNow(5) }), NOW)).toBe(300);
    expect(waitSeconds(fail(403, "x", { until: "not a date" }), NOW)).toBeNull();
    expect(waitSeconds(fail(403, "x", { until: null }), NOW)).toBeNull();
    expect(waitSeconds(fail(403, "x"), NOW)).toBeNull();
  });
});

describe("a refused shout-out (CR-19 to CR-23)", () => {
  it("says how many kudos are really left", () => {
    expect(first(sendProblem(en, fail(409, "kudos_insufficient", { kudos_left: 5 })))).toBe(
      "You only have 5 kudos coins left this month.",
    );
    expect(first(sendProblem(en, fail(409, "kudos_insufficient", { kudos_left: 1 })))).toBe(
      "You only have 1 kudos coin left this month.",
    );
    expect(first(sendProblem(en, fail(409, "kudos_insufficient", { kudos_left: 0 })))).toBe(
      "You have no kudos left this month.",
    );
    expect(first(sendProblem(es, fail(409, "kudos_insufficient", { kudos_left: 5 })), es)).toBe(
      "Solo te quedan 5 monedas kudos este mes.",
    );
    expect(first(sendProblem(en, fail(409, "kudos_insufficient")))).toBe(
      "You don't have enough kudos left for that amount.",
    );
  });

  it("gives the longest message allowed", () => {
    expect(first(sendProblem(en, fail(422, "message_too_long", { max: 140 })))).toBe(
      "Keep your message to 140 characters.",
    );
    expect(first(sendProblem(en, fail(422, "message_too_long")))).toBe("That message is too long.");
  });

  it.each(["not_in_scope", "tag_not_allowed", "amount_not_allowed", "recipient_not_found", "idempotency_key_required"])(
    "%s has its own words in both languages",
    (code) => {
      const english = first(sendProblem(en, fail(422, code)));
      const spanish = first(sendProblem(es, fail(422, code)), es);
      expect(english).not.toBe("Something went wrong. Try again.");
      expect(spanish).not.toBe(english);
    },
  );

  it("says offline for no connection, and the generic words for anything unknown", () => {
    expect(first(sendProblem(en, new ApiError(0, "network", "")))).toBe(
      "You're offline. Check your connection and try again.",
    );
    expect(first(sendProblem(en, fail(500, "http_500")))).toBe("Something went wrong. Try again.");
    expect(first(sendProblem(en, new Error("boom")))).toBe("Something went wrong. Try again.");
  });
});

describe("the wall's error codes", () => {
  it.each(["cannot_hide", "not_found"])("%s has its own words in English and Spanish", (code) => {
    expect(en.has(`errors.${code}`)).toBe(true);
    expect(explain(es, fail(403, code))).not.toBe(explain(en, fail(403, code)));
  });
});

describe("no connection (P5: opening the app offline)", () => {
  it("is told apart from a failure, so a screen can say it calmly", () => {
    expect(isOffline(new ApiError(0, "network", "no connection"))).toBe(true);
    expect(isOffline(fail(500, "http_500"))).toBe(false);
    expect(isOffline(fail(401, "token_invalid"))).toBe(false);
    expect(isOffline(new Error("boom"))).toBe(false);
  });

  it("keeps the session unless the server says who this isn't", () => {
    // A dead spot, a bad minute on the server or a busy one: still signed in.
    expect(keepsSession(new ApiError(0, "network", "no connection"))).toBe(true);
    expect(keepsSession(fail(503, "http_503"))).toBe(true);
    expect(keepsSession(fail(429, "rate_limited"))).toBe(true);
    expect(keepsSession(new Error("boom"))).toBe(true);
    // The refresh token was refused, or the person may not use the app: signed out.
    expect(keepsSession(fail(401, "refresh_invalid"))).toBe(false);
    expect(keepsSession(fail(403, "owner_use_portal"))).toBe(false);
  });

  it("keeps the session of someone whose company is paused: it is not about them", () => {
    expect(keepsSession(fail(403, "tenant_suspended"))).toBe(true);
  });
});

describe("what the API says about the company (P7)", () => {
  it("is paused for a suspended operator and gone for one that does not exist", () => {
    expect(tenantProblemOf(fail(403, "tenant_suspended"))).toBe("paused");
    expect(tenantProblemOf(fail(404, "tenant_not_found"))).toBe("gone");
  });

  it("is nothing for every other answer, including look-alikes", () => {
    expect(tenantProblemOf(fail(404, "not_found"))).toBeNull();
    expect(tenantProblemOf(fail(403, "owner_use_portal"))).toBeNull();
    expect(tenantProblemOf(fail(400, "tenant_not_resolved"))).toBeNull();
    // The code alone is not enough: it must come with its status.
    expect(tenantProblemOf(fail(500, "tenant_suspended"))).toBeNull();
    expect(tenantProblemOf(new ApiError(0, "network", "no connection"))).toBeNull();
    expect(tenantProblemOf(new Error("tenant_suspended"))).toBeNull();
  });
});

describe("a company code GET /meta would not take (P7)", () => {
  it("says a code no operator has can't be found, and to ask the manager", () => {
    const problem = companyProblem(fail(404, "tenant_not_found"));
    expect(problem.code).toBe("tenant_not_found");
    expect(first(problem)).toBe("We couldn't find that company code. Check it, or ask your manager for it.");
    expect(first(problem, es)).toBe("No encontramos ese código de empresa. Revísalo o pídeselo a tu gerente.");
  });

  it("says the same for a code the API cannot even read", () => {
    expect(companyProblem(fail(400, "tenant_not_resolved")).code).toBe("tenant_not_found");
  });

  it("says a paused operator is paused, and to ask the manager", () => {
    const problem = companyProblem(fail(403, "tenant_suspended"));
    expect(first(problem)).toBe("This company's Crew Stars is paused. Ask your manager.");
    expect(first(problem, es)).toBe("Crew Stars está en pausa en esta empresa. Pregúntale a tu gerente.");
  });

  it("keeps no connection apart, for the calm offline message with a retry", () => {
    const problem = companyProblem(new ApiError(0, "network", "no connection"));
    expect(problem.code).toBe("network");
    expect(isOffline(new ApiError(0, "network", "no connection"))).toBe(true);
  });

  it("says too many tries as itself, and anything else generically", () => {
    expect(companyProblem(fail(429, "rate_limited")).code).toBe("rate_limited");
    expect(first(companyProblem(fail(500, "http_500")))).toBe("Something went wrong. Try again.");
    expect(first(companyProblem(fail(404, "http_404")))).toBe("Something went wrong. Try again.");
    expect(first(companyProblem(new Error("boom")))).toBe("Something went wrong. Try again.");
  });
});

describe("a sign-in or a setup step at a company that is paused or gone (P7)", () => {
  it("says so on the form rather than as a wrong password", () => {
    expect(first(signInProblem(fail(403, "tenant_suspended"), NOW))).toBe(
      "This company's Crew Stars is paused. Ask your manager.",
    );
    expect(signInProblem(fail(404, "tenant_not_found"), NOW).code).toBe("tenant_not_found");
    expect(first(setupProblem(es, fail(403, "tenant_suspended"), NOW), es)).toBe(
      "Crew Stars está en pausa en esta empresa. Pregúntale a tu gerente.",
    );
  });
});
