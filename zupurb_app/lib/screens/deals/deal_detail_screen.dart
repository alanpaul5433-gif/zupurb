import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:uuid/uuid.dart';

import '../../core/services/functions_service.dart';
import '../../models/deal.dart';
import '../../state/auth/auth_providers.dart';
import '../../theme/colors.dart';
import '../../widgets/app_button.dart';

/// Detail view for a single [Deal], opened by tapping a deal on the
/// establishment page. Redeem calls the redeemDeal callable.
class DealDetailScreen extends ConsumerStatefulWidget {
  final Deal deal;
  const DealDetailScreen({super.key, required this.deal});

  @override
  ConsumerState<DealDetailScreen> createState() => _DealDetailScreenState();
}

class _DealDetailScreenState extends ConsumerState<DealDetailScreen> {
  bool _isRedeeming = false;
  // Generated once and reused across retries so the server de-dupes the charge.
  final String _idempotencyKey = const Uuid().v4();

  Deal get deal => widget.deal;

  Future<void> _redeem() async {
    if (_isRedeeming) return;
    setState(() => _isRedeeming = true);
    try {
      final res = await ref.read(functionsServiceProvider).redeemDeal(
            dealId: deal.id,
            idempotencyKey: _idempotencyKey,
          );
      if (!mounted) return;
      final qrPayload = (res['qrPayload'] as String?) ?? '';
      if (qrPayload.isNotEmpty) {
        _showQrSheet(qrPayload);
      } else {
        _showGiftCardDialog();
      }
    } on AppFunctionsException catch (e) {
      if (!mounted) return;
      if (e.code == 'permission-denied') {
        // Plus-required (or alcohol/ABC guard). Offer the upsell.
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.message),
          action: SnackBarAction(label: 'Get Plus', onPressed: () => context.push('/zupurb-plus')),
          duration: const Duration(seconds: 4),
        ));
      } else {
        final isInsufficientPoints =
            e.code == 'failed-precondition' || e.message.contains('Insufficient');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            duration: const Duration(seconds: 4),
            action: isInsufficientPoints
                ? SnackBarAction(
                    label: 'Earn points',
                    onPressed: () => context.push('/redeem'),
                  )
                : null,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isRedeeming = false);
    }
  }

  void _showQrSheet(String qrPayload) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Deal Redeemed!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
            const Gap(4),
            Text(deal.title, style: const TextStyle(fontSize: 14, color: AppColors.textSecondary)),
            const Gap(20),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
              child: QrImageView(data: qrPayload, size: 200, backgroundColor: Colors.white),
            ),
            const Gap(16),
            const Text('Show this at the venue. Valid for 2 hours.', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            const Gap(16),
            SizedBox(width: double.infinity, child: AppButton(label: 'Done', onTap: () => Navigator.of(context).pop())),
          ],
        ),
      ),
    );
  }

  void _showGiftCardDialog() {
    showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Redeemed!'),
        content: const Text('Your reward is on its way — it will be delivered to your registered email shortly.'),
        actions: [TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('OK'))],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF5F0ED),
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.of(context).maybePop(),
          tooltip: 'Back',
          icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.primary, semanticLabel: 'Back'),
        ),
        title: const Text('Deal', style: TextStyle(color: Color(0xFF1A1A1A), fontWeight: FontWeight.w700)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (deal.imageUrl.isNotEmpty)
              SizedBox(
                height: 200,
                width: double.infinity,
                child: Image.network(deal.imageUrl, fit: BoxFit.cover,
                    errorBuilder: (c, e, s) => Container(color: AppColors.border)),
              ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(8)),
                    child: Text('${deal.pointCost} pts', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary)),
                  ),
                  const Gap(12),
                  Text(deal.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                  const Gap(12),
                  Text(deal.description, style: const TextStyle(fontSize: 15, color: Color(0xFF444444), height: 1.5)),
                  const Gap(20),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('How it works', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                        const Gap(8),
                        _Step(n: 1, text: 'Redeem this deal with your points.'),
                        _Step(n: 2, text: 'Show the generated QR code at the venue.'),
                        _Step(n: 3, text: 'Staff scans it to apply your deal.'),
                      ],
                    ),
                  ),
                  const Gap(24),
                  AppButton(
                    label: _isRedeeming ? 'Redeeming…' : 'Redeem for ${deal.pointCost} pts',
                    onTap: (_isRedeeming || !deal.isActive) ? null : _redeem,
                  ),
                  const Gap(8),
                  const Center(
                    child: Text('Redeeming generates a QR code valid for 2 hours.',
                        style: TextStyle(fontSize: 12, color: AppColors.textTertiary)),
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

class _Step extends StatelessWidget {
  final int n;
  final String text;
  const _Step({required this.n, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(radius: 11, backgroundColor: AppColors.primary, child: Text('$n', style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w700))),
          const Gap(10),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 13, color: Color(0xFF444444)))),
        ],
      ),
    );
  }
}
