/**
 * Cursor pages for the wall and the notifications: older pages add on without repeats, and a
 * quiet refresh lays the newest page on top without leaving a hole or dropping what was
 * scrolled to.
 */
import { appendPage, mergeFirstPage, pagePath } from "@/lib/pages";

interface Row {
  id: string;
  v?: number;
}

const rows = (...ids: string[]): Row[] => ids.map((id) => ({ id }));
const ids = (items: Row[]) => items.map((item) => item.id).join("");

describe("pagePath", () => {
  it("adds the cursor and the page size to a path with or without a query", () => {
    expect(pagePath("/wall?filter=for_you", null, 20)).toBe("/wall?filter=for_you&limit=20");
    expect(pagePath("/wall?filter=everyone", "abc123", 20)).toBe("/wall?filter=everyone&before=abc123&limit=20");
    expect(pagePath("/me/notifications", "x", 10)).toBe("/me/notifications?before=x&limit=10");
  });
});

describe("appendPage", () => {
  it("adds an older page under the list and moves the cursor", () => {
    const next = appendPage({ items: rows("a", "b"), next: "b" }, { items: rows("c", "d"), next_before: "d" });
    expect(ids(next.items)).toBe("abcd");
    expect(next.next).toBe("d");
  });

  it("skips a row it already has", () => {
    const next = appendPage({ items: rows("a", "b"), next: "b" }, { items: rows("b", "c"), next_before: null });
    expect(ids(next.items)).toBe("abc");
    expect(next.next).toBeNull();
  });
});

describe("mergeFirstPage", () => {
  it("puts new rows on top and keeps the older rows already loaded", () => {
    const loaded = { items: rows("a", "b", "c", "d", "e"), next: "e" };
    const merged = mergeFirstPage(loaded, { items: rows("y", "x", "a", "b", "c"), next_before: "c" });
    expect(ids(merged.items)).toBe("yxabcde");
    expect(merged.next).toBe("e");
  });

  it("takes the fresh copy of a row it already had", () => {
    const loaded = { items: [{ id: "a", v: 1 }, { id: "b", v: 1 }], next: null };
    const merged = mergeFirstPage(loaded, { items: [{ id: "a", v: 2 }, { id: "b", v: 3 }], next_before: null });
    expect(merged.items).toEqual([
      { id: "a", v: 2 },
      { id: "b", v: 3 },
    ]);
  });

  it("drops a row the fresh page skips over (a GM hid it)", () => {
    const loaded = { items: rows("a", "b", "c"), next: null };
    expect(ids(mergeFirstPage(loaded, { items: rows("a", "c"), next_before: null }).items)).toBe("ac");
  });

  it("keeps the end of the list as the end", () => {
    const loaded = { items: rows("a", "b"), next: null };
    const merged = mergeFirstPage(loaded, { items: rows("x", "a"), next_before: "a" });
    expect(ids(merged.items)).toBe("xab");
    expect(merged.next).toBeNull();
  });

  it("replaces everything when the fresh page does not reach the loaded rows", () => {
    const loaded = { items: rows("a", "b"), next: "b" };
    const merged = mergeFirstPage(loaded, { items: rows("z", "y", "x"), next_before: "x" });
    expect(ids(merged.items)).toBe("zyx");
    expect(merged.next).toBe("x");
  });

  it("takes the page as it is when nothing was loaded", () => {
    const merged = mergeFirstPage<Row>({ items: [], next: null }, { items: rows("a"), next_before: null });
    expect(ids(merged.items)).toBe("a");
  });
});
