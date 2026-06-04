import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  int _tabIndex = 0;
  bool _openNow = true;
  bool _dealsAvailable = false;
  bool _verifiedReviews = false;
  bool _reservationsAvailable = false; // P1-12
  final String _preferenceFilter = 'All'; // P1-13
  final _tabs = ['All', 'Venues', 'Users', 'Deals', 'Vendors', 'Entertainers', 'Content/Posts', 'Brands'];
  final _searchController = TextEditingController();

  final List<_RecentSearchData> _recentSearches = [
    _RecentSearchData(icon: Icons.history, label: 'Tacos Downtown'),
    _RecentSearchData(icon: Icons.local_bar_outlined, label: 'Rooftop Bar'),
    _RecentSearchData(isUser: true, label: 'Sarah M.'),
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Gap(16),
              Row(
                children: [
                  const Text('Search', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A))),
                  const Spacer(),
                  IconButton(onPressed: () => context.push('/notifications'), tooltip: 'Notifications', icon: const Icon(Icons.notifications_outlined)),
                ],
              ),
              const Gap(12),
              Container(
                height: 48,
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(100), border: Border.all(color: AppColors.border)),
                child: Row(
                  children: [
                    const Gap(16),
                    const Icon(Icons.search, color: AppColors.primary, size: 20),
                    const Gap(8),
                    Expanded(
                      child: TextField(
                        controller: _searchController,
                        decoration: const InputDecoration(
                          hintText: 'Search experiences, creators...',
                          hintStyle: TextStyle(fontSize: 14, color: AppColors.textTertiary),
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                        style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
                        textInputAction: TextInputAction.search,
                        onSubmitted: (v) {
                          if (v.trim().isEmpty) return;
                          context.push('/search/results');
                        },
                      ),
                    ),
                    const Gap(16),
                  ],
                ),
              ),
              const Gap(14),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: _tabs.asMap().entries.map((e) => GestureDetector(
                    onTap: () => setState(() => _tabIndex = e.key),
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
                      decoration: BoxDecoration(
                        color: _tabIndex == e.key ? AppColors.primary : Colors.white,
                        borderRadius: BorderRadius.circular(100),
                        border: Border.all(color: _tabIndex == e.key ? AppColors.primary : AppColors.border),
                      ),
                      child: Text(e.value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _tabIndex == e.key ? Colors.white : AppColors.textPrimary)),
                    ),
                  )).toList(),
                ),
              ),
              const Gap(16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Detailed Filters', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                        Text('RESET ALL', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
                      ],
                    ),
                    const Gap(16),
                    _FilterRow(label: 'Establishment type', value: 'All', isDropdown: true),
                    const Gap(4),
                    const Text('Radius', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                    const Gap(4),
                    Row(
                      children: [
                        Expanded(child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(value: 0.3, backgroundColor: AppColors.border, color: AppColors.primary, minHeight: 4),
                        )),
                        const Gap(8),
                        const Text('5 km', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                      ],
                    ),
                    const Gap(12),
                    _FilterRow(label: 'Min Score', value: 'Any', isDropdown: true),
                    const Gap(12),
                    _ToggleRow(label: 'Deals available', value: _dealsAvailable, onChanged: (v) => setState(() => _dealsAvailable = v)),
                    const Gap(8),
                    _ToggleRow(label: 'Open now', value: _openNow, onChanged: (v) => setState(() => _openNow = v)),
                    const Gap(8),
                    _ToggleRow(label: 'Verified reviews', value: _verifiedReviews, onChanged: (v) => setState(() => _verifiedReviews = v)),
                    const Gap(8),
                    // P1-12: Reservations available filter
                    _ToggleRow(label: 'Reservations available', value: _reservationsAvailable, onChanged: (v) => setState(() => _reservationsAvailable = v)),
                    const Gap(12),
                    // P1-13: By preference (activity-type) filter
                    _FilterRow(label: 'By preference', value: _preferenceFilter, isDropdown: true),
                    const Gap(12),
                    _FilterRow(label: 'Cuisine type', value: 'Any', isDropdown: true),
                    const Gap(12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Demographic match', style: TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                        const Icon(Icons.info_outline, size: 16, color: AppColors.textTertiary),
                      ],
                    ),
                    const Gap(16),
                    AppButton(
                      label: 'Search',
                      onTap: () {
                        if (_searchController.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Enter a search term'), duration: Duration(seconds: 2)),
                          );
                          return;
                        }
                        context.push('/search/results');
                      },
                    ),
                  ],
                ),
              ),
              const Gap(20),
              const Text('Recent Searches', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
              const Gap(12),
              ..._recentSearches.asMap().entries.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _RecentSearchItem(
                  icon: e.value.icon,
                  label: e.value.label,
                  isUser: e.value.isUser,
                  onTap: () {
                    _searchController.text = e.value.label;
                    context.push('/search/results');
                  },
                  onRemove: () => setState(() => _recentSearches.removeAt(e.key)),
                ),
              )),
              const Gap(140),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isDropdown;

  const _FilterRow({required this.label, required this.value, this.isDropdown = false});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Filter options coming soon'), duration: Duration(seconds: 2))),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
          Row(children: [
            Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
            if (isDropdown) const Icon(Icons.keyboard_arrow_down, size: 16, color: AppColors.textSecondary),
          ]),
        ],
      ),
    );
  }
}

class _ToggleRow extends StatelessWidget {
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _ToggleRow({required this.label, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
        Semantics(
          label: '$label filter',
          child: Switch(value: value, onChanged: onChanged),
        ),
      ],
    );
  }
}

class _RecentSearchData {
  final IconData? icon;
  final String label;
  final bool isUser;
  const _RecentSearchData({this.icon, required this.label, this.isUser = false});
}

class _RecentSearchItem extends StatelessWidget {
  final IconData? icon;
  final String label;
  final bool isUser;
  final VoidCallback? onRemove;
  final VoidCallback? onTap;

  const _RecentSearchItem({this.icon, required this.label, this.isUser = false, this.onRemove, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          isUser
              ? CircleAvatar(radius: 16, backgroundImage: const NetworkImage('https://i.pravatar.cc/150?img=44'), onBackgroundImageError: (e, s) {})
              : Container(
                  width: 32,
                  height: 32,
                  decoration: const BoxDecoration(color: AppColors.background, shape: BoxShape.circle),
                  child: Icon(icon, size: 16, color: AppColors.textSecondary),
                ),
          const Gap(12),
          Text(label, style: const TextStyle(fontSize: 14, color: AppColors.textPrimary)),
          const Spacer(),
          Semantics(
            label: 'Remove $label from recent searches',
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: (onRemove != null) ? () {
                onRemove!();
              } : null,
              child: const SizedBox(
                width: 44,
                height: 44,
                child: Center(child: Icon(Icons.close, size: 16, color: AppColors.textTertiary)),
              ),
            ),
          ),
        ],
      ),
      ),
    );
  }
}
