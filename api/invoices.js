/**
 * Vercel Serverless Function: CRUD untuk Invoice & Klien.
 *
 * Mendukung 2 mode penyimpanan:
 * 1. Cloud (Vercel KV / Upstash Redis):
 *    - Otomatis aktif jika KV_REST_API_URL dan KV_REST_API_TOKEN (atau UPSTASH_*) terpasang di Vercel.
 * 2. File Lokal (Node.js Development):
 *    - Disimpan di `kantor/invoices-data.json` (folder `kantor/` sudah ada di .gitignore agar aman).
 *
 * Endpoint:
 *   GET    /api/invoices              → ambil daftar invoice, klien, dan info bisnis
 *   POST   /api/invoices              → simpan/perbarui invoice atau klien
 *   DELETE /api/invoices?id=...&type=invoice|client → hapus invoice atau klien
 */

const fs = require('fs');
const path = require('path');

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KV_KEY = 'kitforge_invoice_store_v1';

// Lokasi file lokal saat dev
const LOCAL_DIR = path.resolve(__dirname, '..', 'kantor');
const LOCAL_FILE = path.join(LOCAL_DIR, 'invoices-data.json');

const INITIAL_DATA = {
  invoices: [],
  clients: [
    {
      id: 'c1',
      name: 'Brightstone Industries',
      contactPerson: 'Jacob Paul',
      email: 'jacobpaul@brightstone.industries',
      phone: '+62 812-3456-7890',
      address: '45 Evergreen Lane, Suite 102, Brookfield, NY, 11234',
      createdAt: '2026-01-10',
    },
    {
      id: 'c2',
      name: 'Nuha Creative Studio',
      contactPerson: 'Farhan',
      email: 'farhan@nuhastudio.id',
      phone: '+62 878-9988-7766',
      address: 'Jl. Kemang Raya No. 42, Jakarta Selatan, 12730',
      createdAt: '2026-02-01',
    },
  ],
  business: {
    name: 'Mirza Hikmatyar',
    email: 'hi.mirzahikma@gmail.com',
    phone: '(+62) 858-7632-4554',
    address: 'Jakarta, Indonesia',
    bankName: 'BCA / Bank Mandiri',
    accountNumber: '123-456-7890',
    accountHolder: 'Mirza Hikmatyar',
  },
};

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(body));
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return {};
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

async function loadData() {
  // 1. Coba baca dari Vercel KV jika ada
  if (KV_URL && KV_TOKEN) {
    try {
      const res = await fetch(`${KV_URL}/get/${KV_KEY}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
      });
      if (res.ok) {
        const body = await res.json();
        if (body && body.result) {
          const parsed = typeof body.result === 'string' ? JSON.parse(body.result) : body.result;
          return { data: parsed, storage: 'vercel_kv' };
        }
      }
    } catch (err) {
      console.warn('Gagal membaca Vercel KV, fallback ke lokal:', err.message);
    }
  }

  // 2. Coba baca dari file lokal (development)
  try {
    if (fs.existsSync(LOCAL_FILE)) {
      const content = fs.readFileSync(LOCAL_FILE, 'utf-8');
      return { data: JSON.parse(content), storage: 'local_file' };
    }
  } catch (err) {
    console.warn('Gagal membaca file lokal:', err.message);
  }

  // 3. Kembalikan initial default data
  return { data: INITIAL_DATA, storage: 'in_memory' };
}

async function saveData(data) {
  let savedTo = [];

  // 1. Simpan ke Vercel KV jika tersedia
  if (KV_URL && KV_TOKEN) {
    try {
      const res = await fetch(`${KV_URL}/set/${KV_KEY}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(JSON.stringify(data)),
      });
      if (res.ok) savedTo.push('vercel_kv');
    } catch (err) {
      console.error('Error menyimpan ke Vercel KV:', err.message);
    }
  }

  // 2. Simpan ke file lokal (di folder kantor/)
  try {
    if (!fs.existsSync(LOCAL_DIR)) {
      fs.mkdirSync(LOCAL_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(data, null, 2), 'utf-8');
    savedTo.push('local_file');
  } catch (err) {
    // Pada Vercel runtime biasa, sistem file read-only kecuali /tmp
    console.warn('File lokal tidak dapat ditulis (wajar jika di Vercel serverless):', err.message);
  }

  return savedTo;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return send(res, 204, {});
  }

  // Mulai parsing body lebih awal agar stream Node.js tidak hilang saat ada async task
  const bodyPromise = req.method === 'POST' ? parseBody(req) : Promise.resolve({});

  const url = new URL(req.url, 'http://localhost');
  const { data, storage } = await loadData();

  // Pastikan struktur lengkap
  if (!Array.isArray(data.invoices)) data.invoices = [];
  if (!Array.isArray(data.clients)) data.clients = INITIAL_DATA.clients;
  if (!data.business) data.business = INITIAL_DATA.business;

  // ---------------- GET ----------------
  if (req.method === 'GET') {
    return send(res, 200, {
      ok: true,
      storage,
      invoices: data.invoices,
      clients: data.clients,
      business: data.business,
    });
  }

  // ---------------- POST ----------------
  if (req.method === 'POST') {
    const payload = await bodyPromise;
    const action = payload.action || 'save_invoice';

    if (action === 'save_invoice') {
      const invoice = payload.invoice;
      if (!invoice || !invoice.invoiceNumber) {
        return send(res, 400, { ok: false, error: 'Data invoice tidak lengkap (wajib ada invoiceNumber).' });
      }

      // Pastikan punya ID
      if (!invoice.id) {
        invoice.id = 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      }
      invoice.updatedAt = new Date().toISOString();

      // Cek apakah invoice sudah ada (update) atau baru (create)
      const existingIdx = data.invoices.findIndex((inv) => inv.id === invoice.id || inv.invoiceNumber === invoice.invoiceNumber);
      if (existingIdx >= 0) {
        data.invoices[existingIdx] = { ...data.invoices[existingIdx], ...invoice };
      } else {
        if (!invoice.createdAt) invoice.createdAt = new Date().toISOString();
        data.invoices.unshift(invoice); // taruh yang paling baru di awal
      }

      // Jika ada data klien baru yang ikut dikirim dan belum ada di list klien, simpan otomatis
      if (invoice.client && invoice.client.name) {
        const clientExists = data.clients.some(
          (c) => c.name.toLowerCase() === invoice.client.name.toLowerCase() || (c.email && c.email.toLowerCase() === invoice.client.email?.toLowerCase())
        );
        if (!clientExists) {
          data.clients.push({
            id: 'c_' + Date.now(),
            name: invoice.client.name,
            contactPerson: invoice.client.contactPerson || '',
            email: invoice.client.email || '',
            phone: invoice.client.phone || '',
            address: invoice.client.address || '',
            createdAt: new Date().toISOString().slice(0, 10),
          });
        }
      }

      const savedTo = await saveData(data);
      return send(res, 200, { ok: true, invoice, savedTo, storage });
    }

    if (action === 'save_client') {
      const client = payload.client;
      if (!client || !client.name) {
        return send(res, 400, { ok: false, error: 'Nama klien wajib diisi.' });
      }

      if (!client.id) {
        client.id = 'c_' + Date.now();
      }
      client.updatedAt = new Date().toISOString();

      const existingIdx = data.clients.findIndex((c) => c.id === client.id);
      if (existingIdx >= 0) {
        data.clients[existingIdx] = { ...data.clients[existingIdx], ...client };
      } else {
        if (!client.createdAt) client.createdAt = new Date().toISOString().slice(0, 10);
        data.clients.push(client);
      }

      const savedTo = await saveData(data);
      return send(res, 200, { ok: true, client, savedTo, storage });
    }

    if (action === 'save_business') {
      if (payload.business) {
        data.business = { ...data.business, ...payload.business };
        const savedTo = await saveData(data);
        return send(res, 200, { ok: true, business: data.business, savedTo, storage });
      }
    }

    return send(res, 400, { ok: false, error: 'Aksi tidak dikenal.' });
  }

  // ---------------- DELETE ----------------
  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    const type = url.searchParams.get('type') || 'invoice';

    if (!id) {
      return send(res, 400, { ok: false, error: 'Parameter id wajib disertakan.' });
    }

    if (type === 'client') {
      const beforeCount = data.clients.length;
      data.clients = data.clients.filter((c) => c.id !== id);
      if (data.clients.length === beforeCount) {
        return send(res, 404, { ok: false, error: 'Klien tidak ditemukan.' });
      }
    } else {
      const beforeCount = data.invoices.length;
      data.invoices = data.invoices.filter((inv) => inv.id !== id && inv.invoiceNumber !== id);
      if (data.invoices.length === beforeCount) {
        return send(res, 404, { ok: false, error: 'Invoice tidak ditemukan.' });
      }
    }

    const savedTo = await saveData(data);
    return send(res, 200, { ok: true, deletedId: id, type, savedTo, storage });
  }

  return send(res, 405, { ok: false, error: 'Method Not Allowed' });
};
