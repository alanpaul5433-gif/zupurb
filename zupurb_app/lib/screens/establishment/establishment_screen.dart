import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/score_badge.dart';
import '../../core/utils/age_gate_guard.dart';
import '../../state/establishments/establishments_provider.dart';
import '../../state/reviews/reviews_provider.dart';
import '../../state/deals/deals_provider.dart';
import '../../models/establishment.dart';
import '../../models/menu_item.dart';
import '../../models/review.dart';
import '../../models/deal.dart';
import '../../widgets/favorite_heart_button.dart';
import '../../widgets/dual_score.dart';
import '../../state/reviews/review_draft_provider.dart';

// --------------------------------------------------------------------------
// Menu item photo helpers
// --------------------------------------------------------------------------

/// Deterministic photo URL for well-known menu item names.
const _kMenuItemPhotos = <String, String>{
  'Truffle Burrata': 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=400&q=80',
  'Crispy Calamari': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&q=80',
  'Wood-Fired Salmon': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&q=80',
  'Dry-Aged Ribeye': 'https://images.unsplash.com/photo-1546964124-0cce460f38ef?w=400&q=80',
  'Wild Mushroom Risotto': 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400&q=80',
  'Smoked Old Fashioned': 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&q=80',
  'Garden Spritz': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80',
  'Dark Chocolate Torte': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80',
};

/// Generic fallback photos by category.
const _kCategoryFallbacks = <String, String>{
  'Starters': 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=400&q=80',
  'Mains': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80',
  'Drinks': 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&q=80',
  'Desserts': 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=400&q=80',
};

/// Resolves the best available photo URL for a [MenuItem].
String _menuItemPhotoUrl(MenuItem item) {
  if (item.imageUrl.isNotEmpty) return item.imageUrl;
  final byName = _kMenuItemPhotos[item.name];
  if (byName != null) return byName;
  return _kCategoryFallbacks[item.category] ??
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80';
}

/// Thumbnail widget for a menu item. Falls back gracefully on load error.
class _MenuItemThumbnail extends StatelessWidget {
  final String url;
  const _MenuItemThumbnail({required this.url});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: Image.network(
        url,
        width: 56,
        height: 56,
        fit: BoxFit.cover,
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return Container(
            width: 56,
            height: 56,
            color: AppColors.border,
            child: const Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textTertiary),
              ),
            ),
          );
        },
        errorBuilder: (context, error, stackTrace) => Container(
          width: 56,
          height: 56,
          color: AppColors.border,
          child: const Icon(Icons.restaurant, size: 22, color: AppColors.textTertiary),
        ),
      ),
    );
  }
}

// Tags that require age verification.
const _kRestrictedTags = {'nightlife', 'bar', 'club', 'lounge'};

bool _establishmentRequiresAgeGate(Establishment? est) {
  if (est == null) return false;
  if (est.hasAlcohol) return true;
  return est.tags.any((tag) => _kRestrictedTags.contains(tag.toLowerCase()));
}

// Numeric legacy IDs (e.g. '1') map to a real seeded Firestore document ID so
// placeholder/fallback navigation never lands on a non-existent establishment
// (which would make Reserve / Write a Review fail backend not-found).
String _resolveEstId(String rawId) {
  const legacyMap = {
    '1': 'the-social-lounge',
    '2': 'bloom-gardenia',
    '3': 'amber-ember',
    '4': 'brooklyn-smokehouse',
    '5': 'the-atrium-cafe',
    '6': 'the-gilded-owl',
    'social-lounge': 'the-social-lounge',
    'atrium-cafe': 'the-atrium-cafe',
  };
  return legacyMap[rawId] ?? rawId;
}

class EstablishmentScreen extends ConsumerStatefulWidget {
  final String id;
  const EstablishmentScreen({super.key, required this.id});

  @override
  ConsumerState<EstablishmentScreen> createState() =>
      _EstablishmentScreenState();
}

class _EstablishmentScreenState extends ConsumerState<EstablishmentScreen> {
  bool _ageGateChecked = false;

  String get _estId => _resolveEstId(widget.id);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_ageGateChecked) {
      _ageGateChecked = true;
      // Age gate check deferred; runs after first build with real data.
    }
  }

  Future<void> _maybeShowAgeGate(Establishment? est) async {
    if (_establishmentRequiresAgeGate(est)) {
      final allowed = await checkAgeGate(context, ref);
      if (!allowed && mounted) Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final estAsync = ref.watch(establishmentProvider(_estId));
    final reviewsAsync = ref.watch(establishmentReviewsProvider(_estId));
    final dealsAsync = ref.watch(establishmentDealsProvider(_estId));
    final menuAsync = ref.watch(establishmentMenuProvider(_estId));

    // Trigger age gate once establishment data arrives.
    estAsync.whenData((est) {
      if (!_ageGateChecked) {
        _ageGateChecked = true;
        WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShowAgeGate(est));
      }
    });

    return estAsync.when(
      loading: () => _buildScaffold(context, reviewsAsync, dealsAsync, menuAsync, null),
      error: (err, _) => _buildScaffold(context, reviewsAsync, dealsAsync, menuAsync, null),
      data: (est) => _buildScaffold(context, reviewsAsync, dealsAsync, menuAsync, est),
    );
  }

  List<Widget> _buildMenuCategories(List<MenuItem> items) {
    // Items are pre-sorted by category then sortOrder from the provider.
    final categories = <String>[];
    for (final item in items) {
      if (!categories.contains(item.category)) categories.add(item.category);
    }
    final result = <Widget>[];
    for (final cat in categories) {
      final catItems = items.where((i) => i.category == cat).toList();
      result.add(
        Container(
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
                child: Text(
                  cat.toUpperCase(),
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textSecondary, letterSpacing: 0.8),
                ),
              ),
              for (int i = 0; i < catItems.length; i++) ...[
                if (i > 0)
                  const Divider(height: 1, indent: 14, endIndent: 14),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _MenuItemThumbnail(url: _menuItemPhotoUrl(catItems[i])),
                      const Gap(12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(catItems[i].name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1A1A1A))),
                            if (catItems[i].description.isNotEmpty) ...[
                              const Gap(2),
                              Text(catItems[i].description, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary), maxLines: 2, overflow: TextOverflow.ellipsis),
                            ],
                          ],
                        ),
                      ),
                      const Gap(12),
                      Text(catItems[i].priceLabel, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      );
      result.add(const Gap(8));
    }
    return result;
  }

  Widget _buildScaffold(BuildContext context, AsyncValue<List<Review>> reviewsAsync, AsyncValue<List<Deal>> dealsAsync, AsyncValue<List<MenuItem>> menuAsync, Establishment? est) {
    final name = est?.name ?? 'The Social Lounge';
    final typeArea = est != null ? '${est.type} · ${est.area}' : 'Restaurant & Bar · Downtown LA';
    final score = est?.score ?? 4.4;
    final openUntil = est?.openUntil ?? '11 PM';
    final priceRange = est?.priceRange ?? '\$\$';
    final distanceKm = est?.distanceKm ?? 1.2;
    final imageUrl = est?.imageUrl.isNotEmpty == true
        ? est!.imageUrl
        : 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800';

    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 220,
            floating: false,
            pinned: true,
            backgroundColor: const Color(0xFFF5F0ED),
            leading: IconButton(
              onPressed: () => context.pop(),
              tooltip: 'Back',
              icon: const CircleAvatar(backgroundColor: Colors.white, child: Icon(Icons.arrow_back_ios, size: 16, color: AppColors.textPrimary)),
            ),
            actions: [
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: CircleAvatar(
                  backgroundColor: Colors.white,
                  child: FavoriteHeartButton(establishmentId: _estId, size: 20),
                ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (ctx, err, stack) => Container(color: AppColors.border),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Gap(16),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                            const Gap(4),
                            Text(typeArea, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                          ],
                        ),
                      ),
                      DualScore(generalScore: score, plyByCohort: est?.plyByCohort, plyCountByCohort: est?.plyCountByCohort, badgeSize: 48),
                    ],
                  ),
                  const Gap(12),
                  Row(
                    children: [
                      _InfoChip(icon: Icons.access_time, label: 'Open until $openUntil'),
                      const Gap(8),
                      _InfoChip(icon: Icons.attach_money, label: priceRange),
                      const Gap(8),
                      _InfoChip(icon: Icons.location_on_outlined, label: '${distanceKm.toStringAsFixed(1)} km'),
                    ],
                  ),
                  const Gap(16),
                  Row(
                    children: [
                      Expanded(child: AppButton(label: 'Write a Review', onTap: () { ref.read(reviewDraftProvider.notifier).start(_estId, name); context.push('/review/verify'); })),
                      const Gap(10),
                      Expanded(child: AppButton(label: 'Reserve', onTap: () => context.push('/reservation/slots', extra: {'estId': _estId, 'estName': est?.name ?? 'Venue', 'imageUrl': est?.imageUrl ?? ''}))),
                    ],
                  ),
                  // Active Deals — shown only when the venue has active deals.
                  ...dealsAsync.maybeWhen(
                    data: (deals) => deals.isEmpty
                        ? <Widget>[]
                        : <Widget>[
                            const Gap(20),
                            const Text('Active Deals', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                            const Gap(10),
                            for (final d in deals) ...[
                              _DealCard(
                                label: d.title,
                                description: d.description,
                                points: d.pointCost,
                                onTap: () => context.push('/deal/detail', extra: d),
                              ),
                              const Gap(8),
                            ],
                          ],
                    orElse: () => <Widget>[],
                  ),
                  // Menu — grouped by category; hidden when empty.
                  ...menuAsync.maybeWhen(
                    data: (items) => items.isEmpty
                        ? <Widget>[]
                        : <Widget>[
                            const Gap(20),
                            const Text('Menu', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                            const Gap(10),
                            ..._buildMenuCategories(items),
                          ],
                    orElse: () => <Widget>[],
                  ),
                  // Location section — only once the venue has loaded.
                  if (est != null) ...[
                    const Gap(20),
                    const Text('Location', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                    const Gap(10),
                    _LocationCard(est: est),
                  ],
                  const Gap(20),
                  const Text('Recent Reviews', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                  const Gap(10),
                  reviewsAsync.when(
                    loading: () => Column(children: const [
                      _ReviewRow(name: 'Sarah M.', score: 4.2, text: 'Had an incredible dinner here last night...', time: '2d ago'),
                      Gap(8),
                      _ReviewRow(name: 'Marcus T.', score: 4.5, text: 'Excellent cocktails and great atmosphere...', time: '5d ago'),
                    ]),
                    error: (err, _) => Column(children: const [
                      _ReviewRow(name: 'Sarah M.', score: 4.2, text: 'Had an incredible dinner here last night...', time: '2d ago'),
                    ]),
                    data: (reviews) {
                      if (reviews.isEmpty) {
                        return const _ReviewRow(name: 'Sarah M.', score: 4.2, text: 'Had an incredible dinner here last night...', time: '2d ago');
                      }
                      return Column(
                        children: reviews
                            .map((r) => Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: _ReviewRow(
                                    name: r.authorName,
                                    score: r.score,
                                    text: r.text,
                                    time: '',
                                    photoUrl: r.authorPhotoUrl,
                                  ),
                                ))
                            .toList(),
                      );
                    },
                  ),
                  const Gap(32),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LocationCard extends StatelessWidget {
  final Establishment? est;
  const _LocationCard({required this.est});

  Future<void> _openMaps() async {
    final Uri uri;
    if (est != null && est!.lat != null && est!.lng != null) {
      uri = Uri.parse(
        'https://www.google.com/maps/search/?api=1&query=${est!.lat},${est!.lng}',
      );
    } else {
      final query = Uri.encodeComponent('${est?.name ?? ''} ${est?.area ?? ''}');
      uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$query');
    }
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      // Silently fail — no Maps key required, best-effort.
    }
  }

  @override
  Widget build(BuildContext context) {
    final area = est?.area ?? '';
    final address = est?.address ?? '';
    final lat = est?.lat;
    final lng = est?.lng;
    final hasCoords = lat != null && lng != null;

    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Embedded OSM map — only when coordinates are available.
          if (hasCoords) ...[
            SizedBox(
              height: 160,
              child: FlutterMap(
                options: MapOptions(
                  initialCenter: LatLng(lat, lng),
                  initialZoom: 15.0,
                  interactionOptions: const InteractionOptions(
                    flags: InteractiveFlag.pinchZoom | InteractiveFlag.drag,
                  ),
                ),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.zupurb.app',
                    maxNativeZoom: 19,
                  ),
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: LatLng(lat, lng),
                        width: 36,
                        height: 36,
                        child: const DecoratedBox(
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(Icons.location_on, color: Colors.white, size: 22),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const ExcludeSemantics(child: Icon(Icons.location_on_outlined, size: 16, color: AppColors.primary)),
                    const Gap(6),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (area.isNotEmpty)
                            Text(area, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1A1A1A))),
                          if (address.isNotEmpty)
                            Text(address, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                  ],
                ),
                const Gap(12),
                GestureDetector(
                  onTap: _openMaps,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Center(
                      child: Text(
                        'Open in Maps',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _InfoChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(100), border: Border.all(color: AppColors.border)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ExcludeSemantics(child: Icon(icon, size: 13, color: AppColors.textSecondary)),
          const Gap(4),
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textPrimary, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

class _DealCard extends StatelessWidget {
  final String label;
  final String description;
  final int points;
  final VoidCallback? onTap;

  const _DealCard({required this.label, required this.description, required this.points, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap ?? () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Deal details coming soon'), duration: Duration(seconds: 2))),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: Row(
          children: [
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(6)),
                  child: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary)),
                ),
                const Gap(6),
                Text(description, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                const Gap(4),
                Text('$points pts', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600)),
              ],
            )),
            const ExcludeSemantics(child: Icon(Icons.chevron_right, color: AppColors.textTertiary)),
          ],
        ),
      ),
    );
  }
}

class _ReviewRow extends StatelessWidget {
  final String name;
  final double score;
  final String text;
  final String time;
  final String? photoUrl;

  const _ReviewRow({required this.name, required this.score, required this.text, required this.time, this.photoUrl});

  @override
  Widget build(BuildContext context) {
    final avatarUrl = (photoUrl != null && photoUrl!.isNotEmpty)
        ? photoUrl!
        : 'https://i.pravatar.cc/150?img=44';
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            CircleAvatar(radius: 16, backgroundImage: NetworkImage(avatarUrl), onBackgroundImageError: (e, s) {}),
            const Gap(8),
            Expanded(child: Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
            ScoreBadge(score: score, size: 32),
          ]),
          const Gap(8),
          Text(text, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary), maxLines: 2, overflow: TextOverflow.ellipsis),
          if (time.isNotEmpty) ...[
            const Gap(4),
            Text(time, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
          ],
        ],
      ),
    );
  }
}
