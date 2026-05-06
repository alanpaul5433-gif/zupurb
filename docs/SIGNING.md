# Zupurb — Code Signing & Provisioning Guide

## Prerequisites

| Requirement | Notes |
|---|---|
| Apple Developer account | Enrolled in Apple Developer Program ($99/yr), Team Admin role required |
| Google Play Console account | App created and promoted to internal testing at least once |
| Fastlane gem | `gem install fastlane` (Ruby >= 2.7 required) |
| A private Git repo for Match | Dedicated repo, e.g. `github.com/your-org/zupurb-certs` — no other content |

---

## iOS — Fastlane Match Setup

Match stores encrypted certificates and provisioning profiles in a private Git repo.
Run this once from a machine with Apple Developer Admin access.

### 1. Initialize Match (first time only)

```bash
cd zupurb_app/ios
fastlane match init
# When prompted, choose: git
# Enter the URL of your private certs repo
```

### 2. Generate AppStore and Development certs

```bash
fastlane match appstore   # distribution cert + AppStore provisioning profile
fastlane match development
```

Match will encrypt everything with `MATCH_PASSWORD` and push to the certs repo.

### 3. Required environment variables

| Variable | Where set | Description |
|---|---|---|
| `APPLE_ID` | GitHub secret | Apple ID email used for App Store Connect |
| `ITC_TEAM_ID` | GitHub secret | App Store Connect team ID (numeric) |
| `APPLE_TEAM_ID` | GitHub secret | Apple Developer Portal team ID (10-char string) |
| `MATCH_GIT_URL` | GitHub secret | HTTPS URL of the private certs repo |
| `MATCH_PASSWORD` | GitHub secret | Passphrase used to encrypt/decrypt Match certs |

Find `ITC_TEAM_ID` and `APPLE_TEAM_ID` in App Store Connect under Membership.

### 4. Running lanes

```bash
# Sync certs only (read-only, safe on CI)
fastlane sync_certs

# Build a release IPA
fastlane build_release

# Build and push to TestFlight
fastlane beta
```

---

## Android — Upload Keystore Setup

Play App Signing holds the final signing key. You upload the app signed with an
upload key. Google re-signs before delivery.

### 1. Generate the upload keystore (run once, locally)

```bash
keytool -genkey -v \
  -keystore upload-keystore.jks \
  -alias upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Store `upload-keystore.jks` in a password manager or secrets vault. Never commit it.
Place it at `zupurb_app/upload-keystore.jks` (that path is gitignored).

### 2. Create key.properties

```bash
cp zupurb_app/android/key.properties.template zupurb_app/android/key.properties
# Edit key.properties and fill in storePassword, keyPassword
```

`key.properties` is gitignored. Never commit it.

### 3. Required environment variables (CI)

| Variable | Where set | Description |
|---|---|---|
| `KEYSTORE_BASE64` | GitHub secret | Base64-encoded content of `upload-keystore.jks` |
| `KEYSTORE_PASSWORD` | GitHub secret | `storePassword` value |
| `KEY_PASSWORD` | GitHub secret | `keyPassword` value |
| `KEY_ALIAS` | GitHub secret | `keyAlias` value (default: `upload`) |

In CI, decode the keystore before building:

```bash
echo "$KEYSTORE_BASE64" | base64 --decode > zupurb_app/upload-keystore.jks
```

---

## CI Secrets — Full Reference Table

All secrets live in GitHub Actions repository secrets (Settings > Secrets and variables > Actions).

| Secret name | Used by | Description |
|---|---|---|
| `APPLE_ID` | Fastlane (iOS) | Apple ID email |
| `ITC_TEAM_ID` | Fastlane (iOS) | App Store Connect numeric team ID |
| `APPLE_TEAM_ID` | Fastlane (iOS) | Developer Portal 10-char team ID |
| `MATCH_GIT_URL` | Fastlane Match | Private certs repo HTTPS URL |
| `MATCH_PASSWORD` | Fastlane Match | Cert encryption passphrase |
| `APP_STORE_CONNECT_API_KEY_ID` | Fastlane deliver | ASC API key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | Fastlane deliver | ASC API issuer ID |
| `APP_STORE_CONNECT_API_KEY_CONTENT` | Fastlane deliver | ASC API private key (.p8 content) |
| `KEYSTORE_BASE64` | Gradle (Android) | Base64 upload keystore |
| `KEYSTORE_PASSWORD` | Gradle (Android) | Keystore password |
| `KEY_PASSWORD` | Gradle (Android) | Key entry password |
| `KEY_ALIAS` | Gradle (Android) | Key alias (default: `upload`) |
| `FIREBASE_APP_ID_IOS` | Firebase App Distribution | iOS app ID for nightly distribution |
| `FIREBASE_APP_ID_ANDROID` | Firebase App Distribution | Android app ID for nightly distribution |
| `FIREBASE_TOKEN` | Firebase CLI | CI service account token |

---

## Key Rotation Policy

### iOS Certificates (annual)

Apple distribution certificates expire after 12 months.

1. On expiry (or 30 days before), run `fastlane match nuke distribution` to revoke the old cert.
2. Run `fastlane match appstore` to generate a new cert and re-encrypt in the certs repo.
3. Update `MATCH_PASSWORD` in GitHub secrets only if it was rotated.
4. Verify the next CI build succeeds before closing the rotation task.

### Android Upload Key Rotation

Play App Signing allows upload key rotation if the current key is compromised.

1. Generate a new upload keystore using the `keytool` command above.
2. In Play Console: Setup > App signing > Request upload key reset. Upload a certificate
   from the new keystore (export as `.der` with `keytool -export`).
3. Google reviews the request (can take several days).
4. Once approved, replace `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_PASSWORD`
   in GitHub secrets and verify a new build signs and uploads cleanly.
5. Revoke the old keystore from all password managers / vaults.

Routine rotation (non-compromise): recommended every 2 years or when team members
with key access depart.
