/**
 * The web build's key-value store: the browser's localStorage behind the same async calls the
 * app makes on a phone. Only the development web build (`pnpm web`) uses it.
 */
const Storage = {
  async getItem(key: string): Promise<string | null> {
    return globalThis.localStorage?.getItem(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    globalThis.localStorage?.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    globalThis.localStorage?.removeItem(key);
  },
};

export default Storage;
