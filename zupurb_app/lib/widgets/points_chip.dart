import 'package:flutter/material.dart';
import '../theme/colors.dart';

class PointsChip extends StatelessWidget {
  final int points;
  final bool dark;

  const PointsChip({super.key, required this.points, this.dark = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: dark ? const Color(0xFF2A2A2A) : AppColors.primaryLight,
        borderRadius: BorderRadius.circular(100),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.monetization_on, size: 12, color: AppColors.pointsGold),
          const SizedBox(width: 3),
          Text(
            '${points}PTS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: dark ? AppColors.pointsGold : AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }
}
