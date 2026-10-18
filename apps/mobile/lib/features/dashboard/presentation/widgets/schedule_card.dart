import 'package:flutter/material.dart';
import '../../../../core/theme/color_tokens.dart';

enum ScheduleStatus { upcoming, ongoing, completed }

class ScheduleCard extends StatelessWidget {
  final String courseCode;
  final String courseName;
  final String className;
  final int sks;
  final String time;
  final String room;
  final String lecturer;
  final ScheduleStatus status;
  final VoidCallback? onAttendancePressed;

  const ScheduleCard({
    super.key,
    required this.courseCode,
    required this.courseName,
    required this.className,
    required this.sks,
    required this.time,
    required this.room,
    required this.lecturer,
    this.status = ScheduleStatus.upcoming,
    this.onAttendancePressed,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (status) {
      ScheduleStatus.ongoing => SicaColors.success,
      ScheduleStatus.upcoming => SicaColors.primary,
      ScheduleStatus.completed => SicaColors.textMutedLight,
    };

    final statusLabel = switch (status) {
      ScheduleStatus.ongoing => 'SEDANG BERLANGSUNG',
      ScheduleStatus.upcoming => 'MENDATANG',
      ScheduleStatus.completed => 'SELESAI',
    };

    return Card(
      color: Colors.white,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: SicaColors.borderLight),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Code, SKS, Status Badge
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text(
                      courseCode,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: SicaColors.primary,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: SicaColors.canvasLight,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '$sks SKS • Kelas $className',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: SicaColors.textBodyLight,
                        ),
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    statusLabel,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: statusColor,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Course Name
            Text(
              courseName,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: SicaColors.textHeadingLight,
              ),
            ),
            const SizedBox(height: 4),

            // Lecturer Name
            Text(
              '👤 $lecturer',
              style: const TextStyle(
                fontSize: 12,
                color: SicaColors.textMutedLight,
              ),
            ),
            const SizedBox(height: 12),
            const Divider(height: 1, color: SicaColors.borderLight),
            const SizedBox(height: 12),

            // Bottom Row: Time, Room, and Quick Action
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.access_time_rounded, size: 16, color: SicaColors.textMutedLight),
                    const SizedBox(width: 4),
                    Text(
                      time,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(width: 14),
                    const Icon(Icons.room_rounded, size: 16, color: SicaColors.textMutedLight),
                    const SizedBox(width: 4),
                    Text(
                      room,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                if (status == ScheduleStatus.ongoing)
                  InkWell(
                    onTap: onAttendancePressed,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: SicaColors.success,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.qr_code_scanner_rounded, size: 14, color: Colors.white),
                          SizedBox(width: 4),
                          Text(
                            'Scan Presensi',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
