import 'package:flutter/material.dart';
import '../theme/colors.dart';

class ScoreBadge extends StatelessWidget {
  final double score;
  final double size;

  const ScoreBadge({super.key, required this.score, this.size = 36});

  Color _badgeColor() {
    if (score >= 4.5) return AppColors.online;      // green
    if (score >= 3.0) return AppColors.warning;     // amber
    return AppColors.error;                          // red
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Score: ${score.toStringAsFixed(1)} out of 5',
      excludeSemantics: true,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: _badgeColor(),
          borderRadius: BorderRadius.circular(size / 4),
        ),
        alignment: Alignment.center,
        child: Text(
          score.toStringAsFixed(1),
          style: TextStyle(
            fontSize: size * 0.36,
            fontWeight: FontWeight.w800,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}
