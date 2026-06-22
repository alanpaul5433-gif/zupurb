import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class PreferencesScreen extends ConsumerStatefulWidget {
  const PreferencesScreen({super.key});

  @override
  ConsumerState<PreferencesScreen> createState() => _PreferencesScreenState();
}

class _PreferencesScreenState extends ConsumerState<PreferencesScreen> {
  static const _cuisineOptions = [
    'Italian', 'Mexican', 'Japanese', 'Thai', 'Indian', 'American',
    'Mediterranean', 'Chinese', 'Korean', 'Vegan', 'Vegetarian', 'Halal',
    'Seafood', 'BBQ', 'Brunch', 'Street Food',
  ];
  static const _drinkOptions = [
    'Non-alcoholic', 'Beer', 'Wine', 'Cocktails',
  ];
  static const _activityOptions = [
    'Karaoke', 'Pool & Billiards', 'Darts', 'Trivia Nights', 'Live Music',
    'Dancing', 'Shuffleboard', 'Speed Dating', 'Brunch', 'Happy Hour',
    'Taco Tuesday', 'Mechanical Bull', 'Sports Viewing', 'Comedy Nights', 'DJ Sets',
  ];
  static const _sportsOptions = ['NFL', 'NBA', 'MLB', 'Soccer'];

  Set<String> _cuisines = {};
  Set<String> _drinks = {};
  Set<String> _activities = {};
  Set<String> _sports = {};
  late final TextEditingController _bioController;

  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _bioController = TextEditingController();
    _loadPreferences();
  }

  @override
  void dispose() {
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _loadPreferences() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    try {
      final snap = await FirebaseFirestore.instance.doc('users/${user.uid}').get();
      if (!snap.exists) {
        if (mounted) setState(() => _loading = false);
        return;
      }
      final data = snap.data() ?? {};
      List<String> asList(dynamic v) =>
          v is List ? List<String>.from(v.whereType<String>()) : [];

      if (mounted) {
        setState(() {
          _cuisines = {...asList(data['diningPreferences'])};
          _drinks = {...asList(data['drinkPreferences'])};
          _activities = {...asList(data['activityPreferences'])};
          _sports = {...asList(data['sportsFollowed'])};
          _bioController.text = (data['bio'] as String?) ?? '';
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    setState(() => _saving = true);
    try {
      await FirebaseFirestore.instance.doc('users/${user.uid}').set(
        {
          'diningPreferences': _cuisines.toList(),
          'drinkPreferences': _drinks.toList(),
          'sportsFollowed': _sports.toList(),
          'activityPreferences': _activities.toList(),
          'nightlifePreferences': [..._drinks, ..._sports],
          'bio': _bioController.text.trim(),
          'updatedAt': FieldValue.serverTimestamp(),
        },
        SetOptions(merge: true),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Preferences updated')),
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to save: $e')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : Column(
                children: [
                  // ── Header ──────────────────────────────────────────────
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppDimens.screenPadding, vertical: 12),
                    child: Row(
                      children: [
                        IconButton(
                          onPressed: () => context.pop(),
                          icon: const Icon(Icons.arrow_back_ios, size: 20),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                        const Gap(8),
                        const Text(
                          'Your Interests',
                          style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  // ── Scrollable body ─────────────────────────────────────
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppDimens.screenPadding),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Gap(24),
                          _SectionHeader(label: 'Cuisines & Food'),
                          const Gap(12),
                          GridView.count(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            crossAxisCount: 2,
                            mainAxisSpacing: 10,
                            crossAxisSpacing: 10,
                            childAspectRatio: 3.5,
                            children: _cuisineOptions.map((c) => _Chip(
                              label: c,
                              selected: _cuisines.contains(c),
                              onTap: () => setState(() => _cuisines.contains(c)
                                  ? _cuisines.remove(c)
                                  : _cuisines.add(c)),
                            )).toList(),
                          ),
                          const Gap(24),
                          _SectionHeader(label: 'Drinks'),
                          const Gap(12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _drinkOptions.map((d) => _Chip(
                              label: d,
                              selected: _drinks.contains(d),
                              onTap: () => setState(() => _drinks.contains(d)
                                  ? _drinks.remove(d)
                                  : _drinks.add(d)),
                            )).toList(),
                          ),
                          const Gap(24),
                          _SectionHeader(label: 'Activities'),
                          const Gap(12),
                          GridView.count(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            crossAxisCount: 2,
                            mainAxisSpacing: 10,
                            crossAxisSpacing: 10,
                            childAspectRatio: 3.5,
                            children: _activityOptions.map((a) => _Chip(
                              label: a,
                              selected: _activities.contains(a),
                              onTap: () => setState(() => _activities.contains(a)
                                  ? _activities.remove(a)
                                  : _activities.add(a)),
                            )).toList(),
                          ),
                          const Gap(24),
                          _SectionHeader(label: 'Sports'),
                          const Gap(12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _sportsOptions.map((s) => _Chip(
                              label: s,
                              selected: _sports.contains(s),
                              onTap: () => setState(() => _sports.contains(s)
                                  ? _sports.remove(s)
                                  : _sports.add(s)),
                            )).toList(),
                          ),
                          const Gap(24),
                          _SectionHeader(label: 'Bio'),
                          const Gap(12),
                          Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: TextField(
                              controller: _bioController,
                              maxLength: 80,
                              maxLines: 3,
                              style: const TextStyle(
                                  fontSize: 14, color: AppColors.textPrimary),
                              decoration: const InputDecoration(
                                hintText: 'Tell people a little about yourself…',
                                hintStyle: TextStyle(
                                    fontSize: 14, color: AppColors.textTertiary),
                                contentPadding: EdgeInsets.all(14),
                                border: InputBorder.none,
                                counterStyle: TextStyle(
                                    fontSize: 11, color: AppColors.textTertiary),
                              ),
                            ),
                          ),
                          const Gap(100),
                        ],
                      ),
                    ),
                  ),
                  // ── Save button ──────────────────────────────────────────
                  Padding(
                    padding: const EdgeInsets.all(AppDimens.screenPadding),
                    child: AppButton(
                      label: _saving ? 'Saving…' : 'Save Changes',
                      enabled: !_saving,
                      onTap: _save,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

// ── Private helpers ─────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String label;
  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary),
        ),
        const Gap(6),
        const Divider(height: 1),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(100),
          border: Border.all(
              color: selected ? AppColors.primary : AppColors.border),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: selected ? Colors.white : AppColors.textPrimary,
          ),
        ),
      ),
    );
  }
}
