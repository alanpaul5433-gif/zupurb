# Deploying zupurb_owner (Restaurant Owner Portal)

The portal is a **100% client-rendered Next.js SPA** (Firebase Auth + Firestore rules
enforce all access), so it ships as **static files** — no Node/SSR runtime.
It deploys to **Firebase Hosting** in project `zupurb-9580f` as the **`owner`** hosting
target, alongside the Flutter web app (target `app`).

## One-time setup (run once, needs Firebase auth)

```bash
# from repo root
firebase login                                    # if not already
firebase hosting:sites:create zupurb-owner        # creates https://zupurb-owner.web.app
firebase target:apply hosting owner zupurb-owner  # map .firebaserc target -> site
firebase target:apply hosting app   zupurb-9580f  # map the existing Flutter web site
```

> The site ID `zupurb-owner` must match `.firebaserc → targets.zupurb-9580f.hosting.owner`.
> If that ID is taken, pick another and update `.firebaserc` to match.

## Build + deploy (repeatable)

```bash
cd zupurb_owner && npm ci && npm run build   # output:'export' -> ./out
cd ..                                         # back to repo root (firebase.json lives here)
firebase deploy --only hosting:owner          # publishes ./out to zupurb-owner.web.app
```

## ⚠️ Note for the Flutter web app

`firebase.json` `hosting` is now an **array of targets**. The Flutter web app is the
`app` target, so deploy it with:

```bash
firebase deploy --only hosting:app            # NOT bare `--only hosting`
```

Bare `firebase deploy --only hosting` now deploys **both** targets.

## Config that makes this work
- `next.config.ts` → `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true`
- `firebase.json` → `hosting: [ {target:"app", public:"zupurb_app/build/web"}, {target:"owner", public:"zupurb_owner/out"} ]`
- `.firebaserc` → `targets.zupurb-9580f.hosting = { app: ["zupurb-9580f"], owner: ["zupurb-owner"] }`

## P0s fixed (council audit)
Both launch-blocking bugs are resolved:
- **Analytics rendered all zeros** — the endpoint returns every owned venue under
  `establishments[]` (ignoring the `estId` query param) and names the field `count`;
  the dashboard/reviews pages now pick the active venue and map `count → reviewCount`.
- **Auth-context freeze** — the `owners/{uid}` read is wrapped in try/catch and
  **fails closed** (non-owner → login), so a rules denial or network drop can no
  longer hang the loading spinner.
