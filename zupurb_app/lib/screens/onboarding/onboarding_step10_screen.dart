import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';
import '../../state/analytics/analytics_providers.dart';
import '../../state/location/location_providers.dart';

// P0-3: Step 10 — Neighborhood / Location preferences (final onboarding step)
class OnboardingStep10Screen extends ConsumerStatefulWidget {
  const OnboardingStep10Screen({super.key});

  @override
  ConsumerState<OnboardingStep10Screen> createState() =>
      _OnboardingStep10ScreenState();
}

class _OnboardingStep10ScreenState
    extends ConsumerState<OnboardingStep10Screen> {
  final Set<String> _neighborhoods = {};
  String _radius = '5 km';
  bool _locationLoading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(analyticsServiceProvider).logScreen('onboarding_step_10');
    });
  }

  final _radiusOptions = ['1 km', '2 km', '5 km', '10 km', '25 km'];
  final _nearbyNeighborhoods = [
    'Downtown', 'Midtown', 'Westside', 'East Village',
    'SoHo', 'Uptown', 'Financial District', 'Brooklyn Heights',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Gap(12),
                    IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20)),
                    const Gap(12),
                    _buildProgress(),
                    const Gap(24),
                    const Text('Your Neighborhood', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A), height: 1.25)),
                    const Gap(6),
                    const Text("Tell us where you hang out so we can surface the best nearby spots.", style: TextStyle(fontSize: 13, color: Color(0xFF666666))),
                    const Gap(16),
                    // "Use my current location" — auto-fills city + neighborhood via GPS.
                    // Falls back gracefully when permission is denied or GPS unavailable.
                    OutlinedButton.icon(
                      onPressed: _locationLoading ? null : _useCurrentLocation,
                      icon: _locationLoading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                              ),
                            )
                          : const Icon(Icons.my_location, size: 18, color: AppColors.primary),
                      label: Text(
                        _locationLoading ? 'Detecting location...' : 'Use my current location',
                        style: const TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w600),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.primary),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                      ),
                    ),
                    const Gap(20),
                    const Text('Preferred Search Radius', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                    const Gap(10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _radiusOptions.map((r) => GestureDetector(
                        onTap: () => setState(() => _radius = r),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
                          decoration: BoxDecoration(
                            color: _radius == r ? AppColors.primary : Colors.white,
                            borderRadius: BorderRadius.circular(100),
                            border: Border.all(color: _radius == r ? AppColors.primary : AppColors.border),
                          ),
                          child: Text(r, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: _radius == r ? Colors.white : AppColors.textPrimary)),
                        ),
                      )).toList(),
                    ),
                    const Gap(20),
                    const Text('Neighborhoods You Frequent', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                    const Gap(4),
                    const Text('Select any that apply', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    const Gap(10),
                    GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: 2,
                      mainAxisSpacing: 8,
                      crossAxisSpacing: 8,
                      childAspectRatio: 4,
                      children: _nearbyNeighborhoods.map((n) => GestureDetector(
                        onTap: () => setState(() => _neighborhoods.contains(n) ? _neighborhoods.remove(n) : _neighborhoods.add(n)),
                        child: Container(
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _neighborhoods.contains(n) ? AppColors.primary : Colors.white,
                            borderRadius: BorderRadius.circular(100),
                            border: Border.all(color: _neighborhoods.contains(n) ? AppColors.primary : AppColors.border),
                          ),
                          child: Text(n, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: _neighborhoods.contains(n) ? Colors.white : AppColors.textPrimary)),
                        ),
                      )).toList(),
                    ),
                    const Gap(24),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppDimens.screenPadding),
              child: Column(
                children: [
                  AppButton(label: 'Finish Setup', onTap: () => context.go('/onboarding/complete')),
                  const Gap(8),
                  TextButton(
                    onPressed: () => context.go('/onboarding/complete'),
                    child: const Text('Skip', style: TextStyle(color: Color(0xFF666666))),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Resolves GPS position then reverse-geocodes to city + neighborhood.
  /// On failure (denied permission, GPS off, geocoding error) shows a snackbar
  /// and leaves the manual selection intact.
  Future<void> _useCurrentLocation() async {
    setState(() => _locationLoading = true);

    try {
      final mapsService = ref.read(mapsServiceProvider);
      final position = await mapsService.getCurrentLocation();

      if (position == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Could not detect location. Please select manually.'),
              duration: Duration(seconds: 3),
            ),
          );
        }
        return;
      }

      final result = await mapsService.reverseGeocode(
        position.latitude,
        position.longitude,
      );

      if (!mounted) return;

      // Pre-select the detected neighborhood if it matches one of the known chips.
      final detectedNeighborhood = result.neighborhood;
      setState(() {
        if (detectedNeighborhood.isNotEmpty &&
            _nearbyNeighborhoods.contains(detectedNeighborhood)) {
          _neighborhoods.add(detectedNeighborhood);
        }
      });

      // Inform user of detected city even when neighborhood isn't in the preset list.
      final city = result.city.isNotEmpty ? result.city : 'your area';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Location detected: $city'),
          duration: const Duration(seconds: 2),
        ),
      );
    } finally {
      if (mounted) setState(() => _locationLoading = false);
    }
  }

  Widget _buildProgress() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('STEP 10 OF 10', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF999999), letterSpacing: 1)),
        const Gap(6),
        Row(
          children: List.generate(10, (i) => Expanded(
            child: Container(
              margin: const EdgeInsets.only(right: 4),
              height: 3,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          )),
        ),
      ],
    );
  }
}
