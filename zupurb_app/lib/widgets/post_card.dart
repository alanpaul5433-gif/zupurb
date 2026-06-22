import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import '../models/post.dart';
import '../theme/colors.dart';
import 'user_avatar.dart';
import 'entity_detail_sheet.dart';

/// A feed-style card for a [Post]: author header, full-width image, caption and
/// a ♥ likes count row.
class PostCard extends StatelessWidget {
  final Post post;
  const PostCard({super.key, required this.post});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => showEntityDetailSheet(
        context,
        imageUrl: post.imageUrl,
        title: post.authorName,
        subtitle: post.venueName,
        body: post.caption,
        footer: '♥ ${post.likes} likes',
      ),
      child: Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                UserAvatar(name: post.authorName, photoUrl: post.authorPhotoUrl, radius: 18),
                const Gap(10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(post.authorName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A)), maxLines: 1, overflow: TextOverflow.ellipsis),
                      if (post.venueName.isNotEmpty) ...[
                        const Gap(2),
                        Text(post.venueName, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 180,
            width: double.infinity,
            child: post.imageUrl.isNotEmpty
                ? Image.network(post.imageUrl, fit: BoxFit.cover,
                    errorBuilder: (c, e, s) => Container(color: AppColors.border))
                : Container(color: AppColors.border),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (post.caption.isNotEmpty) ...[
                  Text(post.caption, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary), maxLines: 3, overflow: TextOverflow.ellipsis),
                  const Gap(8),
                ],
                Row(
                  children: [
                    const Icon(Icons.favorite, size: 16, color: AppColors.primary),
                    const Gap(4),
                    Text('${post.likes}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }
}
