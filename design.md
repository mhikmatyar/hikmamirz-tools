# Technical Design Document: Invoice Generator (Flowly)

- **Dokumen Terkait**: [prd.md](file:///e:/PROJECT/TOOLS%20AI/prd.md), [task.md](file:///e:/PROJECT/TOOLS%20AI/task.md), [progress.md](file:///e:/PROJECT/TOOLS%20AI/progress.md)
- **Versi**: 1.3.0
- **Status**: Implemented & Verified

---

## 1. Arsitektur Komponen & Skema Data

### 1.1 Struktur State Invoice
Setiap invoice menyimpan opsi fitur opsional secara terisolasi di dalam properti `options`:
```javascript
{
  id: 'inv_1730800000000',
  invoiceNumber: 'INV/2026/XI/001',
  dateIssued: '2026-11-05',
  dueDate: '2026-11-19',
  status: 'pending', // 'draft' | 'pending' | 'paid'
  currency: 'MYR',   // 'MYR' | 'IDR' | 'USD' | 'SGD'
  docType: 'invoice', // 'invoice' | 'quotation' | 'receipt'
  language: 'id',     // 'id' | 'en'
  client: { name, email, phone, address },
  items: [{ description, quantity, unitPrice }],
  taxPercentage: 10,
  discount: 0,
  notes: '...',
  options: {
    enableDP: false,
    dpType: 'percent', // 'percent' | 'fixed'
    dpValue: 50,
    enableTerbilang: false,
    enableQRIS: false,
    qrisImage: 'data:image/png;base64,...',
    enableSignature: false,
    signatureImage: 'data:image/png;base64,...',
    stampImage: 'data:image/png;base64,...',
    signatureCity: 'Jakarta',
    signerName: 'Mirza Hikmatyar',
    signerTitle: 'Authorized Signer',
  }
}
```

### 1.2 Helper Kalkulasi Reaktif (`computeTotals`)
- `subtotal`: `∑(quantity * unitPrice)`
- `taxAmount`: `(subtotal * taxPercentage) / 100`
- `grandTotal`: `max(0, subtotal + taxAmount - discount)`
- Jika `options.enableDP === true`:
  - `dpAmount`: jika persen `(grandTotal * dpValue) / 100`, jika fixed `min(grandTotal, dpValue)`
  - `balanceDue`: `max(0, grandTotal - dpAmount)`

### 1.3 Canvas Signature Pad Interaktif
- Kanvas HTML5 `<canvas id="inv-sig-canvas" width="380" height="150">`
- Event `mousedown/mousemove/mouseup` dan `touchstart/touchmove/touchend` dengan penskalaan koordinat bounding-rect yang akurat.
- Ekspor ke Base64 via `canvas.toDataURL('image/png')`.

### 1.4 Format Cetak Presisi (@media print)
- Seluruh breakpoint responsive form diisolasi ke `@media screen and (...)`.
- Pada `@media print`:
  - Form editor, tombol tindakan, dan sidebar disembunyikan (`display: none !important`).
  - Elemen `#invoice-printable-paper` mengisi lebar kertas A4 portrait dengan margin 10mm x 14mm.
  - Elemen QRIS, Terbilang, dan Tanda Tangan disesuaikan dengan skala cetak optimal tanpa meluap ke halaman kedua.
