# Staging Environment — Setup & Usage

Milestone D5. The staging environment mirrors production so beta testers
and store reviewers never touch real user data.

---

## 1. Create the staging Firebase project (manual — one-time)

1. Go to https://console.firebase.google.com and create a new project named `zupurb-staging`.
2. Enable **Firestore** (Native mode, `us-central1`).
3. Enable **Authentication** → Phone provider.
4. Enable **Cloud Functions** (Blaze plan required).
5. Enable **Firebase App Check** and register both iOS and Android apps.
6. Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
   for the staging app and place them in the Flutter flavor directories under
   `zupurb_app/android/app/src/staging/` and `zupurb_app/ios/config/staging/`.
7. Create a service account key (Project Settings → Service Accounts → Generate new key)
   and store it as `STAGING_FIREBASE_SA_KEY` in GitHub Actions secrets.
   Never commit this file.

---

## 2. Deploy functions and Firestore rules to staging

```sh
# Switch Firebase CLI to the staging project
firebase use staging

# Deploy Cloud Functions + Firestore rules + indexes
firebase deploy --only functions,firestore
```

Verify in the Firebase console that all functions are deployed under `zupurb-staging`.

---

## 3. Seed staging Firestore with test data

```sh
cd functions

# Install dependencies if not already done
npm install

# Point ADC at the staging project service account
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/zupurb-staging-sa-key.json

# Run the seed script
npm run seed:staging
```

This creates:

| Collection       | Records | Details                                      |
|------------------|---------|----------------------------------------------|
| `users`          | 3       | Phone numbers +15550000001–003               |
| `establishments` | 2       | "The Test Lounge", "Demo Bar & Grill"        |
| `deals`          | 2       | One active deal per establishment            |
| `userBalances`   | 3       | 500 pts each                                 |

The script is idempotent — re-running it overwrites the same document IDs.

---

## 4. Build the Flutter app pointing at staging

```sh
# Run on device
flutter run --dart-define=APP_ENV=staging

# Build release APK
flutter build apk --dart-define=APP_ENV=staging

# Build iOS archive
flutter build ipa --dart-define=APP_ENV=staging
```

The `APP_ENV` dart-define is read by `AppEnvironment.current` in
`lib/core/config/app_environment.dart`.

---

## 5. APP_ENV values

| `APP_ENV` value | Environment        | Firebase project  | Notes                        |
|-----------------|--------------------|-------------------|------------------------------|
| `development`   | Local / emulator   | `zupurb-dev`      | Default when omitted         |
| `staging`       | Beta / review      | `zupurb-staging`  | Used for TestFlight + Play   |
| `production`    | Live App Store     | `zupurb-prod`     | Main branch builds only      |

---

## 6. Switch back to default after staging work

```sh
firebase use default
```
