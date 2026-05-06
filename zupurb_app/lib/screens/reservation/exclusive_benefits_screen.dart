import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';

class ExclusiveBenefitsScreen extends StatefulWidget {
  const ExclusiveBenefitsScreen({super.key});

  @override
  State<ExclusiveBenefitsScreen> createState() => _ExclusiveBenefitsScreenState();
}

class _ExclusiveBenefitsScreenState extends State<ExclusiveBenefitsScreen> {
  int _tab = 0;
  final _tabs = ['Venue Deals', 'Zupurb Rewards', 'Points'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFFEF6B47), Color(0xFFFF8C69)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                padding: const EdgeInsets.all(AppDimens.screenPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('THE MEMBER CONCIERGE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white70, letterSpacing: 0.5)),
                    const Gap(4),
                    const Text('Your\nExclusive\nBenefits', style: TextStyle(fontSize: 36, fontWeight: FontWeight.w800, color: Colors.white, height: 1.1)),
                    const Gap(16),
                    Row(
                      children: _tabs.asMap().entries.map((e) => GestureDetector(
                        onTap: () => setState(() => _tab = e.key),
                        child: Container(
                          margin: const EdgeInsets.only(right: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: _tab == e.key ? Colors.white : Colors.white30,
                            borderRadius: BorderRadius.circular(100),
                          ),
                          child: Text(e.value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _tab == e.key ? AppColors.primary : Colors.white)),
                        ),
                      )).toList(),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppDimens.screenPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      height: 160,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        image: const DecorationImage(
                          image: NetworkImage('https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800'),
                          fit: BoxFit.cover,
                        ),
                      ),
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black.withOpacity(0.7)]),
                        ),
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Monthly Prize\nEntry', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
                            const Gap(8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(color: Colors.white30, borderRadius: BorderRadius.circular(6)),
                              child: const Text('Redeemed for 50 pts', style: TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w600)),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const Gap(16),
                    // P2-18: $2 booking credit removed — not in SOW §14. Replaced with gift card redemption.
                    _BenefitRow(title: 'Gift Card Redemption', subtitle: 'Redeem points for partner gift cards via Tremendous.', icon: Icons.card_giftcard_outlined),
                    const Gap(12),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(12)),
                      child: const Row(children: [
                        Icon(Icons.workspace_premium, color: AppColors.primary, size: 20),
                        Gap(10),
                        Expanded(child: Text('Free Zupurb Plus', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary))),
                        Text('1,000 pts', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary)),
                      ]),
                    ),
                    const Gap(16),
                    const Text('PARTNER HIGHLIGHTS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textTertiary, letterSpacing: 0.5)),
                    const Text('Venue Deals', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                    const Gap(12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.network('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800', height: 140, width: double.infinity, fit: BoxFit.cover),
                    ),
                    const Gap(8),
                    const Text('Dinner for Two Experience', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                    const Gap(4),
                    const Text('3,000 pts', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BenefitRow extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;

  const _BenefitRow({required this.title, required this.subtitle, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.primaryLight, shape: BoxShape.circle),
            child: Icon(icon, color: AppColors.primary, size: 20)),
          const Gap(12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ])),
        ],
      ),
    );
  }
}
