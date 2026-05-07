// T11 — Localization Smoke Test
//
// Verifies that:
//   1. AppLocalizations.delegate loads for the en locale without throwing.
//   2. Every key currently defined in lib/l10n/app_en.arb returns a non-empty
//      string at runtime.
//   3. The MaterialApp wires AppLocalizations.delegate alongside the three
//      global delegates and resolves the en locale cleanly.
//
// ARB keys in scope (app_en.arb as of 2026-05-07):
//   appName, continueButton, cancelButton
//
// When new keys are added to app_en.arb, add a corresponding expect() below.
//
// TODO (Gap 1 — L10N_STATUS.md §2): Once AppLocalizations.delegate is added
// to MaterialApp in lib/main.dart, update the MaterialApp in this test to use
// AppLocalizations.localizationsDelegates so both the app and the tests share
// the same delegate list.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/l10n/app_localizations.dart';

void main() {
  group('L10N smoke test — app_en.arb keys', () {
    // ---------------------------------------------------------------------------
    // Helper: pump a minimal MaterialApp that includes AppLocalizations.delegate
    // and resolve the AppLocalizations instance from BuildContext.
    // ---------------------------------------------------------------------------
    Future<AppLocalizations> pumpAndResolve(WidgetTester tester) async {
      late AppLocalizations resolved;

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(
            builder: (context) {
              resolved = AppLocalizations.of(context)!;
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      await tester.pumpAndSettle();
      return resolved;
    }

    // ---------------------------------------------------------------------------
    // 1. Delegate loads for the 'en' locale without throwing.
    // ---------------------------------------------------------------------------
    testWidgets('AppLocalizations.delegate loads for locale en', (
      WidgetTester tester,
    ) async {
      final l10n = await pumpAndResolve(tester);
      expect(l10n, isNotNull);
    });

    // ---------------------------------------------------------------------------
    // 2. AppLocalizations.of(context) is non-null — delegate is correctly wired.
    // ---------------------------------------------------------------------------
    testWidgets('AppLocalizations.of(context) returns non-null', (
      WidgetTester tester,
    ) async {
      late AppLocalizations? result;

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(
            builder: (context) {
              result = AppLocalizations.of(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(result, isNotNull);
    });

    // ---------------------------------------------------------------------------
    // 3. Key: appName — expected value 'Zupurb'
    // ---------------------------------------------------------------------------
    testWidgets('appName key resolves to non-empty string', (
      WidgetTester tester,
    ) async {
      final l10n = await pumpAndResolve(tester);
      expect(l10n.appName, isNotEmpty);
      expect(l10n.appName, equals('Zupurb'));
    });

    // ---------------------------------------------------------------------------
    // 4. Key: continueButton — expected value 'Continue'
    // ---------------------------------------------------------------------------
    testWidgets('continueButton key resolves to non-empty string', (
      WidgetTester tester,
    ) async {
      final l10n = await pumpAndResolve(tester);
      expect(l10n.continueButton, isNotEmpty);
      expect(l10n.continueButton, equals('Continue'));
    });

    // ---------------------------------------------------------------------------
    // 5. Key: cancelButton — expected value 'Cancel'
    // ---------------------------------------------------------------------------
    testWidgets('cancelButton key resolves to non-empty string', (
      WidgetTester tester,
    ) async {
      final l10n = await pumpAndResolve(tester);
      expect(l10n.cancelButton, isNotEmpty);
      expect(l10n.cancelButton, equals('Cancel'));
    });

    // ---------------------------------------------------------------------------
    // 6. supportedLocales list contains exactly Locale('en').
    // ---------------------------------------------------------------------------
    test('supportedLocales contains Locale(en)', () {
      expect(
        AppLocalizations.supportedLocales,
        contains(const Locale('en')),
      );
    });

    // ---------------------------------------------------------------------------
    // 7. isSupported returns true for 'en', false for unsupported locales.
    // ---------------------------------------------------------------------------
    test('delegate.isSupported returns true for en', () {
      expect(
        AppLocalizations.delegate.isSupported(const Locale('en')),
        isTrue,
      );
    });

    test('delegate.isSupported returns false for fr (not yet supported)', () {
      expect(
        AppLocalizations.delegate.isSupported(const Locale('fr')),
        isFalse,
      );
    });

    // ---------------------------------------------------------------------------
    // 8. localizationsDelegates convenience list is non-empty and includes the
    //    app delegate as its first entry.
    // ---------------------------------------------------------------------------
    test('localizationsDelegates list is non-empty', () {
      expect(AppLocalizations.localizationsDelegates, isNotEmpty);
    });

    test('localizationsDelegates first entry is AppLocalizations.delegate', () {
      expect(
        AppLocalizations.localizationsDelegates.first,
        equals(AppLocalizations.delegate),
      );
    });
  });
}
