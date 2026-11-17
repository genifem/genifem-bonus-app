// The package's public face. The locales live in locales.ts so translate.ts can use them without
// importing this file, which re-exports it (a require cycle Metro warns about on every load).
export * from "./locales";
export * from "./translate";
