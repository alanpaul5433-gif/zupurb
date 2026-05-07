// T6 Accessibility — Semantic audit helper
//
// Usage:
//   final complaints = auditSemantics(tester);
//   // complaints is empty when every interactive node has a label.
//
// The helper walks the semantics tree once per call and returns one complaint
// string per node that has a tap/focus action but no label or value.

import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

/// Returns a list of human-readable complaints for every interactive semantics
/// node that is missing a meaningful label.
///
/// A node is "interactive" if it exposes a [SemanticsAction.tap] or
/// [SemanticsAction.longPress] action — the most reliable cross-SDK signal
/// that a node is tappable.
///
/// A node is "labelled" if [SemanticsData.label] or [SemanticsData.value] is
/// non-empty after trimming whitespace.
List<String> auditSemantics(WidgetTester tester) {
  final List<String> complaints = [];

  void walk(SemanticsNode node) {
    final SemanticsData data = node.getSemanticsData();

    // Using only hasAction which is not deprecated in any Flutter version.
    final bool isInteractive = data.hasAction(SemanticsAction.tap) ||
        data.hasAction(SemanticsAction.longPress);

    final bool hasLabel =
        data.label.trim().isNotEmpty || data.value.trim().isNotEmpty;

    if (isInteractive && !hasLabel) {
      final String id = node.id.toString();
      final String rect = node.rect.toString();
      complaints.add(
        'Node #$id at $rect is interactive but has no semantic label or value.',
      );
    }

    node.visitChildren((child) {
      walk(child);
      return true;
    });
  }

  // Retrieve the semantics root from the test binding.
  final binding = TestWidgetsFlutterBinding.ensureInitialized();
  // rootElement replaces the deprecated renderViewElement in Flutter 3.9+.
  final SemanticsNode? root =
      binding.rootElement?.renderObject?.debugSemantics;
  if (root == null) {
    complaints.add('Semantics tree is empty — did you call ensureSemantics()?');
    return complaints;
  }

  walk(root);
  return complaints;
}
