import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';

class OtherProfileScreen extends StatefulWidget {
  const OtherProfileScreen({super.key});

  @override
  State<OtherProfileScreen> createState() => _OtherProfileScreenState();
}

class _OtherProfileScreenState extends State<OtherProfileScreen> {
  int _tab = 0;
  final _tabs = ['Reviews', 'Photos', 'Lists'];

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
                        const Text('Redeem Rewards', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.primary)),
                        const Spacer(),
                        const SizedBox(width: 40),
                      ],
                    ),
                  ),
                  const CircleAvatar(
                    radius: 45,
                    backgroundImage: NetworkImage('https://randomuser.me/api/portraits/women/65.jpg'),
                  ),
                  const Gap(12),
                  const Text('Jessica R.', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                  const Text('@jessreed · Food & Nightlife Creator', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  const Gap(12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ElevatedButton(
                        onPressed: () {},
                        style: ElevatedButton.styleFrom(minimumSize: const Size(110, 38), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100))),
                        child: const Text('Follow'),
                      ),
                      const Gap(8),
                      OutlinedButton(
                        onPressed: () => context.go('/chat/1'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(110, 38),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                          side: const BorderSide(color: AppColors.border),
                        ),
                        child: const Text('Message', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
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
                    // P1-21: Creator analytics removed from public profile — private dashboard only
                    padding: EdgeInsets.zero,
                    child: const SizedBox.shrink(),
                  ),
                  const Gap(12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                    child: Row(
                      children: _tabs.asMap().entries.map((e) => GestureDetector(
                        onTap: () => setState(() => _tab = e.key),
                        child: Padding(
                          padding: const EdgeInsets.only(right: 24),
                          child: Column(children: [
                            Text(e.value, style: TextStyle(fontSize: 14, fontWeight: _tab == e.key ? FontWeight.w700 : FontWeight.w400, color: _tab == e.key ? AppColors.primary : AppColors.textSecondary)),
                            if (_tab == e.key) Container(height: 2, width: 36, color: AppColors.primary, margin: const EdgeInsets.only(top: 4)),
                          ]),
                        ),
                      )).toList(),
                    ),
                  ),
                  const Gap(12),
                  _ReviewItem(
                    venue: 'The Gilded Shaker',
                    type: 'Cocktails · West Village',
                    score: 4.0,
                    text: '"The Mezcal Negroni here is life-changing. Come for the drinks, stay for the velvet- drenched atmosphere. Perfect for a first date."',
                    likes: 24,
                    comments: 6,
                    time: '2d ago',
                    imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
                  ),
                  const Gap(12),
                  _ReviewItem(
                    venue: 'Komorebi Sushi',
                    type: 'Japanese · Soho',
                    score: 4.0,
                    text: '"Authentic Omakase experience that rivals anything in Ginza. The attention to detail is just staggering."',
                    likes: 0,
                    comments: 0,
                    time: '1w ago',
                    imageUrl: 'https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=800',
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

class _StatCol extends StatelessWidget {
  final String value;
  final String label;

  const _StatCol(this.value, this.label);

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
      Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
    ]);
  }
}

class _ReviewItem extends StatelessWidget {
  final String venue;
  final String type;
  final double score;
  final String text;
  final int likes;
  final int comments;
  final String time;
  final String imageUrl;

  const _ReviewItem({required this.venue, required this.type, required this.score, required this.text, required this.likes, required this.comments, required this.time, required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child: Stack(
              children: [
                Image.network(imageUrl, height: 160, width: double.infinity, fit: BoxFit.cover),
                Positioned(
                  top: 10, right: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(8)),
                    child: Text(score.toStringAsFixed(1), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white)),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(venue, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                Text(type, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                const Gap(8),
                Text(text, style: const TextStyle(fontSize: 13, color: Color(0xFF444444), fontStyle: FontStyle.italic, height: 1.5)),
                const Gap(10),
                Row(children: [
                  const Icon(Icons.thumb_up_outlined, size: 16, color: AppColors.textSecondary),
                  const Gap(4),
                  Text('$likes', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  const Gap(16),
                  const Icon(Icons.chat_bubble_outline, size: 16, color: AppColors.textSecondary),
                  const Gap(4),
                  Text('$comments', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  const Spacer(),
                  Text(time, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
