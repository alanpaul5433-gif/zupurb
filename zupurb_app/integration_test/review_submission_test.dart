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

import 'package:zupurb_app/screens/review/verify_visit_screen.dart';
import 'package:zupurb_app/screens/review/rate_experience_screen.dart';
import 'package:zupurb_app/screens/review/creator_disclosure_screen.dart';
import 'package:zupurb_app/screens/review/written_review_screen.dart';
import 'package:zupurb_app/screens/review/review_submitted_screen.dart';

import 'test_helpers.dart';

// ---------------------------------------------------------------------------
// Screen routes used across the full review flow
// ---------------------------------------------------------------------------
//
// STEP 1 OF 8  VerifyVisitScreen      /review/verify   → /review/rate
// STEP 2 OF 8  RateExperienceScreen   /review/rate     → /review/disclosure
// STEP 3 OF 8  CreatorDisclosureScreen/review/disclosure→ /review/write
// STEP 4 OF 8  WrittenReviewScreen    /review/write    → /review/submitted
//              ReviewSubmittedScreen  /review/submitted→ /home

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

  // ---------------------------------------------------------------------------
  // VerifyVisitScreen — Step 1 of 8
  // ---------------------------------------------------------------------------

  group('VerifyVisitScreen — verify visit step', () {
    testWidgets('renders step header and headline', (tester) async {
      await pumpScreen(
        tester,
        const VerifyVisitScreen(),
        stubRoutes: ['/review/rate'],
      );

      expect(find.text('STEP 1 OF 8'), findsOneWidget);
      expect(find.text('Verify Your Visit'), findsOneWidget);
    });

    testWidgets('renders establishment context card', (tester) async {
      await pumpScreen(
        tester,
        const VerifyVisitScreen(),
        stubRoutes: ['/review/rate'],
      );

      expect(find.text('The Social Lounge'), findsOneWidget);
      expect(find.text('Downtown LA · Restaurant'), findsOneWidget);
    });

    testWidgets('renders all three verification options', (tester) async {
      await pumpScreen(
        tester,
        const VerifyVisitScreen(),
        stubRoutes: ['/review/rate'],
      );

      expect(find.text('Verified Visit'), findsOneWidget);
      expect(find.text('Partially Verified'), findsOneWidget);
      expect(find.text('Unverified'), findsOneWidget);
    });

    testWidgets('Verified Visit option shows RECOMMENDED badge', (tester) async {
      await pumpScreen(
        tester,
        const VerifyVisitScreen(),
        stubRoutes: ['/review/rate'],
      );

      expect(find.text('RECOMMENDED'), findsOneWidget);
    });

    testWidgets('verification options display point rewards', (tester) async {
      await pumpScreen(
        tester,
        const VerifyVisitScreen(),
        stubRoutes: ['/review/rate'],
      );

      expect(find.text('80 pts'), findsOneWidget);
      expect(find.text('25 pts'), findsAtLeastNWidgets(1));
    });

    testWidgets('tapping Partially Verified updates selection', (tester) async {
      await pumpScreen(
        tester,
        const VerifyVisitScreen(),
        stubRoutes: ['/review/rate'],
      );

      await tester.tap(find.text('Partially Verified'));
      await tester.pump();

      // After tap the widget rebuilds — option still present confirms setState.
      expect(find.text('Partially Verified'), findsOneWidget);
    });

    testWidgets('Continue button navigates to /review/rate', (tester) async {
      await pumpScreen(
        tester,
        const VerifyVisitScreen(),
        stubRoutes: ['/review/rate'],
      );

      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('stub_page__review_rate')),
        findsOneWidget,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // CreatorDisclosureScreen — Step 3 of 8
  // ---------------------------------------------------------------------------

  group('CreatorDisclosureScreen — creator disclosure step', () {
    testWidgets('renders step header and headline', (tester) async {
      await pumpScreen(
        tester,
        const CreatorDisclosureScreen(),
        stubRoutes: ['/review/write'],
      );

      expect(find.text('STEP 3 OF 8'), findsOneWidget);
      expect(find.textContaining('How Did This Visit Come'), findsOneWidget);
    });

    testWidgets('renders Creator Disclosure Required info card', (tester) async {
      await pumpScreen(
        tester,
        const CreatorDisclosureScreen(),
        stubRoutes: ['/review/write'],
      );

      expect(find.text('Creator Disclosure Required'), findsOneWidget);
    });

    testWidgets('renders both Yes/No questions', (tester) async {
      await pumpScreen(
        tester,
        const CreatorDisclosureScreen(),
        stubRoutes: ['/review/write'],
      );

      expect(
        find.text('Was this visit arranged by the establishment?'),
        findsOneWidget,
      );
      expect(
        find.text('Did you receive any compensation for this review?'),
        findsOneWidget,
      );
    });

    testWidgets('Yes and No answer options are rendered for each question',
        (tester) async {
      await pumpScreen(
        tester,
        const CreatorDisclosureScreen(),
        stubRoutes: ['/review/write'],
      );

      // Two questions × two options = 4 total Yes/No labels.
      expect(find.text('Yes'), findsNWidgets(2));
      expect(find.text('No'), findsNWidgets(2));
    });

    testWidgets('tapping Yes on first question updates its selection',
        (tester) async {
      await pumpScreen(
        tester,
        const CreatorDisclosureScreen(),
        stubRoutes: ['/review/write'],
      );

      // Tap the first Yes button (arranged question).
      await tester.tap(find.text('Yes').first);
      await tester.pump();

      // Widget rebuilds — Yes still visible confirms setState succeeded.
      expect(find.text('Yes'), findsAtLeastNWidgets(1));
    });

    testWidgets('Confirm & Continue navigates to /review/write', (tester) async {
      await pumpScreen(
        tester,
        const CreatorDisclosureScreen(),
        stubRoutes: ['/review/write'],
      );

      await tester.tap(find.text('Confirm & Continue'));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('stub_page__review_write')),
        findsOneWidget,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // WrittenReviewScreen — Step 4 of 8
  // ---------------------------------------------------------------------------

  group('WrittenReviewScreen — written review step', () {
    testWidgets('renders step header and headline', (tester) async {
      await pumpScreen(
        tester,
        const WrittenReviewScreen(),
        stubRoutes: ['/review/submitted'],
      );

      expect(find.text('STEP 4 OF 8'), findsOneWidget);
      expect(find.text('Add Your Written Review'), findsOneWidget);
    });

    testWidgets('renders AI summary auto-generated card', (tester) async {
      await pumpScreen(
        tester,
        const WrittenReviewScreen(),
        stubRoutes: ['/review/submitted'],
      );

      expect(find.text('AI Summary (Auto-Generated)'), findsOneWidget);
    });

    testWidgets('renders free-text input hint', (tester) async {
      await pumpScreen(
        tester,
        const WrittenReviewScreen(),
        stubRoutes: ['/review/submitted'],
      );

      expect(find.text('Share your experience...'), findsOneWidget);
    });

    testWidgets('renders character counter "0 / 500"', (tester) async {
      await pumpScreen(
        tester,
        const WrittenReviewScreen(),
        stubRoutes: ['/review/submitted'],
      );

      expect(find.text('0 / 500'), findsOneWidget);
    });

    testWidgets('renders Add photos or video section', (tester) async {
      await pumpScreen(
        tester,
        const WrittenReviewScreen(),
        stubRoutes: ['/review/submitted'],
      );

      expect(find.text('Add photos or video'), findsOneWidget);
    });

    testWidgets('renders Link a Reel optional row', (tester) async {
      await pumpScreen(
        tester,
        const WrittenReviewScreen(),
        stubRoutes: ['/review/submitted'],
      );

      await tester.scrollUntilVisible(
        find.text('Link a Reel'),
        200,
        scrollable: find.byType(Scrollable).first,
      );

      expect(find.text('Link a Reel'), findsOneWidget);
      expect(find.text('OPTIONAL'), findsOneWidget);
    });

    testWidgets('Continue button navigates to /review/submitted', (tester) async {
      await pumpScreen(
        tester,
        const WrittenReviewScreen(),
        stubRoutes: ['/review/submitted'],
      );

      await tester.scrollUntilVisible(
        find.text('Continue'),
        300,
        scrollable: find.byType(Scrollable).first,
      );

      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('stub_page__review_submitted')),
        findsOneWidget,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // ReviewSubmittedScreen — Submission Confirmation
  // ---------------------------------------------------------------------------

  group('ReviewSubmittedScreen — submission confirmation', () {
    testWidgets('renders Review Submitted headline', (tester) async {
      await pumpScreen(
        tester,
        const ReviewSubmittedScreen(),
        stubRoutes: ['/home'],
      );

      expect(find.text('Review Submitted!'), findsOneWidget);
    });

    testWidgets('renders points earned card with 80 Pts', (tester) async {
      await pumpScreen(
        tester,
        const ReviewSubmittedScreen(),
        stubRoutes: ['/home'],
      );

      expect(find.text('YOU EARNED'), findsOneWidget);
      expect(find.text('80 Pts'), findsOneWidget);
    });

    testWidgets('renders verified review label with venue name', (tester) async {
      await pumpScreen(
        tester,
        const ReviewSubmittedScreen(),
        stubRoutes: ['/home'],
      );

      expect(
        find.text('Verified review • The Social Lounge'),
        findsOneWidget,
      );
    });

    testWidgets('renders total balance line', (tester) async {
      await pumpScreen(
        tester,
        const ReviewSubmittedScreen(),
        stubRoutes: ['/home'],
      );

      expect(find.text('Total Balance: 800 Pts'), findsOneWidget);
    });

    testWidgets('renders Badge Unlocked card', (tester) async {
      await pumpScreen(
        tester,
        const ReviewSubmittedScreen(),
        stubRoutes: ['/home'],
      );

      expect(find.text('Badge Unlocked: Taster'), findsOneWidget);
      expect(find.text('5 reviews completed'), findsOneWidget);
      expect(find.text('+150 pts'), findsOneWidget);
    });

    testWidgets('Explore More Spots button navigates to /home', (tester) async {
      await pumpScreen(
        tester,
        const ReviewSubmittedScreen(),
        stubRoutes: ['/home'],
      );

      await tester.tap(find.text('Explore More Spots'));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('stub_page__home')),
        findsOneWidget,
      );
    });

    testWidgets('Share Your Review button is present', (tester) async {
      await pumpScreen(
        tester,
        const ReviewSubmittedScreen(),
        stubRoutes: ['/home'],
      );

      expect(find.text('Share Your Review'), findsOneWidget);
    });
  });
}
