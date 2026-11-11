/**
 * A failed API call: the HTTP status, the envelope's stable `code` and its `details`.
 *
 * Kept apart from api.ts so the code that turns failures into words (errors.ts) can be
 * loaded, and tested, without the keychain and the network stack behind api().
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** The API's structured context, when it sends one. */
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
