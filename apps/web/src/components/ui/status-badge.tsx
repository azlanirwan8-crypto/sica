import * as React from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Peta status kanonik (enum DB) → nada badge + label Indonesia.
 * Sumber enum: packages/database/src/schema/enums.ts dan register
 * docs/DATA_MODEL.md §15. Label tetap harus lewat kamus i18n bila dipakai di
 * layar; komponen ini khusus untuk *warna* agar chip tidak lagi ditembak tebak.
 */
const TONE: Record<string, NonNullable<BadgeProps['tone']>> = {
  // enrollment_status
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  EFFECTIVE: 'primary',
  WITHDRAWN: 'secondary',
  CANCELLED: 'neutral',
  // invoice_status
  ISSUED: 'info',
  PARTIAL: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  WAIVED: 'secondary',
  VOID: 'neutral',
  // payment_status
  INITIATED: 'neutral',
  PENDING: 'warning',
  SETTLED: 'success',
  FAILED: 'danger',
  REFUNDED: 'secondary',
  // grade_status
  EMPTY: 'neutral',
  LOCKED: 'secondary',
  CORRECTING: 'warning',
  CORRECTED: 'primary',
  // period_status
  OPEN: 'success',
  CLOSING: 'warning',
  CLOSED: 'neutral',
  // attendance_status
  PRESENT: 'success',
  EXCUSED: 'info',
  SICK: 'info',
  ABSENT_LATE: 'warning',
  ABSENT: 'danger',
  // student_status
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
  GRADUATED: 'primary',
  DROPPED: 'danger',
  STOPPED: 'neutral',
  TRANSFERRED: 'secondary',
  EXPELLED: 'danger',
  CANDIDATE: 'info',
  // tenant / module / access
  TRIAL: 'info',
  DISABLED: 'neutral',
  EXPIRED: 'danger',
  PAST_DUE: 'warning',
  ONBOARDING: 'info',
  SUSPENDED: 'danger',
  ARCHIVED: 'neutral',
  PENDING_PAYMENT: 'warning',
  // grant dukungan terawasi (0083)
  GRANTED: 'info',
  ENDED: 'neutral',
  REVOKED: 'danger',
  // virtual account & clearance
  USED: 'success',
  RESERVED: 'info',
  RECYCLED: 'secondary',
  LIFTED: 'success',
  BLOCK: 'danger',
  WARN: 'warning',
};

export type StatusTone = NonNullable<BadgeProps['tone']>;

export function toneForStatus(status: string | null | undefined): StatusTone {
  if (!status) return 'neutral';
  return TONE[status.toUpperCase()] ?? 'neutral';
}

/** Label Indonesia singkat per status (fallback: status apa adanya). */
const LABEL: Record<string, string> = {
  DRAFT: 'Draf',
  SUBMITTED: 'Terkirim',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  EFFECTIVE: 'Aktif',
  WITHDRAWN: 'Ditarik',
  CANCELLED: 'Dibatalkan',
  ISSUED: 'Terbit',
  PARTIAL: 'Sebagian',
  PAID: 'Lunas',
  OVERDUE: 'Tunggak',
  WAIVED: 'Dibebaskan',
  VOID: 'Batal',
  INITIATED: 'Dimulai',
  PENDING: 'Menunggu',
  SETTLED: 'Selesai',
  FAILED: 'Gagal',
  REFUNDED: 'Dikembalikan',
  EMPTY: 'Kosong',
  LOCKED: 'Terkunci',
  CORRECTING: 'Koreksi',
  CORRECTED: 'Dikoreksi',
  OPEN: 'Dibuka',
  CLOSING: 'Tutup Bersamaan',
  CLOSED: 'Ditutup',
  PRESENT: 'Hadir',
  EXCUSED: 'Izin',
  SICK: 'Sakit',
  ABSENT_LATE: 'Terlambat',
  ABSENT: 'Alpa',
  ACTIVE: 'Aktif',
  ON_LEAVE: 'Cuti',
  GRADUATED: 'Lulus',
  DROPPED: 'DO',
  STOPPED: 'Stop',
  TRANSFERRED: 'Pindah',
  EXPELLED: 'Diberhentikan',
  CANDIDATE: 'Kandidat',
  TRIAL: 'Uji Coba',
  DISABLED: 'Nonaktif',
  EXPIRED: 'Kedaluwarsa',
  PAST_DUE: 'Melewat Jatuh Tempo',
  ONBOARDING: 'Onboarding',
  SUSPENDED: 'Ditangguhkan',
  ARCHIVED: 'Diarsip',
  GRANTED: 'Diberikan',
  ENDED: 'Selesai',
  REVOKED: 'Dicabut',
  PENDING_PAYMENT: 'Menunggu Bayar',
  USED: 'Terpakai',
  RESERVED: 'Ditahan',
  RECYCLED: 'Daur Ulang',
  LIFTED: 'Dilepas',
  BLOCK: 'Diblokir',
  WARN: 'Peringatan',
};

export function labelForStatus(status: string | null | undefined): string {
  if (!status) return '—';
  return LABEL[status.toUpperCase()] ?? status;
}

export function StatusBadge({
  status,
  look = 'soft',
  className,
  label,
}: {
  readonly status: string | null | undefined;
  readonly look?: BadgeProps['look'];
  readonly className?: string;
  readonly label?: string;
}) {
  return (
    <Badge tone={toneForStatus(status)} look={look} dot className={cn('whitespace-nowrap', className)}>
      {label ?? labelForStatus(status)}
    </Badge>
  );
}
