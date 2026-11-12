/**
 * Cursor pages (the wall, notifications): `{items, next_before}`, newest first, where
 * `next_before` is the id to ask `before=` for the next, older page, or null at the end.
 */

export interface CursorPage<T> {
  items: T[];
  next_before: string | null;
}

export interface Feed<T> {
  items: T[];
  /** Where the next page starts, or null when everything is loaded. */
  next: string | null;
}

/** `path` with the paging query added: `/wall?filter=for_you` + `&before=…&limit=20`. */
export function pagePath(path: string, before: string | null, limit: number): string {
  const query = [before ? `before=${encodeURIComponent(before)}` : null, `limit=${limit}`].filter(Boolean).join("&");
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

/** An older page added under what is loaded. A row can arrive twice when new posts push the
 *  page boundary down between two loads, so ids already shown are skipped. */
export function appendPage<T extends { id: string }>(feed: Feed<T>, page: CursorPage<T>): Feed<T> {
  const seen = new Set(feed.items.map((item) => item.id));
  return { items: [...feed.items, ...page.items.filter((item) => !seen.has(item.id))], next: page.next_before };
}

/**
 * A fresh first page laid over what is loaded, for a quiet refresh when the person comes
 * back to the screen. New rows go on top, rows on both are replaced by their fresh copies
 * (new like counts), rows the fresh page skips over are gone (a GM hid them), and the older
 * rows loaded beyond it stay, so the list does not shrink back to one page under the finger.
 *
 * If the fresh page does not reach anything loaded (more new rows than a page), keeping the
 * old rows would leave a hole between them, so the fresh page replaces everything.
 */
export function mergeFirstPage<T extends { id: string }>(feed: Feed<T>, page: CursorPage<T>): Feed<T> {
  const fresh = new Set(page.items.map((item) => item.id));
  let last = -1;
  feed.items.forEach((item, index) => {
    if (fresh.has(item.id)) last = index;
  });
  if (last < 0) return { items: page.items, next: page.next_before };
  // The oldest loaded row is still the oldest, so where the next page starts has not moved.
  return { items: [...page.items, ...feed.items.slice(last + 1)], next: feed.next };
}
