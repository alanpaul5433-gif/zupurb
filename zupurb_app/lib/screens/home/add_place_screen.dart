import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class AddPlaceScreen extends StatefulWidget {
  const AddPlaceScreen({super.key});

  @override
  State<AddPlaceScreen> createState() => _AddPlaceScreenState();
}

class _AddPlaceScreenState extends State<AddPlaceScreen> {
  final Set<String> _tags = {'Italian'};
  String _priceRange = '\$\$';
  String _selectedType = '';
  bool _loading = false;
  final _allTags = ['Italian', 'Mexican', 'Bar', 'Pet-friendly', 'Vegan-friendly'];
  final _typeOptions = ['Restaurant', 'Bar', 'Cafe', 'Club', 'Lounge', 'Other'];

  final _nameController = TextEditingController();
  final _descController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a venue name')));
      return;
    }
    setState(() => _loading = true);
    try {
      final ref = FirebaseFirestore.instance.collection('establishments').doc();
      await ref.set({
        'id': ref.id,
        'name': name,
        'type': _selectedType.isEmpty ? 'Restaurant' : _selectedType,
        'area': 'User Submitted',
        'imageUrl': '',
        'score': 0.0,
        'priceRange': _priceRange,
        'distanceKm': 0.0,
        'openUntil': 'Unknown',
        'hasAlcohol': false,
        'hasReservations': false,
        'hasDeals': false,
        'isActive': false,
        'tags': _tags.toList(),
        'description': _descController.text.trim(),
        'submittedBy': uid,
        'status': 'pending',
        'createdAt': FieldValue.serverTimestamp(),
      });
      if (uid != null) {
        await FirebaseFirestore.instance.doc('userBalances/$uid').set({
          'userId': uid,
          'balance': FieldValue.increment(150),
          'updatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
        await FirebaseFirestore.instance.doc('users/$uid').set({
          'pointsBalance': FieldValue.increment(150),
          'updatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
      }
      if (mounted) context.push('/review/verify');
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showTypePicker() {
    showModalBottomSheet(
      context: context,
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: _typeOptions.map((t) => ListTile(
          title: Text(t),
          trailing: _selectedType == t ? const Icon(Icons.check, color: AppColors.primary) : null,
          onTap: () {
            setState(() => _selectedType = t);
            Navigator.of(context).pop();
          },
        )).toList(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.textPrimary)),
        title: const Text('Add a Place'),
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Be The First To Add It', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
            const Gap(6),
            const Text("Can't find a place? Add it and post your review right away.", style: TextStyle(fontSize: 13, color: Color(0xFF666666))),
            const Gap(12),
            // P1-15: Reward pill per SOW §1.15
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(color: const Color(0xFF2A2A2A), borderRadius: BorderRadius.circular(100)),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.monetization_on, color: AppColors.pointsGold, size: 16),
                  Gap(6),
                  Text('+150 PTS for adding this venue', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.pointsGold)),
                ],
              ),
            ),
            const Gap(20),
            Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border, style: BorderStyle.solid),
              ),
              child: const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_a_photo_outlined, color: AppColors.primary, size: 28),
                ],
              ),
            ),
            const Gap(20),
            _Label('Venue Name *'),
            const Gap(8),
            _Field(hint: 'Enter establishment name', controller: _nameController),
            const Gap(16),
            _Label('Establishment Type'),
            const Gap(8),
            GestureDetector(
              onTap: _showTypePicker,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(_selectedType.isEmpty ? 'Select type...' : _selectedType, style: TextStyle(color: _selectedType.isEmpty ? AppColors.textTertiary : AppColors.textPrimary, fontSize: 14)),
                    const Icon(Icons.keyboard_arrow_down, color: AppColors.textTertiary),
                  ],
                ),
              ),
            ),
            const Gap(16),
            _Label('Address'),
            const Gap(8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
              child: const Row(
                children: [
                  Expanded(child: Text('Start typing address...', style: TextStyle(color: AppColors.textTertiary, fontSize: 14))),
                  Icon(Icons.my_location, color: AppColors.primary, size: 20),
                ],
              ),
            ),
            const Gap(16),
            _Label('Description'),
            const Gap(8),
            Container(
              height: 100,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
              child: TextField(
                controller: _descController,
                maxLines: null,
                decoration: const InputDecoration(
                  hintText: 'Tell us about this hidden gem...',
                  hintStyle: TextStyle(color: AppColors.textTertiary, fontSize: 13),
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ),
            const Gap(16),
            _Label('Category Tags'),
            const Gap(8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ..._allTags.map((t) => GestureDetector(
                  onTap: () => setState(() => _tags.contains(t) ? _tags.remove(t) : _tags.add(t)),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: _tags.contains(t) ? AppColors.primary : Colors.white,
                      borderRadius: BorderRadius.circular(100),
                      border: Border.all(color: _tags.contains(t) ? AppColors.primary : AppColors.border),
                    ),
                    child: Text(t, style: TextStyle(fontSize: 13, color: _tags.contains(t) ? Colors.white : AppColors.textPrimary)),
                  ),
                )),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(100), border: Border.all(color: AppColors.border)),
                  child: const Icon(Icons.add, size: 16, color: AppColors.textSecondary),
                ),
              ],
            ),
            const Gap(16),
            _Label('Price Range'),
            const Gap(4),
            // P1-16: Price range precedence note per SOW §17.2
            const Text('Price range you set may be updated by the business when they claim this listing.', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            const Gap(8),
            Row(
              children: ['\$', '\$\$', '\$\$\$'].map((p) => GestureDetector(
                onTap: () => setState(() => _priceRange = p),
                child: Container(
                  margin: const EdgeInsets.only(right: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                  decoration: BoxDecoration(
                    color: _priceRange == p ? Colors.transparent : Colors.white,
                    borderRadius: BorderRadius.circular(100),
                    border: Border.all(color: _priceRange == p ? AppColors.primary : AppColors.border, width: _priceRange == p ? 2 : 1),
                  ),
                  child: Text(p, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _priceRange == p ? AppColors.primary : AppColors.textPrimary)),
                ),
              )).toList(),
            ),
            const Gap(16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(10)),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, color: AppColors.primary, size: 16),
                  Gap(8),
                  Expanded(child: Text('This listing will be marked Unclaimed until the business verifies ownership through our portal.', style: TextStyle(fontSize: 12, color: AppColors.primary))),
                ],
              ),
            ),
            const Gap(24),
            AppButton(label: _loading ? 'Saving...' : 'Save & Continue', onTap: _loading ? null : _save),
            const Gap(32),
          ],
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);

  @override
  Widget build(BuildContext context) => Text(text, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1A1A1A)));
}

class _Field extends StatelessWidget {
  final String hint;
  final TextEditingController? controller;
  const _Field({required this.hint, this.controller});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
    child: TextField(
      controller: controller,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.textTertiary, fontSize: 14),
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        isDense: true,
        contentPadding: EdgeInsets.zero,
      ),
    ),
  );
}
