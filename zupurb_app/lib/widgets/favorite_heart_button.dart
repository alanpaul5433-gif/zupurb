import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/favorites/favorites_provider.dart';
import '../theme/colors.dart';

/// The single, consistent favourite-heart control used on every establishment
/// card and list row, so the icon is identical everywhere (fixes the prior
/// heart-vs-bookmark inconsistency on Discover). Persists via favoritesProvider.
class FavoriteHeartButton extends ConsumerWidget {
  final String establishmentId;
  final double size;
  final bool showSnackBar;

  const FavoriteHeartButton({
    super.key,
    required this.establishmentId,
    this.size = 20,
    this.showSnackBar = true,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isFav = ref.watch(favoritesProvider).contains(establishmentId);
    return Semantics(
      button: true,
      label: isFav ? 'Remove from favourites' : 'Add to favourites',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          ref.read(favoritesProvider.notifier).toggle(establishmentId);
          if (showSnackBar) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(!isFav ? 'Added to favourites' : 'Removed from favourites'),
                duration: const Duration(seconds: 1),
              ),
            );
          }
        },
        child: Icon(isFav ? Icons.favorite : Icons.favorite_border, color: AppColors.primary, size: size),
      ),
    );
  }
}
