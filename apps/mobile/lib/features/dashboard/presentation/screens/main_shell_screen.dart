import 'package:flutter/material.dart';
import '../../../../core/theme/color_tokens.dart';
import '../../profile/presentation/widgets/digital_ktm_card.dart';
import '../widgets/schedule_card.dart';
import '../widgets/custom_bottom_nav.dart';

class MainShellScreen extends StatefulWidget {
  final VoidCallback? onScanQrRequested;

  const MainShellScreen({super.key, this.onScanQrRequested});

  @override
  State<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends State<MainShellScreen> {
  int _currentTabIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SicaColors.canvasLight,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: SicaColors.primary,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.school, color: Colors.white, size: 18),
            ),
            const SizedBox(width: 10),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'SICA Academic',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                Text(
                  'Semester Ganjil 2025/2026',
                  style: TextStyle(fontSize: 11, color: SicaColors.textMutedLight),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none_rounded),
            onPressed: () {},
          ),
        ],
      ),
      body: _buildCurrentTab(),
      bottomNavigationBar: CustomBottomNav(
        currentIndex: _currentTabIndex,
        onTabSelected: (index) => setState(() => _currentTabIndex = index),
        onScanPressed: () {
          widget.onScanQrRequested?.call();
        },
      ),
    );
  }

  Widget _buildCurrentTab() {
    return switch (_currentTabIndex) {
      0 => _buildHomeTab(),
      1 => _buildScheduleTab(),
      2 => _buildGradesTab(),
      3 => _buildProfileTab(),
      _ => _buildHomeTab(),
    };
  }

  Widget _buildHomeTab() {
    return RefreshIndicator(
      onRefresh: () async {
        await Future<void>.delayed(const Duration(milliseconds: 600));
      },
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // 1. Digital KTM Card
          const DigitalKtmCard(
            fullName: 'Ahmad Faiz Muzaki',
            nim: '2201010045',
            studyProgram: 'Teknik Informatika (S1)',
          ),
          const SizedBox(height: 20),

          // 2. Academic Metric Quick Stats
          Row(
            children: [
              Expanded(
                child: _buildMetricCard(
                  title: 'IPK Kumulatif',
                  value: '3.78',
                  icon: Icons.emoji_events_rounded,
                  color: SicaColors.success,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMetricCard(
                  title: 'SKS Selesai',
                  value: '118 SKS',
                  icon: Icons.menu_book_rounded,
                  color: SicaColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMetricCard(
                  title: 'Kehadiran',
                  value: '95.2%',
                  icon: Icons.verified_user_rounded,
                  color: SicaColors.info,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // 3. Section Title: Jadwal Kuliah Hari Ini
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Jadwal Kuliah Hari Ini',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: SicaColors.textHeadingLight,
                ),
              ),
              Text(
                'Senin, 18 Okt 2026',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: SicaColors.textMutedLight,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Schedule Cards
          ScheduleCard(
            courseCode: 'IF-3101',
            courseName: 'Kecerdasan Buatan & Machine Learning',
            className: 'IF-A',
            sks: 3,
            time: '08:00 - 10:30',
            room: 'Lab AI 3.1',
            lecturer: 'Dr. Hendra Wijaya, M.Kom',
            status: ScheduleStatus.ongoing,
            onAttendancePressed: () {
              widget.onScanQrRequested?.call();
            },
          ),
          const ScheduleCard(
            courseCode: 'IF-3102',
            courseName: 'Rekayasa Perangkat Lunak Lanjut',
            className: 'IF-A',
            sks: 4,
            time: '10:45 - 13:15',
            room: 'R. 402',
            lecturer: 'Rina Kusuma, S.T., M.T.',
            status: ScheduleStatus.upcoming,
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: SicaColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: SicaColors.textHeadingLight,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: SicaColors.textMutedLight,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScheduleTab() {
    return const Center(child: Text('Kalender Jadwal Kuliah Semester Ini'));
  }

  Widget _buildGradesTab() {
    return const Center(child: Text('Kartu Hasil Studi (KHS) & Transkrip'));
  }

  Widget _buildProfileTab() {
    return const Center(child: Text('Profil Mahasiswa & Pengaturan Akun'));
  }
}
