/**
 * Jam basis data untuk keputusan kadaluarsa.
 *
 * Alasan ada: pada database terkelola/pooler, `now()` server bisa berbeda dari jam proses
 * Node (di lingkungan dev ini terukur selisih berjam-jam). Keputusan "sudah kedaluwarsa?"
 * yang membandingkan kolom `timestamptz` hasil `now()` DB dengan `Date.now()` lokal akan
 * salah — tantangan MFA bisa dianggap mati seketika. Karena itu semua ambang waktu yang
 * membandingkan data DB memakai offset DB yang diukur ulang tiap 60 detik, bukan jam lokal.
 * Catatan: ini BUKAN pengganti NTP; lingkungan produksi tetap wajib sinkron jam (ADR-8).
 */
import { db, sql } from '@sica/database';

let base: { readonly dbMs: number; readonly localMs: number } | null = null;

export async function dbNowMs(): Promise<number> {
  if (!base || Date.now() - base.localMs > 60_000) {
    const rows = await db.execute<{ ms: number | string }>(sql`SELECT extract(epoch FROM now()) * 1000 AS ms`);
    const first = rows[0] as { ms: number | string } | undefined;
    if (!first) throw new Error('Gagal membaca now() database untuk kalibrasi waktu.');
    base = { dbMs: Number(first.ms), localMs: Date.now() };
  }
  return base.dbMs + (Date.now() - base.localMs);
}

export async function dbNowDate(): Promise<Date> {
  return new Date(await dbNowMs());
}
