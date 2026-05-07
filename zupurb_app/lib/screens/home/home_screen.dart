import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/score_badge.dart';
import '../../widgets/points_chip.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tabIndex = 0;
  final _tabs = ['All', 'Reviews', 'Feed', 'Creators', 'Deals'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Gap(12),
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 20,
                          backgroundColor: AppColors.border,
                          child: const Icon(Icons.person, color: AppColors.textTertiary),
                        ),
                        const Gap(10),
                        const Text('Zupurb', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                        const Spacer(),
                        IconButton(
                          onPressed: () => context.go('/notifications'),
                          tooltip: 'Notifications',
                          icon: const Icon(Icons.notifications_outlined, color: AppColors.textPrimary),
                        ),
                      ],
                    ),
                    const Gap(14),
                    _SearchBar(),
                    const Gap(16),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: _tabs.asMap().entries.map((e) => GestureDetector(
                          onTap: () => setState(() => _tabIndex = e.key),
                          child: Container(
                            margin: const EdgeInsets.only(right: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
                            decoration: BoxDecoration(
                              color: _tabIndex == e.key ? AppColors.primary : Colors.white,
                              borderRadius: BorderRadius.circular(100),
                              border: Border.all(color: _tabIndex == e.key ? AppColors.primary : AppColors.border),
                            ),
                            child: Text(e.value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _tabIndex == e.key ? Colors.white : AppColors.textPrimary)),
                          ),
                        )).toList(),
                      ),
                    ),
                    const Gap(16),
                    _DealsBanner(),
                    const Gap(20),
                    const Text('Recent Reviews', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                    const Gap(12),
                    _ReviewCard(),
                    const Gap(24),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchBar extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Search experiences and creators',
      button: true,
      child: GestureDetector(
        onTap: () => context.go('/search'),
        child: Container(
          height: 48,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(100),
            border: Border.all(color: AppColors.border),
          ),
          child: const Row(
            children: [
              Gap(16),
              Icon(Icons.search, color: AppColors.primary, size: 20),
              Gap(8),
              Text('Search experiences, creators...', style: TextStyle(fontSize: 14, color: AppColors.textTertiary)),
            ],
          ),
        ),
      ),
    );
  }
}

class _DealsBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 130,
      child: Row(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('The Social\nLounge', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A), height: 1.2)),
                  const Gap(4),
                  const Text('Free Dessert with\nEntree', style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w500)),
                  const Spacer(),
                  const PointsChip(points: 750),
                ],
              ),
            ),
          ),
          const Gap(8),
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                image: const DecorationImage(
                  image: NetworkImage('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'),
                  fit: BoxFit.cover,
                ),
              ),
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: Colors.black38,
                ),
                padding: const EdgeInsets.all(10),
                child: const Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Establishment Safe Work...', style: TextStyle(fontSize: 10, color: Colors.white70)),
                  ],
                ),
              ),
            ),
          ),
          const Gap(8),
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Bloom\nGardenia', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A), height: 1.2)),
                  const Gap(4),
                  const Text('20% Off Signature\nCocktails', style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w500)),
                  const Spacer(),
                  const PointsChip(points: 750),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Row(
              children: [
                const CircleAvatar(
                  radius: 20,
                  backgroundImage: NetworkImage('https://randomuser.me/api/portraits/women/44.jpg'),
                ),
                const Gap(10),
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Sarah M.', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    const Text('The Social Lounge • Restaurant', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ],
                )),
                const ScoreBadge(score: 4.2),
              ],
            ),
          ),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Icon(Icons.auto_awesome, color: AppColors.primary, size: 14),
                  Gap(6),
                  Text('AI SUMMARY', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary, letterSpacing: 0.5)),
                ]),
                Gap(6),
                Text('Vibrant atmosphere with exceptional service. The seafood selection stands out as the main highlight.', style: TextStyle(fontSize: 13, color: Color(0xFF444444))),
              ],
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Text(
              'Had an incredible dinner here last night. The ambiance is exactly what we were looking for modern, dimly lit but still energetic. The scallops were perfectly seared and the...',
              style: TextStyle(fontSize: 13, color: Color(0xFF444444), height: 1.5),
            ),
          ),
          const Gap(12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _CircleImage('https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=100'),
                const Gap(6),
                _CircleImage('https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=100'),
                const Gap(6),
                _CircleImage('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=100'),
              ],
            ),
          ),
          const Gap(12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(100),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.verified, color: AppColors.primary, size: 14),
                  Gap(4),
                  Text('Hosted Experience', style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
          ),
          const Gap(12),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Row(
              children: [
                Semantics(
                  label: 'Helpful — 24 votes',
                  button: true,
                  child: const SizedBox(
                    width: 44,
                    height: 44,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.thumb_up_outlined, size: 18, color: AppColors.textSecondary),
                        Gap(4),
                        Text('24', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                ),
                const Gap(8),
                Semantics(
                  label: 'Not helpful',
                  button: true,
                  child: const SizedBox(
                    width: 44,
                    height: 44,
                    child: Center(child: Icon(Icons.thumb_down_outlined, size: 18, color: AppColors.textSecondary)),
                  ),
                ),
                const Gap(8),
                Semantics(
                  label: 'Share review',
                  button: true,
                  child: const SizedBox(
                    width: 44,
                    height: 44,
                    child: Center(child: Icon(Icons.share_outlined, size: 18, color: AppColors.textSecondary)),
                  ),
                ),
                const Spacer(),
                Semantics(
                  label: 'More options',
                  button: true,
                  child: const SizedBox(
                    width: 44,
                    height: 44,
                    child: Center(child: Icon(Icons.more_horiz, size: 20, color: AppColors.textTertiary)),
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

class _CircleImage extends StatelessWidget {
  final String url;
  const _CircleImage(this.url);

  @override
  Widget build(BuildContext context) => CircleAvatar(
    radius: 28,
    backgroundImage: NetworkImage(url),
  );
}

