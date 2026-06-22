import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';

import '../state/user/user_profile_provider.dart';
import '../theme/colors.dart';
import 'score_badge.dart';

/// Shows the general ScoreBadge and, when the viewer has a taste cohort with
/// enough like-minded reviewers for this venue, a small "People like you" pill
/// beneath it. When there's no personalized data, only the general badge shows.
class DualScore extends ConsumerWidget {
  final double generalScore;
  final Map<String, double>? plyByCohort;
  final Map<String, int>? plyCountByCohort;
  final bool compact;
  final double badgeSize;

  const DualScore({
    super.key,
    required this.generalScore,
    this.plyByCohort,
    this.plyCountByCohort,
    this.compact = false,
    this.badgeSize = 44,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cohort = ref.watch(currentUserCohortProvider);
    double? ply;
    if (cohort != null && cohort.isNotEmpty && plyByCohort != null) {
      final s = plyByCohort![cohort];
      final c = plyCountByCohort?[cohort] ?? 0;
      if (s != null && c >= 2) ply = s;
    }

    final badge = ScoreBadge(score: generalScore, size: compact ? 36 : badgeSize);
    if (ply == null) return badge;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        badge,
        Gap(compact ? 3 : 6),
        _PlyPill(score: ply, compact: compact),
      ],
    );
  }
}

class _PlyPill extends StatelessWidget {
  final double score;
  final bool compact;
  const _PlyPill({required this.score, required this.compact});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: compact ? 6 : 8, vertical: compact ? 2 : 3),
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(100),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.people_alt, size: compact ? 10 : 12, color: AppColors.primary),
          const Gap(3),
          Text(
            compact ? score.toStringAsFixed(1) : 'People like you ${score.toStringAsFixed(1)}',
            style: TextStyle(fontSize: compact ? 10 : 11, fontWeight: FontWeight.w700, color: AppColors.primary),
          ),
        ],
      ),
    );
  }
}
