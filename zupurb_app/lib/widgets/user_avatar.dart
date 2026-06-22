import 'package:flutter/material.dart';
import '../theme/colors.dart';

/// A circular user avatar that shows the person's initial on a coloured circle
/// whenever the photo is missing OR fails to load. This is the production-correct
/// behaviour and, importantly, prevents blank circles on Flutter web when the
/// avatar host doesn't send CORS headers (e.g. i.pravatar.cc).
class UserAvatar extends StatelessWidget {
  final String? photoUrl;
  final String name;
  final double radius;

  const UserAvatar({super.key, required this.name, this.photoUrl, this.radius = 20});

  @override
  Widget build(BuildContext context) {
    final size = radius * 2;
    final trimmed = name.trim();
    final initial = trimmed.isNotEmpty ? trimmed[0].toUpperCase() : '?';
    final fallback = Container(
      width: size,
      height: size,
      color: AppColors.primaryLight,
      alignment: Alignment.center,
      child: Text(initial, style: TextStyle(fontSize: radius * 0.85, fontWeight: FontWeight.w700, color: AppColors.primary)),
    );

    if (photoUrl == null || photoUrl!.isEmpty) {
      return ClipOval(child: SizedBox(width: size, height: size, child: fallback));
    }
    return ClipOval(
      child: SizedBox(
        width: size,
        height: size,
        child: Image.network(
          photoUrl!,
          fit: BoxFit.cover,
          errorBuilder: (c, e, s) => fallback,
          loadingBuilder: (c, child, progress) => progress == null ? child : fallback,
        ),
      ),
    );
  }
}
