/**
 * Flowly - Invoice Generator
 * Fitur Utama & Opsi Fleksibel (Opsional):
 * - Nomor Invoice Otomatis berbasis Tahun, Bulan (Angka Romawi), dan Nomor Urut (contoh: INV/2026/XI/001)
 * - Pilihan kombinasi format penomoran (Romawi, garis miring, strip, format bulanan)
 * - Multi-currency: MYR (RM), IDR (Rp), USD ($), SGD (S$)
 * - Multi-tipe Dokumen (Opsional): Faktur/Invoice, Penawaran/Quotation, Kuitansi/Receipt
 * - Pilihan Bahasa (Opsional): 🇮🇩 Bahasa Indonesia & 🇬🇧 English
 * - Termin / Uang Muka (DP) & Sisa Tagihan (Opsional)
 * - Teks Terbilang Otomatis (Opsional)
 * - QRIS Pembayaran (Opsional)
 * - Tanda Tangan Digital & Stempel Perusahaan (Opsional, dengan upload atau Draw Canvas pad)
 * - 1-Click Kirim Tagihan via WhatsApp (WA Billing) & Email
 * - Menu/Tab Pelanggan (Customer Management) & Quick "+ Add New Client" modal
 * - Riwayat invoice lengkap (Draft, Pending, Paid, Cetak/PDF, Edit, Duplikat, Hapus)
 * - Sinkronisasi otomatis ke Vercel KV / lokal file (/api/invoices) + localStorage
 * - Cetak PDF A4 siap kirim via browser print engine tanpa terpotong
 */

HT.register('invoice-generator', {
  mount(el) {
    const { escapeHtml, icon } = HTUtil;

    // State aplikasi
    let currentTab = 'create'; // 'create' | 'history' | 'clients' | 'business'
    let mobileActiveView = 'form'; // 'form' | 'preview'
    let storageStatus = 'local'; // 'vercel_kv' | 'local_file' | 'browser'
    let isSaving = false;

    // Format penomoran & angka Romawi
    const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    let selectedInvFormat = 'INV/YYYY/ROMAN/SEQ'; // format default

    function toRoman(monthIndex) {
      return ROMAN_MONTHS[monthIndex] || 'I';
    }

    function generateInvoiceNumber(dateStr = null, existingInvoices = [], formatPattern = selectedInvFormat, docType = 'invoice') {
      const d = dateStr ? new Date(dateStr) : new Date();
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const monthRoman = toRoman(monthIdx);
      const monthNum = String(monthIdx + 1).padStart(2, '0');

      let prefix = 'INV';
      if (docType === 'quotation') prefix = 'QUO';
      if (docType === 'receipt') prefix = 'REC';

      // Hitung nomor urut tertinggi untuk tahun tersebut
      let maxSeq = 0;
      for (const inv of existingInvoices) {
        if (inv && inv.invoiceNumber) {
          if (inv.invoiceNumber.includes(String(year))) {
            const match = inv.invoiceNumber.match(/(\d+)$/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (!isNaN(num) && num > maxSeq) {
                maxSeq = num;
              }
            }
          }
        }
      }

      const nextSeq = String(maxSeq + 1).padStart(3, '0');

      switch (formatPattern) {
        case 'INV/ROMAN/YYYY/SEQ':
          return `${prefix}/${monthRoman}/${year}/${nextSeq}`;
        case 'INV-YYYY-ROMAN-SEQ':
          return `${prefix}-${year}-${monthRoman}-${nextSeq}`;
        case 'INV/YYYY/MM/SEQ':
          return `${prefix}/${year}/${monthNum}/${nextSeq}`;
        case 'INV-YYYYMM-SEQ':
          return `${prefix}-${year}${monthNum}-${nextSeq}`;
        case 'INV/YYYY/ROMAN/SEQ':
        default:
          return `${prefix}/${year}/${monthRoman}/${nextSeq}`;
      }
    }

    // Database & Profil Bisnis
    let state = {
      invoices: [],
      clients: [
        {
          id: 'c1',
          name: 'Brightstone Industries',
          contactPerson: 'Jacob Paul',
          email: 'jacobpaul@brightstone.industries',
          phone: '+62 812-3456-7890',
          address: '45 Evergreen Lane, Suite 102, Brookfield, NY, 11234',
        },
        {
          id: 'c2',
          name: 'Syarikat Megah Bina Sdn Bhd',
          contactPerson: 'Ahmad Daniel',
          email: 'daniel@megahbina.my',
          phone: '+60 12-345 6789',
          address: 'Level 18, Menara Kembar, Jalan Ampang, 50450 Kuala Lumpur, Malaysia',
        },
      ],
      business: {
        name: 'Mirza Hikmatyar',
        email: 'hi.mirzahikma@gmail.com',
        phone: '(+62) 858-7632-4554',
        address: 'Jakarta, Indonesia',
        city: 'Jakarta',
        bankName: 'BCA',
        accountNumber: '0600684761',
        accountHolder: 'MIRZA HIKMATYAR',
        logoImage: '',
        qrisImage: '',
        signatureImage: '',
        stampImage: '',
      },
    };

    // Dictionary Bahasa & Tipe Dokumen
    const I18N = {
      id: {
        invoice: 'FAKTUR / INVOICE',
        quotation: 'PENAWARAN HARGA',
        receipt: 'KUITANSI PEMBAYARAN',
        numLabel: {
          invoice: 'Nomor Faktur',
          quotation: 'Nomor Penawaran',
          receipt: 'Nomor Kuitansi',
        },
        billedBy: 'Diterbitkan Oleh',
        billedTo: 'Ditujukan Kepada',
        dateIssued: 'Tanggal Terbit',
        dueDate: {
          invoice: 'Jatuh Tempo',
          quotation: 'Berlaku Hingga',
          receipt: 'Tanggal Pembayaran',
        },
        itemDesc: 'Layanan / Item',
        quantity: 'Qty',
        unitPrice: 'Harga Satuan',
        total: 'Total',
        subtotal: 'Subtotal',
        tax: 'Pajak',
        discount: 'Diskon',
        grandTotal: {
          invoice: 'Total Tagihan',
          quotation: 'Total Penawaran',
          receipt: 'Total Pelunasan',
        },
        dpLabel: 'Uang Muka (DP)',
        balanceDue: 'Sisa Tagihan',
        paymentNotes: 'Instruksi Pembayaran & Catatan',
        bankTransfer: 'Transfer Bank',
        scanQRIS: 'Scan QRIS untuk Pembayaran',
        terbilang: 'Terbilang',
        signer: 'Penanggung Jawab',
        paidWatermark: 'LUNAS / PAID',
      },
      en: {
        invoice: 'INVOICE',
        quotation: 'PRICE QUOTATION',
        receipt: 'OFFICIAL RECEIPT',
        numLabel: {
          invoice: 'Invoice Number',
          quotation: 'Quotation Number',
          receipt: 'Receipt Number',
        },
        billedBy: 'Billed By',
        billedTo: 'Billed To',
        dateIssued: 'Date Issued',
        dueDate: {
          invoice: 'Due Date',
          quotation: 'Valid Until',
          receipt: 'Payment Date',
        },
        itemDesc: 'Items / Service',
        quantity: 'Quantity',
        unitPrice: 'Unit Price',
        total: 'Total',
        subtotal: 'Subtotal',
        tax: 'Tax',
        discount: 'Discount',
        grandTotal: {
          invoice: 'Grand Total',
          quotation: 'Total Quotation',
          receipt: 'Amount Paid',
        },
        dpLabel: 'Down Payment (DP)',
        balanceDue: 'Balance Due',
        paymentNotes: 'Payment & Notes',
        bankTransfer: 'Bank Transfer',
        scanQRIS: 'Scan QRIS to Pay',
        terbilang: 'Amount in Words',
        signer: 'Authorized Signer',
        paidWatermark: 'PAID',
      },
    };

    // Helper Fungsi Terbilang (Number to Words)
    function angkaKeKataIndonesia(n) {
      n = Math.floor(Math.abs(Number(n) || 0));
      if (n === 0) return 'Nol';
      const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
      function helper(num) {
        if (num < 12) return satuan[num];
        if (num < 20) return helper(num - 10) + ' Belas';
        if (num < 100) return helper(Math.floor(num / 10)) + ' Puluh' + (num % 10 !== 0 ? ' ' + satuan[num % 10] : '');
        if (num < 200) return 'Seratus' + (num % 100 !== 0 ? ' ' + helper(num % 100) : '');
        if (num < 1000) return satuan[Math.floor(num / 100)] + ' Ratus' + (num % 100 !== 0 ? ' ' + helper(num % 100) : '');
        if (num < 2000) return 'Seribu' + (num % 1000 !== 0 ? ' ' + helper(num % 1000) : '');
        if (num < 1000000) return helper(Math.floor(num / 1000)) + ' Ribu' + (num % 1000 !== 0 ? ' ' + helper(num % 1000) : '');
        if (num < 1000000000) return helper(Math.floor(num / 1000000)) + ' Juta' + (num % 1000000 !== 0 ? ' ' + helper(num % 1000000) : '');
        if (num < 1000000000000) return helper(Math.floor(num / 1000000000)) + ' Miliar' + (num % 1000000000 !== 0 ? ' ' + helper(num % 1000000000) : '');
        if (num < 1000000000000000) return helper(Math.floor(num / 1000000000000)) + ' Triliun' + (num % 1000000000000 !== 0 ? ' ' + helper(num % 1000000000000) : '');
        return String(num);
      }
      return helper(n).trim();
    }

    function numberToWordsEnglish(n) {
      n = Math.floor(Math.abs(Number(n) || 0));
      if (n === 0) return 'Zero';
      const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      function helper(num) {
        if (num < 20) return a[num];
        if (num < 100) return b[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + a[num % 10] : '');
        if (num < 1000) return a[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' ' + helper(num % 100) : '');
        if (num < 1000000) return helper(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + helper(num % 1000) : '');
        if (num < 1000000000) return helper(Math.floor(num / 1000000)) + ' Million' + (num % 1000000 !== 0 ? ' ' + helper(num % 1000000) : '');
        if (num < 1000000000000) return helper(Math.floor(num / 1000000000)) + ' Billion' + (num % 1000000000 !== 0 ? ' ' + helper(num % 1000000000) : '');
        return String(num);
      }
      return helper(n).trim();
    }

    function getAmountInWords(amount, currencyCode, lang = 'id') {
      const num = Math.round(Number(amount) || 0);
      if (lang === 'en') {
        const words = numberToWordsEnglish(num);
        const currName = currencyCode === 'IDR' ? 'Indonesian Rupiah' : currencyCode === 'MYR' ? 'Malaysian Ringgit' : currencyCode === 'USD' ? 'US Dollars' : 'Singapore Dollars';
        return `${words} ${currName}`;
      } else {
        const words = angkaKeKataIndonesia(num);
        const currName = currencyCode === 'IDR' ? 'Rupiah' : currencyCode === 'MYR' ? 'Ringgit Malaysia' : currencyCode === 'USD' ? 'Dolar AS' : 'Dolar Singapura';
        return `${words} ${currName}`;
      }
    }

    // Helper format mata uang
    const CURRENCIES = {
      MYR: { label: '🇲🇾 MYR - Ringgit Malaysia (RM)', symbol: 'RM', code: 'MYR', locale: 'ms-MY' },
      IDR: { label: '🇮🇩 IDR - Rupiah Indonesia (Rp)', symbol: 'Rp', code: 'IDR', locale: 'id-ID' },
      USD: { label: '🇺🇸 USD - US Dollar ($)', symbol: '$', code: 'USD', locale: 'en-US' },
      SGD: { label: '🇸🇬 SGD - Singapore Dollar (S$)', symbol: 'S$', code: 'SGD', locale: 'en-SG' },
    };

    function formatMoney(amount, currencyCode = 'MYR') {
      const num = Number(amount) || 0;
      const curr = CURRENCIES[currencyCode] || CURRENCIES.MYR;

      if (currencyCode === 'IDR') {
        return 'Rp ' + Math.round(num).toLocaleString('id-ID');
      }
      if (currencyCode === 'MYR') {
        return (
          'RM ' +
          num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
      }
      if (currencyCode === 'USD') {
        return (
          '$' +
          num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
      }
      return (
        curr.symbol +
        ' ' +
        num.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    }

    function formatDateDisplay(dateStr, lang = 'id') {
      if (!dateStr) return '-';
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      } catch (_) {
        return dateStr;
      }
    }

    // Helper resolusi opsi invoice dengan fallback aman
    function getInvoiceOptions(inv) {
      const opts = inv.options || {};
      return {
        docType: inv.docType || 'invoice',
        language: inv.language || 'id',
        enableDP: Boolean(opts.enableDP),
        dpType: opts.dpType || 'percent',
        dpValue: Number(opts.dpValue) || 50,
        enableTerbilang: Boolean(opts.enableTerbilang),
        enableQRIS: Boolean(opts.enableQRIS),
        qrisImage: opts.qrisImage || state.business.qrisImage || '',
        enableSignature: Boolean(opts.enableSignature),
        signatureImage: opts.signatureImage || state.business.signatureImage || '',
        stampImage: opts.stampImage || state.business.stampImage || '',
        signatureCity: opts.signatureCity || state.business.city || 'Jakarta',
        signerName: opts.signerName || state.business.name || '',
        signerTitle: opts.signerTitle || 'Authorized Signer',
      };
    }

    function createBlankInvoice(dateStr = null) {
      const today = dateStr ? new Date(dateStr) : new Date();
      const due = new Date(today);
      due.setDate(today.getDate() + 14);

      const dateIssued = today.toISOString().slice(0, 10);
      const dueDate = due.toISOString().slice(0, 10);
      const invoiceNumber = generateInvoiceNumber(dateIssued, state.invoices, selectedInvFormat, 'invoice');

      return {
        id: 'inv_' + Date.now(),
        invoiceNumber,
        dateIssued,
        dueDate,
        status: 'pending', // 'draft' | 'pending' | 'paid'
        currency: 'MYR',
        docType: 'invoice', // 'invoice' | 'quotation' | 'receipt'
        language: 'id', // 'id' | 'en'
        logoImage: state.business?.logoImage || '',
        clientId: state.clients[0]?.id || 'c1',
        client: state.clients[0]
          ? { ...state.clients[0] }
          : {
              name: 'Brightstone Industries',
              contactPerson: 'Jacob Paul',
              email: 'jacobpaul@brightstone.industries',
              phone: '+62 812-3456-7890',
              address: '45 Evergreen Lane, Suite 102, Brookfield, NY, 11234',
            },
        items: [
          { description: 'Cloud Hosting Subscription', quantity: 1, unitPrice: 3500 },
          { description: 'Data Analytics Report', quantity: 2, unitPrice: 750 },
          { description: 'On-Site Technical Support', quantity: 1, unitPrice: 400 },
        ],
        taxPercentage: 10,
        discount: 0,
        notes: 'Pembayaran jatuh tempo sesuai tanggal tertera.\nHarap cantumkan nomor faktur pada referensi transfer pembayaran.',
        options: {
          enableDP: false,
          dpType: 'percent',
          dpValue: 50,
          enableTerbilang: false,
          enableQRIS: false,
          qrisImage: state.business.qrisImage || '',
          enableSignature: false,
          signatureImage: state.business.signatureImage || '',
          stampImage: state.business.stampImage || '',
          signatureCity: state.business.city || 'Jakarta',
          signerName: state.business.name || '',
          signerTitle: 'Authorized Signer',
        },
      };
    }

    // Invoice yang sedang diedit
    
    let currentInvoice = createBlankInvoice();

    // Fungsi ganti bahasa dokumen (Bilingual ID / EN)
    function switchLanguage(lang) {
      if (!lang) return;
      const oldLang = currentInvoice.language || 'id';
      currentInvoice.language = lang;

      const defaultNotesId = 'Pembayaran jatuh tempo sesuai tanggal tertera.\nHarap cantumkan nomor faktur pada referensi transfer pembayaran.';
      const defaultNotesEn = 'Payment is due by the due date.\nInclude invoice number in the payment reference to ensure accurate processing.';

      if (currentInvoice.notes === defaultNotesEn && lang === 'id') {
        currentInvoice.notes = defaultNotesId;
      } else if (currentInvoice.notes === defaultNotesId && lang === 'en') {
        currentInvoice.notes = defaultNotesEn;
      }

      renderApp();
      showToast(lang === 'id' ? 'Bahasa invoice diubah ke Bahasa Indonesia 🇮🇩' : 'Invoice language switched to English 🇬🇧');
    }


    // Hitung ringkasan angka termasuk kalkulasi Termin / DP opsional
    function computeTotals(inv) {
      const subtotal = (inv.items || []).reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unitPrice) || 0;
        return sum + qty * price;
      }, 0);

      const taxRate = Number(inv.taxPercentage) || 0;
      const taxAmount = (subtotal * taxRate) / 100;
      const discount = Number(inv.discount) || 0;
      const grandTotal = Math.max(0, subtotal + taxAmount - discount);

      const opts = getInvoiceOptions(inv);
      let dpAmount = 0;
      let balanceDue = grandTotal;

      if (opts.enableDP) {
        if (opts.dpType === 'fixed') {
          dpAmount = Math.min(grandTotal, Math.max(0, Number(opts.dpValue) || 0));
        } else {
          const pct = Math.max(0, Math.min(100, Number(opts.dpValue) || 0));
          dpAmount = (grandTotal * pct) / 100;
        }
        balanceDue = Math.max(0, grandTotal - dpAmount);
      }

      return { subtotal, taxAmount, taxRate, discount, grandTotal, dpAmount, balanceDue };
    }

    // Helper kompresi gambar lokal (QRIS, Tanda Tangan, Stempel)
    function compressImageFile(file, maxDimension = 400, quality = 0.85) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            let w = img.width;
            let h = img.height;
            if (w > maxDimension || h > maxDimension) {
              if (w > h) {
                h = Math.round((h * maxDimension) / w);
                w = maxDimension;
              } else {
                w = Math.round((w * maxDimension) / h);
                h = maxDimension;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/png', quality));
          };
          img.onerror = reject;
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    // Muat data dari API / LocalStorage
    async function loadAllData() {
      try {
        const cached = localStorage.getItem('flowly_invoices_local');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.invoices) state.invoices = parsed.invoices;
          if (parsed.clients) state.clients = parsed.clients;
          if (parsed.business) state.business = { ...state.business, ...parsed.business };
        }
      } catch (_) {}

      try {
        const res = await fetch('/api/invoices');
        if (res.ok) {
          const body = await res.json();
          if (body.ok) {
            state.invoices = body.invoices || [];
            state.clients = body.clients?.length ? body.clients : state.clients;
            state.business = body.business ? { ...state.business, ...body.business } : state.business;
            storageStatus = body.storage || 'vercel_kv';

            localStorage.setItem('flowly_invoices_local', JSON.stringify(state));
          }
        }
      } catch (err) {
        console.warn('API invoices tidak terjangkau, menggunakan mode browser offline:', err);
        storageStatus = 'browser';
      }

      if (currentInvoice && !currentInvoice.isManualEdited) {
        currentInvoice.invoiceNumber = generateInvoiceNumber(
          currentInvoice.dateIssued,
          state.invoices,
          selectedInvFormat,
          currentInvoice.docType || 'invoice'
        );
      }
    }

    // Simpan ke API + localStorage
    async function syncInvoiceToBackend(inv) {
      isSaving = true;
      renderApp();

      const idx = state.invoices.findIndex((x) => x.id === inv.id || x.invoiceNumber === inv.invoiceNumber);
      if (idx >= 0) {
        state.invoices[idx] = { ...inv };
      } else {
        state.invoices.unshift({ ...inv });
      }

      if (inv.client && inv.client.name) {
        const cIdx = state.clients.findIndex((c) => c.name.toLowerCase() === inv.client.name.toLowerCase());
        if (cIdx >= 0) {
          state.clients[cIdx] = { ...state.clients[cIdx], ...inv.client };
        } else {
          state.clients.push({
            id: 'c_' + Date.now(),
            ...inv.client,
          });
        }
      }

      localStorage.setItem('flowly_invoices_local', JSON.stringify(state));

      try {
        const res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_invoice', invoice: inv }),
        });
        if (res.ok) {
          const body = await res.json();
          if (body.storage) storageStatus = body.storage;
        }
      } catch (err) {
        console.warn('Gagal sync ke serverless API, tetap tersimpan aman di browser:', err);
      }

      isSaving = false;
      renderApp();
      showToast('Dokumen berhasil disimpan!');
    }

    async function syncClientToBackend(client) {
      const idx = state.clients.findIndex((c) => c.id === client.id);
      if (idx >= 0) {
        state.clients[idx] = { ...client };
      } else {
        state.clients.push(client);
      }
      localStorage.setItem('flowly_invoices_local', JSON.stringify(state));

      try {
        await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_client', client }),
        });
      } catch (_) {}

      renderApp();
      showToast('Data pelanggan berhasil disimpan!');
    }

    async function deleteInvoice(id) {
      if (!confirm('Yakin ingin menghapus invoice ini?')) return;
      state.invoices = state.invoices.filter((inv) => inv.id !== id);
      localStorage.setItem('flowly_invoices_local', JSON.stringify(state));

      try {
        await fetch(`/api/invoices?id=${encodeURIComponent(id)}&type=invoice`, {
          method: 'DELETE',
        });
      } catch (_) {}

      renderApp();
      showToast('Invoice dihapus.');
    }

    async function deleteClient(id) {
      if (!confirm('Yakin ingin menghapus pelanggan ini dari database?')) return;
      state.clients = state.clients.filter((c) => c.id !== id);
      localStorage.setItem('flowly_invoices_local', JSON.stringify(state));

      try {
        await fetch(`/api/invoices?id=${encodeURIComponent(id)}&type=client`, {
          method: 'DELETE',
        });
      } catch (_) {}

      renderApp();
      showToast('Pelanggan dihapus.');
    }

    function showToast(msg) {
      let toast = document.getElementById('flowly-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'flowly-toast';
        toast.style.cssText =
          'position:fixed;bottom:24px;right:24px;background:#141414;color:#fff;padding:12px 20px;border-radius:10px;font-size:0.875rem;box-shadow:0 6px 20px rgba(0,0,0,0.25);z-index:9999;transition:opacity 0.2s;';
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      toast.style.opacity = '1';
      setTimeout(() => {
        toast.style.opacity = '0';
      }, 3000);
    }

    // Modal popup Tambah Klien Baru
    let isClientModalOpen = false;
    let editingClient = null;

    function openClientModal(client = null) {
      isClientModalOpen = true;
      editingClient = client
        ? { ...client }
        : {
            id: 'c_' + Date.now(),
            name: '',
            contactPerson: '',
            email: '',
            phone: '',
            address: '',
          };
      renderClientModal();
    }

    function closeClientModal() {
      isClientModalOpen = false;
      editingClient = null;
      const modal = document.getElementById('inv-client-modal-container');
      if (modal) modal.remove();
    }

    function renderClientModal() {
      let container = document.getElementById('inv-client-modal-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'inv-client-modal-container';
        document.body.appendChild(container);
      }

      if (!isClientModalOpen || !editingClient) {
        container.innerHTML = '';
        return;
      }

      container.innerHTML = `
        <div class="inv-modal-overlay">
          <div class="inv-modal" role="dialog" aria-modal="true">
            <div class="inv-modal-head">
              <h3>${editingClient.name ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}</h3>
              <button class="inv-btn-ghost inv-btn-sm" id="modal-close-btn">${icon('x', 18)}</button>
            </div>
            <div class="inv-modal-body">
              <label class="inv-field">
                <span class="inv-label">Nama Perusahaan / Klien *</span>
                <input class="inv-input" id="modal-c-name" value="${escapeHtml(editingClient.name || '')}" placeholder="Misal: PT Maju Jaya atau Daniel Enterprise">
              </label>
              <div class="inv-field-row">
                <label class="inv-field">
                  <span class="inv-label">Nama Kontak (PIC)</span>
                  <input class="inv-input" id="modal-c-pic" value="${escapeHtml(editingClient.contactPerson || '')}" placeholder="Nama penanggung jawab">
                </label>
                <label class="inv-field">
                  <span class="inv-label">No. Telepon / WhatsApp</span>
                  <input class="inv-input" id="modal-c-phone" value="${escapeHtml(editingClient.phone || '')}" placeholder="+60 12-xxx / +62 812-xxx">
                </label>
              </div>
              <label class="inv-field">
                <span class="inv-label">Email Klien</span>
                <input class="inv-input" type="email" id="modal-c-email" value="${escapeHtml(editingClient.email || '')}" placeholder="klien@perusahaan.com">
              </label>
              <label class="inv-field">
                <span class="inv-label">Alamat Lengkap</span>
                <textarea class="inv-textarea" id="modal-c-address" rows="2" placeholder="Alamat jalan, gedung, kota, kode pos">${escapeHtml(editingClient.address || '')}</textarea>
              </label>
            </div>
            <div class="inv-modal-foot">
              <button class="inv-btn inv-btn-ghost" id="modal-cancel-btn">Batal</button>
              <button class="inv-btn inv-btn-primary" id="modal-save-btn">Simpan Pelanggan</button>
            </div>
          </div>
        </div>
      `;

      container.querySelector('#modal-close-btn').onclick = closeClientModal;
      container.querySelector('#modal-cancel-btn').onclick = closeClientModal;
      container.querySelector('#modal-save-btn').onclick = () => {
        const name = container.querySelector('#modal-c-name').value.trim();
        if (!name) {
          alert('Nama perusahaan/klien wajib diisi.');
          return;
        }

        const updated = {
          ...editingClient,
          name,
          contactPerson: container.querySelector('#modal-c-pic').value.trim(),
          phone: container.querySelector('#modal-c-phone').value.trim(),
          email: container.querySelector('#modal-c-email').value.trim(),
          address: container.querySelector('#modal-c-address').value.trim(),
        };

        syncClientToBackend(updated);

        if (currentTab === 'create') {
          currentInvoice.clientId = updated.id;
          currentInvoice.client = { ...updated };
        }

        closeClientModal();
        renderApp();
      };
    }

    // Modal popup Interactive Signature Pad
    let isSigPadOpen = false;

    function openSignaturePad() {
      isSigPadOpen = true;
      let container = document.getElementById('inv-sig-modal-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'inv-sig-modal-container';
        document.body.appendChild(container);
      }

      container.innerHTML = `
        <div class="inv-modal-overlay">
          <div class="inv-modal" style="max-width: 440px;" role="dialog" aria-modal="true">
            <div class="inv-modal-head">
              <h3>${icon('pen', 18)} Gambar Tanda Tangan</h3>
              <button class="inv-btn-ghost inv-btn-sm" id="sig-pad-close-btn">${icon('x', 18)}</button>
            </div>
            <div class="inv-modal-body">
              <p style="font-size: 0.8rem; color: var(--text-2); margin: 0;">
                Gunakan mouse atau sentuhan jari Anda di atas kanvas berikut untuk membubuhkan tanda tangan:
              </p>
              <div style="border: 1px solid var(--border-strong); border-radius: var(--radius-sm); overflow: hidden; background: #fff;">
                <canvas id="inv-sig-canvas" width="380" height="150" style="display:block; width:100%; height:150px; cursor:crosshair; touch-action:none;"></canvas>
              </div>
            </div>
            <div class="inv-modal-foot" style="justify-content: space-between;">
              <button class="inv-btn inv-btn-ghost" id="sig-pad-clear-btn">${icon('retry', 14)} Bersihkan</button>
              <div style="display: flex; gap: 8px;">
                <button class="inv-btn" id="sig-pad-cancel-btn">Batal</button>
                <button class="inv-btn inv-btn-primary" id="sig-pad-save-btn">${icon('check', 14)} Terapkan TTD</button>
              </div>
            </div>
          </div>
        </div>
      `;

      const canvas = container.querySelector('#inv-sig-canvas');
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';

      let drawing = false;
      let hasDrawn = false;

      function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
          x: (clientX - rect.left) * scaleX,
          y: (clientY - rect.top) * scaleY,
        };
      }

      function startDraw(e) {
        e.preventDefault();
        drawing = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      }

      function moveDraw(e) {
        if (!drawing) return;
        e.preventDefault();
        hasDrawn = true;
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }

      function endDraw(e) {
        if (!drawing) return;
        e.preventDefault();
        drawing = false;
      }

      canvas.addEventListener('mousedown', startDraw);
      canvas.addEventListener('mousemove', moveDraw);
      window.addEventListener('mouseup', endDraw);

      canvas.addEventListener('touchstart', startDraw, { passive: false });
      canvas.addEventListener('touchmove', moveDraw, { passive: false });
      canvas.addEventListener('touchend', endDraw, { passive: false });

      container.querySelector('#sig-pad-clear-btn').onclick = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasDrawn = false;
      };

      const closePad = () => {
        isSigPadOpen = false;
        container.remove();
      };

      container.querySelector('#sig-pad-close-btn').onclick = closePad;
      container.querySelector('#sig-pad-cancel-btn').onclick = closePad;

      container.querySelector('#sig-pad-save-btn').onclick = () => {
        if (!hasDrawn) {
          alert('Silakan gambar tanda tangan Anda di atas kanvas terlebih dahulu.');
          return;
        }
        const dataUrl = canvas.toDataURL('image/png');
        if (!currentInvoice.options) currentInvoice.options = {};
        currentInvoice.options.signatureImage = dataUrl;
        currentInvoice.options.enableSignature = true;
        closePad();
        renderApp();
        showToast('Tanda tangan berhasil diterapkan!');
      };
    }

    // Aksi 1-Click WhatsApp Tagihan
    function sendWhatsAppInvoice(inv) {
      const totals = computeTotals(inv);
      const opts = getInvoiceOptions(inv);
      let phone = (inv.client?.phone || '').replace(/[^0-9+]/g, '');

      if (!phone) {
        const entered = prompt('Masukkan nomor WhatsApp klien (contoh: 08123456789 atau +60123456789):', '');
        if (!entered) return;
        phone = entered.replace(/[^0-9+]/g, '');
      }

      if (phone.startsWith('0')) {
        phone = '62' + phone.slice(1);
      } else if (phone.startsWith('+')) {
        phone = phone.slice(1);
      }

      const docTitle =
        opts.docType === 'quotation'
          ? opts.language === 'id'
            ? 'Penawaran Harga'
            : 'Price Quotation'
          : opts.docType === 'receipt'
          ? opts.language === 'id'
            ? 'Kuitansi Pembayaran'
            : 'Official Receipt'
          : opts.language === 'id'
          ? 'Tagihan Faktur / Invoice'
          : 'Invoice';

      let text = '';
      if (opts.language === 'en') {
        text = `Hello *${inv.client?.name || 'Customer'}*,\n\n`;
        text += `Here are the details for ${docTitle} from *${state.business.name}*:\n`;
        text += `📄 Number: *${inv.invoiceNumber}*\n`;
        text += `📅 Date Issued: ${formatDateDisplay(inv.dateIssued, 'en')}\n`;
        if (opts.docType !== 'receipt') {
          text += `⏰ Due Date: ${formatDateDisplay(inv.dueDate, 'en')}\n`;
        }
        text += `💰 Total Amount: *${formatMoney(totals.grandTotal, inv.currency)}*\n`;
        if (opts.enableDP) {
          text += `🔹 Down Payment (DP): *${formatMoney(totals.dpAmount, inv.currency)}*\n`;
          text += `🔸 Balance Due: *${formatMoney(totals.balanceDue, inv.currency)}*\n`;
        }
        if (state.business.bankName) {
          text += `\nPayment Instructions:\n`;
          text += `🏦 *${state.business.bankName}*\n`;
          text += `💳 Account: *${state.business.accountNumber}*\n`;
          text += `👤 Name: *${state.business.accountHolder}*\n`;
        }
        text += `\nPlease confirm once the transfer is made. Thank you! 🙏`;
      } else {
        text = `Halo *${inv.client?.name || 'Bapak/Ibu'}*,\n\n`;
        text += `Berikut kami kirimkan rincian ${docTitle} dari *${state.business.name}*:\n`;
        text += `📄 Nomor: *${inv.invoiceNumber}*\n`;
        text += `📅 Tanggal: ${formatDateDisplay(inv.dateIssued, 'id')}\n`;
        if (opts.docType !== 'receipt') {
          text += `⏰ Jatuh Tempo: ${formatDateDisplay(inv.dueDate, 'id')}\n`;
        }
        text += `💰 Total Tagihan: *${formatMoney(totals.grandTotal, inv.currency)}*\n`;
        if (opts.enableDP) {
          text += `🔹 Uang Muka (DP): *${formatMoney(totals.dpAmount, inv.currency)}*\n`;
          text += `🔸 Sisa Tagihan: *${formatMoney(totals.balanceDue, inv.currency)}*\n`;
        }
        if (state.business.bankName) {
          text += `\nPembayaran dapat ditransfer ke:\n`;
          text += `🏦 Bank: *${state.business.bankName}*\n`;
          text += `💳 No. Rekening: *${state.business.accountNumber}*\n`;
          text += `👤 Atas Nama: *${state.business.accountHolder}*\n`;
        }
        text += `\nMohon konfirmasi jika pembayaran telah dilakukan. Terima kasih atas kerja samanya! 🙏`;
      }

      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    }

    // Render Utama Aplikasi
    function renderApp() {
      el.innerHTML = `
        <div class="inv-container">
          <!-- Top Bar -->
          <div class="inv-top-bar">
            <nav class="inv-subnav">
              <button class="inv-subnav-btn ${currentTab === 'create' ? 'is-active' : ''}" data-tab="create">
                ${icon('fileText', 16)} <span>Buat Invoice</span>
              </button>
              <button class="inv-subnav-btn ${currentTab === 'history' ? 'is-active' : ''}" data-tab="history">
                ${icon('chart', 16)} <span>Riwayat (${state.invoices.length})</span>
              </button>
              <button class="inv-subnav-btn ${currentTab === 'clients' ? 'is-active' : ''}" data-tab="clients">
                ${icon('users', 16)} <span>Pelanggan (${state.clients.length})</span>
              </button>
              <button class="inv-subnav-btn ${currentTab === 'business' ? 'is-active' : ''}" data-tab="business">
                ${icon('sliders', 16)} <span>Profil Bisnis</span>
              </button>
            </nav>

            <div class="inv-top-actions">
              ${
                currentTab === 'create'
                  ? `
                <button class="inv-btn inv-btn-wa" id="btn-top-wa" title="Kirim penagihan via WhatsApp">
                  ${icon('whatsapp', 16)} <span>WhatsApp</span>
                </button>
                <button class="inv-btn" id="btn-save-draft" title="Simpan sebagai draft">
                  ${icon('copy', 16)} <span>Simpan Draft</span>
                </button>
                <button class="inv-btn inv-btn-primary" id="btn-save-and-print" title="Simpan invoice dan cetak PDF">
                  ${icon('download', 16)} <span>Simpan & Unduh PDF</span>
                </button>
              `
                  : ''
              }
            </div>
          </div>

          <!-- Body per Tab -->
          ${currentTab === 'create' ? renderCreateView() : ''}
          ${currentTab === 'history' ? renderHistoryView() : ''}
          ${currentTab === 'clients' ? renderClientsView() : ''}
          ${currentTab === 'business' ? renderBusinessView() : ''}
        </div>
      `;

      bindEvents();
    }

    // Tab 1: Create / Edit View (Layout 2 Kolom Khas Gambar Referensi)
    function renderCreateView() {
      const totals = computeTotals(currentInvoice);
      const curr = CURRENCIES[currentInvoice.currency] || CURRENCIES.MYR;
      const opts = getInvoiceOptions(currentInvoice);
      const i18n = I18N[opts.language] || I18N.id;

      return `
        <div class="inv-workspace">
          <!-- Mobile View Toggle Switcher (Hanya tampil di layar kecil/mobile <= 900px) -->
          <div class="inv-mobile-toggle-bar">
            <button class="inv-mobile-tab-btn ${mobileActiveView === 'form' ? 'is-active' : ''}" data-view="form">
              ${icon('fileText', 15)} <span>Form Editor</span>
            </button>
            <button class="inv-mobile-tab-btn ${mobileActiveView === 'preview' ? 'is-active' : ''}" data-view="preview">
              ${icon('eye', 15)} <span>Pratinjau (${formatMoney(totals.grandTotal, currentInvoice.currency)})</span>
            </button>
          </div>
          <!-- KOLOM KIRI: FORM DETAIL INVOICE -->
          <div class="inv-card ${mobileActiveView === 'preview' ? 'inv-mobile-hidden' : ''}">
            <div class="inv-card-head">
              <h2 class="inv-card-title">${icon('fileText', 18)} Detail Dokumen</h2>
              <div class="inv-pill-tabs">
                <button class="inv-pill-tab is-active">Editor</button>
                <button class="inv-pill-tab" id="quick-switch-history">Riwayat</button>
              </div>
            </div>

            <!-- Upload Logo Bisnis -->
            <div class="inv-logo-card">
              <div style="display: flex; align-items: center; gap: 12px;">
                ${
                  currentInvoice.logoImage || state.business.logoImage
                    ? `<img src="${currentInvoice.logoImage || state.business.logoImage}" class="inv-logo-thumb" alt="Logo">`
                    : `<div class="inv-paper-logo" style="width: 40px; height: 40px; font-size: 1.1rem; border-radius: 8px;">${(state.business.name || 'F').slice(0, 1)}</div>`
                }
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span style="font-size: 0.85rem; font-weight: 600; color: var(--text);">Logo Bisnis / Kop Faktur</span>
                  <span style="font-size: 0.72rem; color: var(--text-3);">Tampil di sudut kanan atas dokumen invoice</span>
                </div>
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <input type="file" id="file-logo-upload" accept="image/*" style="display: none;">
                <button class="inv-btn inv-btn-sm" id="btn-trigger-logo" type="button" title="Pilih logo baru">
                  ${icon('upload', 14)} <span>${currentInvoice.logoImage || state.business.logoImage ? 'Ganti' : 'Upload'} Logo</span>
                </button>
                ${
                  currentInvoice.logoImage || state.business.logoImage
                    ? `<button class="inv-btn inv-btn-sm inv-btn-danger" id="btn-remove-logo" title="Hapus logo">${icon('trash', 14)}</button>`
                    : ''
                }
              </div>
            </div>

            <!-- OPSI DOKUMEN & FITUR TAMBAHAN (OPSIONAL) -->
            <div class="inv-opt-box">
              <div class="inv-opt-header">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <h3 class="inv-section-title" style="margin: 0; color: #0f766e;">⚙️ Opsi Dokumen & Fitur Fleksibel</h3>
                  <span class="inv-opt-badge">Opsional</span>
                </div>
                <span style="font-size: 0.75rem; color: var(--text-3);">Pilih fitur yang ingin diaktifkan</span>
              </div>

              <!-- Baris Tipe Dokumen & Bahasa -->
              <div class="inv-field-row">
                <label class="inv-field">
                  <span class="inv-label">Tipe Dokumen</span>
                  <select class="inv-select" id="sel-doc-type">
                    <option value="invoice" ${opts.docType === 'invoice' ? 'selected' : ''}>📄 Faktur / Invoice Tagihan</option>
                    <option value="quotation" ${opts.docType === 'quotation' ? 'selected' : ''}>📋 Penawaran / Quotation</option>
                    <option value="receipt" ${opts.docType === 'receipt' ? 'selected' : ''}>🧾 Kuitansi / Official Receipt</option>
                  </select>
                </label>
                <label class="inv-field">
                  <span class="inv-label">Bahasa Pratinjau & Cetak</span>
                  <select class="inv-select" id="sel-doc-lang">
                    <option value="id" ${opts.language === 'id' ? 'selected' : ''}>🇮🇩 Bahasa Indonesia</option>
                    <option value="en" ${opts.language === 'en' ? 'selected' : ''}>🇬🇧 English</option>
                  </select>
                </label>
              </div>

              <!-- Grid Sakelar / Toggles Fitur Opsional -->
              <div class="inv-opt-grid">
                <!-- Sakelar 1: Termin / Uang Muka (DP) -->
                <div class="inv-switch-item ${opts.enableDP ? 'is-active' : ''}">
                  <label class="inv-switch-row" for="chk-opt-dp">
                    <div class="inv-switch-meta">
                      <span class="inv-switch-title">Termin / DP</span>
                      <span class="inv-switch-desc">Uang muka & sisa tagihan</span>
                    </div>
                    <input type="checkbox" id="chk-opt-dp" class="inv-switch-checkbox" ${opts.enableDP ? 'checked' : ''}>
                    <span class="inv-switch-ctrl"></span>
                  </label>
                  ${
                    opts.enableDP
                      ? `
                    <div class="inv-switch-body">
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div>
                          <span class="inv-label" style="font-size:0.75rem;">Jenis DP</span>
                          <select class="inv-select" id="inp-dp-type" style="padding: 5px 8px; font-size: 0.8rem;">
                            <option value="percent" ${opts.dpType === 'percent' ? 'selected' : ''}>Persen (%)</option>
                            <option value="fixed" ${opts.dpType === 'fixed' ? 'selected' : ''}>Nominal Tetap (${curr.symbol})</option>
                          </select>
                        </div>
                        <div>
                          <span class="inv-label" style="font-size:0.75rem;">Nilai DP</span>
                          <input class="inv-input" type="number" id="inp-dp-val" value="${opts.dpValue}" style="padding: 5px 8px; font-size: 0.8rem;">
                        </div>
                      </div>
                      <div style="font-size: 0.75rem; color: #0369a1; background: #f0f9ff; padding: 4px 8px; border-radius: 4px;">
                        DP: <strong>${formatMoney(totals.dpAmount, currentInvoice.currency)}</strong> | Sisa: <strong>${formatMoney(totals.balanceDue, currentInvoice.currency)}</strong>
                      </div>
                    </div>
                  `
                      : ''
                  }
                </div>

                <!-- Sakelar 2: Teks Terbilang Otomatis -->
                <div class="inv-switch-item ${opts.enableTerbilang ? 'is-active' : ''}">
                  <label class="inv-switch-row" for="chk-opt-terbilang">
                    <div class="inv-switch-meta">
                      <span class="inv-switch-title">Teks Terbilang</span>
                      <span class="inv-switch-desc">Terjemahan angka ke kata</span>
                    </div>
                    <input type="checkbox" id="chk-opt-terbilang" class="inv-switch-checkbox" ${opts.enableTerbilang ? 'checked' : ''}>
                    <span class="inv-switch-ctrl"></span>
                  </label>
                  ${
                    opts.enableTerbilang
                      ? `
                    <div class="inv-switch-body">
                      <span style="font-size: 0.75rem; color: #0f766e; font-style: italic;">
                        "${getAmountInWords(totals.grandTotal, currentInvoice.currency, opts.language)}"
                      </span>
                    </div>
                  `
                      : ''
                  }
                </div>

                <!-- Sakelar 3: QRIS Pembayaran -->
                <div class="inv-switch-item ${opts.enableQRIS ? 'is-active' : ''}">
                  <label class="inv-switch-row" for="chk-opt-qris">
                    <div class="inv-switch-meta">
                      <span class="inv-switch-title">QRIS Pembayaran</span>
                      <span class="inv-switch-desc">QR code bayar di faktur</span>
                    </div>
                    <input type="checkbox" id="chk-opt-qris" class="inv-switch-checkbox" ${opts.enableQRIS ? 'checked' : ''}>
                    <span class="inv-switch-ctrl"></span>
                  </label>
                  ${
                    opts.enableQRIS
                      ? `
                    <div class="inv-switch-body">
                      ${
                        opts.qrisImage
                          ? `
                        <div style="display: flex; align-items: center; gap: 10px;">
                          <img src="${opts.qrisImage}" style="width: 44px; height: 44px; object-fit: contain; border: 1px solid var(--border); border-radius: 4px; background: #fff;">
                          <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="font-size: 0.75rem; color: #16a34a; font-weight: 500;">QRIS Aktif</span>
                            <button class="inv-btn inv-btn-sm inv-btn-danger" id="btn-remove-qris" style="padding: 2px 6px; font-size: 0.72rem;">Hapus QRIS</button>
                          </div>
                        </div>
                      `
                          : `
                        <div>
                          <input type="file" id="file-qris-upload" accept="image/*" style="display: none;">
                          <button class="inv-btn inv-btn-sm" id="btn-trigger-qris" style="width: 100%;">
                            ${icon('upload', 14)} <span>Upload Gambar QRIS</span>
                          </button>
                        </div>
                      `
                      }
                    </div>
                  `
                      : ''
                  }
                </div>

                <!-- Sakelar 4: Tanda Tangan & Stempel Resmi -->
                <div class="inv-switch-item ${opts.enableSignature ? 'is-active' : ''}">
                  <label class="inv-switch-row" for="chk-opt-sig">
                    <div class="inv-switch-meta">
                      <span class="inv-switch-title">Tanda Tangan & Stempel</span>
                      <span class="inv-switch-desc">Otorisasi resmi penandatangan</span>
                    </div>
                    <input type="checkbox" id="chk-opt-sig" class="inv-switch-checkbox" ${opts.enableSignature ? 'checked' : ''}>
                    <span class="inv-switch-ctrl"></span>
                  </label>
                  ${
                    opts.enableSignature
                      ? `
                    <div class="inv-switch-body">
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                        <input class="inv-input" id="inp-sig-city" value="${escapeHtml(opts.signatureCity)}" placeholder="Kota (Jakarta)" style="padding: 5px 8px; font-size: 0.75rem;">
                        <input class="inv-input" id="inp-sig-name" value="${escapeHtml(opts.signerName)}" placeholder="Nama Penandatangan" style="padding: 5px 8px; font-size: 0.75rem;">
                      </div>
                      <input class="inv-input" id="inp-sig-title" value="${escapeHtml(opts.signerTitle)}" placeholder="Jabatan (Direktur / Authorized Signer)" style="padding: 5px 8px; font-size: 0.75rem;">

                      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <input type="file" id="file-sig-upload" accept="image/*" style="display: none;">
                        <button class="inv-btn inv-btn-sm" id="btn-trigger-sig" style="font-size: 0.72rem; flex: 1;">Upload TTD</button>
                        <button class="inv-btn inv-btn-sm" id="btn-draw-sig" style="font-size: 0.72rem; flex: 1;">${icon('pen', 12)} Gambar TTD</button>

                        <input type="file" id="file-stamp-upload" accept="image/*" style="display: none;">
                        <button class="inv-btn inv-btn-sm" id="btn-trigger-stamp" style="font-size: 0.72rem; flex: 1;">Upload Stempel</button>
                      </div>

                      ${
                        opts.signatureImage || opts.stampImage
                          ? `
                        <div style="display: flex; gap: 8px; align-items: center; margin-top: 2px;">
                          ${opts.signatureImage ? `<span style="font-size: 0.7rem; color: #15803d; font-weight: 500;">✓ TTD</span>` : ''}
                          ${opts.stampImage ? `<span style="font-size: 0.7rem; color: #15803d; font-weight: 500;">✓ Stempel</span>` : ''}
                          <button class="inv-btn inv-btn-sm inv-btn-danger" id="btn-clear-sig-media" style="padding: 2px 6px; font-size: 0.7rem; margin-left: auto;">Reset Media</button>
                        </div>
                      `
                          : ''
                      }
                    </div>
                  `
                      : ''
                  }
                </div>
              </div>
            </div>

            <!-- Invoice Information -->
            <div class="inv-section">
              <h3 class="inv-section-title">Informasi Dokumen</h3>
              <div class="inv-field">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                  <span class="inv-label">Nomor Dokumen</span>
                  <span style="font-size: 0.75rem; color: #0f766e; font-weight: 500;">Format: Tahun / Bulan Romawi / No Urut</span>
                </div>
                <div class="inv-input-group">
                  <input class="inv-input" id="inp-inv-number" value="${escapeHtml(currentInvoice.invoiceNumber)}" placeholder="INV/2026/XI/001">
                  <button class="inv-input-action" id="btn-regen-number" title="Generate ulang nomor urut">${icon('retry', 16)}</button>
                </div>
              </div>

              <!-- Pilihan Format Kombinasi Penomoran -->
              <div class="inv-field" style="margin-top: -4px;">
                <span class="inv-label" style="font-size: 0.75rem; color: var(--text-3);">Format Penomoran Otomatis:</span>
                <select class="inv-select" id="sel-inv-format" style="padding: 6px 10px; font-size: 0.8rem;">
                  <option value="INV/YYYY/ROMAN/SEQ" ${selectedInvFormat === 'INV/YYYY/ROMAN/SEQ' ? 'selected' : ''}>
                    [PREFIX] / Tahun / Romawi / Urut (Contoh: INV/2026/XI/001)
                  </option>
                  <option value="INV/ROMAN/YYYY/SEQ" ${selectedInvFormat === 'INV/ROMAN/YYYY/SEQ' ? 'selected' : ''}>
                    [PREFIX] / Romawi / Tahun / Urut (Contoh: INV/XI/2026/001)
                  </option>
                  <option value="INV-YYYY-ROMAN-SEQ" ${selectedInvFormat === 'INV-YYYY-ROMAN-SEQ' ? 'selected' : ''}>
                    [PREFIX] - Tahun - Romawi - Urut (Contoh: INV-2026-XI-001)
                  </option>
                  <option value="INV/YYYY/MM/SEQ" ${selectedInvFormat === 'INV/YYYY/MM/SEQ' ? 'selected' : ''}>
                    [PREFIX] / Tahun / Bulan Angka / Urut (Contoh: INV/2026/11/001)
                  </option>
                  <option value="INV-YYYYMM-SEQ" ${selectedInvFormat === 'INV-YYYYMM-SEQ' ? 'selected' : ''}>
                    [PREFIX] - YYYYMM - Urut (Contoh: INV-202611-001)
                  </option>
                </select>
              </div>

              <div class="inv-field-row" style="margin-top: 6px;">
                <label class="inv-field">
                  <span class="inv-label">${i18n.dateIssued}</span>
                  <input class="inv-input" type="date" id="inp-date-issued" value="${currentInvoice.dateIssued}">
                </label>
                <label class="inv-field">
                  <span class="inv-label">${i18n.dueDate[opts.docType]}</span>
                  <input class="inv-input" type="date" id="inp-due-date" value="${currentInvoice.dueDate}">
                </label>
              </div>
            </div>

            <!-- Billed To (Client Selector) -->
            <div class="inv-section">
              <div class="inv-client-box-head">
                <h3 class="inv-section-title">${i18n.billedTo}</h3>
                <button class="inv-add-client-link" id="btn-add-client-quick">
                  + Add New Client
                </button>
              </div>

              <div class="inv-client-box">
                <label class="inv-field">
                  <span class="inv-label">Pilih Pelanggan / Customer</span>
                  <select class="inv-select" id="sel-client">
                    ${state.clients
                      .map(
                        (c) =>
                          `<option value="${c.id}" ${c.id === currentInvoice.clientId ? 'selected' : ''}>${escapeHtml(c.name)} ${
                            c.email ? '(' + escapeHtml(c.email) + ')' : ''
                          }</option>`
                      )
                      .join('')}
                    <option value="custom">+ Isi Manual / Baru...</option>
                  </select>
                </label>

                <div class="inv-client-details">
                  <span class="inv-client-name">${escapeHtml(currentInvoice.client.name || 'Belum ada nama klien')}</span>
                  ${currentInvoice.client.email ? `<span class="inv-client-sub">${escapeHtml(currentInvoice.client.email)}</span>` : ''}
                  ${currentInvoice.client.phone ? `<span class="inv-client-sub">${escapeHtml(currentInvoice.client.phone)}</span>` : ''}
                  ${currentInvoice.client.address ? `<span class="inv-client-sub">${escapeHtml(currentInvoice.client.address)}</span>` : ''}
                </div>
              </div>
            </div>

            <!-- Items & Currency -->
            <div class="inv-section">
              <h3 class="inv-section-title">${i18n.itemDesc} & Mata Uang</h3>

              <!-- Currency & Language Selector Row -->
              <div class="inv-field-row">
                <label class="inv-field">
                  <span class="inv-label">Currency (Mata Uang)</span>
                  <select class="inv-select" id="sel-currency">
                    ${Object.keys(CURRENCIES)
                      .map((key) => `<option value="${key}" ${key === currentInvoice.currency ? 'selected' : ''}>${CURRENCIES[key].label}</option>`)
                      .join('')}
                  </select>
                </label>
                <label class="inv-field">
                  <span class="inv-label">Bahasa Dokumen (Language)</span>
                  <div class="inv-lang-switch" style="width: 100%; height: 38px; border-radius: var(--radius-sm); padding: 3px; box-sizing: border-box;">
                    <button class="inv-lang-btn btn-set-lang ${opts.language === 'id' ? 'is-active' : ''}" data-lang="id" style="flex: 1; justify-content: center; height: 100%; border-radius: var(--radius-sm); font-size: 0.825rem;">
                      🇮🇩 Indonesia
                    </button>
                    <button class="inv-lang-btn btn-set-lang ${opts.language === 'en' ? 'is-active' : ''}" data-lang="en" style="flex: 1; justify-content: center; height: 100%; border-radius: var(--radius-sm); font-size: 0.825rem;">
                      🇬🇧 English
                    </button>
                  </div>
                </label>
              </div>

              <!-- Items Table -->
              <div class="inv-items-table-wrapper"><table class="inv-items-table">
                <thead>
                  <tr>
                    <th style="width: 45%;">${i18n.itemDesc}</th>
                    <th style="width: 18%;">${i18n.quantity}</th>
                    <th style="width: 27%;">${i18n.unitPrice}</th>
                    <th style="width: 10%;"></th>
                  </tr>
                </thead>
                <tbody id="items-table-body">
                  ${currentInvoice.items
                    .map(
                      (item, i) => `
                    <tr>
                      <td>
                        <input class="inv-input inp-item-desc" data-index="${i}" value="${escapeHtml(item.description)}" placeholder="Nama layanan...">
                      </td>
                      <td>
                        <input class="inv-input inp-item-qty" type="number" min="1" step="1" data-index="${i}" value="${item.quantity}">
                      </td>
                      <td>
                        <input class="inv-input inp-item-price" type="number" min="0" step="any" data-index="${i}" value="${item.unitPrice}">
                      </td>
                      <td style="text-align: center;">
                        <button class="inv-btn-danger inv-btn-sm btn-del-item" data-index="${i}" title="Hapus">${icon('trash', 16)}</button>
                      </td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table></div>

              <button class="inv-add-item-btn" id="btn-add-item">
                ${icon('upload', 16)} <span>+ Tambah Baris Layanan</span>
              </button>

              <!-- Tax & Discount -->
              <div class="inv-field-row" style="margin-top: 10px;">
                <label class="inv-field">
                  <span class="inv-label">${i18n.tax} (%)</span>
                  <input class="inv-input" type="number" min="0" max="100" step="0.5" id="inp-tax" value="${currentInvoice.taxPercentage}" placeholder="10">
                </label>
                <label class="inv-field">
                  <span class="inv-label">${i18n.discount} (${curr.symbol})</span>
                  <input class="inv-input" type="number" min="0" step="any" id="inp-discount" value="${currentInvoice.discount}" placeholder="0">
                </label>
              </div>

              <!-- Notes & Payment Instruction -->
              <label class="inv-field" style="margin-top: 10px;">
                <span class="inv-label">${i18n.paymentNotes}</span>
                <textarea class="inv-textarea" id="inp-notes" rows="3">${escapeHtml(currentInvoice.notes || '')}</textarea>
              </label>

              <!-- Tombol Cepat ke Pratinjau untuk Pengguna Mobile -->
              <button class="inv-btn inv-btn-primary inv-mobile-only-btn" id="btn-jump-to-preview" style="margin-top: 12px; width: 100%; justify-content: center; padding: 11px;">
                ${icon('eye', 16)} <span>Lihat Pratinjau Dokumen (${formatMoney(totals.grandTotal, currentInvoice.currency)}) &rarr;</span>
              </button>
            </div>
          </div>

          <!-- KOLOM KANAN: PREVIEW DOKUMEN INVOICE (STICKY) -->
          <div class="inv-preview-wrapper ${mobileActiveView === 'form' ? 'inv-mobile-hidden' : ''}">
            <div class="inv-preview-bar">
              <div class="inv-preview-title">
                ${icon('eye', 18)} <span>Preview</span>
                <span class="inv-badge ${
                  currentInvoice.status === 'paid' ? 'inv-badge-paid' : currentInvoice.status === 'pending' ? 'inv-badge-pending' : 'inv-badge-draft'
                }">
                  ${currentInvoice.status}
                </span>
              </div>

              <!-- Pilihan Bahasa Cepat Langsung di Pratinjau -->
              <div class="inv-lang-switch" title="Ganti Bahasa Dokumen (Document Language)">
                <button class="inv-lang-btn btn-set-lang ${opts.language === 'id' ? 'is-active' : ''}" data-lang="id">
                  🇮🇩 ID
                </button>
                <button class="inv-lang-btn btn-set-lang ${opts.language === 'en' ? 'is-active' : ''}" data-lang="en">
                  🇬🇧 EN
                </button>
              </div>

              <div class="inv-preview-actions">
                <button class="inv-btn inv-btn-sm inv-btn-wa" id="btn-share-wa" title="Kirim penagihan via WhatsApp">
                  ${icon('whatsapp', 14)} <span>WhatsApp</span>
                </button>
                <button class="inv-btn inv-btn-sm" id="btn-share-email" title="Kirim via Email">
                  <span>✉ Email</span>
                </button>
                <button class="inv-btn inv-btn-sm inv-btn-primary" id="btn-print-pdf" title="Cetak atau Simpan PDF">
                  ${icon('download', 14)} <span>PDF / Cetak</span>
                </button>
              </div>

              <!-- Tombol Kembali ke Form untuk Pengguna Mobile -->
              <button class="inv-btn inv-btn-sm inv-mobile-only-btn" id="btn-back-to-form" style="width: 100%; justify-content: center; margin-top: 6px;">
                <span>&larr; Kembali ke Form Editor</span>
              </button>
            </div>

            <!-- LEMBAR DOKUMEN (KERTAS A4) -->
            <div class="inv-paper" id="invoice-printable-paper">
              <!-- Watermark LUNAS jika Kuitansi atau Status Paid -->
              ${
                opts.docType === 'receipt' || currentInvoice.status === 'paid'
                  ? `<div class="inv-paper-paid-watermark">${i18n.paidWatermark}</div>`
                  : ''
              }

              <!-- Header Paper -->
              <div class="inv-paper-header">
                <div class="inv-paper-brand">
                  <h1 class="inv-paper-h1">${i18n[opts.docType]}</h1>
                  <span class="inv-paper-num">${i18n.numLabel[opts.docType]}: ${escapeHtml(currentInvoice.invoiceNumber)}</span>
                </div>
                ${
                  currentInvoice.logoImage || state.business.logoImage
                    ? `<img class="inv-paper-logo-img" id="paper-logo-clickable" src="${currentInvoice.logoImage || state.business.logoImage}" alt="${escapeHtml(state.business.name)}" title="Klik untuk ganti logo">`
                    : `<div class="inv-paper-logo" id="paper-logo-clickable" title="Klik untuk upload logo bisnis">${state.business.name.slice(0, 1) || 'K'}</div>`
                }
              </div>

              <!-- Parties: Billed By vs Billed To -->
              <div class="inv-paper-parties">
                <div class="inv-party-col">
                  <span class="inv-party-label">${i18n.billedBy}:</span>
                  <span class="inv-party-name">${escapeHtml(state.business.name || '')}</span>
                  ${state.business.email ? `<span class="inv-party-text">${escapeHtml(state.business.email)}</span>` : ''}
                  ${state.business.phone ? `<span class="inv-party-text">${escapeHtml(state.business.phone)}</span>` : ''}
                  ${state.business.address ? `<span class="inv-party-text">${escapeHtml(state.business.address)}</span>` : ''}
                </div>
                <div class="inv-party-col">
                  <span class="inv-party-label">${i18n.billedTo}:</span>
                  <span class="inv-party-name">${escapeHtml(currentInvoice.client.name || 'Nama Klien')}</span>
                  ${currentInvoice.client.email ? `<span class="inv-party-text">${escapeHtml(currentInvoice.client.email)}</span>` : ''}
                  ${currentInvoice.client.phone ? `<span class="inv-party-text">${escapeHtml(currentInvoice.client.phone)}</span>` : ''}
                  ${currentInvoice.client.address ? `<span class="inv-party-text">${escapeHtml(currentInvoice.client.address)}</span>` : ''}
                </div>
              </div>

              <!-- Dates: Issued vs Due -->
              <div class="inv-paper-dates">
                <div class="inv-date-item">
                  <span class="inv-date-label">${i18n.dateIssued}:</span>
                  <span class="inv-date-val">${formatDateDisplay(currentInvoice.dateIssued, opts.language)}</span>
                </div>
                <div class="inv-date-item">
                  <span class="inv-date-label">${i18n.dueDate[opts.docType]}:</span>
                  <span class="inv-date-val">${formatDateDisplay(currentInvoice.dueDate, opts.language)}</span>
                </div>
              </div>

              <!-- Items Table -->
              <div class="inv-paper-table-wrapper"><table class="inv-paper-table">
                <thead>
                  <tr>
                    <th class="t-center" style="width: 8%;">#</th>
                    <th style="width: 48%;">${i18n.itemDesc}</th>
                    <th class="t-center" style="width: 12%;">${i18n.quantity}</th>
                    <th class="t-right" style="width: 16%;">${i18n.unitPrice}</th>
                    <th class="t-right" style="width: 16%;">${i18n.total}</th>
                  </tr>
                </thead>
                <tbody>
                  ${currentInvoice.items
                    .map((item, idx) => {
                      const totalItem = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                      return `
                      <tr>
                        <td class="t-center" style="color: #9ca3af; font-size: 0.8rem;">${idx + 1}</td>
                        <td><strong>${escapeHtml(item.description || (opts.language === 'id' ? 'Layanan' : 'Service Item'))}</strong></td>
                        <td class="t-center">${item.quantity}</td>
                        <td class="t-right">${formatMoney(item.unitPrice, currentInvoice.currency)}</td>
                        <td class="t-right"><strong>${formatMoney(totalItem, currentInvoice.currency)}</strong></td>
                      </tr>
                    `;
                    })
                    .join('')}
                </tbody></table></div>

              <!-- Totals Calculation -->
              <div class="inv-paper-summary">
                <div class="inv-summary-table">
                  <div class="inv-summary-row">
                    <span>${i18n.subtotal}</span>
                    <span>${formatMoney(totals.subtotal, currentInvoice.currency)}</span>
                  </div>
                  ${
                    totals.taxRate > 0
                      ? `
                    <div class="inv-summary-row">
                      <span>${i18n.tax} (${totals.taxRate}%)</span>
                      <span>${formatMoney(totals.taxAmount, currentInvoice.currency)}</span>
                    </div>
                  `
                      : ''
                  }
                  ${
                    totals.discount > 0
                      ? `
                    <div class="inv-summary-row">
                      <span>${i18n.discount}</span>
                      <span>-${formatMoney(totals.discount, currentInvoice.currency)}</span>
                    </div>
                  `
                      : ''
                  }
                  <div class="inv-summary-row is-total">
                    <span>${i18n.grandTotal[opts.docType]}</span>
                    <span>${formatMoney(totals.grandTotal, currentInvoice.currency)}</span>
                  </div>

                  <!-- Termin / DP (jika diaktifkan) -->
                  ${
                    opts.enableDP
                      ? `
                    <div class="inv-summary-row is-dp">
                      <span>${i18n.dpLabel} (${opts.dpType === 'percent' ? opts.dpValue + '%' : curr.symbol})</span>
                      <span>${formatMoney(totals.dpAmount, currentInvoice.currency)}</span>
                    </div>
                    <div class="inv-summary-row is-balance">
                      <span>${i18n.balanceDue}</span>
                      <span>${formatMoney(totals.balanceDue, currentInvoice.currency)}</span>
                    </div>
                  `
                      : ''
                  }
                </div>
              </div>

              <!-- Teks Terbilang Otomatis (jika diaktifkan) -->
              ${
                opts.enableTerbilang
                  ? `
                <div class="inv-paper-terbilang">
                  <strong>${i18n.terbilang}:</strong> # ${getAmountInWords(
                      opts.enableDP ? totals.dpAmount || totals.grandTotal : totals.grandTotal,
                      currentInvoice.currency,
                      opts.language
                    )} #
                </div>
              `
                  : ''
              }

              <!-- Notes, Bank Info & QRIS -->
              <div class="inv-paper-notes">
                <div class="inv-paper-pay-container">
                  <div class="inv-paper-pay-left">
                    <div class="inv-paper-notes-title">${i18n.paymentNotes}:</div>
                    <div>${escapeHtml(currentInvoice.notes || '').replace(/\n/g, '<br>')}</div>
                    ${
                      state.business.bankName
                        ? `
                      <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e5e7eb;">
                        <strong>${i18n.bankTransfer}:</strong> ${escapeHtml(state.business.bankName)} — A/N ${escapeHtml(
                            state.business.accountHolder
                          )} (${escapeHtml(state.business.accountNumber)})
                      </div>
                    `
                        : ''
                    }
                  </div>

                  <!-- QRIS Pembayaran (jika diaktifkan) -->
                  ${
                    opts.enableQRIS && opts.qrisImage
                      ? `
                    <div class="inv-paper-qris-col">
                      <img class="inv-paper-qris-img" src="${opts.qrisImage}" alt="QRIS">
                      <span class="inv-paper-qris-label">${i18n.scanQRIS}</span>
                    </div>
                  `
                      : ''
                  }
                </div>
              </div>

              <!-- Tanda Tangan & Stempel Resmi (jika diaktifkan) -->
              ${
                opts.enableSignature
                  ? `
                <div class="inv-paper-sig-row">
                  <div class="inv-paper-sig-box">
                    <span class="inv-paper-sig-date">${opts.signatureCity ? escapeHtml(opts.signatureCity) + ', ' : ''}${formatDateDisplay(
                      currentInvoice.dateIssued,
                      opts.language
                    )}</span>
                    <div class="inv-paper-sig-art">
                      ${opts.signatureImage ? `<img class="inv-paper-sig-img" src="${opts.signatureImage}" alt="Signature">` : `<div style="height: 35px;"></div>`}
                      ${opts.stampImage ? `<img class="inv-paper-stamp-img" src="${opts.stampImage}" alt="Stamp">` : ''}
                    </div>
                    <div class="inv-paper-sig-line"></div>
                    <span class="inv-paper-sig-name">${escapeHtml(opts.signerName || state.business.name || '')}</span>
                    <span class="inv-paper-sig-title">${escapeHtml(opts.signerTitle || i18n.signer)}</span>
                  </div>
                </div>
              `
                  : ''
              }

              <!-- Footer -->
              <div class="inv-paper-footer">
                <span>${escapeHtml(state.business.name)}</span>
                <span>${escapeHtml(state.business.phone || state.business.email || '')}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Tab 2: History View (Riwayat Invoice)
    function renderHistoryView() {
      const invoices = state.invoices || [];

      return `
        <div class="inv-list-card">
          <div class="inv-card-head">
            <h2 class="inv-card-title">${icon('chart', 18)} Riwayat Invoice</h2>
            <div style="display: flex; gap: 8px;">
              <button class="inv-btn inv-btn-primary inv-btn-sm" id="btn-create-new-from-hist">
                ${icon('upload', 14)} <span>+ Buat Invoice Baru</span>
              </button>
            </div>
          </div>

          <div class="inv-search-bar">
            <input class="inv-search-input" id="hist-search" placeholder="Cari no invoice, nama klien, atau nominal...">
            <span style="font-size: 0.8rem; color: var(--text-3);">Tersimpan di: <strong>${
              storageStatus === 'vercel_kv' ? 'Cloud Vercel KV' : storageStatus === 'local_file' ? 'File Lokal (kantor/)' : 'Browser LocalStorage'
            }</strong></span>
          </div>

          ${
            invoices.length === 0
              ? `
            <div class="inv-empty">
              ${icon('fileText', 32)}
              <p>Belum ada invoice yang tersimpan. Klik tombol di atas untuk membuat invoice pertama.</p>
            </div>
          `
              : `
            <div class="inv-table-responsive">
              <table class="inv-data-table">
                <thead>
                  <tr>
                    <th>Dokumen #</th>
                    <th>Tipe</th>
                    <th>Klien</th>
                    <th>Tanggal</th>
                    <th>Jatuh Tempo</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th style="text-align: right;">Aksi</th>
                  </tr>
                </thead>
                <tbody id="hist-table-body">
                  ${invoices
                    .map((inv) => {
                      const t = computeTotals(inv);
                      const dType = inv.docType || 'invoice';
                      const badgeLabel = dType === 'quotation' ? 'Quotation' : dType === 'receipt' ? 'Receipt' : 'Invoice';
                      return `
                      <tr>
                        <td><strong>${escapeHtml(inv.invoiceNumber)}</strong></td>
                        <td><span class="inv-badge" style="background:#e0f2fe; color:#0369a1; font-size:0.7rem;">${badgeLabel}</span></td>
                        <td>${escapeHtml(inv.client?.name || '-')}</td>
                        <td>${inv.dateIssued || '-'}</td>
                        <td>${inv.dueDate || '-'}</td>
                        <td><strong>${formatMoney(t.grandTotal, inv.currency)}</strong></td>
                        <td>
                          <select class="inv-select inv-status-select" data-id="${inv.id}" style="padding: 2px 6px; font-size: 0.75rem; width: auto;">
                            <option value="pending" ${inv.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="paid" ${inv.status === 'paid' ? 'selected' : ''}>Paid</option>
                            <option value="draft" ${inv.status === 'draft' ? 'selected' : ''}>Draft</option>
                          </select>
                        </td>
                        <td style="text-align: right; white-space: nowrap;">
                          <button class="inv-btn inv-btn-sm inv-btn-wa btn-hist-wa" data-id="${inv.id}" title="Kirim WhatsApp">${icon(
                        'whatsapp',
                        14
                      )}</button>
                          <button class="inv-btn inv-btn-sm btn-edit-inv" data-id="${inv.id}" title="Buka & Edit">Edit</button>
                          <button class="inv-btn inv-btn-sm btn-print-inv" data-id="${inv.id}" title="Cetak / PDF">${icon('download', 14)}</button>
                          <button class="inv-btn inv-btn-sm btn-dup-inv" data-id="${inv.id}" title="Duplikat">${icon('copy', 14)}</button>
                          <button class="inv-btn-danger inv-btn-sm btn-del-inv" data-id="${inv.id}" title="Hapus">${icon('trash', 14)}</button>
                        </td>
                      </tr>
                    `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          }
        </div>
      `;
    }

    // Tab 3: Customer Menu (Daftar Pelanggan)
    function renderClientsView() {
      const clients = state.clients || [];

      return `
        <div class="inv-list-card">
          <div class="inv-card-head">
            <h2 class="inv-card-title">${icon('users', 18)} Manajemen Pelanggan (Customers)</h2>
            <button class="inv-btn inv-btn-primary inv-btn-sm" id="btn-add-client-tab">
              ${icon('upload', 14)} <span>+ Tambah Pelanggan Baru</span>
            </button>
          </div>

          <p style="font-size: 0.85rem; color: var(--text-2); margin: 0;">
            Data pelanggan yang tersimpan di sini dapat langsung dipilih saat membuat invoice baru tanpa perlu mengetik ulang alamat & kontak.
          </p>

          ${
            clients.length === 0
              ? `
            <div class="inv-empty">
              ${icon('users', 32)}
              <p>Belum ada data pelanggan tersimpan.</p>
            </div>
          `
              : `
            <div class="inv-table-responsive">
              <table class="inv-data-table">
                <thead>
                  <tr>
                    <th>Perusahaan / Klien</th>
                    <th>PIC (Kontak)</th>
                    <th>Email</th>
                    <th>No. Telepon / WA</th>
                    <th>Alamat</th>
                    <th style="text-align: right;">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  ${clients
                    .map(
                      (c) => `
                    <tr>
                      <td><strong>${escapeHtml(c.name)}</strong></td>
                      <td>${escapeHtml(c.contactPerson || '-')}</td>
                      <td>${escapeHtml(c.email || '-')}</td>
                      <td>${escapeHtml(c.phone || '-')}</td>
                      <td style="max-width: 250px; font-size: 0.8rem; color: var(--text-2);">${escapeHtml(c.address || '-')}</td>
                      <td style="text-align: right; white-space: nowrap;">
                        <button class="inv-btn inv-btn-sm btn-use-client" data-id="${c.id}" title="Buat invoice untuk klien ini">Buat Invoice</button>
                        <button class="inv-btn inv-btn-sm btn-edit-client" data-id="${c.id}" title="Edit Data">${icon('retry', 14)}</button>
                        <button class="inv-btn-danger inv-btn-sm btn-del-client" data-id="${c.id}" title="Hapus">${icon('trash', 14)}</button>
                      </td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          }
        </div>
      `;
    }

    // Tab 4: Business Profile Settings
    function renderBusinessView() {
      const b = state.business || {};

      return `
        <div class="inv-card" style="max-width: 720px; margin: 0 auto;">
          <div class="inv-card-head">
            <h2 class="inv-card-title">${icon('sliders', 18)} Pengaturan Profil Bisnis</h2>
            <button class="inv-btn inv-btn-primary inv-btn-sm" id="btn-save-biz">Simpan Pengaturan</button>
          </div>

          <div class="inv-section">
            <h3 class="inv-section-title">Informasi Usaha</h3>
            <label class="inv-field">
              <span class="inv-label">Nama Bisnis / Brand</span>
              <input class="inv-input" id="biz-name" value="${escapeHtml(b.name || '')}" placeholder="Flowly Tech / NuhaWeb">
            </label>
            <div class="inv-field-row">
              <label class="inv-field">
                <span class="inv-label">Email Penagihan</span>
                <input class="inv-input" id="biz-email" value="${escapeHtml(b.email || '')}" placeholder="billing@perusahaan.com">
              </label>
              <label class="inv-field">
                <span class="inv-label">No. Telepon / WA</span>
                <input class="inv-input" id="biz-phone" value="${escapeHtml(b.phone || '')}" placeholder="+62 823-4567-8901">
              </label>
            </div>
            <div class="inv-field-row">
              <label class="inv-field">
                <span class="inv-label">Kota Asal (Default Penandatanganan)</span>
                <input class="inv-input" id="biz-city" value="${escapeHtml(b.city || 'Jakarta')}" placeholder="Jakarta / Kuala Lumpur">
              </label>
              <label class="inv-field">
                <span class="inv-label">Alamat Kantor / Bisnis</span>
                <input class="inv-input" id="biz-address" value="${escapeHtml(b.address || '')}" placeholder="Jl. Sudirman No. 1, Jakarta">
              </label>
            </div>
          </div>

          <div class="inv-section">
            <h3 class="inv-section-title">Rekening Pembayaran Bank (Tampil di Invoice)</h3>
            <div class="inv-field-row">
              <label class="inv-field">
                <span class="inv-label">Nama Bank</span>
                <input class="inv-input" id="biz-bank" value="${escapeHtml(b.bankName || '')}" placeholder="BCA / Maybank / Mandiri">
              </label>
              <label class="inv-field">
                <span class="inv-label">Nomor Rekening</span>
                <input class="inv-input" id="biz-acc-no" value="${escapeHtml(b.accountNumber || '')}" placeholder="123-456-7890">
              </label>
            </div>
            <label class="inv-field">
              <span class="inv-label">Atas Nama Rekening</span>
              <input class="inv-input" id="biz-acc-holder" value="${escapeHtml(b.accountHolder || '')}" placeholder="Nama pemilik rekening">
            </label>
          </div>

          <div class="inv-section">
            <h3 class="inv-section-title">Aset Default (QRIS, Tanda Tangan & Stempel)</h3>
            <p style="font-size: 0.8rem; color: var(--text-2); margin: 0 0 8px 0;">
              Aset yang diunggah di sini akan otomatis menjadi gambar default saat membuat invoice baru:
            </p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
              <!-- Default Logo -->
              <div style="border: 1px solid var(--border); padding: 12px; border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 8px;">
                <span class="inv-label">Logo Bisnis / Perusahaan</span>
                ${
                  b.logoImage
                    ? `
                  <img src="${b.logoImage}" style="max-height: 50px; max-width: 120px; object-fit: contain; border: 1px solid var(--border); border-radius: 4px; background: #fff;">
                  <button class="inv-btn inv-btn-sm inv-btn-danger" id="biz-del-logo" style="padding: 2px 6px; font-size: 0.72rem;">Hapus Logo</button>
                `
                    : `
                  <input type="file" id="biz-file-logo" accept="image/*" style="display: none;">
                  <button class="inv-btn inv-btn-sm" id="biz-btn-logo" style="font-size: 0.75rem;">${icon('upload', 14)} Upload Logo</button>
                `
                }
              </div>
              <!-- Default QRIS -->
              <div style="border: 1px solid var(--border); padding: 12px; border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 8px;">
                <span class="inv-label">Default QRIS</span>
                ${
                  b.qrisImage
                    ? `
                  <img src="${b.qrisImage}" style="width: 60px; height: 60px; object-fit: contain; border: 1px solid var(--border); border-radius: 4px; background: #fff;">
                  <button class="inv-btn inv-btn-sm inv-btn-danger" id="biz-del-qris" style="padding: 2px 6px; font-size: 0.72rem;">Hapus QRIS</button>
                `
                    : `
                  <input type="file" id="biz-file-qris" accept="image/*" style="display: none;">
                  <button class="inv-btn inv-btn-sm" id="biz-btn-qris" style="font-size: 0.75rem;">Upload QRIS</button>
                `
                }
              </div>

              <!-- Default TTD -->
              <div style="border: 1px solid var(--border); padding: 12px; border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 8px;">
                <span class="inv-label">Default Tanda Tangan</span>
                ${
                  b.signatureImage
                    ? `
                  <img src="${b.signatureImage}" style="max-height: 50px; max-width: 120px; object-fit: contain; border: 1px solid var(--border); border-radius: 4px; background: #fff;">
                  <button class="inv-btn inv-btn-sm inv-btn-danger" id="biz-del-sig" style="padding: 2px 6px; font-size: 0.72rem;">Hapus TTD</button>
                `
                    : `
                  <input type="file" id="biz-file-sig" accept="image/*" style="display: none;">
                  <button class="inv-btn inv-btn-sm" id="biz-btn-sig" style="font-size: 0.75rem;">Upload TTD</button>
                `
                }
              </div>

              <!-- Default Stempel -->
              <div style="border: 1px solid var(--border); padding: 12px; border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 8px;">
                <span class="inv-label">Default Stempel</span>
                ${
                  b.stampImage
                    ? `
                  <img src="${b.stampImage}" style="max-height: 50px; max-width: 100px; object-fit: contain; border: 1px solid var(--border); border-radius: 4px; background: #fff;">
                  <button class="inv-btn inv-btn-sm inv-btn-danger" id="biz-del-stamp" style="padding: 2px 6px; font-size: 0.72rem;">Hapus Stempel</button>
                `
                    : `
                  <input type="file" id="biz-file-stamp" accept="image/*" style="display: none;">
                  <button class="inv-btn inv-btn-sm" id="biz-btn-stamp" style="font-size: 0.75rem;">Upload Stempel</button>
                `
                }
              </div>
            </div>
          </div>

          <div class="inv-section" style="background: var(--field); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border);">
            <h3 class="inv-section-title" style="margin-bottom: 6px;">Status Penyimpanan Cloud Vercel</h3>
            <p style="font-size: 0.85rem; color: var(--text-2); margin: 0 0 10px 0;">
              Status saat ini: <strong>${
                storageStatus === 'vercel_kv'
                  ? 'Tersambung ke Vercel KV Cloud Store'
                  : storageStatus === 'local_file'
                  ? 'Menyimpan ke File Lokal (kantor/invoices-data.json)'
                  : 'Menyimpan di Browser Lokal (LocalStorage)'
              }</strong>.
            </p>
            <p style="font-size: 0.8rem; color: var(--text-3); margin: 0;">
              Tip untuk Vercel: Tambahkan <strong>Vercel KV</strong> dari dashboard Vercel &rarr; Storage, maka riwayat invoice otomatis tersimpan secara online tanpa biaya.
            </p>
          </div>
        </div>
      `;
    }

    // Binding event listener ke elemen DOM
    function bindEvents() {
      // Tab switching
      el.querySelectorAll('.inv-subnav-btn').forEach((btn) => {
        btn.onclick = () => {
          currentTab = btn.dataset.tab;
          renderApp();
        };
      });

      const quickHistBtn = el.querySelector('#quick-switch-history');
      if (quickHistBtn) {
        quickHistBtn.onclick = () => {
          currentTab = 'history';
          renderApp();
        };
      }

      // ================= TAB CREATE EVENTS =================
      if (currentTab === 'create') {
        if (!currentInvoice.options) {
          currentInvoice.options = {
            enableDP: false,
            dpType: 'percent',
            dpValue: 50,
            enableTerbilang: false,
            enableQRIS: false,
            qrisImage: state.business.qrisImage || '',
            enableSignature: false,
            signatureImage: state.business.signatureImage || '',
            stampImage: state.business.stampImage || '',
            signatureCity: state.business.city || 'Jakarta',
            signerName: state.business.name || '',
            signerTitle: 'Authorized Signer',
          };
        }

        // Tipe Dokumen (Invoice / Quotation / Receipt)
        const selDocType = el.querySelector('#sel-doc-type');
        if (selDocType) {
          selDocType.onchange = () => {
            currentInvoice.docType = selDocType.value;
            if (!currentInvoice.isManualEdited) {
              currentInvoice.invoiceNumber = generateInvoiceNumber(
                currentInvoice.dateIssued,
                state.invoices,
                selectedInvFormat,
                currentInvoice.docType
              );
            }
            renderApp();
          };
        }

        // Pilihan Bahasa (ID / EN) - Sinkron dari semua tombol & select
        el.querySelectorAll('.btn-set-lang').forEach((btn) => {
          btn.onclick = () => {
            const lang = btn.dataset.lang;
            if (lang) switchLanguage(lang);
          };
        });

        const selDocLang = el.querySelector('#sel-doc-lang');
        if (selDocLang) {
          selDocLang.onchange = () => {
            switchLanguage(selDocLang.value);
          };
        }

        // Sakelar 1: Termin / DP
        const chkDP = el.querySelector('#chk-opt-dp');
        if (chkDP) {
          chkDP.onchange = () => {
            currentInvoice.options.enableDP = chkDP.checked;
            renderApp();
          };
        }

        const inpDpType = el.querySelector('#inp-dp-type');
        if (inpDpType) {
          inpDpType.onchange = () => {
            currentInvoice.options.dpType = inpDpType.value;
            renderApp();
          };
        }

        const inpDpVal = el.querySelector('#inp-dp-val');
        if (inpDpVal) {
          inpDpVal.oninput = () => {
            currentInvoice.options.dpValue = Number(inpDpVal.value) || 0;
            renderApp();
          };
        }

        // Sakelar 2: Terbilang
        const chkTerbilang = el.querySelector('#chk-opt-terbilang');
        if (chkTerbilang) {
          chkTerbilang.onchange = () => {
            currentInvoice.options.enableTerbilang = chkTerbilang.checked;
            renderApp();
          };
        }

        // Sakelar 3: QRIS
        const chkQRIS = el.querySelector('#chk-opt-qris');
        if (chkQRIS) {
          chkQRIS.onchange = () => {
            currentInvoice.options.enableQRIS = chkQRIS.checked;
            if (chkQRIS.checked && !currentInvoice.options.qrisImage && state.business.qrisImage) {
              currentInvoice.options.qrisImage = state.business.qrisImage;
            }
            renderApp();
          };
        }

        const btnTriggerQRIS = el.querySelector('#btn-trigger-qris');
        const fileQRIS = el.querySelector('#file-qris-upload');
        if (btnTriggerQRIS && fileQRIS) {
          btnTriggerQRIS.onclick = () => fileQRIS.click();
          fileQRIS.onchange = async () => {
            if (fileQRIS.files && fileQRIS.files[0]) {
              try {
                const b64 = await compressImageFile(fileQRIS.files[0], 400);
                currentInvoice.options.qrisImage = b64;
                currentInvoice.options.enableQRIS = true;
                renderApp();
                showToast('Gambar QRIS berhasil dimuat!');
              } catch (_) {
                alert('Gagal memproses gambar QRIS.');
              }
            }
          };
        }

        const btnRemoveQRIS = el.querySelector('#btn-remove-qris');
        if (btnRemoveQRIS) {
          btnRemoveQRIS.onclick = () => {
            currentInvoice.options.qrisImage = '';
            renderApp();
          };
        }

        // Sakelar 4: Tanda Tangan & Stempel
        const chkSig = el.querySelector('#chk-opt-sig');
        if (chkSig) {
          chkSig.onchange = () => {
            currentInvoice.options.enableSignature = chkSig.checked;
            if (chkSig.checked) {
              if (!currentInvoice.options.signatureImage && state.business.signatureImage) {
                currentInvoice.options.signatureImage = state.business.signatureImage;
              }
              if (!currentInvoice.options.stampImage && state.business.stampImage) {
                currentInvoice.options.stampImage = state.business.stampImage;
              }
            }
            renderApp();
          };
        }

        const inpSigCity = el.querySelector('#inp-sig-city');
        if (inpSigCity) {
          inpSigCity.oninput = () => {
            currentInvoice.options.signatureCity = inpSigCity.value;
            const paperDate = el.querySelector('.inv-paper-sig-date');
            if (paperDate) {
              paperDate.textContent = `${currentInvoice.options.signatureCity ? currentInvoice.options.signatureCity + ', ' : ''}${formatDateDisplay(
                currentInvoice.dateIssued,
                currentInvoice.language || 'id'
              )}`;
            }
          };
        }

        const inpSigName = el.querySelector('#inp-sig-name');
        if (inpSigName) {
          inpSigName.oninput = () => {
            currentInvoice.options.signerName = inpSigName.value;
            const paperName = el.querySelector('.inv-paper-sig-name');
            if (paperName) paperName.textContent = currentInvoice.options.signerName;
          };
        }

        const inpSigTitle = el.querySelector('#inp-sig-title');
        if (inpSigTitle) {
          inpSigTitle.oninput = () => {
            currentInvoice.options.signerTitle = inpSigTitle.value;
            const paperTitle = el.querySelector('.inv-paper-sig-title');
            if (paperTitle) paperTitle.textContent = currentInvoice.options.signerTitle;
          };
        }

        const btnTriggerSig = el.querySelector('#btn-trigger-sig');
        const fileSig = el.querySelector('#file-sig-upload');
        if (btnTriggerSig && fileSig) {
          btnTriggerSig.onclick = () => fileSig.click();
          fileSig.onchange = async () => {
            if (fileSig.files && fileSig.files[0]) {
              try {
                const b64 = await compressImageFile(fileSig.files[0], 350);
                currentInvoice.options.signatureImage = b64;
                currentInvoice.options.enableSignature = true;
                renderApp();
                showToast('Gambar Tanda Tangan berhasil dimuat!');
              } catch (_) {
                alert('Gagal memproses gambar tanda tangan.');
              }
            }
          };
        }

        const btnDrawSig = el.querySelector('#btn-draw-sig');
        if (btnDrawSig) {
          btnDrawSig.onclick = () => openSignaturePad();
        }

        const btnTriggerStamp = el.querySelector('#btn-trigger-stamp');
        const fileStamp = el.querySelector('#file-stamp-upload');
        if (btnTriggerStamp && fileStamp) {
          btnTriggerStamp.onclick = () => fileStamp.click();
          fileStamp.onchange = async () => {
            if (fileStamp.files && fileStamp.files[0]) {
              try {
                const b64 = await compressImageFile(fileStamp.files[0], 300);
                currentInvoice.options.stampImage = b64;
                currentInvoice.options.enableSignature = true;
                renderApp();
                showToast('Gambar Stempel berhasil dimuat!');
              } catch (_) {
                alert('Gagal memproses gambar stempel.');
              }
            }
          };
        }

        const btnClearSigMedia = el.querySelector('#btn-clear-sig-media');
        if (btnClearSigMedia) {
          btnClearSigMedia.onclick = () => {
            currentInvoice.options.signatureImage = '';
            currentInvoice.options.stampImage = '';
            renderApp();
          };
        }

        // WhatsApp Billing Buttons
        const btnTopWA = el.querySelector('#btn-top-wa');
        if (btnTopWA) {
          btnTopWA.onclick = () => sendWhatsAppInvoice(currentInvoice);
        }

        const btnShareWA = el.querySelector('#btn-share-wa');
        if (btnShareWA) {
          btnShareWA.onclick = () => sendWhatsAppInvoice(currentInvoice);
        }

        // Mobile View Toggle Events
        el.querySelectorAll('.inv-mobile-tab-btn').forEach((btn) => {
          btn.onclick = () => {
            mobileActiveView = btn.dataset.view;
            renderApp();
          };
        });

        const btnJumpPreview = el.querySelector('#btn-jump-to-preview');
        if (btnJumpPreview) {
          btnJumpPreview.onclick = () => {
            mobileActiveView = 'preview';
            renderApp();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          };
        }

        const btnBackForm = el.querySelector('#btn-back-to-form');
        if (btnBackForm) {
          btnBackForm.onclick = () => {
            mobileActiveView = 'form';
            renderApp();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          };
        }

        // Regenerate invoice number
        const regenBtn = el.querySelector('#btn-regen-number');
        if (regenBtn) {
          regenBtn.onclick = () => {
            currentInvoice.isManualEdited = false;
            currentInvoice.invoiceNumber = generateInvoiceNumber(
              currentInvoice.dateIssued,
              state.invoices,
              selectedInvFormat,
              currentInvoice.docType
            );
            showToast('Nomor baru: ' + currentInvoice.invoiceNumber);
            renderApp();
          };
        }

        // Logo upload events
        const btnTriggerLogo = el.querySelector('#btn-trigger-logo');
        const fileLogo = el.querySelector('#file-logo-upload');
        const paperLogo = el.querySelector('#paper-logo-clickable');

        if (btnTriggerLogo && fileLogo) {
          btnTriggerLogo.onclick = () => fileLogo.click();
        }
        if (paperLogo && fileLogo) {
          paperLogo.onclick = () => fileLogo.click();
        }
        if (fileLogo) {
          fileLogo.onchange = async () => {
            if (fileLogo.files && fileLogo.files[0]) {
              try {
                const b64 = await compressImageFile(fileLogo.files[0], 400);
                currentInvoice.logoImage = b64;
                state.business.logoImage = b64;
                localStorage.setItem('flowly_invoices_local', JSON.stringify(state));
                renderApp();
                showToast('Logo bisnis berhasil diunggah!');
              } catch (_) {
                alert('Gagal memproses gambar logo.');
              }
            }
          };
        }

        const btnRemoveLogo = el.querySelector('#btn-remove-logo');
        if (btnRemoveLogo) {
          btnRemoveLogo.onclick = () => {
            currentInvoice.logoImage = '';
            state.business.logoImage = '';
            localStorage.setItem('flowly_invoices_local', JSON.stringify(state));
            renderApp();
            showToast('Logo dihapus.');
          };
        }

        // Ganti format kombinasi penomoran
        const selFormat = el.querySelector('#sel-inv-format');
        if (selFormat) {
          selFormat.onchange = () => {
            selectedInvFormat = selFormat.value;
            currentInvoice.isManualEdited = false;
            currentInvoice.invoiceNumber = generateInvoiceNumber(
              currentInvoice.dateIssued,
              state.invoices,
              selectedInvFormat,
              currentInvoice.docType
            );
            renderApp();
          };
        }

        // Live input: invoice number
        const inpNum = el.querySelector('#inp-inv-number');
        if (inpNum) {
          inpNum.oninput = () => {
            currentInvoice.invoiceNumber = inpNum.value.trim();
            currentInvoice.isManualEdited = true;
            updateLivePreview();
          };
        }

        // Date pickers
        const inpDateIssued = el.querySelector('#inp-date-issued');
        if (inpDateIssued) {
          inpDateIssued.onchange = () => {
            currentInvoice.dateIssued = inpDateIssued.value;
            if (!currentInvoice.isManualEdited) {
              currentInvoice.invoiceNumber = generateInvoiceNumber(
                currentInvoice.dateIssued,
                state.invoices,
                selectedInvFormat,
                currentInvoice.docType
              );
              renderApp();
            } else {
              updateLivePreview();
            }
          };
        }

        const inpDueDate = el.querySelector('#inp-due-date');
        if (inpDueDate) {
          inpDueDate.onchange = () => {
            currentInvoice.dueDate = inpDueDate.value;
            updateLivePreview();
          };
        }

        // Currency change
        const selCurr = el.querySelector('#sel-currency');
        if (selCurr) {
          selCurr.onchange = () => {
            currentInvoice.currency = selCurr.value;
            renderApp();
          };
        }

        // Client Select
        const selClient = el.querySelector('#sel-client');
        if (selClient) {
          selClient.onchange = () => {
            const val = selClient.value;
            if (val === 'custom') {
              openClientModal();
            } else {
              const found = state.clients.find((c) => c.id === val);
              if (found) {
                currentInvoice.clientId = found.id;
                currentInvoice.client = { ...found };
                renderApp();
              }
            }
          };
        }

        // Quick add client button
        const btnAddClientQuick = el.querySelector('#btn-add-client-quick');
        if (btnAddClientQuick) {
          btnAddClientQuick.onclick = () => openClientModal();
        }

        // Item dynamic inputs
        el.querySelectorAll('.inp-item-desc').forEach((inp) => {
          inp.oninput = () => {
            const i = Number(inp.dataset.index);
            if (currentInvoice.items[i]) {
              currentInvoice.items[i].description = inp.value;
              updateLivePreview();
            }
          };
        });

        el.querySelectorAll('.inp-item-qty').forEach((inp) => {
          inp.oninput = () => {
            const i = Number(inp.dataset.index);
            if (currentInvoice.items[i]) {
              currentInvoice.items[i].quantity = Number(inp.value) || 0;
              updateLivePreview();
            }
          };
        });

        el.querySelectorAll('.inp-item-price').forEach((inp) => {
          inp.oninput = () => {
            const i = Number(inp.dataset.index);
            if (currentInvoice.items[i]) {
              currentInvoice.items[i].unitPrice = Number(inp.value) || 0;
              updateLivePreview();
            }
          };
        });

        // Delete item
        el.querySelectorAll('.btn-del-item').forEach((btn) => {
          btn.onclick = () => {
            if (currentInvoice.items.length <= 1) {
              alert('Minimal harus ada 1 item di invoice.');
              return;
            }
            const i = Number(btn.dataset.index);
            currentInvoice.items.splice(i, 1);
            renderApp();
          };
        });

        // Add item
        const btnAddItem = el.querySelector('#btn-add-item');
        if (btnAddItem) {
          btnAddItem.onclick = () => {
            currentInvoice.items.push({ description: 'New Service Item', quantity: 1, unitPrice: 500 });
            renderApp();
          };
        }

        // Tax & Discount
        const inpTax = el.querySelector('#inp-tax');
        if (inpTax) {
          inpTax.oninput = () => {
            currentInvoice.taxPercentage = Number(inpTax.value) || 0;
            updateLivePreview();
          };
        }

        const inpDiscount = el.querySelector('#inp-discount');
        if (inpDiscount) {
          inpDiscount.oninput = () => {
            currentInvoice.discount = Number(inpDiscount.value) || 0;
            updateLivePreview();
          };
        }

        // Notes
        const inpNotes = el.querySelector('#inp-notes');
        if (inpNotes) {
          inpNotes.oninput = () => {
            currentInvoice.notes = inpNotes.value;
            updateLivePreview();
          };
        }

        // Save Draft button
        const btnSaveDraft = el.querySelector('#btn-save-draft');
        if (btnSaveDraft) {
          btnSaveDraft.onclick = () => {
            currentInvoice.status = 'draft';
            syncInvoiceToBackend(currentInvoice);
          };
        }

        // Save & Print button
        const btnSaveAndPrint = el.querySelector('#btn-save-and-print');
        if (btnSaveAndPrint) {
          btnSaveAndPrint.onclick = async () => {
            if (currentInvoice.status === 'draft') currentInvoice.status = 'pending';
            await syncInvoiceToBackend(currentInvoice);
            window.print();
          };
        }

        // Direct Print PDF button on preview
        const btnPrintPdf = el.querySelector('#btn-print-pdf');
        if (btnPrintPdf) {
          btnPrintPdf.onclick = () => {
            window.print();
          };
        }

        // Email Share
        const btnShareEmail = el.querySelector('#btn-share-email');
        if (btnShareEmail) {
          btnShareEmail.onclick = () => {
            const totals = computeTotals(currentInvoice);
            const opts = getInvoiceOptions(currentInvoice);
            const docName = opts.docType === 'quotation' ? 'Penawaran' : opts.docType === 'receipt' ? 'Kuitansi' : 'Invoice';
            const subject = encodeURIComponent(`${docName} ${currentInvoice.invoiceNumber} dari ${state.business.name}`);
            const body = encodeURIComponent(
              `Halo ${currentInvoice.client.name},\n\nBerikut kami lampirkan dokumen ${docName} ${currentInvoice.invoiceNumber}.\n` +
                `Total: ${formatMoney(totals.grandTotal, currentInvoice.currency)}\n` +
                `Jatuh Tempo: ${currentInvoice.dueDate}\n\n` +
                `Pembayaran dapat ditransfer ke ${state.business.bankName} - ${state.business.accountNumber} a/n ${state.business.accountHolder}.\n\n` +
                `Terima kasih!\n${state.business.name}`
            );
            window.open(`mailto:${currentInvoice.client.email || ''}?subject=${subject}&body=${body}`);
          };
        }
      }

      // ================= TAB HISTORY EVENTS =================
      if (currentTab === 'history') {
        const btnCreateNew = el.querySelector('#btn-create-new-from-hist');
        if (btnCreateNew) {
          btnCreateNew.onclick = () => {
            currentInvoice = createBlankInvoice();
            currentTab = 'create';
            renderApp();
          };
        }

        // Search history
        const histSearch = el.querySelector('#hist-search');
        if (histSearch) {
          histSearch.oninput = () => {
            const q = histSearch.value.trim().toLowerCase();
            const rows = el.querySelectorAll('#hist-table-body tr');
            rows.forEach((row) => {
              const text = row.textContent.toLowerCase();
              row.style.display = text.includes(q) ? '' : 'none';
            });
          };
        }

        // WhatsApp from history
        el.querySelectorAll('.btn-hist-wa').forEach((btn) => {
          btn.onclick = () => {
            const id = btn.dataset.id;
            const inv = state.invoices.find((x) => x.id === id);
            if (inv) sendWhatsAppInvoice(inv);
          };
        });

        // Status change
        el.querySelectorAll('.inv-status-select').forEach((sel) => {
          sel.onchange = () => {
            const id = sel.dataset.id;
            const inv = state.invoices.find((x) => x.id === id);
            if (inv) {
              inv.status = sel.value;
              syncInvoiceToBackend(inv);
            }
          };
        });

        // Edit invoice
        el.querySelectorAll('.btn-edit-inv').forEach((btn) => {
          btn.onclick = () => {
            const id = btn.dataset.id;
            const found = state.invoices.find((x) => x.id === id);
            if (found) {
              currentInvoice = JSON.parse(JSON.stringify(found));
              currentTab = 'create';
              renderApp();
            }
          };
        });

        // Print from history
        el.querySelectorAll('.btn-print-inv').forEach((btn) => {
          btn.onclick = () => {
            const id = btn.dataset.id;
            const found = state.invoices.find((x) => x.id === id);
            if (found) {
              currentInvoice = JSON.parse(JSON.stringify(found));
              currentTab = 'create';
              renderApp();
              setTimeout(() => window.print(), 300);
            }
          };
        });

        // Duplicate invoice
        el.querySelectorAll('.btn-dup-inv').forEach((btn) => {
          btn.onclick = () => {
            const id = btn.dataset.id;
            const found = state.invoices.find((x) => x.id === id);
            if (found) {
              currentInvoice = JSON.parse(JSON.stringify(found));
              currentInvoice.id = 'inv_' + Date.now();
              currentInvoice.dateIssued = new Date().toISOString().slice(0, 10);
              currentInvoice.invoiceNumber = generateInvoiceNumber(
                currentInvoice.dateIssued,
                state.invoices,
                selectedInvFormat,
                currentInvoice.docType || 'invoice'
              );
              currentInvoice.status = 'draft';
              currentTab = 'create';
              renderApp();
              showToast('Invoice diduplikat dengan nomor baru: ' + currentInvoice.invoiceNumber);
            }
          };
        });

        // Delete invoice
        el.querySelectorAll('.btn-del-inv').forEach((btn) => {
          btn.onclick = () => {
            deleteInvoice(btn.dataset.id);
          };
        });
      }

      // ================= TAB CLIENTS EVENTS =================
      if (currentTab === 'clients') {
        const btnAdd = el.querySelector('#btn-add-client-tab');
        if (btnAdd) {
          btnAdd.onclick = () => openClientModal();
        }

        el.querySelectorAll('.btn-use-client').forEach((btn) => {
          btn.onclick = () => {
            const found = state.clients.find((c) => c.id === btn.dataset.id);
            if (found) {
              currentInvoice = createBlankInvoice();
              currentInvoice.clientId = found.id;
              currentInvoice.client = { ...found };
              currentTab = 'create';
              renderApp();
            }
          };
        });

        el.querySelectorAll('.btn-edit-client').forEach((btn) => {
          btn.onclick = () => {
            const found = state.clients.find((c) => c.id === btn.dataset.id);
            if (found) openClientModal(found);
          };
        });

        el.querySelectorAll('.btn-del-client').forEach((btn) => {
          btn.onclick = () => {
            deleteClient(btn.dataset.id);
          };
        });
      }

      // ================= TAB BUSINESS PROFILE EVENTS =================
      if (currentTab === 'business') {
        // Upload default Logo Bisnis
        const bizBtnLogo = el.querySelector('#biz-btn-logo');
        const bizFileLogo = el.querySelector('#biz-file-logo');
        if (bizBtnLogo && bizFileLogo) {
          bizBtnLogo.onclick = () => bizFileLogo.click();
          bizFileLogo.onchange = async () => {
            if (bizFileLogo.files && bizFileLogo.files[0]) {
              try {
                const b64 = await compressImageFile(bizFileLogo.files[0], 400);
                state.business.logoImage = b64;
                currentInvoice.logoImage = b64;
                localStorage.setItem('flowly_invoices_local', JSON.stringify(state));
                renderApp();
                showToast('Logo bisnis default disimpan!');
              } catch (_) {}
            }
          };
        }
        const bizDelLogo = el.querySelector('#biz-del-logo');
        if (bizDelLogo) {
          bizDelLogo.onclick = () => {
            state.business.logoImage = '';
            currentInvoice.logoImage = '';
            localStorage.setItem('flowly_invoices_local', JSON.stringify(state));
            renderApp();
            showToast('Logo dihapus.');
          };
        }

        // Upload default QRIS
        const bizBtnQRIS = el.querySelector('#biz-btn-qris');
        const bizFileQRIS = el.querySelector('#biz-file-qris');
        if (bizBtnQRIS && bizFileQRIS) {
          bizBtnQRIS.onclick = () => bizFileQRIS.click();
          bizFileQRIS.onchange = async () => {
            if (bizFileQRIS.files && bizFileQRIS.files[0]) {
              try {
                state.business.qrisImage = await compressImageFile(bizFileQRIS.files[0], 400);
                renderApp();
                showToast('Default QRIS dimuat. Klik Simpan Pengaturan.');
              } catch (_) {}
            }
          };
        }
        const bizDelQRIS = el.querySelector('#biz-del-qris');
        if (bizDelQRIS) {
          bizDelQRIS.onclick = () => {
            state.business.qrisImage = '';
            renderApp();
          };
        }

        // Upload default TTD
        const bizBtnSig = el.querySelector('#biz-btn-sig');
        const bizFileSig = el.querySelector('#biz-file-sig');
        if (bizBtnSig && bizFileSig) {
          bizBtnSig.onclick = () => bizFileSig.click();
          bizFileSig.onchange = async () => {
            if (bizFileSig.files && bizFileSig.files[0]) {
              try {
                state.business.signatureImage = await compressImageFile(bizFileSig.files[0], 350);
                renderApp();
                showToast('Default TTD dimuat. Klik Simpan Pengaturan.');
              } catch (_) {}
            }
          };
        }
        const bizDelSig = el.querySelector('#biz-del-sig');
        if (bizDelSig) {
          bizDelSig.onclick = () => {
            state.business.signatureImage = '';
            renderApp();
          };
        }

        // Upload default Stempel
        const bizBtnStamp = el.querySelector('#biz-btn-stamp');
        const bizFileStamp = el.querySelector('#biz-file-stamp');
        if (bizBtnStamp && bizFileStamp) {
          bizBtnStamp.onclick = () => bizFileStamp.click();
          bizFileStamp.onchange = async () => {
            if (bizFileStamp.files && bizFileStamp.files[0]) {
              try {
                state.business.stampImage = await compressImageFile(bizFileStamp.files[0], 300);
                renderApp();
                showToast('Default Stempel dimuat. Klik Simpan Pengaturan.');
              } catch (_) {}
            }
          };
        }
        const bizDelStamp = el.querySelector('#biz-del-stamp');
        if (bizDelStamp) {
          bizDelStamp.onclick = () => {
            state.business.stampImage = '';
            renderApp();
          };
        }

        // Simpan Profil Bisnis
        const btnSaveBiz = el.querySelector('#btn-save-biz');
        if (btnSaveBiz) {
          btnSaveBiz.onclick = async () => {
            state.business = {
              ...state.business,
              logoImage: state.business.logoImage || '',
              name: el.querySelector('#biz-name').value.trim() || 'Flowly Tech',
              email: el.querySelector('#biz-email').value.trim(),
              phone: el.querySelector('#biz-phone').value.trim(),
              city: el.querySelector('#biz-city').value.trim() || 'Jakarta',
              address: el.querySelector('#biz-address').value.trim(),
              bankName: el.querySelector('#biz-bank').value.trim(),
              accountNumber: el.querySelector('#biz-acc-no').value.trim(),
              accountHolder: el.querySelector('#biz-acc-holder').value.trim(),
            };

            localStorage.setItem('flowly_invoices_local', JSON.stringify(state));

            try {
              await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_business', business: state.business }),
              });
            } catch (_) {}

            showToast('Profil bisnis tersimpan!');
            renderApp();
          };
        }
      }
    }

    // Update real-time Live Preview tanpa me-re-render seluruh form
    function updateLivePreview() {
      const paper = el.querySelector('#invoice-printable-paper');
      if (!paper) return;

      const totals = computeTotals(currentInvoice);
      const opts = getInvoiceOptions(currentInvoice);
      const i18n = I18N[opts.language] || I18N.id;

      // No invoice & Dates
      const numEl = paper.querySelector('.inv-paper-num');
      if (numEl) numEl.textContent = `${i18n.numLabel[opts.docType]}: ${currentInvoice.invoiceNumber}`;

      const dates = paper.querySelectorAll('.inv-date-val');
      if (dates[0]) dates[0].textContent = formatDateDisplay(currentInvoice.dateIssued, opts.language);
      if (dates[1]) dates[1].textContent = formatDateDisplay(currentInvoice.dueDate, opts.language);

      // Table items
      const tbody = paper.querySelector('.inv-paper-table tbody');
      if (tbody) {
        tbody.innerHTML = currentInvoice.items
          .map((item, idx) => {
            const totalItem = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
            return `
            <tr>
              <td class="t-center" style="color: #9ca3af; font-size: 0.8rem;">${idx + 1}</td>
              <td><strong>${escapeHtml(item.description || (opts.language === 'id' ? 'Layanan' : 'Service Item'))}</strong></td>
              <td class="t-center">${item.quantity}</td>
              <td class="t-right">${formatMoney(item.unitPrice, currentInvoice.currency)}</td>
              <td class="t-right"><strong>${formatMoney(totalItem, currentInvoice.currency)}</strong></td>
            </tr>
          `;
          })
          .join('');
      }

      // Summary
      const summary = paper.querySelector('.inv-paper-summary');
      if (summary) {
        summary.innerHTML = `
          <div class="inv-summary-table">
            <div class="inv-summary-row">
              <span>${i18n.subtotal}</span>
              <span>${formatMoney(totals.subtotal, currentInvoice.currency)}</span>
            </div>
            ${
              totals.taxRate > 0
                ? `
              <div class="inv-summary-row">
                <span>${i18n.tax} (${totals.taxRate}%)</span>
                <span>${formatMoney(totals.taxAmount, currentInvoice.currency)}</span>
              </div>
            `
                : ''
            }
            ${
              totals.discount > 0
                ? `
              <div class="inv-summary-row">
                <span>${i18n.discount}</span>
                <span>-${formatMoney(totals.discount, currentInvoice.currency)}</span>
              </div>
            `
                : ''
            }
            <div class="inv-summary-row is-total">
              <span>${i18n.grandTotal[opts.docType]}</span>
              <span>${formatMoney(totals.grandTotal, currentInvoice.currency)}</span>
            </div>
            ${
              opts.enableDP
                ? `
              <div class="inv-summary-row is-dp">
                <span>${i18n.dpLabel} (${opts.dpType === 'percent' ? opts.dpValue + '%' : (CURRENCIES[currentInvoice.currency] || CURRENCIES.MYR).symbol})</span>
                <span>${formatMoney(totals.dpAmount, currentInvoice.currency)}</span>
              </div>
              <div class="inv-summary-row is-balance">
                <span>${i18n.balanceDue}</span>
                <span>${formatMoney(totals.balanceDue, currentInvoice.currency)}</span>
              </div>
            `
                : ''
            }
          </div>
        `;
      }

      // Terbilang
      const terbilangEl = paper.querySelector('.inv-paper-terbilang');
      if (terbilangEl) {
        terbilangEl.innerHTML = `<strong>${i18n.terbilang}:</strong> # ${getAmountInWords(
          opts.enableDP ? totals.dpAmount || totals.grandTotal : totals.grandTotal,
          currentInvoice.currency,
          opts.language
        )} #`;
      }

      // Notes
      const notesEl = paper.querySelector('.inv-paper-notes');
      if (notesEl) {
        notesEl.innerHTML = `
          <div class="inv-paper-pay-container">
            <div class="inv-paper-pay-left">
              <div class="inv-paper-notes-title">${i18n.paymentNotes}:</div>
              <div>${escapeHtml(currentInvoice.notes || '').replace(/\n/g, '<br>')}</div>
              ${
                state.business.bankName
                  ? `
                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e5e7eb;">
                  <strong>${i18n.bankTransfer}:</strong> ${escapeHtml(state.business.bankName)} — A/N ${escapeHtml(
                      state.business.accountHolder
                    )} (${escapeHtml(state.business.accountNumber)})
                </div>
              `
                  : ''
              }
            </div>
            ${
              opts.enableQRIS && opts.qrisImage
                ? `
              <div class="inv-paper-qris-col">
                <img class="inv-paper-qris-img" src="${opts.qrisImage}" alt="QRIS">
                <span class="inv-paper-qris-label">${i18n.scanQRIS}</span>
              </div>
            `
                : ''
            }
          </div>
        `;
      }
    }

    // Inisialisasi awal
    loadAllData().then(() => {
      renderApp();
    });

    // Cleanup saat ganti tool
    return () => {
      closeClientModal();
      if (isSigPadOpen) {
        const container = document.getElementById('inv-sig-modal-container');
        if (container) container.remove();
      }
    };
  },
});
