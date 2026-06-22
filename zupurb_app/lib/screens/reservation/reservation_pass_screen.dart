import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import '../../models/reservation.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class ReservationPassScreen extends StatelessWidget {
  final CreateReservationResult? result;
  const ReservationPassScreen({super.key, this.result});

  static const _weekdays = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  String _formatWhen(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final h = dt.hour == 0 ? 12 : (dt.hour > 12 ? dt.hour - 12 : dt.hour);
    final ampm = dt.hour >= 12 ? 'PM' : 'AM';
    final mm = dt.minute.toString().padLeft(2, '0');
    return '${_weekdays[dt.weekday]} ${dt.day} · $h:$mm $ampm';
  }

  @override
  Widget build(BuildContext context) {
    final r = result;
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.canPop() ? context.pop() : context.go('/home'), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.textPrimary)),
        title: const Text('Zupurb', style: TextStyle(color: AppColors.textPrimary)),
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      body: r == null
          ? const _NoPass()
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Gap(8),
                  const Text('RESERVATION CONFIRMED', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary, letterSpacing: 0.5)),
                  const Gap(8),
                  Text(_formatWhen(r.scheduledAt), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                  const Gap(20),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(8)),
                          child: QrImageView(data: r.qrPayload.isNotEmpty ? r.qrPayload : r.reservationId, size: 200, backgroundColor: Colors.white),
                        ),
                        const Gap(16),
                        const Text('REFERENCE NUMBER', style: TextStyle(fontSize: 11, color: AppColors.textTertiary, letterSpacing: 0.5)),
                        const Gap(4),
                        SelectableText(
                          r.reservationId.length > 10 ? r.reservationId.substring(0, 10).toUpperCase() : r.reservationId.toUpperCase(),
                          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: 1),
                        ),
                      ],
                    ),
                  ),
                  if (r.otpCode != null && r.otpCode!.isNotEmpty) ...[
                    const Gap(16),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                      child: Column(
                        children: [
                          const Text('OR USE MANUAL ENTRY CODE', style: TextStyle(fontSize: 11, color: AppColors.textTertiary, letterSpacing: 0.5)),
                          const Gap(12),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: r.otpCode!.split('').map((d) => Container(
                              width: 52,
                              height: 52,
                              margin: const EdgeInsets.symmetric(horizontal: 5),
                              decoration: BoxDecoration(color: const Color(0xFFF5F0ED), borderRadius: BorderRadius.circular(12)),
                              alignment: Alignment.center,
                              child: Text(d, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                            )).toList(),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const Gap(16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(12)),
                    child: const Column(
                      children: [
                        CircleAvatar(radius: 24, backgroundColor: AppColors.primary, child: Icon(Icons.qr_code_scanner, color: Colors.white, size: 24)),
                        Gap(10),
                        Text('Show this at the entrance', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary)),
                        Gap(4),
                        Text('The host will scan your code to confirm your reservation and add rewards to your account.', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                  const Gap(24),
                  AppButton(
                    label: 'Share Reservation',
                    onTap: () => Share.share('My Zupurb reservation — ${_formatWhen(r.scheduledAt)}. Ref: ${r.reservationId}. See you there! 🍽️'),
                  ),
                  const Gap(8),
                  Center(child: TextButton(onPressed: () => context.go('/home'), child: const Text('Done', style: TextStyle(color: AppColors.textSecondary)))),
                  const Gap(24),
                ],
              ),
            ),
    );
  }
}

class _NoPass extends StatelessWidget {
  const _NoPass();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.qr_code_2, size: 48, color: AppColors.textTertiary),
            const Gap(12),
            const Text('Pass unavailable', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const Gap(4),
            const Text('Your entry code is shown right after you book. Check "My Reservations" for booking details.', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            const Gap(16),
            AppButton(label: 'My Reservations', onTap: () => context.go('/reservation/my')),
          ],
        ),
      ),
    );
  }
}
