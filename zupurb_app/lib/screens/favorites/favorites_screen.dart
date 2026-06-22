import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';

import '../../models/establishment.dart';
import '../../state/establishments/establishments_provider.dart';
import '../../state/favorites/favorites_provider.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/favorite_heart_button.dart';
import '../../widgets/score_badge.dart';
import '../../widgets/dual_score.dart';

/// Lists the establishments the user has favourited.
class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favs = ref.watch(favoritesProvider);
    final estAsync = ref.watch(establishmentsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF5F0ED),
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.of(context).maybePop(),
          tooltip: 'Back',
          icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary, semanticLabel: 'Back'),
        ),
        title: const Text('Favourites', style: TextStyle(color: Color(0xFF1A1A1A), fontWeight: FontWeight.w800)),
        centerTitle: true,
      ),
      body: estAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (e, _) => const Center(child: Text('Could not load favourites.', style: TextStyle(color: AppColors.textSecondary))),
        data: (ests) {
          final favEsts = ests.where((e) => favs.contains(e.id)).toList();
          if (favEsts.isEmpty) {
            return const _EmptyFavorites();
          }
          return ListView.separated(
            padding: const EdgeInsets.all(AppDimens.screenPadding),
            itemCount: favEsts.length,
            separatorBuilder: (_, __) => const Gap(10),
            itemBuilder: (context, i) => _FavoriteRow(est: favEsts[i]),
          );
        },
      ),
    );
  }
}

class _EmptyFavorites extends StatelessWidget {
  const _EmptyFavorites();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.favorite_border, size: 48, color: AppColors.textTertiary),
            Gap(12),
            Text('No favourites yet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            Gap(4),
            Text('Tap the heart on a venue to save it here.', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}

class _FavoriteRow extends StatelessWidget {
  final Establishment est;
  const _FavoriteRow({required this.est});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/establishment/${est.id}'),
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
                child: est.imageUrl.isNotEmpty
                    ? Image.network(est.imageUrl, fit: BoxFit.cover, errorBuilder: (c, e, s) => Container(color: AppColors.border, child: const Icon(Icons.store, color: AppColors.textTertiary)))
                    : Container(color: AppColors.border, child: const Icon(Icons.store, color: AppColors.textTertiary)),
              ),
            ),
            const Gap(12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(est.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A)), maxLines: 1, overflow: TextOverflow.ellipsis),
                  const Gap(2),
                  Text('${est.type} · ${est.area}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            const Gap(8),
            DualScore(generalScore: est.score, plyByCohort: est.plyByCohort, plyCountByCohort: est.plyCountByCohort, compact: true),
            const Gap(8),
            FavoriteHeartButton(establishmentId: est.id),
          ],
        ),
      ),
    );
  }
}
