import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class MyReservationsScreen extends StatefulWidget {
  const MyReservationsScreen({super.key});

  @override
  State<MyReservationsScreen> createState() => _MyReservationsScreenState();
}

class _MyReservationsScreenState extends State<MyReservationsScreen> {
  int _tab = 0;
  final _tabs = ['Upcoming', 'Past', 'Cancelled'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary)),
        title: const Text('My Reservations'),
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.go('/reservation/slots'),
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
            child: Row(
              children: _tabs.asMap().entries.map((e) => GestureDetector(
                onTap: () => setState(() => _tab = e.key),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: _tab == e.key ? AppColors.primary : Colors.white,
                    borderRadius: BorderRadius.circular(100),
                    border: Border.all(color: _tab == e.key ? AppColors.primary : AppColors.border),
                  ),
                  child: Text(e.value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _tab == e.key ? Colors.white : AppColors.textPrimary)),
                ),
              )).toList(),
            ),
          ),
          const Gap(16),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
              children: [
                _ReservationCard(
                  status: 'Confirmed',
                  statusColor: AppColors.success,
                  name: 'The Social Lounge',
                  date: 'Oct 24, 2026',
                  time: '08:30 PM',
                  guests: '4 People',
                  imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
                  onViewPass: () => context.go('/reservation/pass'),
                ),
                const Gap(16),
                // P1-17: "Requested" removed — instant-confirm flow (R5.3)
                _ReservationCard(
                  status: 'Upcoming',
                  statusColor: AppColors.primary,
                  name: 'Havana Social Club',
                  date: 'Oct 24, 2026',
                  time: '08:30 PM',
                  guests: '2 People',
                  imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800',
                  onViewPass: () => context.go('/reservation/pass'),
                  showCancel: true,
                ),
                const Gap(20),
                const Text('Nearby Venues', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                const Gap(12),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                  child: Row(
                    children: [
                      CircleAvatar(radius: 22, backgroundImage: NetworkImage('https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=100')),
                      const Gap(10),
                      const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('The Artisan Kitchen', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                        Text('Oct 12 · 8 Guests · Completed', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      ])),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(6)),
                        child: const Text('+450 pts', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary)),
                      ),
                    ],
                  ),
                ),
                const Gap(24),
                Container(
                  height: 100,
                  decoration: BoxDecoration(color: const Color(0xFFF0EAE5), borderRadius: BorderRadius.circular(16)),
                  child: const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.calendar_today_outlined, color: AppColors.textTertiary, size: 28),
                      Gap(8),
                      Text('Looking For Something Else?', style: TextStyle(fontSize: 13, color: AppColors.textTertiary)),
                      Text('Explore New Hotspots', style: TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
                const Gap(24),
                AppButton(label: 'Save & Continue', onTap: () => context.go('/home')),
                const Gap(32),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ReservationCard extends StatelessWidget {
  final String status;
  final Color statusColor;
  final String name;
  final String date;
  final String time;
  final String guests;
  final String imageUrl;
  final VoidCallback onViewPass;
  final bool showCancel;

  const _ReservationCard({
    required this.status,
    required this.statusColor,
    required this.name,
    required this.date,
    required this.time,
    required this.guests,
    required this.imageUrl,
    required this.onViewPass,
    this.showCancel = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                child: Image.network(imageUrl, height: 140, width: double.infinity, fit: BoxFit.cover),
              ),
              Positioned(
                top: 10,
                left: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: statusColor.withOpacity(0.9), borderRadius: BorderRadius.circular(6)),
                  child: Text(status, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                const Gap(6),
                Row(children: [
                  const Text('DATE', style: TextStyle(fontSize: 10, color: AppColors.textTertiary, fontWeight: FontWeight.w600)),
                  const Gap(12),
                  const Text('TIME', style: TextStyle(fontSize: 10, color: AppColors.textTertiary, fontWeight: FontWeight.w600)),
                  const Gap(12),
                  const Text('GUEST', style: TextStyle(fontSize: 10, color: AppColors.textTertiary, fontWeight: FontWeight.w600)),
                ]),
                const Gap(2),
                Row(children: [
                  Text(date, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                  const Gap(12),
                  Text(time, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                  const Gap(12),
                  Text(guests, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                ]),
                const Gap(10),
                Row(
                  children: [
                    Expanded(child: ElevatedButton(
                      onPressed: onViewPass,
                      style: ElevatedButton.styleFrom(minimumSize: const Size(0, 42), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100))),
                      child: const Text('View Pass'),
                    )),
                    const Gap(10),
                    if (showCancel)
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(color: AppColors.primaryLight, shape: BoxShape.circle),
                        child: const Icon(Icons.close, color: AppColors.primary, size: 18),
                      )
                    else
                      const Icon(Icons.more_horiz, color: AppColors.textTertiary),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
