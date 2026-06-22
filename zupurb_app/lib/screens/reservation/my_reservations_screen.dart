import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../models/reservation.dart';
import '../../state/reservations/reservations_provider.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';

class MyReservationsScreen extends ConsumerStatefulWidget {
  const MyReservationsScreen({super.key});

  @override
  ConsumerState<MyReservationsScreen> createState() => _MyReservationsScreenState();
}

class _MyReservationsScreenState extends ConsumerState<MyReservationsScreen> {
  static const _months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  int _tab = 0;
  final _tabs = ['Upcoming', 'Past', 'Cancelled'];

  List<Reservation> _filter(List<Reservation> all) {
    switch (_tab) {
      case 2: // Cancelled
        return all.where((r) => r.isCancelled).toList();
      case 1: // Past
        return all.where((r) => !r.isCancelled && !r.isUpcoming).toList();
      default: // Upcoming
        return all.where((r) => r.isUpcoming).toList();
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(myReservationsProvider);
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.canPop() ? context.pop() : context.go('/home'), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary)),
        title: const Text('My Reservations'),
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/discover'),
        backgroundColor: AppColors.primary,
        tooltip: 'Find a venue to book',
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
            child: async.when(
              loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
              error: (e, _) => _Empty(icon: Icons.error_outline, title: 'Could not load reservations', subtitle: 'Pull to retry.', onRetry: () => ref.invalidate(myReservationsProvider)),
              data: (all) {
                final items = _filter(all);
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(myReservationsProvider),
                  child: items.isEmpty
                      ? ListView(children: const [Gap(80), _Empty(icon: Icons.event_busy, title: 'No reservations here', subtitle: 'Book a table from a venue page to see it here.')])
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                          itemCount: items.length,
                          separatorBuilder: (_, __) => const Gap(12),
                          itemBuilder: (_, i) => _ReservationCard(r: items[i], months: _months),
                        ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onRetry;
  const _Empty({required this.icon, required this.title, required this.subtitle, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: AppColors.textTertiary),
            const Gap(12),
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const Gap(4),
            Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            if (onRetry != null) ...[
              const Gap(12),
              TextButton(onPressed: onRetry, child: const Text('Retry')),
            ],
          ],
        ),
      ),
    );
  }
}

class _ReservationCard extends StatelessWidget {
  final Reservation r;
  final List<String> months;
  const _ReservationCard({required this.r, required this.months});

  (Color, String) get _statusStyle {
    switch (r.status) {
      case 'confirmed':
        return (AppColors.success, 'Confirmed');
      case 'checked_in':
        return (AppColors.primary, 'Checked In');
      case 'completed':
        return (AppColors.textSecondary, 'Completed');
      case 'no_show':
        return (AppColors.error, 'No Show');
      case 'cancelled':
        return (AppColors.error, 'Cancelled');
      default:
        return (AppColors.textSecondary, r.status);
    }
  }

  String _when() {
    final dt = r.scheduledAt;
    if (dt == null) return '';
    final h = dt.hour == 0 ? 12 : (dt.hour > 12 ? dt.hour - 12 : dt.hour);
    final ampm = dt.hour >= 12 ? 'PM' : 'AM';
    final mm = dt.minute.toString().padLeft(2, '0');
    return '${months[dt.month]} ${dt.day} · $h:$mm $ampm';
  }

  @override
  Widget build(BuildContext context) {
    final (color, label) = _statusStyle;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.event_available, color: AppColors.primary),
          ),
          const Gap(12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(r.estName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
                const Gap(2),
                Text('${_when()} · ${r.partySize} ${r.partySize == 1 ? 'guest' : 'guests'}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              ],
            ),
          ),
          const Gap(8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
            child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
          ),
        ],
      ),
    );
  }
}
