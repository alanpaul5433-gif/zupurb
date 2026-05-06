import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Localization scaffold', () {
    const supportedLocales = [Locale('en', 'US')];

    const delegates = [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ];

    test('supportedLocales contains en_US', () {
      expect(supportedLocales, contains(const Locale('en', 'US')));
    });

    test('localizationsDelegates list is non-empty', () {
      expect(delegates, isNotEmpty);
    });

    testWidgets(
      'MaterialApp with localization delegates pumps without error',
      (WidgetTester tester) async {
        await tester.pumpWidget(
          MaterialApp(
            localizationsDelegates: delegates,
            supportedLocales: supportedLocales,
            home: const Scaffold(body: Text('Zupurb')),
          ),
        );

        // Settle all pending frames/timers.
        await tester.pumpAndSettle();

        // The widget must be present — no exception thrown.
        expect(find.text('Zupurb'), findsOneWidget);
      },
    );

    testWidgets(
      'Locale en_US resolves without throwing a missing-locale error',
      (WidgetTester tester) async {
        await tester.pumpWidget(
          MaterialApp(
            locale: const Locale('en', 'US'),
            localizationsDelegates: delegates,
            supportedLocales: supportedLocales,
            home: const Scaffold(body: Text('locale ok')),
          ),
        );

        await tester.pumpAndSettle();

        expect(find.text('locale ok'), findsOneWidget);
      },
    );
  });
}
