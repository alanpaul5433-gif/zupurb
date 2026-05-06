import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/dimens.dart';

class AppButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final bool outlined;
  final bool enabled;

  const AppButton({
    super.key,
    required this.label,
    this.onTap,
    this.outlined = false,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: AppDimens.buttonHeight,
      child: outlined
          ? OutlinedButton(
              onPressed: enabled ? onTap : null,
              child: Text(label),
            )
          : ElevatedButton(
              onPressed: enabled ? onTap : null,
              child: Text(label),
            ),
    );
  }
}

class AppTextButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final Color? color;

  const AppTextButton({super.key, required this.label, this.onTap, this.color});

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      child: Text(
        label,
        style: TextStyle(
          color: color ?? AppColors.textSecondary,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}
