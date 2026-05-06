import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class TimeSlotScreen extends StatefulWidget {
  const TimeSlotScreen({super.key});

  @override
  State<TimeSlotScreen> createState() => _TimeSlotScreenState();
}

class _TimeSlotScreenState extends State<TimeSlotScreen> {
  int _party = 4;
  int _dayIndex = 0;
  String _selectedSlot = '7:30 PM';

  final _days = [
    ('MON', '23'), ('TUE', '24'), ('WED', '25'), ('THU', '26'), ('SAT', '28'), ('FR', '27'),
  ];

  final _slots = [
    ('5:30 PM', 30, true), ('6:00 PM', 30, true), ('7:00 PM', 10, true),
    ('7:30 PM', 10, false), ('8:00 PM', 10, false), ('9:30 PM', 30, true),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.textPrimary)),
        title: const Text('The Social Lounge', style: TextStyle(color: AppColors.primary)),
        backgroundColor: const Color(0xFFF5F0ED),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  Container(
                    height: 160,
                    decoration: const BoxDecoration(
                      image: DecorationImage(
                        image: NetworkImage('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'),
                        fit: BoxFit.cover,
                      ),
                    ),
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black.withOpacity(0.7)]),
                      ),
                      padding: const EdgeInsets.all(14),
                      alignment: Alignment.bottomLeft,
                      child: const Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('TRENDING NEARBY', style: TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.5)),
                          Text('The Espresso Lab', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(AppDimens.screenPadding),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Text('Party Size', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                            const Spacer(),
                            GestureDetector(
                              onTap: () => setState(() { if (_party > 1) _party--; }),
                              child: const CircleAvatar(radius: 16, backgroundColor: AppColors.border, child: Icon(Icons.remove, size: 16)),
                            ),
                            const Gap(12),
                            Text('$_party', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                            const Gap(12),
                            GestureDetector(
                              onTap: () => setState(() => _party++),
                              child: const CircleAvatar(radius: 16, backgroundColor: AppColors.primary, child: Icon(Icons.add, size: 16, color: Colors.white)),
                            ),
                          ],
                        ),
                        const Gap(16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Establishment Type', style: TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w500)),
                            const Text('October 2026', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                          ],
                        ),
                        const Gap(12),
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: _days.asMap().entries.map((e) => GestureDetector(
                              onTap: () => setState(() => _dayIndex = e.key),
                              child: Container(
                                margin: const EdgeInsets.only(right: 8),
                                width: 48,
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  color: _dayIndex == e.key ? AppColors.primary : Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: _dayIndex == e.key ? AppColors.primary : AppColors.border),
                                ),
                                child: Column(
                                  children: [
                                    Text(e.value.$1, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _dayIndex == e.key ? Colors.white : AppColors.textSecondary)),
                                    const Gap(2),
                                    Text(e.value.$2, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _dayIndex == e.key ? Colors.white : AppColors.textPrimary)),
                                  ],
                                ),
                              ),
                            )).toList(),
                          ),
                        ),
                        const Gap(16),
                        const Row(
                          children: [
                            Text('Select Time', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                            Spacer(),
                            Icon(Icons.circle, size: 8, color: AppColors.success),
                            Gap(4),
                            Text('30 pts', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                            Gap(10),
                            Icon(Icons.circle, size: 8, color: AppColors.textTertiary),
                            Gap(4),
                            Text('10 pts', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                          ],
                        ),
                        const Gap(10),
                        GridView.count(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisCount: 3,
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          childAspectRatio: 2.2,
                          children: _slots.map((s) => GestureDetector(
                            onTap: () => setState(() => _selectedSlot = s.$1),
                            child: Container(
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: _selectedSlot == s.$1 ? AppColors.primary : AppColors.border, width: _selectedSlot == s.$1 ? 1.5 : 1),
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(s.$1, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _selectedSlot == s.$1 ? AppColors.primary : AppColors.textPrimary)),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.add_circle_outline, size: 10, color: s.$3 ? AppColors.success : AppColors.textTertiary),
                                      const Gap(2),
                                      Text('${s.$2} PTS', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: s.$3 ? AppColors.success : AppColors.textTertiary)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          )).toList(),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppDimens.screenPadding),
            child: AppButton(label: 'Save & Continue', onTap: () => context.go('/reservation/confirm')),
          ),
        ],
      ),
    );
  }
}
