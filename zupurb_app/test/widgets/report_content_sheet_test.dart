/// Widget tests for lib/widgets/report_content_sheet.dart
/// Opens the sheet via showReportContentSheet(), asserts the reason picker
/// renders, submit is gated until a reason is chosen, and the "other" details
/// field appears on demand.
/// NOTE: the submit path is NOT unit-verifiable here — _submit constructs
/// `FunctionsService()` directly (no provider/DI seam), so it cannot be mocked
/// and tapping it would hit real Firebase. That branch is integration-only.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:zupurb_app/widgets/report_content_sheet.dart';

Widget _host() {
  return MaterialApp(
    home: Scaffold(
      body: Builder(
        builder: (context) => Center(
          child: ElevatedButton(
            onPressed: () => showReportContentSheet(
              context,
              contentType: 'review',
              contentId: 'r-1',
              title: 'Report review',
            ),
            child: const Text('open-report'),
          ),
        ),
      ),
    ),
  );
}

Future<void> _openSheet(WidgetTester tester) async {
  await tester.pumpWidget(_host());
  await tester.tap(find.text('open-report'));
  await tester.pumpAndSettle();
}

ElevatedButton _submitButton(WidgetTester tester) => tester.widget<ElevatedButton>(
      find.widgetWithText(ElevatedButton, 'Submit report'),
    );

void main() {
  group('ReportContentSheet – rendering', () {
    testWidgets('renders the custom title and the five reason rows',
        (tester) async {
      await _openSheet(tester);

      expect(find.text('Report review'), findsOneWidget);
      expect(find.text('Spam or misleading'), findsOneWidget);
      expect(find.text('Inappropriate or offensive'), findsOneWidget);
      expect(find.text('Fake or fraudulent'), findsOneWidget);
      expect(find.text('Harassment or bullying'), findsOneWidget);
      expect(find.text('Something else'), findsOneWidget);
      // All rows start unchecked.
      expect(find.byIcon(Icons.radio_button_unchecked), findsNWidgets(5));
      expect(find.byIcon(Icons.radio_button_checked), findsNothing);
    });

    testWidgets('details field is hidden until "Something else" is chosen',
        (tester) async {
      await _openSheet(tester);
      expect(find.byType(TextField), findsNothing);
    });
  });

  group('ReportContentSheet – validation gating', () {
    testWidgets('submit is disabled until a reason is selected', (tester) async {
      await _openSheet(tester);
      expect(_submitButton(tester).onPressed, isNull);
    });

    testWidgets('selecting a reason checks it and enables submit',
        (tester) async {
      await _openSheet(tester);

      await tester.tap(find.text('Fake or fraudulent'));
      await tester.pump();

      expect(find.byIcon(Icons.radio_button_checked), findsOneWidget);
      expect(_submitButton(tester).onPressed, isNotNull);
    });

    testWidgets('choosing "Something else" reveals the details TextField',
        (tester) async {
      await _openSheet(tester);

      expect(find.byType(TextField), findsNothing);
      await tester.tap(find.text('Something else'));
      await tester.pump();

      expect(find.byType(TextField), findsOneWidget);
      expect(_submitButton(tester).onPressed, isNotNull);
    });
  });
}
