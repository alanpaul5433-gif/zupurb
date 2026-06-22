import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../../theme/dimens.dart';
import '../../widgets/app_button.dart';

class TimeSlotScreen extends StatefulWidget {
  final Map<String, dynamic> args;
  const TimeSlotScreen({super.key, this.args = const {}});

  @override
  State<TimeSlotScreen> createState() => _TimeSlotScreenState();
}

class _TimeSlotScreenState extends State<TimeSlotScreen> {
  static const _weekdays = ['', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  static const _months = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // (label, hour24, minute)
  static const _timeSlots = [
    ('5:30 PM', 17, 30), ('6:00 PM', 18, 0), ('7:00 PM', 19, 0),
    ('7:30 PM', 19, 30), ('8:00 PM', 20, 0), ('9:30 PM', 21, 30),
  ];

  int _party = 4;
  int _dayIndex = 0;
  int _slotIndex = 3;
  late final List<DateTime> _days;

  String get _estId => (widget.args['estId'] ?? '').toString();
  String get _estName => (widget.args['estName'] ?? 'Reserve a table').toString();
  String get _imageUrl => (widget.args['imageUrl'] ?? '').toString();

  @override
  void initState() {
    super.initState();
    final today = DateTime.now();
    final base = DateTime(today.year, today.month, today.day);
    _days = List.generate(14, (i) => base.add(Duration(days: i)));
  }

  DateTime get _scheduledAt {
    final d = _days[_dayIndex];
    final s = _timeSlots[_slotIndex];
    return DateTime(d.year, d.month, d.day, s.$2, s.$3);
  }

  void _continue() {
    final at = _scheduledAt;
    if (at.isBefore(DateTime.now().add(const Duration(hours: 1)))) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please pick a time at least 1 hour from now.'), duration: Duration(seconds: 2)),
      );
      return;
    }
    if (_estId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Open this from a venue to make a reservation.')),
      );
      return;
    }
    context.push('/reservation/confirm', extra: {
      'estId': _estId,
      'estName': _estName,
      'imageUrl': _imageUrl,
      'partySize': _party,
      'scheduledAtIso': at.toUtc().toIso8601String(),
      'slotLabel': _timeSlots[_slotIndex].$1,
      'dayLabel': '${_weekdays[_days[_dayIndex].weekday]} ${_days[_dayIndex].day}',
    });
  }

  @override
  Widget build(BuildContext context) {
    final monthLabel = '${_months[_days[_dayIndex].month]} ${_days[_dayIndex].year}';
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0ED),
      appBar: AppBar(
        leading: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_ios, size: 20, color: AppColors.textPrimary)),
        title: Text(_estName, style: const TextStyle(color: AppColors.primary)),
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
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      image: _imageUrl.isNotEmpty
                          ? DecorationImage(image: NetworkImage(_imageUrl), fit: BoxFit.cover)
                          : null,
                    ),
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black.withValues(alpha: 0.7)]),
                      ),
                      padding: const EdgeInsets.all(14),
                      alignment: Alignment.bottomLeft,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('RESERVE A TABLE', style: TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.5)),
                          Text(_estName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
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
                            Semantics(
                              label: 'Decrease party size',
                              button: true,
                              child: GestureDetector(
                                onTap: () => setState(() { if (_party > 1) _party--; }),
                                child: const SizedBox(
                                  width: 44,
                                  height: 44,
                                  child: Center(
                                    child: CircleAvatar(radius: 16, backgroundColor: AppColors.border, child: Icon(Icons.remove, size: 16)),
                                  ),
                                ),
                              ),
                            ),
                            const Gap(12),
                            Text('$_party', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                            const Gap(12),
                            Semantics(
                              label: 'Increase party size',
                              button: true,
                              child: GestureDetector(
                                onTap: () => setState(() { if (_party < 20) _party++; }),
                                child: const SizedBox(
                                  width: 44,
                                  height: 44,
                                  child: Center(
                                    child: CircleAvatar(radius: 16, backgroundColor: AppColors.primary, child: Icon(Icons.add, size: 16, color: Colors.white)),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const Gap(16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Select Date', style: TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w500)),
                            Text(monthLabel, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
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
                                    Text(_weekdays[e.value.weekday], style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _dayIndex == e.key ? Colors.white : AppColors.textSecondary)),
                                    const Gap(2),
                                    Text('${e.value.day}', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _dayIndex == e.key ? Colors.white : AppColors.textPrimary)),
                                  ],
                                ),
                              ),
                            )).toList(),
                          ),
                        ),
                        const Gap(16),
                        const Text('Select Time', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                        const Gap(10),
                        GridView.count(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisCount: 3,
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          childAspectRatio: 2.6,
                          children: _timeSlots.asMap().entries.map((e) {
                            final sel = _slotIndex == e.key;
                            return GestureDetector(
                              onTap: () => setState(() => _slotIndex = e.key),
                              child: Container(
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: sel ? AppColors.primary : AppColors.border, width: sel ? 1.5 : 1),
                                ),
                                child: Text(e.value.$1, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: sel ? AppColors.primary : AppColors.textPrimary)),
                              ),
                            );
                          }).toList(),
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
            child: AppButton(label: 'Save & Continue', onTap: _continue),
          ),
        ],
      ),
    );
  }
}
