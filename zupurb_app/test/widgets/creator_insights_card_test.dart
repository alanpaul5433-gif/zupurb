/// Widget tests for lib/widgets/creator_insights_card.dart
/// CreatorInsightsCard is a ConsumerWidget that watches postsByAuthorProvider(uid)
/// and reviewsByAuthorProvider(uid) and derives five metrics (followers from the
/// passed UserProfile, plus posts / post-likes / reviews / helpful-votes from the
/// streamed data). Both family stream providers are overridden with fixed values;
/// covers the populated, all-zero, and loading (valueOrNull -> const []) branches.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/widgets/creator_insights_card.dart';
import 'package:zupurb_app/models/user_profile.dart';
import 'package:zupurb_app/models/post.dart';
import 'package:zupurb_app/models/review.dart';
import 'package:zupurb_app/state/posts/posts_provider.dart';
import 'package:zupurb_app/state/reviews/reviews_provider.dart';

const _uid = 'u1';

UserProfile _profile({int followers = 0}) => UserProfile(
      uid: _uid,
      displayName: 'Creator',
      followersCount: followers,
      followingCount: 0,
      reviewCount: 0,
      pointsBalance: 0,
      loyaltyTier: 'bronze',
      onboardingComplete: true,
    );

Post _post({int likes = 0}) => Post(
      id: 'p',
      authorUid: _uid,
      authorName: 'Creator',
      authorPhotoUrl: '',
      caption: '',
      imageUrl: '',
      venueName: '',
      likes: likes,
    );

Review _review({int helpful = 0}) => Review(
      id: 'r',
      estId: 'e',
      estName: 'E',
      authorName: 'Creator',
      authorPhotoUrl: '',
      score: 4.0,
      text: '',
      verificationTier: '',
      helpfulVotes: helpful,
    );

Future<void> _pump(
  WidgetTester tester, {
  required UserProfile profile,
  required Stream<List<Post>> posts,
  required Stream<List<Review>> reviews,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        postsByAuthorProvider(_uid).overrideWith((ref) => posts),
        reviewsByAuthorProvider(_uid).overrideWith((ref) => reviews),
      ],
      child: MaterialApp(
        home: Scaffold(
          body: CreatorInsightsCard(uid: _uid, profile: profile),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('CreatorInsightsCard', () {
    testWidgets('renders the header and all metric labels', (tester) async {
      await _pump(
        tester,
        profile: _profile(),
        posts: Stream.value(const []),
        reviews: Stream.value(const []),
      );
      expect(find.text('CREATOR INSIGHTS'), findsOneWidget);
      expect(find.text('Private'), findsOneWidget);
      for (final label in const [
        'Followers',
        'Posts',
        'Post likes',
        'Reviews',
        'Helpful votes',
      ]) {
        expect(find.text(label), findsOneWidget);
      }
    });

    testWidgets('all-zero state renders 0 for every computed metric',
        (tester) async {
      await _pump(
        tester,
        profile: _profile(followers: 0),
        posts: Stream.value(const []),
        reviews: Stream.value(const []),
      );
      // Followers(0), Posts(0), Post likes(0), Reviews(0), Helpful votes(0).
      expect(find.text('0'), findsNWidgets(5));
    });

    testWidgets('computes and renders metrics from streamed data',
        (tester) async {
      await _pump(
        tester,
        profile: _profile(followers: 120),
        posts: Stream.value([_post(likes: 5), _post(likes: 7), _post(likes: 3)]),
        reviews: Stream.value([_review(helpful: 4), _review(helpful: 6)]),
      );
      expect(find.text('120'), findsOneWidget); // followers
      expect(find.text('3'), findsOneWidget); // posts count
      expect(find.text('15'), findsOneWidget); // 5 + 7 + 3 post likes
      expect(find.text('2'), findsOneWidget); // reviews count
      expect(find.text('10'), findsOneWidget); // 4 + 6 helpful votes
    });

    testWidgets('loading streams fall back to const [] (valueOrNull null path)',
        (tester) async {
      // Streams that close without emitting -> provider has no value ->
      // valueOrNull is null -> the `?? const []` fallback yields zero metrics,
      // while the profile-derived follower count still renders.
      await _pump(
        tester,
        profile: _profile(followers: 42),
        posts: const Stream<List<Post>>.empty(),
        reviews: const Stream<List<Review>>.empty(),
      );
      expect(find.text('42'), findsOneWidget); // followers from profile
      // Posts, Post likes, Reviews, Helpful votes all 0.
      expect(find.text('0'), findsNWidgets(4));
    });
  });
}
