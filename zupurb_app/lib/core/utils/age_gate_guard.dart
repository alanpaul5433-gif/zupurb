// lib/core/utils/age_gate_guard.dart
//
// Utility function that screens callers behind the age gate.
//
// Usage (inside a ConsumerStatefulWidget's initState or first-build hook):
//   @override
//   void initState() {
//     super.initState();
//     WidgetsBinding.instance.addPostFrameCallback((_) async {
//       final allowed = await checkAgeGate(context, ref);
//       if (!allowed && mounted) Navigator.of(context).pop();
//     });
//   }
//
// Returns:
//   true  — user has confirmed their age (or was auto-passed via birthYear).
//   false — user dismissed the dialog without confirming; caller should pop.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/age_gate_provider.dart';
import '../../features/age_gate/widgets/age_gate_dialog.dart';

/// Returns `true` if the user is permitted to view restricted content.
///
/// If the gate has already been passed (cached in SharedPreferences or
/// derived from [birthYear]), this resolves immediately without showing UI.
///
/// If the gate has not been passed, shows [AgeGateDialog] as a modal bottom
/// sheet and returns the user's choice.
Future<bool> checkAgeGate(BuildContext context, WidgetRef ref) async {
  // ── Fast path: already cleared ────────────────────────────────────────────
  final passed = await ref.read(ageGatePassedProvider.future);
  if (passed) return true;

  // ── Slow path: show dialog ────────────────────────────────────────────────
  if (!context.mounted) return false;

  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    isDismissible: false,
    enableDrag: false,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    // The modal sheet's route has its own BuildContext; wrapping in Consumer
    // lets AgeGateDialog read the same Riverpod container as the caller
    // without relying on the deprecated ProviderScope.containerOf API.
    builder: (sheetContext) => Consumer(
      builder: (ctx, innerRef, child) => const AgeGateDialog(),
    ),
  );

  // `null` means the sheet was dismissed programmatically without a result;
  // treat that the same as "Go Back".
  return result ?? false;
}
