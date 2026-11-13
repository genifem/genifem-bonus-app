/**
 * Which part of the app the root stack allows (P7, CR-08): no company comes before anything
 * else, a paused company covers everything once one is chosen, and only then does who is
 * signed in pick the welcome screens or a tab group, as it did before.
 */
import { homeGroupFor, type PlaceInput, placeFor } from "@/lib/guards";

const crew = { role: "crew" } as const;
const gm = { role: "gm" } as const;

function place(over: Partial<PlaceInput>) {
  return placeFor({ ready: true, company: "ecc", me: null, offline: false, paused: false, ...over });
}

describe("the root guards", () => {
  it("draw nothing until the company and the session have been read", () => {
    expect(place({ ready: false })).toBe("loading");
    expect(place({ ready: false, company: null })).toBe("loading");
    expect(place({ ready: false, me: crew, paused: true })).toBe("loading");
  });

  it("allow only the company screen while no company is chosen, whatever else is known", () => {
    expect(place({ company: null })).toBe("company");
    // A session can't outlive its company; even a stale one never gets past this.
    expect(place({ company: null, me: crew })).toBe("company");
    expect(place({ company: null, me: gm, paused: true, offline: true })).toBe("company");
  });

  it("cover a signed-in person with the paused screen while the company is paused", () => {
    expect(place({ me: crew, paused: true })).toBe("paused");
    expect(place({ me: gm, paused: true })).toBe("paused");
    // Paused at launch on a phone that never kept the profile: still paused, not signed out.
    expect(place({ me: null, paused: true })).toBe("paused");
    expect(place({ me: null, paused: true, offline: true })).toBe("paused");
  });

  it("open the welcome screens at a company with nobody signed in", () => {
    expect(place({})).toBe("signedOut");
  });

  it("wait calmly offline when a session is kept but the profile never was", () => {
    expect(place({ offline: true })).toBe("offline");
  });

  it("open the person's own tabs once signed in, offline or not", () => {
    expect(place({ me: crew })).toBe("crew");
    expect(place({ me: gm })).toBe("manager");
    expect(place({ me: crew, offline: true })).toBe("crew");
    expect(place({ me: { role: "director" } })).toBe("crew");
  });
});

describe("homeGroupFor", () => {
  it("gives GMs the manager tabs and everyone else the crew tabs", () => {
    expect(homeGroupFor(gm)).toBe("manager");
    for (const role of ["crew", "shift", "supervisor", "director"] as const) {
      expect(homeGroupFor({ role })).toBe("crew");
    }
  });
});
