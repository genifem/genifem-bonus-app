# Crew Stars: mobile app

The Expo app (SDK 57) for crew and GMs. Crew members recognise each other with coins, spend them on rewards and spin the wheel, and GMs approve reward requests. Owners use the web portal (`bonus-admin`) instead.

| Repository | What |
|---|---|
| `bonus-backend` | the API, the rules engine and the scheduled jobs |
| `bonus-admin` | the owner portal (web) |
| `bonus-app` (this one) | this app, plus the `packages/*` it shares with the portal |

The plan is in `../todos/Crew-Stars-Technical-Plan.md`, §8 for this app.

## Layout

```
src/app/              routes (expo-router, typed routes)
  welcome · sign-in · setup/[step]     signed-out screens (CR-01 to CR-06)
  (crew)/(tabs)/      Home · Wall · Give · Rewards · Profile
  (manager)/(tabs)/   Home · Wall · Give · Approvals · Profile   (role "gm")
src/screens/          screens written once and used by both tab groups
src/components/ui/    the kit: tokens, T, Button, Field, Card, Sheet, TabBar, Toast...
src/components/       Mascot, Coin / CoinPill, OtpInput, the route gates
src/lib/              api (tokens, X-Tenant, one refresh at a time), session, auth, i18n
packages/shared       design tokens and contrast helpers (shared with the portal)
packages/i18n         English and Spanish strings, with a parity test
packages/api-client   types generated from the API's OpenAPI schema
```

## Setup

```bash
pnpm install
cp .env.example .env     # optional: EXPO_PUBLIC_API_URL, EXPO_PUBLIC_TENANT
pnpm start               # then scan the QR code, with the API running on the same wifi
```

An unset `EXPO_PUBLIC_API_URL` points the app at the machine running Metro on port 8000. There is one operator per build (plan D3): `EXPO_PUBLIC_TENANT` is sent as `X-Tenant` on every request, and it defaults to `demo` in development. A release build must set it.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm gen:api             # after an API change; commit the result
```

`pnpm test` runs the app's Jest tests and the packages' Vitest suites (token contrast, catalog parity, the translator).

`pnpm gen:api` exports the schema from a `bonus-backend` checkout beside this one (or from `CREWSTARS_BACKEND`), using `python -m uv run python -m app.scripts.export_openapi`. Without a checkout, it falls back to the committed `packages/api-client/openapi.json`. CI fails if the committed types are out of date.

## Builds

EAS profiles `development`, `preview` and `production` are in `eas.json`. The EAS project has not been created yet: run `eas init` once to add `extra.eas.projectId` and `owner` to `app.json`.

Push notifications (plan D10, `src/lib/push.ts`) need that project id and a real phone: without one (Expo Go, a local build, a simulator, the web build) the app skips registration quietly and logs it once. They also need the APNs key and FCM credentials uploaded to EAS (`eas credentials`) before the server's pushes reach a phone.
