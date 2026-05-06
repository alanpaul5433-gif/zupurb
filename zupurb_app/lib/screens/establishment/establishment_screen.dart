import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/score_badge.dart';

class EstablishmentScreen extends StatelessWidget {
  const EstablishmentScreen({super.key});

  @override
  Widget build(BuildContext context) {
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
              icon: const CircleAvatar(backgroundColor: Colors.white, child: Icon(Icons.arrow_back_ios, size: 16, color: AppColors.textPrimary)),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: Image.network(
                'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
                fit: BoxFit.cover,
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
                            const Text('The Social Lounge', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                            const Gap(4),
                            const Text('Restaurant & Bar · Downtown LA', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                          ],
                        ),
                      ),
                      const ScoreBadge(score: 4.4, size: 48),
                    ],
                  ),
                  const Gap(12),
                  Row(
                    children: [
                      _InfoChip(icon: Icons.access_time, label: 'Open until 11 PM'),
                      const Gap(8),
                      _InfoChip(icon: Icons.attach_money, label: '\$\$'),
                      const Gap(8),
                      _InfoChip(icon: Icons.location_on_outlined, label: '1.2 km'),
                    ],
                  ),
                  const Gap(16),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      children: [
                        const Icon(Icons.people_outline, color: AppColors.primary, size: 18),
                        const Gap(8),
                        const Expanded(
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
                      Expanded(child: AppButton(label: 'Write a Review', onTap: () => context.go('/review/verify'))),
                      const Gap(10),
                      Expanded(child: AppButton(label: 'Reserve', onTap: () => context.go('/reservation/slots'))),
                    ],
                  ),
                  const Gap(20),
                  const Text('Active Deals', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                  const Gap(10),
                  _DealCard(
                    label: 'Free Appetizer',
                    description: 'Free appetizer with any entree purchase',
                    points: 800,
                  ),
                  const Gap(20),
                  const Text('Recent Reviews', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                  const Gap(10),
                  _ReviewRow(
                    name: 'Sarah M.',
                    score: 8.4,
                    text: 'Had an incredible dinner here last night...',
                    time: '2d ago',
                  ),
                  const Gap(8),
                  _ReviewRow(
                    name: 'Marcus T.',
                    score: 9.0,
                    text: 'Excellent cocktails and great atmosphere...',
                    time: '5d ago',
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
          Icon(icon, size: 13, color: AppColors.textSecondary),
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
    return Container(
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
          const Icon(Icons.chevron_right, color: AppColors.textTertiary),
        ],
      ),
    );
  }
}

class _ReviewRow extends StatelessWidget {
  final String name;
  final double score;
  final String text;
  final String time;

  const _ReviewRow({required this.name, required this.score, required this.text, required this.time});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const CircleAvatar(radius: 16, backgroundImage: NetworkImage('https://randomuser.me/api/portraits/women/44.jpg')),
            const Gap(8),
            Expanded(child: Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
            ScoreBadge(score: score, size: 32),
          ]),
          const Gap(8),
          Text(text, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary), maxLines: 2, overflow: TextOverflow.ellipsis),
          const Gap(4),
          Text(time, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
        ],
      ),
    );
  }
}
