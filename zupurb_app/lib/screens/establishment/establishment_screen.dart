import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/score_badge.dart';
import '../../core/utils/age_gate_guard.dart';
import '../../state/establishments/establishments_provider.dart';
import '../../state/reviews/reviews_provider.dart';
import '../../models/establishment.dart';
import '../../models/review.dart';

// Tags that require age verification.
const _kRestrictedTags = {'nightlife', 'bar', 'club', 'lounge'};

bool _establishmentRequiresAgeGate(Establishment? est) {
  if (est == null) return false;
  if (est.hasAlcohol) return true;
  return est.tags.any((tag) => _kRestrictedTags.contains(tag.toLowerCase()));
}

// Numeric legacy IDs (e.g. '1') map to the canonical Firestore document ID.
String _resolveEstId(String rawId) {
  const legacyMap = {
    '1': 'social-lounge',
    '2': 'rooftop-garden',
    '3': 'amber-bistro',
    '4': 'velvet-lounge',
    '5': 'atrium-cafe',
    '6': 'bloom-gardenia',
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

    // Trigger age gate once establishment data arrives.
    estAsync.whenData((est) {
      if (!_ageGateChecked) {
        _ageGateChecked = true;
        WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShowAgeGate(est));
      }
    });

    return estAsync.when(
      loading: () => _buildScaffold(context, reviewsAsync, null),
      error: (err, _) => _buildScaffold(context, reviewsAsync, null),
      data: (est) => _buildScaffold(context, reviewsAsync, est),
    );
  }

  Widget _buildScaffold(BuildContext context, AsyncValue<List<Review>> reviewsAsync, Establishment? est) {
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
                      ScoreBadge(score: score, size: 48),
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
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(12)),
                    child: const Row(
                      children: [
                        Icon(Icons.people_outline, color: AppColors.primary, size: 18),
                        Gap(8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('From People Like You: 9.1', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary)),
                              Text('Rated higher by users with your background', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Gap(16),
                  Row(
                    children: [
                      Expanded(child: AppButton(label: 'Write a Review', onTap: () => context.push('/review/verify'))),
                      const Gap(10),
                      Expanded(child: AppButton(label: 'Reserve', onTap: () => context.push('/reservation/slots'))),
                    ],
                  ),
                  const Gap(20),
                  const Text('Active Deals', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                  const Gap(10),
                  const _DealCard(
                    label: 'Free Appetizer',
                    description: 'Free appetizer with any entree purchase',
                    points: 800,
                  ),
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

  const _DealCard({required this.label, required this.description, required this.points});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Deal details coming soon'), duration: Duration(seconds: 2))),
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
