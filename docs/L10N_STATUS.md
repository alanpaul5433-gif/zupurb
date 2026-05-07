# L10N Status — Zupurb

**Date:** 2026-05-07
**Milestone:** T11 Localization Smoke Test
**Auditor:** QA Agent

---

## 1. Infrastructure Status

| Check | Result |
|---|---|
| `flutter_localizations` in pubspec.yaml | PRESENT (`sdk: flutter`) |
| `intl` in pubspec.yaml | PRESENT (`^0.20.2`) |
| `lib/l10n/app_en.arb` | PRESENT — 3 keys only |
| `app_localizations.dart` (generated delegate) | PRESENT |
| `app_localizations_en.dart` (generated impl) | PRESENT |
| `l10n.yaml` config file | PRESENT |
| `AppLocalizations.delegate` wired into `MaterialApp` | MISSING — see gap below |
| `pubspec.yaml` `generate: true` flag | PRESENT |

**Overall status: Scaffold exists; ARB coverage is near-zero; delegate not wired.**

---

## 2. Gaps

### Gap 1 — `AppLocalizations.delegate` not added to `MaterialApp`

`lib/main.dart` (line 62) uses the three global delegates only:

```dart
localizationsDelegates: const [
  GlobalMaterialLocalizations.delegate,
  GlobalWidgetsLocalizations.delegate,
  GlobalCupertinoLocalizations.delegate,
],
```

`AppLocalizations.delegate` is missing. Until it is added, `AppLocalizations.of(context)` will return `null` at runtime for any widget that calls it.

**Fix required (Phase 1B or when strings are first consumed):**
```dart
localizationsDelegates: AppLocalizations.localizationsDelegates,
// — or —
localizationsDelegates: const [
  AppLocalizations.delegate,
  GlobalMaterialLocalizations.delegate,
  GlobalWidgetsLocalizations.delegate,
  GlobalCupertinoLocalizations.delegate,
],
```

### Gap 2 — ARB file contains only 3 keys

`lib/l10n/app_en.arb` currently defines:
- `appName`
- `continueButton`
- `cancelButton`

The codebase contains hundreds of hardcoded English strings (see §4). None of them are extracted into ARB.

### Gap 3 — Only English locale supported

`supportedLocales` in `main.dart` is `[Locale('en', 'US')]`. No additional locale ARB files exist. This is acceptable for Phase 1 but will require ARB files per locale before international expansion.

---

## 3. What Needs To Be Done To Add Full i18n

These steps are **not implemented here** — documented for the build team:

1. **Add `AppLocalizations.delegate`** to `MaterialApp.localizationsDelegates` in `lib/main.dart`.
2. **Extract all hardcoded strings** from `lib/` into `lib/l10n/app_en.arb`, assigning one key per unique user-visible string.
3. **Replace inline string literals** with `AppLocalizations.of(context)!.<key>` calls throughout the widget tree.
4. **Re-run code generation:** `flutter gen-l10n` (or `flutter pub run build_runner build`).
5. **For each additional locale:** create `lib/l10n/app_<locale>.arb` and provide translations; add the locale to `supportedLocales`.
6. **iOS:** Add locale entries to `ios/Runner/Info.plist` `CFBundleLocalizations` array.
7. **Android:** Add `resConfigs` to `android/app/build.gradle` for supported locales.

---

## 4. Sample Hardcoded English Strings (10 of hundreds)

These were found by grepping `Text('...')` and `label: '...'` patterns across `lib/`. This is a representative sample, not exhaustive.

| # | File | Hardcoded String |
|---|---|---|
| 1 | `lib/screens/messages/messages_list_screen.dart:39` | `'Messages'` (screen title) |
| 2 | `lib/screens/messages/messages_list_screen.dart:53` | `'Search conversations...'` (placeholder) |
| 3 | `lib/screens/messages/messages_list_screen.dart:140` | `'Business intro — reply to continue'` (badge label) |
| 4 | `lib/screens/home/home_screen.dart:75` | `'Recent Reviews'` (section heading) |
| 5 | `lib/screens/home/home_screen.dart:110` | `'Search experiences, creators...'` (search placeholder) |
| 6 | `lib/screens/home/add_place_screen.dart:34` | `'Be The First To Add It'` (heading) |
| 7 | `lib/screens/home/add_place_screen.dart:36` | `"Can't find a place? Add it and post your review right away."` (body copy) |
| 8 | `lib/screens/settings/settings_screen.dart:77` | `'Personal Information'` (menu item) |
| 9 | `lib/screens/settings/settings_screen.dart:94` | `'Delete Account'` (destructive action label) |
| 10 | `lib/widgets/plus_paywall.dart:173` | `'Zupurb Plus activated! Enjoy your perks.'` (success snackbar) |

---

## 5. Recommendation

i18n is not a Phase 1 blocker; implement before international expansion.

The infrastructure skeleton (ARB pipeline, generated delegate, l10n.yaml) is in place and functional. No work is needed before US launch. Before any international market expansion, the team should complete the string-extraction pass (Gap 2) and wire the delegate (Gap 1) in a single dedicated sprint — estimated 3–5 days of mechanical extraction work plus translator handoff time per locale.
