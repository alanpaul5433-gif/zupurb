import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/dimens.dart';

/// A single photo tile for the Instagram Explore-style grid.
///
/// Shows a full-bleed [imageUrl] with a bottom gradient containing a short
/// [label] and an optional [sublabel].  Tapping calls [onTap].
class ExploreTile extends StatelessWidget {
  final String imageUrl;
  final String label;
  final String? sublabel;
  final VoidCallback onTap;
  /// Optional pill badge (e.g. "500 pts" for deals).
  final String? badge;

  const ExploreTile({
    super.key,
    required this.imageUrl,
    required this.label,
    this.sublabel,
    required this.onTap,
    this.badge,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      button: true,
      child: GestureDetector(
        onTap: onTap,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppDimens.radiusMd),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Background image
              _TileImage(imageUrl: imageUrl),

              // Bottom gradient + text
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(8, 20, 8, 8),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        Color(0xCC000000), // 80% black
                        Colors.transparent,
                      ],
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        label,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          height: 1.2,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (sublabel != null && sublabel!.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          sublabel!,
                          style: const TextStyle(
                            fontSize: 10,
                            color: Color(0xCCFFFFFF),
                            height: 1.2,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // Optional badge pill (top-right)
              if (badge != null && badge!.isNotEmpty)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(AppDimens.radiusFull),
                    ),
                    child: Text(
                      badge!,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TileImage extends StatelessWidget {
  final String imageUrl;
  const _TileImage({required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    if (imageUrl.isEmpty) {
      return Container(color: AppColors.border);
    }
    return Image.network(
      imageUrl,
      fit: BoxFit.cover,
      errorBuilder: (ctx, err, st) => Container(color: AppColors.border),
    );
  }
}
