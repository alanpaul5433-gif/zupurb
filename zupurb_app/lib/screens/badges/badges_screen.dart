import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';

class BadgesScreen extends StatefulWidget {
  const BadgesScreen({super.key});

  @override
  State<BadgesScreen> createState() => _BadgesScreenState();
}

class _BadgesScreenState extends State<BadgesScreen> {
  int _tab = 0;
  // P2-13: Leaderboard tab removed — not in SOW
  final _tabs = ['Badges', 'Challenges'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), tooltip: 'Back', icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary, semanticLabel: 'Back')),
        title: const Text('Badges & Challenges'),
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: _tabs.asMap().entries.map((e) => Semantics(
                label: e.value,
                selected: _tab == e.key,
                button: true,
                child: GestureDetector(
                  onTap: () => setState(() => _tab = e.key),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    constraints: const BoxConstraints(minHeight: 44),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: _tab == e.key ? AppColors.primary : Colors.white,
                      borderRadius: BorderRadius.circular(100),
                      border: Border.all(color: _tab == e.key ? AppColors.primary : AppColors.border),
                    ),
                    child: Text(e.value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _tab == e.key ? Colors.white : AppColors.textPrimary)),
                  ),
                ),
              )).toList(),
            ),
            const Gap(20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('ACTIVE MILESTONE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.primary, letterSpacing: 0.5)),
                          Gap(2),
                          Text('Critic in progress', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                        ],
                      ),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('23/75', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                          Text('reviews', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                        ],
                      ),
                    ],
                  ),
                  const Gap(10),
                  Semantics(
                    label: '23 of 75 reviews completed',
                    child: LinearProgressIndicator(value: 23 / 75, backgroundColor: AppColors.border, color: AppColors.primary, minHeight: 6, borderRadius: BorderRadius.circular(3)),
                  ),
                  const Gap(8),
                  const Text('Write 52 more quality reviews to unlock the Master Critic tier and earn exclusive venue invites.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ],
              ),
            ),
            const Gap(16),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFFFFB347), Color(0xFFFFD700)], begin: Alignment.topLeft, end: Alignment.bottomRight), borderRadius: BorderRadius.circular(16)),
              child: Column(children: [
                Container(width: 56, height: 56, decoration: const BoxDecoration(color: Colors.white30, shape: BoxShape.circle), child: const Icon(Icons.star, color: Colors.white, size: 28)),
                const Gap(10),
                const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text('Founder Badge', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
                  Gap(8),
                  Chip(label: Text('LIFETIME', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFFB8860B))), backgroundColor: Colors.white, padding: EdgeInsets.symmetric(horizontal: 6), side: BorderSide.none),
                ]),
                const Gap(4),
                const Text("One of the first 150 members of Zupurb. We appreciate your early trust.", textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Colors.white)),
              ]),
            ),
            const Gap(20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Your Collection', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                const Text('4 Earned', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
              ],
            ),
            const Gap(12),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.3,
              children: [
                // P2-12: Removed duplicate "First Bite" — renamed second to "Explorer"
                _BadgeCard(icon: Icons.restaurant_menu, name: 'First Bite', status: 'EARNED', locked: false),
                _BadgeCard(icon: Icons.local_cafe, name: 'Taster', status: 'EARNED', locked: false),
                _BadgeCard(icon: Icons.explore, name: 'Explorer', status: '10 VISIT', locked: true),
                _BadgeCard(icon: Icons.rate_review_outlined, name: 'Critic', status: '75 REVIEW', locked: true),
              ],
            ),
            const Gap(20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Weekly Challenges', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                TextButton(onPressed: () {}, child: const Text('View All', style: TextStyle(color: AppColors.primary, fontSize: 13))),
              ],
            ),
            const Gap(10),
            _ChallengeCard(icon: Icons.bolt, title: 'Weekend Warrior', subtitle: 'Visit 3 new spots this Sat-Sun', progress: '4/5', points: '+150 PTS'),
            const Gap(8),
            _ChallengeCard(icon: Icons.receipt_long, title: 'Receipt Ready', subtitle: 'Upload your first 5 receipts', progress: '1/3', points: '+200 PTS'),
            const Gap(32),
          ],
        ),
      ),
    );
  }
}

class _BadgeCard extends StatelessWidget {
  final IconData icon;
  final String name;
  final String status;
  final bool locked;

  const _BadgeCard({required this.icon, required this.name, required this.status, required this.locked});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Stack(alignment: Alignment.topRight, children: [
          CircleAvatar(
            radius: 26,
            backgroundColor: locked ? AppColors.border : AppColors.primaryLight,
            child: Icon(icon, color: locked ? AppColors.textTertiary : AppColors.primary, size: 26),
          ),
          if (locked) const Icon(Icons.lock, size: 14, color: AppColors.textTertiary),
        ]),
        const Gap(8),
        Text(name, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: locked ? AppColors.textTertiary : AppColors.textPrimary)),
        Text(status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: locked ? AppColors.textTertiary : AppColors.primary, letterSpacing: 0.3)),
      ]),
    );
  }
}

class _ChallengeCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String progress;
  final String points;

  const _ChallengeCard({required this.icon, required this.title, required this.subtitle, required this.progress, required this.points});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Container(width: 44, height: 44, decoration: BoxDecoration(color: AppColors.primary, shape: BoxShape.circle), child: Icon(icon, color: Colors.white, size: 22)),
        const Gap(12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(progress, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary)),
          Text(points, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary)),
        ]),
      ]),
    );
  }
}
