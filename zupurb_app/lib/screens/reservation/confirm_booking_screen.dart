import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import '../../core/services/functions_service.dart';
import '../../state/reservations/reservations_provider.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class ConfirmBookingScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> args;
  const ConfirmBookingScreen({super.key, this.args = const {}});

  @override
  ConsumerState<ConfirmBookingScreen> createState() => _ConfirmBookingScreenState();
}

class _ConfirmBookingScreenState extends ConsumerState<ConfirmBookingScreen> {
  // Generated once and reused on retry so the server de-dupes (idempotency).
  final String _idempotencyKey = const Uuid().v4();
  bool _loading = false;

  String get _estId => (widget.args['estId'] ?? '').toString();
  String get _estName => (widget.args['estName'] ?? 'Venue').toString();
  String get _imageUrl => (widget.args['imageUrl'] ?? '').toString();
  int get _partySize => (widget.args['partySize'] as int?) ?? 2;
  String get _dayLabel => (widget.args['dayLabel'] ?? '—').toString();
  String get _slotLabel => (widget.args['slotLabel'] ?? '—').toString();

  Future<void> _confirm() async {
    if (_loading) return;
    final scheduledAtIso = (widget.args['scheduledAtIso'] ?? '').toString();
    if (_estId.isEmpty || scheduledAtIso.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Missing booking details — please start again.')),
      );
      return;
    }
    setState(() => _loading = true);
    try {
      final result = await ref.read(createReservationProvider)({
        'establishmentId': _estId,
        'partySize': _partySize,
        'scheduledAt': scheduledAtIso,
        'idempotencyKey': _idempotencyKey,
      });
      if (!mounted) return;
      context.push('/reservation/pass', extra: result);
    } on AppFunctionsException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), duration: const Duration(seconds: 3)),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.textPrimary)),
        title: const Text('Zupurb', style: TextStyle(color: AppColors.textPrimary)),
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Gap(4),
            const Text('ONE STEP LEFT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary, letterSpacing: 0.5)),
            const Gap(4),
            const Text('Confirm Your Table.', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
            const Gap(20),
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: _imageUrl.isNotEmpty
                  ? Image.network(_imageUrl, height: 180, width: double.infinity, fit: BoxFit.cover,
                      errorBuilder: (c, e, s) => Container(height: 180, color: AppColors.border))
                  : Container(height: 180, color: AppColors.border),
            ),
            const Gap(16),
            Text(_estName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const Gap(14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: Row(
                children: [
                  _InfoCol(label: 'DATE', value: _dayLabel),
                  const _Divider(),
                  _InfoCol(label: 'TIME', value: _slotLabel),
                  const _Divider(),
                  _InfoCol(label: 'GUESTS', value: '$_partySize'),
                ],
              ),
            ),
            const Gap(20),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: const Row(
                children: [
                  CircleAvatar(radius: 22, backgroundColor: AppColors.primaryLight, child: Icon(Icons.alarm, color: AppColors.primary, size: 22)),
                  Gap(12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Arrive 10 minutes early', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    Gap(4),
                    Text('Tables are held for a maximum of 15 minutes past your reservation time.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ])),
                ],
              ),
            ),
            const Gap(12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: const Row(
                children: [
                  Icon(Icons.cancel_outlined, color: AppColors.primary, size: 20),
                  Gap(12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Cancellation Policy', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    Gap(4),
                    Text('Cancellations within 48 hours of your reservation are subject to a no-show penalty.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ])),
                ],
              ),
            ),
            const Gap(24),
            AppButton(
              label: _loading ? 'Booking…' : 'Confirm Booking',
              onTap: _loading ? null : _confirm,
            ),
            const Gap(8),
            TextButton(onPressed: () => context.pop(), child: const Text('Change Time', style: TextStyle(color: AppColors.textSecondary))),
            const Gap(32),
          ],
        ),
      ),
    );
  }
}

class _InfoCol extends StatelessWidget {
  final String label;
  final String value;

  const _InfoCol({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(child: Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textTertiary, letterSpacing: 0.5)),
        const Gap(2),
        Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600), textAlign: TextAlign.center),
      ],
    ));
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) => Container(width: 1, height: 36, color: AppColors.border);
}
