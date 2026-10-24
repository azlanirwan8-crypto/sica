'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, CheckCircle2, Clock3, Inbox, Search, Users } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardHeading, CardTitle } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { MetaRow, PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface AdviseeStudent {
  id: string;
  nim: string;
  fullName: string;
  studyProgram: string;
  semester: number;
  totalSksSubmitted: number;
  maxSksAllowed: number;
  ipsPrevious: number;
  ipkCumulative: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
}

const INITIAL_ADVISEES: AdviseeStudent[] = [
  {
    id: 'adv-01',
    nim: '2201010045',
    fullName: 'Ahmad Faiz Muzaki',
    studyProgram: 'Teknik Informatika (S1)',
    semester: 5,
    totalSksSubmitted: 21,
    maxSksAllowed: 24,
    ipsPrevious: 3.82,
    ipkCumulative: 3.78,
    status: 'PENDING',
    submittedAt: '18 Okt 2026, 09:30',
  },
  {
    id: 'adv-02',
    nim: '2201010012',
    fullName: 'Dewi Anggraini',
    studyProgram: 'Teknik Informatika (S1)',
    semester: 5,
    totalSksSubmitted: 24,
    maxSksAllowed: 24,
    ipsPrevious: 3.90,
    ipkCumulative: 3.85,
    status: 'APPROVED',
    submittedAt: '17 Okt 2026, 14:15',
  },
  {
    id: 'adv-03',
    nim: '2201010088',
    fullName: 'Rizky Ramadhan',
    studyProgram: 'Teknik Informatika (S1)',
    semester: 5,
    totalSksSubmitted: 22,
    maxSksAllowed: 20,
    ipsPrevious: 2.85,
    ipkCumulative: 3.12,
    status: 'PENDING',
    submittedAt: '18 Okt 2026, 11:00',
  },
  {
    id: 'adv-04',
    nim: '2201010023',
    fullName: 'Siti Sarah Nurhaliza',
    studyProgram: 'Teknik Informatika (S1)',
    semester: 5,
    totalSksSubmitted: 18,
    maxSksAllowed: 20,
    ipsPrevious: 2.95,
    ipkCumulative: 3.20,
    status: 'APPROVED',
    submittedAt: '16 Okt 2026, 16:40',
  },
  {
    id: 'adv-05',
    nim: '2201010077',
    fullName: 'Budi Santoso',
    studyProgram: 'Teknik Informatika (S1)',
    semester: 5,
    totalSksSubmitted: 15,
    maxSksAllowed: 18,
    ipsPrevious: 2.20,
    ipkCumulative: 2.65,
    status: 'REJECTED',
    submittedAt: '15 Okt 2026, 10:20',
  },
];

type SortKey = 'fullName' | 'ipsPrevious' | 'ipkCumulative' | 'totalSksSubmitted' | 'submittedAt' | 'status';

export default function AdvisorApprovalPage() {
  const [advisees, setAdvisees] = useState<AdviseeStudent[]>(INITIAL_ADVISEES);
  const [selectedStudent, setSelectedStudent] = useState<AdviseeStudent | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const totalAdvisees = advisees.length;
  const pendingCount = advisees.filter((a) => a.status === 'PENDING').length;
  const approvedCount = advisees.filter((a) => a.status === 'APPROVED').length;
  const rejectedCount = advisees.filter((a) => a.status === 'REJECTED').length;

  const handleApprove = (studentId: string) => {
    setAdvisees((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status: 'APPROVED' } : s))
    );
    setSelectedStudent(null);
    setNotification('Pengajuan KRS mahasiswa berhasil disetujui (Approved).');
    setTimeout(() => setNotification(null), 4000);
  };

  const handleReject = (studentId: string) => {
    setAdvisees((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status: 'REJECTED' } : s))
    );
    setSelectedStudent(null);
    setNotification('Pengajuan KRS mahasiswa telah ditolak dengan catatan revisi.');
    setTimeout(() => setNotification(null), 4000);
  };

  const visibleRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = query
      ? advisees.filter(
          (item) =>
            item.fullName.toLowerCase().includes(query) || item.nim.toLowerCase().includes(query),
        )
      : advisees;

    if (!sortKey) return filtered;

    return [...filtered].sort((left, right) => {
      const a = left[sortKey];
      const b = right[sortKey];
      const direction = sortOrder === 'asc' ? 1 : -1;
      if (typeof a === 'number' && typeof b === 'number') return (a - b) * direction;
      return String(a).localeCompare(String(b)) * direction;
    });
  }, [advisees, searchTerm, sortKey, sortOrder]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortKey(null);
        setSortOrder('asc');
      }
      return;
    }
    setSortKey(key);
    setSortOrder('asc');
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Approval KRS Dosen Pembimbing Akademik (DPA)"
        description="Verifikasi rencana studi dan beban SKS mahasiswa bimbingan akademik Anda • Semester Ganjil 2025/2026"
        crumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Akademik' }, { label: 'Approval DPA' }]}
        actions={
          pendingCount > 0 ? (
            <Badge tone="warning" look="label" size="lg">
              <Clock3 size={13} strokeWidth={2} aria-hidden />
              {pendingCount} menunggu review
            </Badge>
          ) : (
            <Badge tone="success" look="label" size="lg">
              <CheckCircle2 size={13} strokeWidth={2} aria-hidden />
              Semua pengajuan selesai
            </Badge>
          )
        }
      />

      {notification ? <Alert tone="success" title="Pengajuan diperbarui">{notification}</Alert> : null}

      <section aria-label="Ringkasan bimbingan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Bimbingan"
          value={String(totalAdvisees)}
          hint="Mahasiswa Aktif"
          icon={<Users size={16} strokeWidth={2} aria-hidden />}
        />
        <StatCard
          label="Menunggu Review"
          value={String(pendingCount)}
          hint="Perlu Tindakan Cepat"
          icon={<Clock3 size={16} strokeWidth={2} aria-hidden />}
        />
        <StatCard
          label="Telah Disetujui"
          value={String(approvedCount)}
          hint="KRS Terverifikasi"
          icon={<BadgeCheck size={16} strokeWidth={2} aria-hidden />}
        />
        <StatCard
          label="Perlu Revisi"
          value={String(rejectedCount)}
          hint="Dikembalikan ke Mahasiswa"
          icon={<AlertTriangle size={16} strokeWidth={2} aria-hidden />}
        />
      </section>

      <Card>
        <CardHeader className="flex-wrap">
          <CardHeading>
            <CardTitle>Daftar Mahasiswa Bimbingan Akademik</CardTitle>
            <CardDescription>
              Klik tombol Setujui untuk meratifikasi KRS atau Tolak jika rencana studi tidak sesuai
              beban SKS.
            </CardDescription>
          </CardHeading>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="secondary" look="label">
              {visibleRows.length} dari {totalAdvisees} entri
            </Badge>
            <Input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Cari nama atau NIM mahasiswa..."
              aria-label="Cari nama atau NIM mahasiswa"
              startIcon={<Search size={15} strokeWidth={2} aria-hidden />}
              className="w-full sm:w-72"
            />
          </div>
        </CardHeader>

        {visibleRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Inbox size={18} strokeWidth={2} aria-hidden />
            </span>
            <p className="text-sm font-semibold text-[color:var(--sica-text-heading)]">
              Tidak ada data ditemukan.
            </p>
            <p className="max-w-sm text-[13px] leading-relaxed text-[color:var(--sica-text-muted)]">
              Belum ada mahasiswa bimbingan yang cocok dengan kata kunci
              {searchTerm.trim() ? ` “${searchTerm.trim()}”` : ''}. Kosongkan pencarian untuk melihat
              seluruh pengajuan.
            </p>
            {searchTerm ? (
              <Button variant="soft" size="sm" className="mt-1" onClick={() => setSearchTerm('')}>
                Bersihkan pencarian
              </Button>
            ) : null}
          </div>
        ) : (
          <Table>
            <THead>
              <TH sortable active={sortKey === 'fullName'} onSort={() => toggleSort('fullName')}>
                Mahasiswa
              </TH>
              <TH sortable active={sortKey === 'ipsPrevious'} onSort={() => toggleSort('ipsPrevious')}>
                IPS / IPK
              </TH>
              <TH
                align="center"
                sortable
                active={sortKey === 'totalSksSubmitted'}
                onSort={() => toggleSort('totalSksSubmitted')}
              >
                Beban SKS
              </TH>
              <TH
                sortable
                active={sortKey === 'submittedAt'}
                onSort={() => toggleSort('submittedAt')}
              >
                Waktu Pengajuan
              </TH>
              <TH align="center" sortable active={sortKey === 'status'} onSort={() => toggleSort('status')}>
                Status
              </TH>
              <TH align="right">Aksi</TH>
            </THead>
            <TBody>
              {visibleRows.map((item) => {
                const isExceeded = item.totalSksSubmitted > item.maxSksAllowed;
                const ratio =
                  item.maxSksAllowed > 0
                    ? Math.min(100, (item.totalSksSubmitted / item.maxSksAllowed) * 100)
                    : 0;
                return (
                  <TR key={item.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={item.fullName} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium text-[color:var(--sica-text-heading)]">
                            {item.fullName}
                          </p>
                          <p className="text-[11.5px] tabular text-[color:var(--sica-text-muted)]">
                            NIM: {item.nim} • Sem. {item.semester}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <div className="flex flex-col gap-0.5 text-[12px] text-[color:var(--sica-text-muted)]">
                        <span>
                          IPS Lalu:{' '}
                          <span className="font-semibold tabular text-primary-hover">
                            {item.ipsPrevious.toFixed(2)}
                          </span>
                        </span>
                        <span>
                          IPK:{' '}
                          <span className="font-semibold tabular text-[color:var(--sica-text-heading)]">
                            {item.ipkCumulative.toFixed(2)}
                          </span>
                        </span>
                      </div>
                    </TD>
                    <TD align="center">
                      <div className="mx-auto flex w-40 flex-col gap-1.5">
                        <p
                          className={cn(
                            'text-[13px] font-semibold tabular',
                            isExceeded
                              ? 'text-danger-hover'
                              : 'text-[color:var(--sica-text-heading)]',
                          )}
                        >
                          {item.totalSksSubmitted} SKS
                          <span className="font-normal text-[color:var(--sica-text-muted)]">
                            {' '}/ Maks. {item.maxSksAllowed}
                          </span>
                        </p>
                        <Progress
                          value={ratio}
                          size="sm"
                          tone={isExceeded ? 'danger' : 'success'}
                          label={`Beban SKS ${item.totalSksSubmitted} dari maksimum ${item.maxSksAllowed}`}
                        />
                        {isExceeded ? (
                          <p className="flex items-center justify-center gap-1 text-[11px] font-semibold text-danger-hover">
                            <AlertTriangle size={12} strokeWidth={2.2} aria-hidden />
                            Melampaui Batas
                          </p>
                        ) : null}
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap text-[12.5px] tabular text-[color:var(--sica-text-muted)]">
                      {item.submittedAt}
                    </TD>
                    <TD align="center">
                      <StatusBadge status={item.status} />
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-2">
                        {item.status === 'PENDING' ? (
                          <>
                            <Button variant="soft" size="xs" onClick={() => handleApprove(item.id)}>
                              Setujui
                            </Button>
                            <Button
                              variant="destructive"
                              size="xs"
                              onClick={() => handleReject(item.id)}
                            >
                              Tolak
                            </Button>
                          </>
                        ) : (
                          <Button variant="outline" size="xs" onClick={() => setSelectedStudent(item)}>
                            Lihat Detail
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <Drawer
        open={selectedStudent !== null}
        onClose={() => setSelectedStudent(null)}
        title={selectedStudent?.fullName ?? 'Detail mahasiswa'}
        description={
          selectedStudent
            ? `${selectedStudent.studyProgram} • Semester ${selectedStudent.semester}`
            : undefined
        }
        footer={
          <Button variant="soft" onClick={() => setSelectedStudent(null)}>
            Tutup
          </Button>
        }
      >
        {selectedStudent ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
              <MetaRow
                items={[
                  { label: 'NIM', value: selectedStudent.nim },
                  { label: 'Diajukan', value: selectedStudent.submittedAt },
                ]}
              />
              <StatusBadge status={selectedStudent.status} look="label" />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <span className="section-label">Prestasi</span>
                <span className="text-[13px] font-semibold tabular text-[color:var(--sica-text-heading)]">
                  IPS {selectedStudent.ipsPrevious.toFixed(2)} · IPK {selectedStudent.ipkCumulative.toFixed(2)}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-[color:var(--sica-text-body)]">
                IPS terakhir dipakai sebagai dasar kuota maksimum SKS pada semester berjalan.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <span className="section-label">Beban SKS</span>
                <span
                  className={cn(
                    'text-[13px] font-semibold tabular',
                    selectedStudent.totalSksSubmitted > selectedStudent.maxSksAllowed
                      ? 'text-danger-hover'
                      : 'text-[color:var(--sica-text-heading)]',
                  )}
                >
                  {selectedStudent.totalSksSubmitted} / Maks. {selectedStudent.maxSksAllowed}
                </span>
              </div>
              <Progress
                value={
                  selectedStudent.maxSksAllowed > 0
                    ? Math.min(
                        100,
                        (selectedStudent.totalSksSubmitted / selectedStudent.maxSksAllowed) * 100,
                      )
                    : 0
                }
                tone={
                  selectedStudent.totalSksSubmitted > selectedStudent.maxSksAllowed ? 'danger' : 'success'
                }
                label="Beban SKS terhadap maksimum"
              />
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
