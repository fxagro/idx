# 💎 README PE: Perusahaan Efek - Future System Specification

Dokumen ini adalah acuan utama (*single source of truth*) dalam pengembangan platform **Sinyal IDX - Institutional Back Office** untuk persiapan transisi dari **Perusahaan Efek Daerah (PED)** menuju **Perusahaan Efek (PE) Full Service / Anggota Bursa**.

---

## 🎯 1. Visi Utama
Membangun platform *back-office* dan *core broker system* yang tangguh, aman, dan mematuhi regulasi OJK secara *end-to-end*. Aplikasi ini dirancang sebagai sistem pencadangan (*mirroring*) saat ini, sekaligus dipersiapkan untuk mengambil alih seluruh fungsi operasional harian ketika terintegrasi penuh dengan bursa (IDX), kliring (KPEI), dan kustodian (KSEI).

---

## 🏗️ 2. Arsitektur & Topologi Sistem

Aplikasi terbagi secara terdistribusi di beberapa server:
*   **Frontend (React Vite)**: Dideploy di **VPS2** (`/var/www/idx.mytriv.com/client`). Menyajikan visualisasi terminal quant premium, grafik Bandarmologi, dan modul akuntansi/finance.
*   **Backend (FastAPI)**: Dideploy di **VPS2** (`/var/www/idx.mytriv.com/fastapi-server`) di bawah pengelolaan **PM2** (`idx-fastapi-backend`).
*   **Database (PostgreSQL)**: Dideploy di **VPS3** (`62.171.183.236:5434/broker_db`) untuk menjamin performa transaksi yang terisolasi dari server aplikasi utama.

---

## 📁 3. Modul yang Telah Diimplementasikan

### A. Chart of Accounts (COA) Integration
*   **Lokasi Database**: Tabel `chart_of_accounts` di VPS3.
*   **Struktur**: Hierarki akun self-referensial (`class_id` merujuk ke `account_id`) untuk mendukung tree-view kedalaman multi-level.
*   **Data**: Memuat **484 akun standar akuntansi sekuritas** lengkap (Aset, Kewajiban, Ekuitas, Pendapatan, Beban).

### B. Daily Transaction Ledger (Double-Entry Journal)
*   **Lokasi Database**: Tabel `journal_entries` di VPS3.
*   **Logika Akuntansi (Broker Code: `JB`)**:
    *   **Transaksi Beli (Buy Trade)**:
        *   `Debit` AR Client (`1.1.05.01.01`) = `Buy Value + Commission (0.15%) + Levy (0.043%)`
        *   `Credit` AP KPEI (`2.1.06.00.03`) = `Buy Value`
        *   `Credit` Commission Revenue (`4.1.02.00.01`) = `Commission`
        *   `Credit` IDX Levy Payable (`2.1.10.03.01`) = `Levy`
    *   **Transaksi Jual (Sell Trade)**:
        *   `Debit` AR KPEI (`1.1.06.01.03`) = `Sell Value`
        *   `Credit` AP Client (`2.1.05.01.01`) = `Sell Value - Commission (0.25%) - Levy (0.043%) - Tax (0.1%)`
        *   `Credit` Commission Revenue (`4.1.02.00.01`) = `Commission`
        *   `Credit` IDX Levy Payable (`2.1.10.03.01`) = `Levy`
        *   `Credit` Tax Payable (`2.1.10.02.06`) = `Tax (PPH Final 0.1%)`

### C. OJK MKBD Calculator (Formulir XE13)
*   **Alur Kerja**:
    1.  Membaca nilai dasar dari berkas template laporan OJK `.xls` di folder `/var/www/idx.mytriv.com/ped/[YYYYMMDD].xls`.
    2.  Mengambil entri jurnal harian dari `journal_entries` berdasarkan tanggal yang dipilih.
    3.  Menerapkan penyesuaian aset dan liabilitas secara dinamis pada saldo dasar.
    4.  Menerapkan aturan **haircut regulasi OJK** (termasuk potongan **10% haircut** pada saldo dinamis Client Margin AR).
    5.  Menghitung rasio final MKBD Riil vs MKBD Wajib dengan respons cepat.

---

## 🚀 4. Roadmap Masa Depan (Road to Perusahaan Efek)

### Modul Akuntansi & Keuangan Lanjutan
*   [ ] **Buku Besar Pembantu (Subsidiary Ledger)** untuk masing-masing nasabah/client.
*   [ ] **Cash Management**: Sinkronisasi bank RDN (Rekening Dana Nasabah) dan pencatatan kas internal sekuritas.
*   [ ] **Laporan Keuangan Standar OJK**: Neraca Dinamis, Laporan Laba Rugi Akrual, Laporan Perubahan Ekuitas, dan Arus Kas.

### Manajemen Risiko & Kepatuhan
*   [ ] **Automated Limit Control**: Pemblokiran order otomatis jika saldo RDN / kolateral nasabah tidak mencukupi.
*   [ ] **Ageing AR Monitor**: Notifikasi dan pengenaan haircut lebih tinggi jika piutang nasabah melewati batas T+2.
*   [ ] **Pelaporan Otomatis OJK**: Export data langsung ke format XML/Excel standar e-Reporting OJK.

### Integrasi Sistem Pasar Modal
*   [ ] **Feed Transaksi Otomatis**: Integrasi langsung dengan FIX Protocol / API IDX untuk penarikan data trade confirmation harian secara real-time.
*   [ ] **KPEI Cleared Balance**: Rekonsiliasi kewajiban serah-terima efek dan dana secara kliring otomatis.
*   [ ] **KSEI Static Data Sync**: Sinkronisasi data nasabah dengan SID (Single Investor Identification) KSEI.

---

## 🛠️ 5. Cara Penggunaan & Pemeliharaan Kode

Jika ingin mengembangkan atau memodifikasi fitur di masa depan, silakan periksa:
1.  **Frontend**: Modul utama terletak di `/client/src/pages/AdminFinancePage.jsx`. Setelah melakukan pengeditan, jalankan:
    ```bash
    cd /var/www/idx.mytriv.com/client
    npm run build
    ```
2.  **Backend**: Modul router terletak di `/fastapi-server/routers/finance.py`. Jika memodifikasi kode python, pastikan memuat ulang server melalui PM2:
    ```bash
    pm2 restart idx-fastapi-backend
    ```
3.  **Database DDL**: Selalu gunakan migrasi aman untuk memodifikasi skema database `broker_db` di VPS3 demi menjaga integritas data transaksi.
