/**
 * Flowly - Invoice Generator
 * Fitur:
 * - Nomor Invoice Otomatis berbasis Tahun, Bulan (Angka Romawi), dan Nomor Urut (contoh: INV/2026/XI/001)
 * - Pilihan kombinasi format penomoran (Romawi, garis miring, strip, format bulanan)
 * - Multi-currency: MYR (RM), IDR (Rp), USD ($), SGD (S$)
 * - Layout 2 kolom: Form input di kiri, sticky Live Preview di kanan (persis gambar referensi)
 * - Auto calculation: Subtotal, Tax %, Discount, Grand Total
 * - Menu/Tab Pelanggan (Customer Management) & Quick "+ Add New Client" modal
 * - Riwayat invoice lengkap (Draft, Pending, Paid, Cetak/PDF, Edit, Hapus)
 * - Sinkronisasi otomatis ke Vercel KV / lokal file (/api/invoices) + localStorage
 * - Cetak PDF A4 siap kirim via browser print engine
 */

HT.register('invoice-generator', {
  mount(el) {
    const { escapeHtml, icon } = HTUtil;

    // State aplikasi
    let currentTab = 'create'; // 'create' | 'history' | 'clients' | 'business'
    let storageStatus = 'local'; // 'vercel_kv' | 'local_file' | 'browser'
    let isSaving = false;

    // Format penomoran & angka Romawi
    const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    let selectedInvFormat = 'INV/YYYY/ROMAN/SEQ'; // format default

    function toRoman(monthIndex) {
      return ROMAN_MONTHS[monthIndex] || 'I';
    }

    function generateInvoiceNumber(dateStr = null, existingInvoices = [], formatPattern = selectedInvFormat) {
      const d = dateStr ? new Date(dateStr) : new Date();
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const monthRoman = toRoman(monthIdx);
      const monthNum = String(monthIdx + 1).padStart(2, '0');

      // Hitung nomor urut berikutnya dari database invoices
      // Cari nomor urut tertinggi untuk tahun tersebut
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
          return `INV/${monthRoman}/${year}/${nextSeq}`;
        case 'INV-YYYY-ROMAN-SEQ':
          return `INV-${year}-${monthRoman}-${nextSeq}`;
        case 'INV/YYYY/MM/SEQ':
          return `INV/${year}/${monthNum}/${nextSeq}`;
        case 'INV-YYYYMM-SEQ':
          return `INV-${year}${monthNum}-${nextSeq}`;
        case 'INV/YYYY/ROMAN/SEQ':
        default:
          return `INV/${year}/${monthRoman}/${nextSeq}`;
      }
    }

    // Database
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
        bankName: 'BCA',
        accountNumber: '0600684761',
        accountHolder: 'MIRZA HIKMATYAR',
      },
    };

    // Invoice yang sedang diedit
    let currentInvoice = createBlankInvoice();

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

    function formatDateDisplay(dateStr) {
      if (!dateStr) return '-';
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      } catch (_) {
        return dateStr;
      }
    }

    function createBlankInvoice(dateStr = null) {
      const today = dateStr ? new Date(dateStr) : new Date();
      const due = new Date(today);
      due.setDate(today.getDate() + 14);

      const dateIssued = today.toISOString().slice(0, 10);
      const dueDate = due.toISOString().slice(0, 10);
      const invoiceNumber = generateInvoiceNumber(dateIssued, state.invoices, selectedInvFormat);

      return {
        id: 'inv_' + Date.now(),
        invoiceNumber,
        dateIssued,
        dueDate,
        status: 'pending', // 'draft' | 'pending' | 'paid'
        currency: 'MYR',
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
        notes: 'Payment is due by the due date.\nInclude invoice number in the payment reference to ensure accurate processing.',
      };
    }

    // Hitung ringkasan angka
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

      return { subtotal, taxAmount, taxRate, discount, grandTotal };
    }

    // Muat data dari API / LocalStorage
    async function loadAllData() {
      // 1. Coba baca dari localStorage dulu
      try {
        const cached = localStorage.getItem('flowly_invoices_local');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.invoices) state.invoices = parsed.invoices;
          if (parsed.clients) state.clients = parsed.clients;
          if (parsed.business) state.business = parsed.business;
        }
      } catch (_) {}

      // 2. Fetch dari backend /api/invoices
      try {
        const res = await fetch('/api/invoices');
        if (res.ok) {
          const body = await res.json();
          if (body.ok) {
            state.invoices = body.invoices || [];
            state.clients = body.clients?.length ? body.clients : state.clients;
            state.business = body.business || state.business;
            storageStatus = body.storage || 'vercel_kv';

            // Simpan juga ke cache localStorage
            localStorage.setItem('flowly_invoices_local', JSON.stringify(state));
          }
        }
      } catch (err) {
        console.warn('API invoices tidak terjangkau, menggunakan mode browser offline:', err);
        storageStatus = 'browser';
      }

      // Perbarui nomor urut invoice draf saat ini agar sinkron dengan daftar invoice yang tersimpan
      if (currentInvoice && !currentInvoice.isManualEdited) {
        currentInvoice.invoiceNumber = generateInvoiceNumber(currentInvoice.dateIssued, state.invoices, selectedInvFormat);
      }
    }

    // Simpan ke API + localStorage
    async function syncInvoiceToBackend(inv) {
      isSaving = true;
      renderApp();

      // Update lokal state
      const idx = state.invoices.findIndex((x) => x.id === inv.id || x.invoiceNumber === inv.invoiceNumber);
      if (idx >= 0) {
        state.invoices[idx] = { ...inv };
      } else {
        state.invoices.unshift({ ...inv });
      }

      // Pastikan klien tersimpan
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

      // Backup ke browser localStorage
      localStorage.setItem('flowly_invoices_local', JSON.stringify(state));

      // Kirim ke API Vercel / serverless
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
      showToast('Invoice berhasil disimpan!');
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

        // Jika modal dibuka dari form invoice, langsung set client invoice saat ini
        if (currentTab === 'create') {
          currentInvoice.clientId = updated.id;
          currentInvoice.client = { ...updated };
        }

        closeClientModal();
        renderApp();
      };
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

      return `
        <div class="inv-workspace">
          <!-- KOLOM KIRI: FORM DETAIL INVOICE -->
          <div class="inv-card">
            <div class="inv-card-head">
              <h2 class="inv-card-title">${icon('fileText', 18)} Invoice Detail</h2>
              <div class="inv-pill-tabs">
                <button class="inv-pill-tab is-active">General</button>
                <button class="inv-pill-tab" id="quick-switch-history">Riwayat</button>
              </div>
            </div>

            <!-- Invoice Information -->
            <div class="inv-section">
              <h3 class="inv-section-title">Invoice Information</h3>
              <div class="inv-field">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                  <span class="inv-label">Invoice Number</span>
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
                    INV / Tahun / Romawi / Urut (Contoh: INV/2026/XI/001)
                  </option>
                  <option value="INV/ROMAN/YYYY/SEQ" ${selectedInvFormat === 'INV/ROMAN/YYYY/SEQ' ? 'selected' : ''}>
                    INV / Romawi / Tahun / Urut (Contoh: INV/XI/2026/001)
                  </option>
                  <option value="INV-YYYY-ROMAN-SEQ" ${selectedInvFormat === 'INV-YYYY-ROMAN-SEQ' ? 'selected' : ''}>
                    INV - Tahun - Romawi - Urut (Contoh: INV-2026-XI-001)
                  </option>
                  <option value="INV/YYYY/MM/SEQ" ${selectedInvFormat === 'INV/YYYY/MM/SEQ' ? 'selected' : ''}>
                    INV / Tahun / Bulan Angka / Urut (Contoh: INV/2026/11/001)
                  </option>
                  <option value="INV-YYYYMM-SEQ" ${selectedInvFormat === 'INV-YYYYMM-SEQ' ? 'selected' : ''}>
                    INV - YYYYMM - Urut (Contoh: INV-202611-001)
                  </option>
                </select>
              </div>

              <div class="inv-field-row" style="margin-top: 6px;">
                <label class="inv-field">
                  <span class="inv-label">Date Issued</span>
                  <input class="inv-input" type="date" id="inp-date-issued" value="${currentInvoice.dateIssued}">
                </label>
                <label class="inv-field">
                  <span class="inv-label">Due Date</span>
                  <input class="inv-input" type="date" id="inp-due-date" value="${currentInvoice.dueDate}">
                </label>
              </div>
            </div>

            <!-- Billed To (Client Selector) -->
            <div class="inv-section">
              <div class="inv-client-box-head">
                <h3 class="inv-section-title">Billed To</h3>
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
              <h3 class="inv-section-title">Invoice Items / Service</h3>

              <!-- Currency selector -->
              <label class="inv-field">
                <span class="inv-label">Currency (Mata Uang)</span>
                <select class="inv-select" id="sel-currency">
                  ${Object.keys(CURRENCIES)
                    .map((key) => `<option value="${key}" ${key === currentInvoice.currency ? 'selected' : ''}>${CURRENCIES[key].label}</option>`)
                    .join('')}
                </select>
              </label>

              <!-- Items Table -->
              <table class="inv-items-table">
                <thead>
                  <tr>
                    <th style="width: 45%;">Items / Service</th>
                    <th style="width: 18%;">Qty</th>
                    <th style="width: 27%;">Unit Price</th>
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
              </table>

              <button class="inv-add-item-btn" id="btn-add-item">
                ${icon('upload', 16)} <span>+ Add New Items</span>
              </button>

              <!-- Tax & Discount -->
              <div class="inv-field-row" style="margin-top: 10px;">
                <label class="inv-field">
                  <span class="inv-label">Tax Percentage (%)</span>
                  <input class="inv-input" type="number" min="0" max="100" step="0.5" id="inp-tax" value="${currentInvoice.taxPercentage}" placeholder="10">
                </label>
                <label class="inv-field">
                  <span class="inv-label">Discount (${curr.symbol})</span>
                  <input class="inv-input" type="number" min="0" step="any" id="inp-discount" value="${currentInvoice.discount}" placeholder="0">
                </label>
              </div>

              <!-- Notes & Payment Instruction -->
              <label class="inv-field" style="margin-top: 10px;">
                <span class="inv-label">Notes & Instruksi Pembayaran</span>
                <textarea class="inv-textarea" id="inp-notes" rows="3">${escapeHtml(currentInvoice.notes || '')}</textarea>
              </label>
            </div>
          </div>

          <!-- KOLOM KANAN: PREVIEW DOKUMEN INVOICE (STICKY) -->
          <div class="inv-preview-wrapper">
            <div class="inv-preview-bar">
              <div class="inv-preview-title">
                ${icon('eye', 18)} <span>Preview</span>
                <span class="inv-badge ${
                  currentInvoice.status === 'paid' ? 'inv-badge-paid' : currentInvoice.status === 'pending' ? 'inv-badge-pending' : 'inv-badge-draft'
                }">
                  ${currentInvoice.status}
                </span>
              </div>
              <div class="inv-preview-actions">
                <button class="inv-btn inv-btn-sm" id="btn-share-email" title="Kirim via Email">
                  <span>✉ Email</span>
                </button>
                <button class="inv-btn inv-btn-sm inv-btn-primary" id="btn-print-pdf" title="Cetak atau Simpan PDF">
                  ${icon('download', 14)} <span>PDF / Cetak</span>
                </button>
              </div>
            </div>

            <!-- LEMBAR INVOICE (KERTAS A4) -->
            <div class="inv-paper" id="invoice-printable-paper">
              <!-- Header Paper -->
              <div class="inv-paper-header">
                <div class="inv-paper-brand">
                  <h1 class="inv-paper-h1">Invoice</h1>
                  <span class="inv-paper-num">Invoice Number: ${escapeHtml(currentInvoice.invoiceNumber)}</span>
                </div>
                <div class="inv-paper-logo" title="${escapeHtml(state.business.name)}">
                  ${state.business.name.slice(0, 1) || 'K'}
                </div>
              </div>

              <!-- Parties: Billed By vs Billed To (Breakline Tiap Baris) -->
              <div class="inv-paper-parties">
                <div class="inv-party-col">
                  <span class="inv-party-label">Billed By:</span>
                  <span class="inv-party-name">${escapeHtml(state.business.name || '')}</span>
                  ${state.business.email ? `<span class="inv-party-text">${escapeHtml(state.business.email)}</span>` : ''}
                  ${state.business.phone ? `<span class="inv-party-text">${escapeHtml(state.business.phone)}</span>` : ''}
                  ${state.business.address ? `<span class="inv-party-text">${escapeHtml(state.business.address)}</span>` : ''}
                </div>
                <div class="inv-party-col">
                  <span class="inv-party-label">Billed To:</span>
                  <span class="inv-party-name">${escapeHtml(currentInvoice.client.name || 'Nama Klien')}</span>
                  ${currentInvoice.client.email ? `<span class="inv-party-text">${escapeHtml(currentInvoice.client.email)}</span>` : ''}
                  ${currentInvoice.client.phone ? `<span class="inv-party-text">${escapeHtml(currentInvoice.client.phone)}</span>` : ''}
                  ${currentInvoice.client.address ? `<span class="inv-party-text">${escapeHtml(currentInvoice.client.address)}</span>` : ''}
                </div>
              </div>

              <!-- Dates: Issued vs Due -->
              <div class="inv-paper-dates">
                <div class="inv-date-item">
                  <span class="inv-date-label">Date Issued:</span>
                  <span class="inv-date-val">${formatDateDisplay(currentInvoice.dateIssued)}</span>
                </div>
                <div class="inv-date-item">
                  <span class="inv-date-label">Due Date:</span>
                  <span class="inv-date-val">${formatDateDisplay(currentInvoice.dueDate)}</span>
                </div>
              </div>

              <!-- Items Table -->
              <table class="inv-paper-table">
                <thead>
                  <tr>
                    <th style="width: 50%;">Items / Service</th>
                    <th class="t-center" style="width: 12%;">Quantity</th>
                    <th class="t-right" style="width: 18%;">Unit Price</th>
                    <th class="t-right" style="width: 20%;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${currentInvoice.items
                    .map((item) => {
                      const totalItem = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                      return `
                      <tr>
                        <td><strong>${escapeHtml(item.description || 'Layanan')}</strong></td>
                        <td class="t-center">${item.quantity}</td>
                        <td class="t-right">${formatMoney(item.unitPrice, currentInvoice.currency)}</td>
                        <td class="t-right"><strong>${formatMoney(totalItem, currentInvoice.currency)}</strong></td>
                      </tr>
                    `;
                    })
                    .join('')}
                </tbody>
              </table>

              <!-- Totals Calculation -->
              <div class="inv-paper-summary">
                <div class="inv-summary-table">
                  <div class="inv-summary-row">
                    <span>Subtotal</span>
                    <span>${formatMoney(totals.subtotal, currentInvoice.currency)}</span>
                  </div>
                  ${
                    totals.taxRate > 0
                      ? `
                    <div class="inv-summary-row">
                      <span>Tax (${totals.taxRate}%)</span>
                      <span>${formatMoney(totals.taxAmount, currentInvoice.currency)}</span>
                    </div>
                  `
                      : ''
                  }
                  ${
                    totals.discount > 0
                      ? `
                    <div class="inv-summary-row">
                      <span>Discount</span>
                      <span>-${formatMoney(totals.discount, currentInvoice.currency)}</span>
                    </div>
                  `
                      : ''
                  }
                  <div class="inv-summary-row is-total">
                    <span>Grand Total</span>
                    <span>${formatMoney(totals.grandTotal, currentInvoice.currency)}</span>
                  </div>
                </div>
              </div>

              <!-- Notes & Bank Info -->
              <div class="inv-paper-notes">
                <div class="inv-paper-notes-title">Payment & Notes:</div>
                <div>${escapeHtml(currentInvoice.notes || '').replace(/\n/g, '<br>')}</div>
                ${
                  state.business.bankName
                    ? `
                  <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e5e7eb;">
                    <strong>Bank Transfer:</strong> ${escapeHtml(state.business.bankName)} — A/N ${escapeHtml(
                        state.business.accountHolder
                      )} (${escapeHtml(state.business.accountNumber)})
                  </div>
                `
                    : ''
                }
              </div>

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
                    <th>Invoice #</th>
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
                      return `
                      <tr>
                        <td><strong>${escapeHtml(inv.invoiceNumber)}</strong></td>
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
            <label class="inv-field">
              <span class="inv-label">Alamat Kantor / Bisnis</span>
              <textarea class="inv-textarea" id="biz-address" rows="2">${escapeHtml(b.address || '')}</textarea>
            </label>
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
        // Regenerate invoice number
        const regenBtn = el.querySelector('#btn-regen-number');
        if (regenBtn) {
          regenBtn.onclick = () => {
            currentInvoice.isManualEdited = false;
            currentInvoice.invoiceNumber = generateInvoiceNumber(currentInvoice.dateIssued, state.invoices, selectedInvFormat);
            showToast('Nomor invoice baru: ' + currentInvoice.invoiceNumber);
            renderApp();
          };
        }

        // Ganti format kombinasi penomoran
        const selFormat = el.querySelector('#sel-inv-format');
        if (selFormat) {
          selFormat.onchange = () => {
            selectedInvFormat = selFormat.value;
            currentInvoice.isManualEdited = false;
            currentInvoice.invoiceNumber = generateInvoiceNumber(currentInvoice.dateIssued, state.invoices, selectedInvFormat);
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
            // Jika belum diedit manual, sesuaikan nomor invoice dengan bulan/tahun yang baru dipilih
            if (!currentInvoice.isManualEdited) {
              currentInvoice.invoiceNumber = generateInvoiceNumber(currentInvoice.dateIssued, state.invoices, selectedInvFormat);
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
            const subject = encodeURIComponent(`Invoice ${currentInvoice.invoiceNumber} dari ${state.business.name}`);
            const body = encodeURIComponent(
              `Halo ${currentInvoice.client.name},\n\nBerikut kami lampirkan tagihan Invoice ${currentInvoice.invoiceNumber}.\n` +
                `Total Tagihan: ${formatMoney(totals.grandTotal, currentInvoice.currency)}\n` +
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
              currentInvoice.invoiceNumber = generateInvoiceNumber(currentInvoice.dateIssued, state.invoices, selectedInvFormat);
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
        const btnSaveBiz = el.querySelector('#btn-save-biz');
        if (btnSaveBiz) {
          btnSaveBiz.onclick = async () => {
            state.business = {
              name: el.querySelector('#biz-name').value.trim() || 'Flowly Tech',
              email: el.querySelector('#biz-email').value.trim(),
              phone: el.querySelector('#biz-phone').value.trim(),
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

      // No invoice & Dates
      const numEl = paper.querySelector('.inv-paper-num');
      if (numEl) numEl.textContent = `Invoice Number: ${currentInvoice.invoiceNumber}`;

      const dates = paper.querySelectorAll('.inv-date-val');
      if (dates[0]) dates[0].textContent = formatDateDisplay(currentInvoice.dateIssued);
      if (dates[1]) dates[1].textContent = formatDateDisplay(currentInvoice.dueDate);

      // Table items
      const tbody = paper.querySelector('.inv-paper-table tbody');
      if (tbody) {
        tbody.innerHTML = currentInvoice.items
          .map((item) => {
            const totalItem = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
            return `
            <tr>
              <td><strong>${escapeHtml(item.description || 'Layanan')}</strong></td>
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
              <span>Subtotal</span>
              <span>${formatMoney(totals.subtotal, currentInvoice.currency)}</span>
            </div>
            ${
              totals.taxRate > 0
                ? `
              <div class="inv-summary-row">
                <span>Tax (${totals.taxRate}%)</span>
                <span>${formatMoney(totals.taxAmount, currentInvoice.currency)}</span>
              </div>
            `
                : ''
            }
            ${
              totals.discount > 0
                ? `
              <div class="inv-summary-row">
                <span>Discount</span>
                <span>-${formatMoney(totals.discount, currentInvoice.currency)}</span>
              </div>
            `
                : ''
            }
            <div class="inv-summary-row is-total">
              <span>Grand Total</span>
              <span>${formatMoney(totals.grandTotal, currentInvoice.currency)}</span>
            </div>
          </div>
        `;
      }

      // Notes
      const notesEl = paper.querySelector('.inv-paper-notes');
      if (notesEl) {
        notesEl.innerHTML = `
          <div class="inv-paper-notes-title">Payment & Notes:</div>
          <div>${escapeHtml(currentInvoice.notes || '').replace(/\n/g, '<br>')}</div>
          ${
            state.business.bankName
              ? `
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e5e7eb;">
              <strong>Bank Transfer:</strong> ${escapeHtml(state.business.bankName)} — A/N ${escapeHtml(
                  state.business.accountHolder
                )} (${escapeHtml(state.business.accountNumber)})
            </div>
          `
              : ''
          }
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
    };
  },
});
