import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';

class SearchResultsScreen extends StatelessWidget {
  const SearchResultsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding, vertical: 12),
              child: Container(
                height: 48,
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(100), border: Border.all(color: AppColors.border)),
                child: Row(
                  children: [
                    const Gap(16),
                    const Icon(Icons.search, color: AppColors.primary, size: 20),
                    const Gap(8),
                    const Expanded(child: Text('Search experiences, creators...', style: TextStyle(fontSize: 14, color: AppColors.textTertiary))),
                    IconButton(
                      icon: const Icon(Icons.tune, color: AppColors.primary, size: 20),
                      onPressed: () {},
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
              child: Row(
                children: [
                  const Text('Cravings Found Nearby', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                ],
              ),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
              child: Text('14 Results · Sorted By Best Match', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            ),
            const Gap(12),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                children: [
                  _ResultCard(
                    name: 'El Pueblo Mexican Grill',
                    type: 'Mexican · Casual · 0.8 km',
                    fpyl: '4.7 / 5',
                    tags: ['#Tacos', '#BBQ', '#FamilyFriendly'],
                    imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800',
                    hasActiveDeal: true,
                  ),
                  const Gap(16),
                  _ResultCard(
                    name: 'El Pueblo Mexican Grill',
                    type: 'Mexican · Casual · 0.8 km',
                    fpyl: '4.7 / 5',
                    tags: ['#Tacos', '#BBQ', '#FamilyFriendly'],
                    imageUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800',
                    hasActiveDeal: true,
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

class _ResultCard extends StatelessWidget {
  final String name;
  final String type;
  final String fpyl;
  final List<String> tags;
  final String imageUrl;
  final bool hasActiveDeal;

  const _ResultCard({
    required this.name,
    required this.type,
    required this.fpyl,
    required this.tags,
    required this.imageUrl,
    this.hasActiveDeal = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/establishment/1'),
      child: Container(
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), color: Colors.white),
        child: Column(
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                  child: Image.network(imageUrl, height: 160, width: double.infinity, fit: BoxFit.cover),
                ),
                if (hasActiveDeal)
                  Positioned(
                    bottom: 10,
                    left: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: const Color(0xFFFFE4B5), borderRadius: BorderRadius.circular(6)),
                      child: const Text('ACTIVE DEAL – 800 PTS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFFB8860B))),
                    ),
                  ),
                Positioned(
                  top: 10,
                  right: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(8)),
                    child: const Text('4.8 / 5', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(6)),
                        child: const Text('OPEN', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF4CAF50))),
                      ),
                    ],
                  ),
                  const Gap(2),
                  Text(type, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  const Gap(6),
                  Row(children: [
                    const Icon(Icons.people_outline, size: 14, color: AppColors.primary),
                    const Gap(4),
                    Text('From People Like You: $fpyl', style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w500)),
                  ]),
                  const Gap(8),
                  Wrap(
                    spacing: 6,
                    children: tags.map((t) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(6)),
                      child: Text(t, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                    )).toList(),
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
