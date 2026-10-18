/**
 * PDF Generator & Printable Document Service — SICA Academic Engine
 *
 * Menghasilkan dokumen cetak resmi Kartu Rencana Studi (KRS) dan
 * Kartu Hasil Studi (KHS) dengan Kop Kampus, data mahasiswa, tabel nilai/jadwal,
 * dan blok tanda tangan resmi.
 */

export interface StudentDocHeader {
  universityName: string;
  facultyName: string;
  studyProgram: string;
  nim: string;
  studentName: string;
  academicYear: string;
  semester: string;
  advisorName: string;
}

export interface KrsPrintItem {
  no: number;
  courseCode: string;
  courseName: string;
  sks: number;
  className: string;
  schedule: string;
  lecturerName: string;
}

export interface KhsPrintItem {
  no: number;
  courseCode: string;
  courseName: string;
  sks: number;
  letterGrade: string;
  pointValue: number;
  qualityScore: number; // SKS * pointValue
}

/**
 * Menghasilkan template cetak HTML untuk Kartu Rencana Studi (KRS)
 */
export function generateKrsPrintHtml(
  header: StudentDocHeader,
  items: KrsPrintItem[],
  totalSks: number
): string {
  const tableRows = items
    .map(
      (item) => `
    <tr>
      <td style="text-align:center; padding: 6px;">${item.no}</td>
      <td style="text-align:center; padding: 6px;">${item.courseCode}</td>
      <td style="padding: 6px;">${item.courseName}</td>
      <td style="text-align:center; padding: 6px;">${item.className}</td>
      <td style="text-align:center; padding: 6px;">${item.sks}</td>
      <td style="padding: 6px;">${item.schedule}</td>
      <td style="padding: 6px;">${item.lecturerName}</td>
    </tr>
  `
    )
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; font-size: 11pt; color: #000; padding: 20px;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
        <h2 style="margin: 0; font-size: 14pt; text-transform: uppercase;">${header.universityName}</h2>
        <h3 style="margin: 3px 0; font-size: 12pt;">${header.facultyName} — ${header.studyProgram}</h3>
        <h4 style="margin: 5px 0 0 0; font-size: 13pt; text-decoration: underline;">KARTU RENCANA STUDI (KRS)</h4>
        <p style="margin: 2px 0 0 0; font-size: 10pt;">Tahun Akademik: ${header.academicYear} — Semester: ${header.semester}</p>
      </div>

      <table style="width: 100%; margin-bottom: 15px; font-size: 10pt;">
        <tr>
          <td style="width: 15%;"><strong>NIM</strong></td>
          <td style="width: 35%;">: ${header.nim}</td>
          <td style="width: 15%;"><strong>Program Studi</strong></td>
          <td style="width: 35%;">: ${header.studyProgram}</td>
        </tr>
        <tr>
          <td><strong>Nama Mahasiswa</strong></td>
          <td>: ${header.studentName}</td>
          <td><strong>Dosen PA</strong></td>
          <td>: ${header.advisorName}</td>
        </tr>
      </table>

      <table style="width: 100%; border-collapse: collapse; font-size: 10pt;" border="1">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 6px; width: 5%;">No</th>
            <th style="padding: 6px; width: 12%;">Kode MK</th>
            <th style="padding: 6px;">Nama Mata Kuliah</th>
            <th style="padding: 6px; width: 8%;">Kelas</th>
            <th style="padding: 6px; width: 8%;">SKS</th>
            <th style="padding: 6px; width: 22%;">Jadwal & Ruang</th>
            <th style="padding: 6px; width: 20%;">Dosen Pengampu</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        <tfoot>
          <tr style="font-weight: bold; background-color: #f9f9f9;">
            <td colspan="4" style="text-align: right; padding: 6px;">Total Beban SKS:</td>
            <td style="text-align: center; padding: 6px;">${totalSks}</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 10pt;">
        <div style="width: 40%;">
          <p style="margin-bottom: 60px;">Mengetahui,<br>Dosen Pembimbing Akademik</p>
          <p style="font-weight: bold; text-decoration: underline;">${header.advisorName}</p>
        </div>
        <div style="width: 40%;">
          <p style="margin-bottom: 60px;">Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}<br>Mahasiswa Bersangkutan,</p>
          <p style="font-weight: bold; text-decoration: underline;">${header.studentName}</p>
          <p style="margin-top: 2px;">NIM. ${header.nim}</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Menghasilkan template cetak HTML untuk Kartu Hasil Studi (KHS)
 */
export function generateKhsPrintHtml(
  header: StudentDocHeader,
  items: KhsPrintItem[],
  totalSks: number,
  ips: number,
  ipk: number
): string {
  const tableRows = items
    .map(
      (item) => `
    <tr>
      <td style="text-align:center; padding: 6px;">${item.no}</td>
      <td style="text-align:center; padding: 6px;">${item.courseCode}</td>
      <td style="padding: 6px;">${item.courseName}</td>
      <td style="text-align:center; padding: 6px;">${item.sks}</td>
      <td style="text-align:center; padding: 6px; font-weight:bold;">${item.letterGrade}</td>
      <td style="text-align:center; padding: 6px;">${item.pointValue.toFixed(2)}</td>
      <td style="text-align:center; padding: 6px;">${item.qualityScore.toFixed(2)}</td>
    </tr>
  `
    )
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; font-size: 11pt; color: #000; padding: 20px;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
        <h2 style="margin: 0; font-size: 14pt; text-transform: uppercase;">${header.universityName}</h2>
        <h3 style="margin: 3px 0; font-size: 12pt;">${header.facultyName} — ${header.studyProgram}</h3>
        <h4 style="margin: 5px 0 0 0; font-size: 13pt; text-decoration: underline;">KARTU HASIL STUDI (KHS)</h4>
        <p style="margin: 2px 0 0 0; font-size: 10pt;">Tahun Akademik: ${header.academicYear} — Semester: ${header.semester}</p>
      </div>

      <table style="width: 100%; margin-bottom: 15px; font-size: 10pt;">
        <tr>
          <td style="width: 15%;"><strong>NIM</strong></td>
          <td style="width: 35%;">: ${header.nim}</td>
          <td style="width: 15%;"><strong>Program Studi</strong></td>
          <td style="width: 35%;">: ${header.studyProgram}</td>
        </tr>
        <tr>
          <td><strong>Nama Mahasiswa</strong></td>
          <td>: ${header.studentName}</td>
          <td><strong>Dosen PA</strong></td>
          <td>: ${header.advisorName}</td>
        </tr>
      </table>

      <table style="width: 100%; border-collapse: collapse; font-size: 10pt;" border="1">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 6px; width: 5%;">No</th>
            <th style="padding: 6px; width: 14%;">Kode MK</th>
            <th style="padding: 6px;">Nama Mata Kuliah</th>
            <th style="padding: 6px; width: 10%;">SKS</th>
            <th style="padding: 6px; width: 10%;">Nilai Huruf</th>
            <th style="padding: 6px; width: 10%;">Bobot</th>
            <th style="padding: 6px; width: 12%;">Mutu (K x N)</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
        <table style="width: 45%; border-collapse: collapse; font-size: 10pt;" border="1">
          <tr>
            <td style="padding: 6px; background-color: #f9f9f9;"><strong>Total SKS Semester Ini</strong></td>
            <td style="padding: 6px; text-align: center; font-weight: bold;">${totalSks}</td>
          </tr>
          <tr>
            <td style="padding: 6px; background-color: #f9f9f9;"><strong>Indeks Prestasi Semester (IPS)</strong></td>
            <td style="padding: 6px; text-align: center; font-weight: bold; color: #0044cc;">${ips.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 6px; background-color: #f9f9f9;"><strong>Indeks Prestasi Kumulatif (IPK)</strong></td>
            <td style="padding: 6px; text-align: center; font-weight: bold; color: #008800;">${ipk.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 10pt;">
        <div style="width: 40%;">
          <p style="margin-bottom: 60px;">Ketua Program Studi,</p>
          <p style="font-weight: bold; text-decoration: underline;">Dr. Ir. Bambang Hermanto, M.T.</p>
          <p style="margin-top: 2px;">NIP. 197805122003121002</p>
        </div>
        <div style="width: 40%;">
          <p style="margin-bottom: 60px;">Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}<br>Dosen Pembimbing Akademik,</p>
          <p style="font-weight: bold; text-decoration: underline;">${header.advisorName}</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Memicu dialog cetak PDF browser dengan layout HTML yang diformat
 */
export function printDocument(htmlContent: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>SICA Academic Document Printout</title>
        <style>
          @media print {
            @page { margin: 15mm; size: A4 portrait; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>
          window.onload = function() {
            window.focus();
            window.print();
            window.close();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
