import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import '../models/entertainer.dart';
import '../theme/colors.dart';
import 'entity_detail_sheet.dart';

/// A compact list card for an [Entertainer]: thumbnail + name + "role · city" +
/// a small ★ rating chip.
class EntertainerCard extends StatelessWidget {
  final Entertainer entertainer;
  const EntertainerCard({super.key, required this.entertainer});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => showEntityDetailSheet(
        context,
        imageUrl: entertainer.imageUrl,
        title: entertainer.name,
        subtitle: '${entertainer.role} · ${entertainer.city}',
        rating: entertainer.rating,
        body: entertainer.tagline,
      ),
      child: Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 56,
              height: 56,
              child: entertainer.imageUrl.isNotEmpty
                  ? Image.network(entertainer.imageUrl, fit: BoxFit.cover,
                      errorBuilder: (c, e, s) => Container(color: AppColors.border))
                  : Container(color: AppColors.border),
            ),
          ),
          const Gap(12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(entertainer.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A)), maxLines: 1, overflow: TextOverflow.ellipsis),
                const Gap(2),
                Text('${entertainer.role} · ${entertainer.city}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          const Gap(8),
          _RatingChip(rating: entertainer.rating),
        ],
      ),
      ),
    );
  }
}

class _RatingChip extends StatelessWidget {
  final double rating;
  const _RatingChip({required this.rating});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(8)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.star, size: 14, color: AppColors.pointsGold),
          const Gap(3),
          Text(rating.toStringAsFixed(1), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        ],
      ),
    );
  }
}
