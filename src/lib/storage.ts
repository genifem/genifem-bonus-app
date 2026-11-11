/**
 * Plain key-value storage on the device, for things that are not secrets (never tokens: those
 * live in the keychain, see session.ts). On a phone it is expo-sqlite's store; the development
 * web build uses storage.web.ts, because expo-sqlite's web worker does not bundle there.
 */
export { default } from "expo-sqlite/kv-store";
