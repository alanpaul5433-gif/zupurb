import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import '../theme/colors.dart';

/// A lightweight, read-only detail sheet shared by the Search category cards
/// (vendors, entertainers, brands, posts). Keeps every result tappable without
/// needing a dedicated detail route per entity type.
Future<void> showEntityDetailSheet(
  BuildContext context, {
  required String imageUrl,
  required String title,
  String? subtitle,
  double? rating,
  String? body,
  String? footer,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.white,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const Gap(14),
            if (imageUrl.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Image.network(
                    imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (c, e, s) => Container(color: AppColors.border),
                  ),
                ),
              ),
            const Gap(14),
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1A1A1A)),
                  ),
                ),
                if (rating != null) ...[
                  const Gap(8),
                  const Icon(Icons.star, size: 18, color: AppColors.pointsGold),
                  const Gap(3),
                  Text(rating.toStringAsFixed(1),
                      style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary)),
                ],
              ],
            ),
            if (subtitle != null && subtitle.isNotEmpty) ...[
              const Gap(4),
              Text(subtitle,
                  style: const TextStyle(
                      fontSize: 13, color: AppColors.textSecondary)),
            ],
            if (body != null && body.isNotEmpty) ...[
              const Gap(12),
              Text(body,
                  style: const TextStyle(
                      fontSize: 14, height: 1.4, color: Color(0xFF333333))),
            ],
            if (footer != null && footer.isNotEmpty) ...[
              const Gap(12),
              Text(footer,
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary)),
            ],
          ],
        ),
      ),
    ),
  );
}
