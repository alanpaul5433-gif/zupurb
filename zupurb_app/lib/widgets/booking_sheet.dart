import 'package:flutter/material.dart';
import 'package:gap/gap.dart';

import '../models/entertainer.dart';
import '../theme/colors.dart';
import '../theme/dimens.dart';

/// Premium booking bottom sheet for entertainers.
/// Shows the entertainer's details + a lightweight "Request a booking" form.
/// No backend — fires a SnackBar confirmation on submit.
Future<void> showBookingSheet(
  BuildContext context, {
  required Entertainer entertainer,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.white,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => _BookingSheetBody(entertainer: entertainer),
  );
}

class _BookingSheetBody extends StatefulWidget {
  final Entertainer entertainer;
  const _BookingSheetBody({required this.entertainer});

  @override
  State<_BookingSheetBody> createState() => _BookingSheetBodyState();
}

class _BookingSheetBodyState extends State<_BookingSheetBody> {
  final _messageController = TextEditingController();
  String _dateText = '';
  bool _submitted = false;

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_submitted) return;
    setState(() => _submitted = true);
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
            'Booking request sent — ${widget.entertainer.name} will be in touch.'),
        backgroundColor: AppColors.primary,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final e = widget.entertainer;
    final bottomPadding = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomPadding),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const Gap(20),

              // ── Entertainer header ──────────────────────────────────────
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _EntertainerAvatar(imageUrl: e.imageUrl, name: e.name),
                  const Gap(14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          e.name,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const Gap(3),
                        Text(
                          '${e.role} · ${e.city}',
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const Gap(6),
                        Row(
                          children: [
                            const Icon(Icons.star,
                                size: 14, color: AppColors.pointsGold),
                            const Gap(3),
                            Text(
                              e.rating.toStringAsFixed(1),
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ],
                        ),
                        if (e.tagline.isNotEmpty) ...[
                          const Gap(8),
                          Text(
                            e.tagline,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                              fontStyle: FontStyle.italic,
                              height: 1.4,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),

              const Gap(24),
              const Divider(color: AppColors.divider, height: 1),
              const Gap(20),

              // ── Request form ────────────────────────────────────────────
              const Text(
                'Request a booking',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const Gap(14),

              // Date field
              _FormLabel(label: 'Preferred date'),
              const Gap(6),
              GestureDetector(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: DateTime.now().add(const Duration(days: 7)),
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                    builder: (ctx, child) => Theme(
                      data: Theme.of(ctx).copyWith(
                        colorScheme: const ColorScheme.light(
                            primary: AppColors.primary),
                      ),
                      child: child!,
                    ),
                  );
                  if (picked != null) {
                    setState(() {
                      _dateText =
                          '${picked.day}/${picked.month}/${picked.year}';
                    });
                  }
                },
                child: Container(
                  height: 48,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius:
                        BorderRadius.circular(AppDimens.radiusMd),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today,
                          size: 16, color: AppColors.textTertiary),
                      const Gap(10),
                      Text(
                        _dateText.isNotEmpty ? _dateText : 'Select a date',
                        style: TextStyle(
                          fontSize: 14,
                          color: _dateText.isNotEmpty
                              ? AppColors.textPrimary
                              : AppColors.textTertiary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const Gap(14),

              // Message field
              _FormLabel(label: 'Message (optional)'),
              const Gap(6),
              TextField(
                controller: _messageController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText:
                      'Tell ${e.name} about your event or requirements...',
                  hintStyle: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textTertiary,
                  ),
                  filled: true,
                  fillColor: AppColors.background,
                  border: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(AppDimens.radiusMd),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(AppDimens.radiusMd),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(AppDimens.radiusMd),
                    borderSide: const BorderSide(
                        color: AppColors.primary, width: 1.5),
                  ),
                  contentPadding: const EdgeInsets.all(14),
                ),
                style: const TextStyle(
                    fontSize: 14, color: AppColors.textPrimary),
              ),

              const Gap(24),

              // Submit button
              SizedBox(
                width: double.infinity,
                height: AppDimens.buttonHeight,
                child: ElevatedButton(
                  onPressed: _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppDimens.radiusMd),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Send request',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Entertainer avatar with fallback ─────────────────────────────────────────

class _EntertainerAvatar extends StatelessWidget {
  final String imageUrl;
  final String name;
  const _EntertainerAvatar({required this.imageUrl, required this.name});

  @override
  Widget build(BuildContext context) {
    const size = 72.0;
    final initial =
        name.trim().isNotEmpty ? name.trim()[0].toUpperCase() : '?';
    final fallback = Container(
      width: size,
      height: size,
      color: AppColors.primaryLight,
      alignment: Alignment.center,
      child: Text(
        initial,
        style: const TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          color: AppColors.primary,
        ),
      ),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppDimens.radiusMd),
      child: SizedBox(
        width: size,
        height: size,
        child: imageUrl.isNotEmpty
            ? Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (c, e, s) => fallback,
              )
            : fallback,
      ),
    );
  }
}

// ── Form label ────────────────────────────────────────────────────────────────

class _FormLabel extends StatelessWidget {
  final String label;
  const _FormLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: AppColors.textSecondary,
      ),
    );
  }
}
