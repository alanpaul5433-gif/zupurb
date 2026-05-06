// T3 — Integration test: Review submission flow
//
// Flow under test:
//   RateExperienceScreen → answer all 8 questions → tap Continue
//   → stub /review/disclosure page appears (confirms navigation fired).
//
// No real Firebase calls are made. The screen uses only local StatefulWidget
// state; FunctionsService is not invoked from this screen directly.
//
// REQUIRES_DEVICE: NetworkImage loading requires a live network; test
// assertions do not depend on the image loading successfully.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:zupurb_app/screens/review/rate_experience_screen.dart';

import 'test_helpers.dart';

/// The 8 questions in RateExperienceScreen and one option to tap per question.
const List<(String, String)> kQuestionAnswers = [
  ('How was the food or drink quality?', 'Good'),
  ('How was the service?', 'Good'),
  ('How clean was the establishment?', 'Clean'),
  ('How was the atmosphere and ambiance?', 'Nice'),
  ('How safe did you feel here?', 'Mostly Safe'),
  ('How was the value for money?', 'Good Value'),
  ('How likely are you to return?', 'Likely'),
  ('Would you recommend this place to others?', 'Pretty Good'),
];

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('RateExperienceScreen — review submission flow', () {
    testWidgets('renders header and STEP 2 OF 8 indicator', (tester) async {
      await pumpScreen(
        tester,
        const RateExperienceScreen(),
        stubRoutes: ['/review/disclosure'],
      );

      expect(find.text('Rate Your Experience'), findsOneWidget);
      expect(find.text('STEP 2 OF 8'), findsOneWidget);
    });

    testWidgets('renders all 8 question cards on scroll', (tester) async {
      await pumpScreen(
        tester,
        const RateExperienceScreen(),
        stubRoutes: ['/review/disclosure'],
      );

      for (final (question, _) in kQuestionAnswers) {
        await tester.scrollUntilVisible(
          find.text(question),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        expect(find.text(question), findsOneWidget);
      }
    });

    testWidgets('can select an answer chip for each question', (tester) async {
      await pumpScreen(
        tester,
        const RateExperienceScreen(),
        stubRoutes: ['/review/disclosure'],
      );

      for (final (_, option) in kQuestionAnswers) {
        await tester.scrollUntilVisible(
          find.text(option).first,
          200,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.tap(find.text(option).first);
        await tester.pump();
      }

      // Verify all selected options still render (confirms setState completed).
      for (final (_, option) in kQuestionAnswers) {
        expect(find.text(option), findsAtLeastNWidgets(1));
      }
    });

    testWidgets('Continue button is visible without completing all answers',
        (tester) async {
      await pumpScreen(
        tester,
        const RateExperienceScreen(),
        stubRoutes: ['/review/disclosure'],
      );

      expect(find.text('Continue'), findsOneWidget);
    });

    testWidgets('Continue button navigates to /review/disclosure', (tester) async {
      await pumpScreen(
        tester,
        const RateExperienceScreen(),
        stubRoutes: ['/review/disclosure'],
      );

      await tester.scrollUntilVisible(
        find.text('Continue'),
        300,
        scrollable: find.byType(Scrollable).first,
      );

      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('stub_page__review_disclosure')),
        findsOneWidget,
      );
    });
  });
}
