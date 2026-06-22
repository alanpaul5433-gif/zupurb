import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';
import '../../state/reviews/review_draft_provider.dart';
import '../../core/services/review_photo_service.dart';

class VerifyVisitScreen extends ConsumerStatefulWidget {
  const VerifyVisitScreen({super.key});

  @override
  ConsumerState<VerifyVisitScreen> createState() => _VerifyVisitScreenState();
}

class _VerifyVisitScreenState extends ConsumerState<VerifyVisitScreen> {
  int _selected = 2;
  final _photoUrls = <String>[];
  bool _uploading = false;

  Future<void> _pickPhotos() async {
    if (_uploading) return;
    setState(() => _uploading = true);
    try {
      final urls = await ReviewPhotoService().pickAndUpload(maxImages: 3);
      if (urls.isNotEmpty) {
        setState(() {
          _photoUrls
            ..clear()
            ..addAll(urls);
        });
        ref.read(reviewDraftProvider.notifier).setPhotoUrls(_photoUrls);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not upload photos. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final estName = ref.watch(reviewDraftProvider).estName;
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary)),
        title: Text(estName.isEmpty ? 'Write a Review' : estName),
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LinearProgressIndicator(value: 1 / 8, backgroundColor: AppColors.border, color: AppColors.primary),
                  const Gap(8),
                  const Text('STEP 1 OF 8', style: TextStyle(fontSize: 10, color: AppColors.textTertiary, letterSpacing: 0.5)),
                  const Gap(20),
                  const Text('Verify Your Visit', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                  const Gap(6),
                  const Text('Verified visits earn more points and carry more weight in the score.', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  const Gap(20),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                    child: const Row(
                      children: [
                        CircleAvatar(radius: 22, backgroundImage: NetworkImage('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=100')),
                        Gap(12),
                        Expanded(child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('The Social Lounge', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                            Text('Downtown LA · Restaurant', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          ],
                        )),
                        Text('Reviewing', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                  const Gap(16),
                  _VerificationOption(
                    index: 0,
                    selected: _selected == 0,
                    icon: Icons.verified_outlined,
                    title: 'Verified Visit',
                    badge: 'RECOMMENDED',
                    subtitle: 'Add photos of your visit',
                    points: 75,
                    highlighted: _selected == 0,
                    onTap: () => setState(() => _selected = 0),
                  ),
                  const Gap(10),
                  _VerificationOption(
                    index: 1,
                    selected: _selected == 1,
                    icon: Icons.photo_camera_outlined,
                    title: 'Partially Verified',
                    subtitle: 'Add a photo (no receipt)',
                    points: 75,
                    onTap: () => setState(() => _selected = 1),
                  ),
                  const Gap(10),
                  _VerificationOption(
                    index: 2,
                    selected: _selected == 2,
                    icon: Icons.image_outlined,
                    title: 'Unverified',
                    subtitle: 'Trust-based contribution',
                    points: 25,
                    onTap: () => setState(() => _selected = 2),
                  ),
                  const Gap(20),
                  if (_selected != 2) ...[
                    GestureDetector(
                      onTap: _uploading ? null : _pickPhotos,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: _photoUrls.isNotEmpty ? AppColors.primary : AppColors.border),
                        ),
                        child: Column(
                          children: [
                            if (_uploading) ...[
                              const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.primary)),
                              const Gap(10),
                              const Text('Uploading…', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                            ] else if (_photoUrls.isNotEmpty) ...[
                              const Icon(Icons.check_circle, color: AppColors.primary, size: 36),
                              const Gap(8),
                              Text('${_photoUrls.length} photo${_photoUrls.length == 1 ? '' : 's'} added', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                              const Gap(4),
                              const Text('Tap to change', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                            ] else ...[
                              const Icon(Icons.add_a_photo_outlined, color: AppColors.primary, size: 36),
                              const Gap(8),
                              const Text('Add photos of your visit', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                              const Gap(4),
                              const Text('JPG, PNG or WebP · up to 3 photos', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                            ],
                          ],
                        ),
                      ),
                    ),
                    if (_photoUrls.isNotEmpty) ...[
                      const Gap(8),
                      SizedBox(
                        height: 64,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _photoUrls.length,
                          separatorBuilder: (_, __) => const Gap(8),
                          itemBuilder: (_, i) => ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network(_photoUrls[i], width: 64, height: 64, fit: BoxFit.cover,
                                errorBuilder: (c, e, s) => Container(width: 64, height: 64, color: AppColors.border)),
                          ),
                        ),
                      ),
                    ],
                  ],
                  const Gap(24),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppDimens.screenPadding),
            child: AppButton(
              label: 'Continue',
              onTap: () {
                if (_selected != 2 && _photoUrls.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Add at least one photo to verify your visit, or pick Unverified.'), duration: Duration(seconds: 2)),
                  );
                  return;
                }
                final notifier = ref.read(reviewDraftProvider.notifier);
                notifier.setTier(_selected);
                notifier.setPhotoUrls(_selected == 2 ? <String>[] : _photoUrls);
                context.push('/review/rate');
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _VerificationOption extends StatelessWidget {
  final int index;
  final bool selected;
  final IconData icon;
  final String title;
  final String? badge;
  final String subtitle;
  final int points;
  final bool highlighted;
  final bool comingSoon;
  final VoidCallback onTap;

  const _VerificationOption({
    required this.index,
    required this.selected,
    required this.icon,
    required this.title,
    this.badge,
    required this.subtitle,
    required this.points,
    this.highlighted = false,
    this.comingSoon = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? AppColors.primary : AppColors.border, width: selected ? 1.5 : 1),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: AppColors.primaryLight, shape: BoxShape.circle),
              child: Icon(icon, color: AppColors.primary, size: 20),
            ),
            const Gap(12),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  if (badge != null) ...[
                    const Gap(6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(4)),
                      child: Text(badge!, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.white)),
                    ),
                  ],
                ]),
                Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              ],
            )),
            comingSoon
                ? const Text('Soon', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textTertiary))
                : Text('$points pts', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}
