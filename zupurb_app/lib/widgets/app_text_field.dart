import 'package:flutter/material.dart';
import '../theme/colors.dart';

class AppTextField extends StatefulWidget {
  final String hint;
  final IconData? prefixIcon;
  final bool obscure;
  final TextEditingController? controller;
  final TextInputType? keyboardType;

  const AppTextField({
    super.key,
    required this.hint,
    this.prefixIcon,
    this.obscure = false,
    this.controller,
    this.keyboardType,
  });

  @override
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  bool _visible = false;

  @override
  Widget build(BuildContext context) {
    // Expose the hint as a semantic label so screen readers announce the
    // field's purpose — `hintText` alone is not surfaced to TalkBack/VoiceOver.
    return Semantics(
      textField: true,
      label: widget.hint,
      child: TextField(
      controller: widget.controller,
      obscureText: widget.obscure && !_visible,
      keyboardType: widget.keyboardType,
      decoration: InputDecoration(
        hintText: widget.hint,
        prefixIcon: widget.prefixIcon != null
            ? Icon(widget.prefixIcon, color: AppColors.primary, size: 20)
            : null,
        suffixIcon: widget.obscure
            ? IconButton(
                tooltip: _visible ? 'Hide password' : 'Show password',
                icon: Icon(
                  _visible ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                  color: AppColors.textTertiary,
                  size: 20,
                  semanticLabel: _visible ? 'Hide password' : 'Show password',
                ),
                onPressed: () => setState(() => _visible = !_visible),
              )
            : null,
      ),
      ),
    );
  }
}
