import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';

class OwnProfileScreen extends StatefulWidget {
  const OwnProfileScreen({super.key});

  @override
  State<OwnProfileScreen> createState() => _OwnProfileScreenState();
}

class _OwnProfileScreenState extends State<OwnProfileScreen> {
  int _tab = 0;
  final _tabs = ['Posts', 'Reels', 'Reviews', 'Places Visited'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding, vertical: 12),
                    child: Row(
                      children: [
                        IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20)),
                        const Spacer(),
                        const Text('My Profile', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                        const Spacer(),
                        GestureDetector(
                          onTap: () => context.push('/points'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(100)),
                            child: Row(children: [
                              const Icon(Icons.monetization_on, size: 12, color: AppColors.primary),
                              const Gap(4),
                              IconButton(
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                                onPressed: () => context.push('/notifications'),
                                icon: const Icon(Icons.notifications_outlined, size: 18, color: AppColors.textPrimary),
                              ),
                            ]),
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(
                    height: 90,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        CircleAvatar(
                          radius: 45,
                          backgroundImage: const NetworkImage('https://i.pravatar.cc/150?img=68'),
                          onBackgroundImageError: (e, s) {},
                        ),
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: Container(
                            width: 24, height: 24,
                            decoration: BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                            child: Icon(Icons.add, color: Colors.white, size: 16),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Gap(12),
                  const Text('Alan Paul', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                  const Text('@alanpaul', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  const Gap(12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      OutlinedButton(
                        onPressed: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Edit profile coming soon'), duration: Duration(seconds: 2))),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(110, 38),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                          side: const BorderSide(color: AppColors.border),
                        ),
                        child: const Text('Edit Profile', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                      ),
                      const Gap(8),
                      OutlinedButton(
                        onPressed: () => context.push('/settings'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(110, 38),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                          side: const BorderSide(color: AppColors.border),
                        ),
                        child: const Text('Settings', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                      ),
                    ],
                  ),
                  const Gap(16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _StatCol('412', 'REVIEWS'),
                      _StatCol('8.4K', 'FOLLOWERS'),
                      _StatCol('203', 'FOLLOWING'),
                    ],
                  ),
                  const Gap(16),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(12)),
                    child: Row(children: [
                      const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('REWARDS BALANCE', style: TextStyle(fontSize: 10, color: Colors.white70, letterSpacing: 0.5)),
                        Gap(4),
                        Text('1,847 pts', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Colors.white)),
                        Text('Est. value \$5.54', style: TextStyle(fontSize: 12, color: Colors.white70)),
                      ])),
                      ElevatedButton(
                        onPressed: () => context.push('/redeem'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: AppColors.primary,
                          minimumSize: const Size(80, 36),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                          elevation: 0,
                        ),
                        child: const Text('Redeem', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      ),
                    ]),
                  ),
                  const Gap(16),
                  const Text('Achievement Badges', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                  const Gap(10),
                  // P1-8: SOW §13.1 badge names only — removed invented "Verified", "Local Guide", "Connoisseur"
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _BadgeIcon(Icons.restaurant_menu, 'Taster'),
                      _BadgeIcon(Icons.star, 'Founder'),
                      _BadgeIcon(Icons.local_cafe, 'First Bite'),
                      _BadgeIcon(Icons.rate_review, 'Critic'),
                      _BadgeIcon(Icons.explore, 'Explorer'),
                    ],
                  ),
                  const Gap(12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                    child: Row(
                      children: _tabs.asMap().entries.map((e) => GestureDetector(
                        onTap: () => setState(() => _tab = e.key),
                        child: Padding(
                          padding: const EdgeInsets.only(right: 16),
                          child: Column(children: [
                            Text(e.value, style: TextStyle(fontSize: 13, fontWeight: _tab == e.key ? FontWeight.w700 : FontWeight.w400, color: _tab == e.key ? AppColors.primary : AppColors.textSecondary)),
                            if (_tab == e.key) Container(height: 2, width: 40, color: AppColors.primary, margin: const EdgeInsets.only(top: 4)),
                          ]),
                        ),
                      )).toList(),
                    ),
                  ),
                ],
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.all(2),
              sliver: SliverGrid(
                delegate: SliverChildBuilderDelegate((ctx, i) {
                  final urls = [
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300',
                    'https://images.unsplash.com/photo-1600180758890-6b94519a8ba6?w=300',
                    'https://images.unsplash.com/photo-1566004100631-35d015d6a491?w=300',
                    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=300',
                    'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?w=300',
                    'https://images.unsplash.com/photo-1499856374892-fecaac17a44e?w=300',
                    'https://images.unsplash.com/photo-1600180758890-6b94519a8ba6?w=300',
                    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=300',
                    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300',
                  ];
                  return Image.network(urls[i % urls.length], fit: BoxFit.cover);
                }, childCount: 9),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, crossAxisSpacing: 2, mainAxisSpacing: 2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCol extends StatelessWidget {
  final String value;
  final String label;

  const _StatCol(this.value, this.label);

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
      Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary, letterSpacing: 0.3)),
    ]);
  }
}

class _BadgeIcon extends StatelessWidget {
  final IconData icon;
  final String label;

  const _BadgeIcon(this.icon, this.label);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Column(children: [
        CircleAvatar(radius: 20, backgroundColor: AppColors.primaryLight, child: Icon(icon, color: AppColors.primary, size: 20)),
        const Gap(4),
        Text(label, style: const TextStyle(fontSize: 9, color: AppColors.textSecondary)),
      ]),
    );
  }
}
