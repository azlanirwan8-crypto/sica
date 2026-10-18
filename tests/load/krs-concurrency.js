/**
 * k6 Concurrency & Race Condition Load Test — SICA Open Wiring (KRS Online)
 *
 * Skenario: 150 mahasiswa serentak menekan tombol "Submit KRS" untuk 1 kursi kelas tersisa.
 * Validasi Penegakan:
 * 1. Tepat 1 transaksi berhasil mendapatkan kursi kelas (HTTP 200/201)
 * 2. 149 transaksi lainnya menerima respon penolakan kuota penuh (HTTP 422 / CLASS_FULL)
 *    atau dialokasikan ke tabel antrean waitlist (AC-KRS-3).
 * 3. Tidak terjadi over-enrollment (kapasitas terlampaui).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

export const successEnrollmentCounter = new Counter('successful_enrollments');
export const rejectedEnrollmentCounter = new Counter('rejected_due_to_capacity');

export const options = {
  scenarios: {
    krs_rush_burst: {
      executor: 'per-vu-iterations',
      vus: 150, // 150 concurrent users serentak
      iterations: 1,
      maxDuration: '10s',
    },
  },
  thresholds: {
    // Tepat 1 enrollment yang berhasil masuk
    'successful_enrollments': ['count == 1'],
    // 149 mahasiswa harus ditolak secara atomik
    'rejected_due_to_capacity': ['count == 149'],
    // Latensi respon 95% di bawah 500ms
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const TARGET_CLASS_ID = '11111111-2222-3333-4444-555555555555';
const TARGET_PERIOD_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

export default function () {
  const url = `${BASE_URL}/api/v1/academic/krs/submit`;

  const payload = JSON.stringify({
    periodId: TARGET_PERIOD_ID,
    classIds: [TARGET_CLASS_ID],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': 'demo',
      'Authorization': `Bearer mock_jwt_token_user_${__VU}`,
    },
  };

  const response = http.post(url, payload, params);

  if (response.status === 200 || response.status === 201) {
    successEnrollmentCounter.add(1);
    check(response, {
      'status is 200/201 (Enrolled)': (r) => r.status === 200 || r.status === 201,
    });
  } else {
    rejectedEnrollmentCounter.add(1);
    check(response, {
      'status is 422 or 409 (Capacity Full)': (r) => r.status === 422 || r.status === 409,
    });
  }

  sleep(0.1);
}
