import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CloudRain,
  CloudSun,
  Leaf,
  Thermometer,
  Droplets,
  AlertTriangle,
  ShoppingCart,
  LineChart,
  Users,
  MapPin,
  RefreshCw,
  Settings as SettingsIcon,
  Phone,
  MessageCircle,
  ExternalLink,
  BookOpen,
} from "lucide-react";

/**
 * AgriHub Pro — Aplikasi Pertanian serba-ada untuk petani dan pelaku agribisnis
 * -------------------------------------------------------------
 * Fitur yang dibundel dalam 1 file React ini:
 * 1) Informasi Cuaca + Peringatan Hama (heuristik) — realtime (Open-Meteo)
 * 2) Panduan Budidaya — praktis untuk komoditas umum
 * 3) Harga Pasar — mode Live API (endpoint Anda) / Mock Data
 * 4) Koneksi Pembeli — form penawaran & daftar kebutuhan (localStorage / webhook)
 * 5) Pengaturan — koordinat, interval refresh, dan endpoint API
 *
 * Cara pakai cepat:
 * - Buat proyek Vite React atau Next.js (client component). Tempelkan file ini sebagai App utama.
 * - Pastikan Tailwind aktif. (Di Vite: postcss/tailwind config standar.)
 * - Jalankan `npm i framer-motion lucide-react`.
 * - (Opsional) Sediakan endpoint API Anda untuk harga pasar & webhook penawaran.
 * - Ganti default koordinat di Settings sesuai lokasi Anda. Klik "Simpan".
 * - Selesai. UI akan memuat cuaca realtime dan menilai risiko hama secara heuristik.
 *
 * Catatan penting:
 * - Prediksi hama di sini berbasis *heuristik sederhana* untuk edukasi awal (beta). Gunakan sebagai indikasi, bukan diagnosis final di lapangan.
 * - Harga pasar: bila Anda mengisi `MARKET_API_URL`, schema JSON yang diharapkan ada di bawah (lihat fungsi fetchMarketPrices).
 * - Koneksi pembeli: jika Anda mengisi `WEBHOOK_URL`, form akan `POST` JSON ke endpoint itu. Jika kosong, data disimpan di localStorage.
 */

// ====== Utilitas kecil
const fmt = new Intl.NumberFormat("id-ID");
const fmtDateTime = (d) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ====== Default Konfigurasi (bisa diubah dari menu Settings)
const DEFAULT_CONFIG = {
  latitude: -6.2, // Jakarta
  longitude: 106.816666,
  crop: "padi",
  refreshMinutes: 15, // interval auto-refresh (menit)
  MARKET_API_URL: "", // isi endpoint API Anda (opsional)
  MARKET_API_KEY: "", // kalau butuh auth
  WEBHOOK_URL: "", // endpoint untuk menerima penawaran (opsional)
};

// ====== Data Panduan Budidaya (ringkas, praktis)
const GUIDES = {
  padi: {
    name: "Padi (Oryza sativa)",
    stages: [
      {
        title: "Pra-Tanam",
        steps: [
          "Pilih varietas unggul sesuai agroklimat (Ciherang, Inpari, dsb).",
          "Benih sehat: rendam air garam 3–5% (benih mengapung dibuang), lalu peram 24–36 jam.",
          "Siapkan lahan: pengolahan tanah & pemupukan dasar (mis. 100–200 kg/ha Urea setara, sesuaikan rekomendasi setempat).",
        ],
      },
      {
        title: "Tanam",
        steps: [
          "Umur bibit 18–21 HSS (hari setelah semai). Jarak tanam 25×25 cm (SRI bisa lebih renggang).",
          "Atur tinggi air 2–3 cm awal tanam, naikkan bertahap.",
        ],
      },
      {
        title: "Pemeliharaan",
        steps: [
          "Pemupukan berimbang (N-P-K) sesuai uji tanah/kalibrasi setempat.",
          "Pengendalian gulma 2–3 MST (minggu setelah tanam).",
          "Pantau hama: wereng, penggerek batang; penyakit: blas, hawar daun bakteri.",
        ],
      },
      { title: "Panen", steps: ["Panen saat 90–95% gabah menguning."] },
    ],
  },
  jagung: {
    name: "Jagung (Zea mays)",
    stages: [
      {
        title: "Pra-Tanam",
        steps: [
          "Benih unggul hibrida/lokal adaptif.",
          "Olah tanah, buat bedengan bila perlu; pemupukan dasar berimbang.",
        ],
      },
      {
        title: "Tanam",
        steps: [
          "Jarak tanam umum 70×20 cm (1–2 biji/lubang).",
          "Pastikan kelembapan tanah cukup saat tanam.",
        ],
      },
      {
        title: "Pemeliharaan",
        steps: [
          "Penyiangan 2–3 MST.",
          "Pemupukan susulan saat fase vegetatif cepat.",
          "Pantau ulat grayak, busuk batang/akar.",
        ],
      },
      { title: "Panen", steps: ["Panen saat kelobot mengering dan biji keras."] },
    ],
  },
  cabai: {
    name: "Cabai (Capsicum spp.)",
    stages: [
      {
        title: "Pra-Tanam",
        steps: [
          "Semai benih 21–30 hari sebelum pindah tanam.",
          "Siapkan mulsa plastik bila tersedia, perbaiki drainase.",
        ],
      },
      {
        title: "Tanam",
        steps: [
          "Jarak 60×60 cm (varietas besar) atau 70×50 cm.",
          "Ajir/pasang penyangga untuk varietas tinggi.",
        ],
      },
      {
        title: "Pemeliharaan",
        steps: [
          "Pemupukan NPK bertahap; semprot K jika gejala kekurangan.",
          "Waspadai antraknosa, trips, kutu kebul; rotasi fungisida/insektisida sesuai anjuran setempat.",
        ],
      },
      {
        title: "Panen",
        steps: ["Panen bertahap saat matang fisiologis (merah) atau sesuai permintaan pasar."],
      },
    ],
  },
  tomat: {
    name: "Tomat (Solanum lycopersicum)",
    stages: [
      { title: "Pra-Tanam", steps: ["Persemaian 18–25 hari, bedengan gembur & steril."] },
      { title: "Tanam", steps: ["Jarak 60×50 cm, pasang ajir, penyiraman cukup."] },
      {
        title: "Pemeliharaan",
        steps: [
          "Pemupukan bertahap, pruning tunas air secukupnya.",
          "Pantau layu bakteri, busuk buah, lalat buah.",
        ],
      },
      { title: "Panen", steps: ["Panen saat warna 60–90% merah, sesuai jarak distribusi."] },
    ],
  },
};

// ====== Heuristik Risiko Hama/Penyakit (sederhana, edukatif)
// Input: suhu (°C), RH (%), curah hujan (mm/h)
function assessRisk(crop, tempC, rh, precipMm) {
  const risks = [];
  if (crop === "padi") {
    if (tempC >= 25 && tempC <= 30 && rh >= 70) {
      risks.push({ name: "Wereng Cokelat", level: 0.6, note: "Suhu & kelembapan mendukung populasi wereng." });
    }
    if (rh >= 85 && precipMm >= 1) {
      risks.push({ name: "Blas/Jamur Daun", level: 0.7, note: "Kelembapan tinggi + hujan → penyakit jamur meningkat." });
    }
    if (tempC >= 28 && precipMm >= 2) {
      risks.push({ name: "Hawar Daun Bakteri", level: 0.5, note: "Hujan disertai suhu hangat memicu hawar bakteri." });
    }
  }
  if (crop === "cabai" || crop === "tomat") {
    if (rh >= 80 && precipMm >= 1) {
      risks.push({ name: "Antraknosa/Busuk Buah", level: 0.65, note: "Buah sensitif saat lembap & basah sering." });
    }
    if (tempC >= 26 && rh >= 70) {
      risks.push({ name: "Trips/Kutu Kebul", level: 0.45, note: "Serangga vektor cenderung aktif di hangat-lembap." });
    }
  }
  if (crop === "jagung") {
    if (tempC >= 24 && tempC <= 30 && rh >= 70) {
      risks.push({ name: "Ulat Grayak", level: 0.55, note: "Hangat & lembap cocok untuk serangan daun muda." });
    }
    if (precipMm >= 2) {
      risks.push({ name: "Busuk Batang/Akar", level: 0.4, note: "Tanah terlalu basah → penyakit tular tanah meningkat." });
    }
  }

  // gabungkan & beri skor tertinggi sebagai headline
  const top = risks.sort((a, b) => b.level - a.level)[0];
  const composite = risks.reduce((acc, r) => acc + r.level, 0);
  const level = Math.min(1, Math.max(0, composite));
  return { level, risks, headline: top?.name || "Rendah", headlineNote: top?.note || "Kondisi relatif aman." };
}

// ====== Mock data harga pasar (fallback jika tanpa API)
const MOCK_MARKET = [
  { commodity: "Beras Medium", unit: "kg", market: "Jakarta", price: 13500, ts: Date.now() },
  { commodity: "Cabai Merah", unit: "kg", market: "Medan", price: 62000, ts: Date.now() },
  { commodity: "Bawang Merah", unit: "kg", market: "Surabaya", price: 38000, ts: Date.now() },
  { commodity: "Jagung Pipilan", unit: "kg", market: "Yogyakarta", price: 6500, ts: Date.now() },
  { commodity: "Kedelai", unit: "kg", market: "Bandung", price: 12800, ts: Date.now() },
  { commodity: "TBS Sawit", unit: "kg", market: "Batam", price: 2550, ts: Date.now() },
];

// Simpan/muat ke localStorage
const loadConfig = () => {
  try {
    const raw = localStorage.getItem("agrihub_config_v1");
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
};

const saveConfig = (cfg) => localStorage.setItem("agrihub_config_v1", JSON.stringify(cfg));

const loadPostings = () => {
  try {
    const raw = localStorage.getItem("agrihub_posts_v1");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const savePostings = (x) => localStorage.setItem("agrihub_posts_v1", JSON.stringify(x));

// ====== Komponen UI kecil
function Badge({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl shadow-sm border border-gray-200 bg-white ${className}`}>{children}</div>
  );
}

function CardHeader({ title, subtitle, icon }) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-3 border-b px-5 py-4">
      {Icon && <Icon className="w-5 h-5" />}
      <div>
        <div className="font-semibold">{title}</div>
        {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
      </div>
    </div>
  );
}

function CardBody({ children }) {
  return <div className="p-5">{children}</div>;
}

function Button({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 border bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-300 ${className}`}
      {...props}
    />
  );
}

function Select({ className = "", children, ...props }) {
  return (
    <select
      className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-300 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function SectionTitle({ icon: Icon, title, right }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5" />}
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div>{right}</div>
    </div>
  );
}

// ====== Fetch cuaca realtime dari Open-Meteo (tanpa API key)
async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,precipitation&current=temperature_2m,relative_humidity_2m,precipitation&timezone=auto&forecast_days=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Gagal memuat cuaca");
  return res.json();
}

// ====== Fetch harga pasar: skema JSON yang diharapkan
/**
 * Diharapkan API mengembalikan array objek:
 * [
 *   {
 *     commodity: "Cabai Merah", unit: "kg", market: "Pasar Kramat Jati",
 *     price: 62000, ts: 1710000000000
 *   }, ...
 * ]
 */
async function fetchMarketPrices(marketApiUrl, apiKey) {
  const res = await fetch(marketApiUrl, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!res.ok) throw new Error("Gagal memuat harga pasar");
  return res.json();
}

// ====== POST penawaran ke webhook (opsional)
async function postToWebhook(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Gagal mengirim data ke webhook");
  return res.json().catch(() => ({}));
}

// ====== Komponen Utama
export default function App() {
  const [tab, setTab] = useState("weather");
  const [config, setConfig] = useState(loadConfig());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 60);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-gray-800">
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/75 bg-white/90 border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Leaf className="w-6 h-6 text-emerald-600" />
            </motion.div>
            <div>
              <div className="font-bold tracking-tight">AgriHub Pro</div>
              <div className="text-xs text-gray-500">Ketahanan pangan dimulai dari data yang bisa dipakai ✨</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm">
            <Badge className="bg-emerald-100 text-emerald-800">{fmtDateTime(now)}</Badge>
            <Button onClick={() => setTab("settings")}> <SettingsIcon className="w-4 h-4"/> Pengaturan</Button>
          </div>
        </div>
        <nav className="mx-auto max-w-7xl px-4 pb-2 md:pb-3">
          <div className="grid grid-cols-2 md:flex md:items-center md:gap-2">
            <NavTab active={tab === "weather"} onClick={() => setTab("weather")} icon={CloudSun} label="Cuaca & Hama" />
            <NavTab active={tab === "guide"} onClick={() => setTab("guide")} icon={BookOpen} label="Panduan Budidaya" />
            <NavTab active={tab === "market"} onClick={() => setTab("market")} icon={LineChart} label="Harga Pasar" />
            <NavTab active={tab === "buyers"} onClick={() => setTab("buyers")} icon={Users} label="Koneksi Pembeli" />
            <NavTab className="md:hidden" active={tab === "settings"} onClick={() => setTab("settings")} icon={SettingsIcon} label="Pengaturan" />
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {tab === "weather" && <WeatherAndPest config={config} onChangeConfig={setConfig} />}
        {tab === "guide" && <Guides config={config} />}
        {tab === "market" && <Market config={config} />}
        {tab === "buyers" && <Buyers config={config} />}
        {tab === "settings" && <SettingsPanel config={config} onSave={(c) => { setConfig(c); saveConfig(c); }} />}
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-8 text-xs text-gray-500">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            © {new Date().getFullYear()} AgriHub Pro — dibuat dengan ❤. Gunakan data dengan bijak. Heuristik risiko hama bersifat indikatif.
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:underline">Privasi</a>
            <a href="#" className="hover:underline">Ketentuan</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavTab({ active, onClick, icon: Icon, label, className="" }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
        active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white hover:bg-gray-50 border-gray-200"
      } ${className}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}

// ===================== Cuaca & Hama =====================
function WeatherAndPest({ config, onChangeConfig }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  const refresh = async () => {
    try {
      setError("");
      setLoading(true);
      const json = await fetchWeather(config.latitude, config.longitude);
      setData(json);
      setLastFetch(new Date());
    } catch (e) {
      setError(e.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    if (config.refreshMinutes > 0) {
      const id = setInterval(refresh, config.refreshMinutes * 60 * 1000);
      return () => clearInterval(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.latitude, config.longitude, config.refreshMinutes]);

  const current = useMemo(() => {
    if (!data?.current) return null;
    const t = data.current.temperature_2m;
    const h = data.current.relative_humidity_2m;
    const p = data.current.precipitation ?? 0;
    const risk = assessRisk(config.crop, t, h, p);
    return { t, h, p, risk };
  }, [data, config.crop]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader title="Cuaca Saat Ini" subtitle={lastFetch ? `Terakhir diperbarui ${fmtDateTime(lastFetch)}` : "Realtime dari Open‑Meteo"} icon={CloudSun} />
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric icon={Thermometer} label="Suhu" value={current ? `${current.t.toFixed(1)} °C` : "-"} />
            <Metric icon={Droplets} label="Kelembapan" value={current ? `${current.h.toFixed(0)} %` : "-"} />
            <Metric icon={CloudRain} label="Hujan" value={current ? `${current.p.toFixed(2)} mm` : "-"} />
            <Metric icon={MapPin} label="Koordinat" value={`${config.latitude.toFixed(3)}, ${config.longitude.toFixed(3)}`} />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button onClick={refresh} className="bg-emerald-50 hover:bg-emerald-100"><RefreshCw className="w-4 h-4"/> Segarkan</Button>
            {loading && <span className="text-sm text-gray-500">Memuat…</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Indikasi Risiko Hama/Penyakit (Heuristik)" subtitle={`Komoditas: ${GUIDES[config.crop]?.name || config.crop}`} icon={AlertTriangle} />
        <CardBody>
          {current ? (
            <div>
              <RiskBar level={current.risk.level} />
              <div className="mt-2 text-sm text-gray-700">Tertinggi: <b>{current.risk.headline}</b> — {current.risk.headlineNote}</div>
              <ul className="mt-3 space-y-2 text-sm">
                {current.risk.risks.length === 0 && <li>Kondisi relatif aman. Tetap lakukan monitoring rutin.</li>}
                {current.risk.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500"/>
                    <div><b>{r.name}</b> — {r.note} (skor {Math.round(r.level*100)}/100)</div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-xs text-gray-500">Catatan: ini estimasi awal berbasis suhu, kelembapan, dan hujan. Konfirmasi lapangan & rekomendasi POPT setempat tetap utama.</div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Memuat data…</div>
          )}
        </CardBody>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader title="Ramalan Jam-Jaman (24 jam)" subtitle="Suhu, Kelembapan, Hujan" icon={LineChart} />
        <CardBody>
          <HourlyTable data={data} />
        </CardBody>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader title="Lokasi & Komoditas" subtitle="Ubah fokus analisis" icon={MapPin} />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-600">Latitude</label>
              <Input type="number" step="0.0001" value={config.latitude} onChange={(e) => onChangeConfig({ ...config, latitude: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">Longitude</label>
              <Input type="number" step="0.0001" value={config.longitude} onChange={(e) => onChangeConfig({ ...config, longitude: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">Komoditas</label>
              <Select value={config.crop} onChange={(e) => onChangeConfig({ ...config, crop: e.target.value })}>
                {Object.keys(GUIDES).map((k) => (
                  <option key={k} value={k}>{GUIDES[k].name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Auto-Refresh (menit)</label>
              <Input type="number" min={0} value={config.refreshMinutes} onChange={(e) => onChangeConfig({ ...config, refreshMinutes: parseInt(e.target.value || "0", 10) })} />
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border bg-white p-4 flex items-center gap-3">
      <div className="p-2 rounded-xl bg-emerald-50">
        <Icon className="w-5 h-5 text-emerald-700" />
      </div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
}

function RiskBar({ level }) {
  const pct = Math.round(level * 100);
  const color = level < 0.33 ? "bg-emerald-500" : level < 0.66 ? "bg-amber-500" : "bg-red-600";
  const label = level < 0.33 ? "Rendah" : level < 0.66 ? "Sedang" : "Tinggi";
  return (
    <div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-3 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs text-gray-600">Skor {pct}/100 — {label}</div>
    </div>
  );
}

function HourlyTable({ data }) {
  if (!data?.hourly) return <div className="text-sm text-gray-500">Belum ada data.</div>;
  const hours = data.hourly.time?.slice(0, 24) || [];
  const t = data.hourly.temperature_2m?.slice(0, 24) || [];
  const h = data.hourly.relative_humidity_2m?.slice(0, 24) || [];
  const p = data.hourly.precipitation?.slice(0, 24) || [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-gray-600">
          <tr>
            <th className="py-2 pr-4">Jam</th>
            <th className="py-2 pr-4">Suhu (°C)</th>
            <th className="py-2 pr-4">RH (%)</th>
            <th className="py-2 pr-4">Hujan (mm)</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((x, i) => (
            <tr key={x} className="border-t">
              <td className="py-2 pr-4">{new Date(x).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</td>
              <td className="py-2 pr-4">{t[i]?.toFixed?.(1)}</td>
              <td className="py-2 pr-4">{h[i]?.toFixed?.(0)}</td>
              <td className="py-2 pr-4">{p[i]?.toFixed?.(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===================== Panduan Budidaya =====================
function Guides({ config }) {
  const keys = Object.keys(GUIDES);
  const [active, setActive] = useState(config.crop || keys[0]);
  const g = GUIDES[active];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader title="Komoditas" subtitle="Pilih untuk melihat panduan" icon={BookOpen} />
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
            {keys.map((k) => (
              <button
                key={k}
                onClick={() => setActive(k)}
                className={`text-left rounded-xl border px-3 py-2 ${k === active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white hover:bg-gray-50"}`}
              >
                {GUIDES[k].name}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title={g.name} subtitle="Ringkasan langkah praktis" icon={Leaf} />
        <CardBody>
          <div className="space-y-5">
            {g.stages.map((s, i) => (
              <div key={i}>
                <SectionTitle title={s.title} />
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {s.steps.map((st, j) => (
                    <li key={j}>{st}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ===================== Harga Pasar =====================
function Market({ config }) {
  const [useLive, setUseLive] = useState(Boolean(config.MARKET_API_URL));
  const [rows, setRows] = useState(MOCK_MARKET);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [lastFetch, setLastFetch] = useState(null);

  const refresh = async () => {
    if (!useLive || !config.MARKET_API_URL) return;
    try {
      setLoading(true);
      setError("");
      const data = await fetchMarketPrices(config.MARKET_API_URL, config.MARKET_API_KEY);
      // Validasi ringan
      if (!Array.isArray(data)) throw new Error("Format tidak sesuai");
      const norm = data.map((d) => ({
        commodity: String(d.commodity || d.nama || "?"),
        unit: String(d.unit || d.satuan || "kg"),
        market: String(d.market || d.pasar || "-"),
        price: Number(d.price || d.harga || 0),
        ts: Number(d.ts || d.timestamp || Date.now()),
      }));
      setRows(norm);
      setLastFetch(new Date());
    } catch (e) {
      setError(e.message || "Gagal memuat");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (useLive && config.MARKET_API_URL) {
      refresh();
    } else {
      setRows(MOCK_MARKET);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useLive, config.MARKET_API_URL, config.MARKET_API_KEY]);

  const filtered = rows.filter((r) =>
    [r.commodity, r.market].join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Harga Pasar" subtitle={useLive ? (lastFetch ? `Live • diperbarui ${fmtDateTime(lastFetch)}` : "Live • menunggu data…") : "Mode Mock • isi endpoint untuk data live"} icon={LineChart} />
        <CardBody>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm">Mode:</label>
              <button onClick={() => setUseLive(false)} className={`px-3 py-1 rounded-full border ${!useLive ? "bg-emerald-600 text-white border-emerald-600" : "bg-white"}`}>Mock</button>
              <button onClick={() => setUseLive(true)} className={`px-3 py-1 rounded-full border ${useLive ? "bg-emerald-600 text-white border-emerald-600" : "bg-white"}`}>Live</button>
            </div>
            <div className="grow">
              <Input placeholder="Cari komoditas atau pasar…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Button onClick={refresh}><RefreshCw className="w-4 h-4"/> Segarkan</Button>
          </div>
          {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-600">
                <tr>
                  <th className="py-2 pr-4">Komoditas</th>
                  <th className="py-2 pr-4">Pasar</th>
                  <th className="py-2 pr-4">Harga</th>
                  <th className="py-2 pr-4">Satuan</th>
                  <th className="py-2 pr-4">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 pr-4">{r.commodity}</td>
                    <td className="py-2 pr-4">{r.market}</td>
                    <td className="py-2 pr-4 font-medium">Rp {fmt.format(r.price)}</td>
                    <td className="py-2 pr-4">{r.unit}</td>
                    <td className="py-2 pr-4">{fmtDateTime(new Date(r.ts))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Konfigurasi Endpoint (Opsional)" subtitle="Isi untuk mengaktifkan mode Live" icon={SettingsIcon} />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-600">MARKET_API_URL</label>
              <Input placeholder="https://api.example.com/market-prices" value={config.MARKET_API_URL} onChange={(e) => updateCfg(setRows, setError, config, { MARKET_API_URL: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">MARKET_API_KEY (jika perlu)</label>
              <Input placeholder="Bearer token…" value={config.MARKET_API_KEY} onChange={(e) => updateCfg(setRows, setError, config, { MARKET_API_KEY: e.target.value })} />
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function updateCfg(setRows, setError, cfg, patch) {
  const next = { ...cfg, ...patch };
  saveConfig(next);
  setError && setError("");
  setRows && setRows(MOCK_MARKET);
}

// ===================== Koneksi Pembeli =====================
function Buyers({ config }) {
  const [posts, setPosts] = useState(loadPostings());
  const [form, setForm] = useState({
    type: "Jual", // Jual/Beli
    commodity: "",
    qty: "",
    unit: "kg",
    location: "",
    price: "",
    contact: "",
    notes: "",
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const payload = { ...form, ts: Date.now(), id: crypto.randomUUID() };
    try {
      setSending(true);
      if (config.WEBHOOK_URL) {
        await postToWebhook(config.WEBHOOK_URL, payload);
      } else {
        const next = [payload, ...posts];
        setPosts(next);
        savePostings(next);
      }
      setForm({ ...form, commodity: "", qty: "", price: "", notes: "" });
    } catch (e) {
      setError(e.message || "Gagal mengirim");
    } finally {
      setSending(false);
    }
  };

  const del = (id) => {
    const next = posts.filter((p) => p.id !== id);
    setPosts(next);
    savePostings(next);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader title="Buat Penawaran / Permintaan" subtitle="Tembus langsung ke pembeli/penjual" icon={ShoppingCart} />
        <CardBody>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm({ ...form, type: "Jual" })} className={`rounded-xl border px-3 py-2 ${form.type === "Jual" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white"}`}>Jual</button>
              <button type="button" onClick={() => setForm({ ...form, type: "Beli" })} className={`rounded-xl border px-3 py-2 ${form.type === "Beli" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white"}`}>Beli</button>
            </div>
            <div>
              <label className="text-xs text-gray-600">Komoditas</label>
              <Input required value={form.commodity} onChange={(e) => setForm({ ...form, commodity: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-xs text-gray-600">Kuantitas</label>
                <Input required value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-600">Satuan</label>
                <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  <option>kg</option>
                  <option>ton</option>
                  <option>ikat</option>
                  <option>karung</option>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-600">Lokasi</label>
              <Input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-600">Harga (Rp/{form.unit})</label>
                <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-600">Kontak (WA/HP)</label>
                <Input required value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-600">Catatan</label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button type="submit" disabled={sending} className="bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700">
              {sending ? "Mengirim…" : "Kirim"}
            </Button>
            {error && <div className="text-sm text-red-600">{error}</div>}
            {!config.WEBHOOK_URL && (
              <div className="text-xs text-gray-500">Tip: isi <b>WEBHOOK_URL</b> di Pengaturan agar setiap postingan juga terkirim ke server/Google Sheet Anda.</div>
            )}
          </form>
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Listing Terbaru" subtitle="Tersimpan lokal (atau lewat webhook jika disetel)" icon={Users} />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.length === 0 && (
              <div className="text-sm text-gray-500">Belum ada postingan. Ayo mulai — pasar menunggu! 😉</div>
            )}
            {posts.map((p) => (
              <div key={p.id} className="rounded-2xl border p-4 bg-white">
                <div className="flex items-center justify-between">
                  <Badge className={p.type === "Jual" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>{p.type}</Badge>
                  <button onClick={() => del(p.id)} className="text-xs text-red-600 hover:underline">hapus</button>
                </div>
                <div className="mt-2 font-semibold">{p.commodity}</div>
                <div className="text-sm text-gray-600">{p.qty} {p.unit} • {p.location}</div>
                {p.price && <div className="mt-1 text-sm">Harga: <b>Rp {fmt.format(Number(p.price)||0)}/{p.unit}</b></div>}
                {p.notes && <div className="mt-1 text-sm">Catatan: {p.notes}</div>}
                <div className="mt-3 flex items-center gap-2 text-sm">
                  {p.contact && (
                    <a className="inline-flex items-center gap-1 text-emerald-700 hover:underline" href={`https://wa.me/${p.contact.replace(/[^0-9]/g,"")}?text=${encodeURIComponent("Halo, saya lihat listing Anda di AgriHub Pro")} `} target="_blank" rel="noreferrer">
                      <MessageCircle className="w-4 h-4"/> WhatsApp
                    </a>
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-500">{fmtDateTime(new Date(p.ts))}</div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ===================== Pengaturan =====================
function SettingsPanel({ config, onSave }) {
  const [local, setLocal] = useState(config);
  const save = () => onSave(local);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Pengaturan Umum" subtitle="Koordinat, komoditas, interval refresh" icon={SettingsIcon} />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-600">Latitude</label>
              <Input type="number" step="0.0001" value={local.latitude} onChange={(e) => setLocal({ ...local, latitude: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">Longitude</label>
              <Input type="number" step="0.0001" value={local.longitude} onChange={(e) => setLocal({ ...local, longitude: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">Komoditas</label>
              <Select value={local.crop} onChange={(e) => setLocal({ ...local, crop: e.target.value })}>
                {Object.keys(GUIDES).map((k) => (
                  <option key={k} value={k}>{GUIDES[k].name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Auto-Refresh (menit)</label>
              <Input type="number" min={0} value={local.refreshMinutes} onChange={(e) => setLocal({ ...local, refreshMinutes: parseInt(e.target.value || "0", 10) })} />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Integrasi Harga Pasar" subtitle="Aktifkan mode Live di menu Harga Pasar" icon={LineChart} />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-600">MARKET_API_URL</label>
              <Input placeholder="https://api.example.com/market-prices" value={local.MARKET_API_URL} onChange={(e) => setLocal({ ...local, MARKET_API_URL: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">MARKET_API_KEY</label>
              <Input placeholder="Bearer token… (opsional)" value={local.MARKET_API_KEY} onChange={(e) => setLocal({ ...local, MARKET_API_KEY: e.target.value })} />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Integrasi Webhook Listing" subtitle="Kirim setiap posting ke server/Google Sheet" icon={Users} />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600">WEBHOOK_URL</label>
              <Input placeholder="https://script.google.com/macros/s/.../exec" value={local.WEBHOOK_URL} onChange={(e) => setLocal({ ...local, WEBHOOK_URL: e.target.value })} />
            </div>
            <div className="text-xs text-gray-600">
              Format payload JSON:
              <pre className="mt-2 bg-gray-50 p-2 rounded-xl overflow-auto">{JSON.stringify({
                id: "uuid",
                type: "Jual/Beli",
                commodity: "Cabai Merah",
                qty: "500",
                unit: "kg",
                location: "Kabanjahe, Karo",
                price: "60000",
                contact: "6281234567890",
                notes: "Siap kirim Jabodetabek",
                ts: 1710000000000,
              }, null, 2)}</pre>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} className="bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700">Simpan</Button>
        <div className="text-sm text-gray-600">Perubahan akan tersimpan di perangkat ini (localStorage).</div>
      </div>
    </div>
  );
}
