import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";

// ─── PALETTE ───────────────────────────────────────────────────────────────
const C = {
  bg: "#0A0A0F",
  surface: "#12121A",
  card: "#1A1A26",
  border: "#2A2A3A",
  gold: "#C9A84C",
  goldLight: "#E8C97A",
  goldDim: "#7A6230",
  text: "#F0EDE8",
  muted: "#7A7A9A",
  green: "#2ECC8A",
  red: "#E05555",
  blue: "#5B8DEF",
  orange: "#E8894A",
};

// ─── CARS ──────────────────────────────────────────────────────────────────
const CAR_BRANDS = {
  Lamborghini: { models: ["Urus", "STO", "Huracán"], color: "#B8952A" },
  Mercedes:    { models: ["Classe G", "GT 63", "GT 63 S"], color: "#7A9EBF" },
  Ferrari:     { models: ["F8", "F8 Tributo"], color: "#CC3333" },
  Porsche:     { models: ["911", "911 GTS", "GT3 RS"], color: "#2E7D52" },
  "Rolls-Royce": { models: ["Cullinan", "Phantom"], color: "#7B5EA7" },
  "Range Rover":  { models: ["SVR", "Vogue"], color: "#2E6B4F" },
  Autre:       { models: [], color: "#7A7A9A" },
};

const DURATIONS = [
  { label: "1 jour", days: 1 },
  { label: "2 jours", days: 2 },
  { label: "3 jours", days: 3 },
  { label: "1 semaine", days: 7 },
  { label: "Personnalisé", days: null },
];

const STATUS_COLORS = {
  active: C.green,
  ended: C.muted,
  upcoming: C.blue,
};

const STATUS_LABELS = {
  active: "En cours",
  ended: "Terminée",
  upcoming: "À venir",
};

// ─── UTILS ─────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtAED(n) {
  if (n == null || n === "") return "—";
  return Number(n).toLocaleString("fr-FR") + " AED";
}

function getRentalStatus(rental) {
  const now = new Date();
  const start = new Date(rental.startDate);
  const end = new Date(rental.endDate);
  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "active";
}

function calcProfit(rental) {
  if (!rental.pricePerDay || !rental.startDate || !rental.endDate) return null;
  const hours = (new Date(rental.endDate) - new Date(rental.startDate)) / 36e5;
  const days = hours / 24;
  const revenue = parseFloat(rental.pricePerDay) * days;
  const cost = parseFloat(rental.costBroker) || 0;
  return { revenue, cost, profit: revenue - cost, days };
}

// ─── SUPABASE SYNC ─────────────────────────────────────────────────────────
const DB_KEY = "nld_main";
const LS_KEY = "nld_data_v1";

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveLocal(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

// ─── TOP LEVEL DATA ─────────────────────────────────────────────────────────
const DEFAULT_DATA = { rentals: [], clients: [], expenses: [] };

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── CAR SELECTOR ──────────────────────────────────────────────────────────
function CarSelector({ value, onChange }) {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [custom, setCustom] = useState("");

  useEffect(() => {
    if (value && !brand) {
      for (const [b, { models }] of Object.entries(CAR_BRANDS)) {
        if (b === "Autre") continue;
        for (const m of models) {
          if (value === `${b} ${m}`) { setBrand(b); setModel(m); return; }
        }
      }
      setBrand("Autre"); setCustom(value);
    }
  }, []);

  function update(b, m, c) {
    if (b === "Autre") onChange(c);
    else if (b && m) onChange(`${b} ${m}`);
    else onChange("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Brand picker — colored pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Object.entries(CAR_BRANDS).map(([b, { color }]) => {
          const active = brand === b;
          return (
            <button key={b} onClick={() => {
              setBrand(b); setModel(""); setCustom("");
              update(b, "", "");
            }} style={{
              padding: "6px 14px", borderRadius: 20, border: `2px solid ${active ? color : "transparent"}`,
              cursor: "pointer", fontWeight: 700, fontSize: 13,
              background: active ? color + "33" : C.border,
              color: active ? color : C.muted,
              transition: "all 0.15s",
            }}>{b}</button>
          );
        })}
      </div>

      {/* Model picker */}
      {brand && brand !== "Autre" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CAR_BRANDS[brand].models.map(m => {
            const active = model === m;
            const col = CAR_BRANDS[brand].color;
            return (
              <button key={m} onClick={() => { setModel(m); update(brand, m, ""); }} style={{
                padding: "6px 14px", borderRadius: 20, border: `2px solid ${active ? col : C.border}`,
                cursor: "pointer", fontWeight: 600, fontSize: 13,
                background: active ? col + "22" : C.surface,
                color: active ? col : C.text,
              }}>{m}</button>
            );
          })}
        </div>
      )}

      {brand === "Autre" && (
        <input
          style={inputStyle}
          placeholder="Modèle (ex: McLaren 720S)"
          value={custom}
          onChange={e => { setCustom(e.target.value); update("Autre", "", e.target.value); }}
        />
      )}

      {/* Preview */}
      {value && (
        <div style={{
          padding: "8px 12px", borderRadius: 10,
          background: (CAR_BRANDS[brand]?.color || C.muted) + "22",
          borderLeft: `3px solid ${CAR_BRANDS[brand]?.color || C.muted}`,
          color: CAR_BRANDS[brand]?.color || C.muted,
          fontSize: 14, fontWeight: 700,
        }}>🚗 {value}</div>
      )}
    </div>
  );
}

// ─── MODAL ─────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 1000, backdropFilter: "blur(4px)",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 540,
        maxHeight: "90vh", overflow: "auto", padding: "24px 20px 40px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ color: C.gold, fontWeight: 700, fontSize: 18 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── RENTAL FORM ───────────────────────────────────────────────────────────
function RentalForm({ initial, onSave, onDelete, clients }) {
  const [form, setForm] = useState(initial || {
    car: "", clientName: "", clientId: "",
    startDate: "", endDate: "",
    durationPreset: "24h",
    customDays: "",
    pricePerDay: "", costBroker: "",
    deposit: false, depositAmount: "",
    notes: "",
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function applyDuration(preset, start) {
    const s = start || form.startDate;
    if (!s) return;
    const dur = DURATIONS.find(d => d.label === preset);
    if (!dur || !dur.days) return;
    const startDate = new Date(s);
    const end = new Date(startDate);
    end.setDate(end.getDate() + dur.days);
    set("endDate", end.toISOString().slice(0, 10));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={labelStyle}>Véhicule</label>
      <CarSelector value={form.car} onChange={v => set("car", v)} />

      <label style={labelStyle}>Client</label>
      <input style={inputStyle} placeholder="Nom du client"
        value={form.clientName} onChange={e => set("clientName", e.target.value)} />

      <label style={labelStyle}>Début de location</label>
      <input type="date" style={inputStyle}
        value={form.startDate}
        onChange={e => { set("startDate", e.target.value); applyDuration(form.durationPreset, e.target.value); }} />

      <label style={labelStyle}>Durée</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {DURATIONS.map(d => (
          <button key={d.label}
            onClick={() => { set("durationPreset", d.label); applyDuration(d.label, null); }}
            style={{
              padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
              background: form.durationPreset === d.label ? C.gold : C.border,
              color: form.durationPreset === d.label ? C.bg : C.text,
              fontWeight: 600, fontSize: 13,
            }}>{d.label}</button>
        ))}
      </div>
      {form.durationPreset === "Personnalisé" && (
        <input type="number" style={inputStyle} placeholder="Nombre de jours"
          value={form.customDays}
          onChange={e => {
            set("customDays", e.target.value);
            if (form.startDate && e.target.value) {
              const end = new Date(form.startDate);
              end.setDate(end.getDate() + parseInt(e.target.value));
              set("endDate", end.toISOString().slice(0, 10));
            }
          }} />
      )}

      <label style={labelStyle}>Fin de location</label>
      <input type="date" style={inputStyle}
        value={form.endDate} onChange={e => set("endDate", e.target.value)} />

      <label style={labelStyle}>Prix de vente / jour (AED)</label>
      <input type="number" style={inputStyle} placeholder="ex: 2500"
        value={form.pricePerDay} onChange={e => set("pricePerDay", e.target.value)} />

      <label style={labelStyle}>Prix d'achat broker (AED)</label>
      <input type="number" style={inputStyle} placeholder="ex: 1800"
        value={form.costBroker} onChange={e => set("costBroker", e.target.value)} />

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input type="checkbox" checked={form.deposit} onChange={e => set("deposit", e.target.checked)}
          style={{ width: 18, height: 18, accentColor: C.gold }} />
        <span style={{ color: C.text }}>Caution encaissée</span>
      </div>
      {form.deposit && (
        <input type="number" style={inputStyle} placeholder="Montant caution (AED)"
          value={form.depositAmount} onChange={e => set("depositAmount", e.target.value)} />
      )}

      <label style={labelStyle}>Statut paiement</label>
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { k: "pending", l: "En attente", c: C.orange },
          { k: "partial", l: "Acompte", c: C.blue },
          { k: "paid", l: "Payé", c: C.green },
        ].map(s => (
          <button key={s.k} onClick={() => set("paymentStatus", s.k)} style={{
            flex: 1, padding: "8px 4px", borderRadius: 10, border: `2px solid ${form.paymentStatus === s.k ? s.c : C.border}`,
            cursor: "pointer", fontWeight: 600, fontSize: 12,
            background: form.paymentStatus === s.k ? s.c + "22" : C.surface,
            color: form.paymentStatus === s.k ? s.c : C.muted,
          }}>{s.l}</button>
        ))}
      </div>

      <label style={labelStyle}>Notes</label>
      <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
        placeholder="Infos complémentaires..."
        value={form.notes} onChange={e => set("notes", e.target.value)} />

      {/* Live price recap */}
      {form.startDate && form.endDate && form.pricePerDay && (() => {
        const hours = (new Date(form.endDate) - new Date(form.startDate)) / 36e5;
        const days = hours / 24;
        const revenue = parseFloat(form.pricePerDay) * days;
        const cost = parseFloat(form.costBroker) || 0;
        const profit = revenue - cost;
        return (
          <div style={{
            background: C.surface, border: `1px solid ${C.gold}44`,
            borderRadius: 12, padding: "14px 16px",
            borderLeft: `3px solid ${C.gold}`,
          }}>
            <div style={{ color: C.gold, fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: 1 }}>
              RÉCAP AUTOMATIQUE
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ color: C.muted, fontSize: 11 }}>Durée</div>
                <div style={{ color: C.text, fontWeight: 600 }}>{days.toFixed(1)} jour{days > 1 ? "s" : ""}</div>
              </div>
              <div>
                <div style={{ color: C.muted, fontSize: 11 }}>Prix/jour</div>
                <div style={{ color: C.text, fontWeight: 600 }}>{fmtAED(form.pricePerDay)}</div>
              </div>
              <div>
                <div style={{ color: C.muted, fontSize: 11 }}>Revenu total</div>
                <div style={{ color: C.gold, fontWeight: 700 }}>{fmtAED(revenue)}</div>
              </div>
              <div>
                <div style={{ color: C.muted, fontSize: 11 }}>Coût broker</div>
                <div style={{ color: C.orange, fontWeight: 600 }}>{cost ? fmtAED(cost) : "—"}</div>
              </div>
            </div>
            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ color: C.muted, fontSize: 12 }}>Bénéfice net</span>
              <span style={{
                color: profit >= 0 ? C.green : C.red,
                fontWeight: 800, fontSize: 18,
              }}>{fmtAED(profit)}</span>
            </div>
          </div>
        );
      })()}

      <button onClick={() => onSave(form)} style={btnPrimary}>
        {initial ? "Mettre à jour la location" : "Créer la location"}
      </button>
      {initial && (
        <button onClick={() => onDelete(initial.id)} style={btnDanger}>Supprimer la location</button>
      )}
    </div>
  );
}

// ─── EXPENSE FORM ──────────────────────────────────────────────────────────
function ExpenseForm({ initial, onSave, onDelete }) {
  const [form, setForm] = useState(initial || {
    label: "", amount: "", date: new Date().toISOString().slice(0, 10), category: "Entretien",
  });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  const cats = ["Entretien", "Broker", "Carburant", "Assurance", "Autre"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={labelStyle}>Libellé</label>
      <input style={inputStyle} placeholder="ex: Vidange Urus" value={form.label} onChange={e => set("label", e.target.value)} />
      <label style={labelStyle}>Montant (AED)</label>
      <input type="number" style={inputStyle} value={form.amount} onChange={e => set("amount", e.target.value)} />
      <label style={labelStyle}>Date</label>
      <input type="date" style={inputStyle} value={form.date} onChange={e => set("date", e.target.value)} />
      <label style={labelStyle}>Catégorie</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {cats.map(c => (
          <button key={c} onClick={() => set("category", c)} style={{
            padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
            background: form.category === c ? C.gold : C.border,
            color: form.category === c ? C.bg : C.text, fontWeight: 600, fontSize: 13,
          }}>{c}</button>
        ))}
      </div>
      <button onClick={() => onSave(form)} style={btnPrimary}>{initial ? "Mettre à jour" : "Ajouter"}</button>
      {initial && <button onClick={() => onDelete(initial.id)} style={btnDanger}>Supprimer</button>}
    </div>
  );
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────
function Dashboard({ data }) {
  const now = new Date();
  const active = data.rentals.filter(r => getRentalStatus(r) === "active");
  const upcoming = data.rentals.filter(r => getRentalStatus(r) === "upcoming");

  // Monthly stats
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRentals = data.rentals.filter(r => new Date(r.startDate) >= monthStart);
  const monthRevenue = monthRentals.reduce((s, r) => {
    const p = calcProfit(r); return s + (p ? p.revenue : 0);
  }, 0);
  const monthCost = monthRentals.reduce((s, r) => {
    const p = calcProfit(r); return s + (p ? p.cost : 0);
  }, 0);
  const monthExpenses = data.expenses
    .filter(e => new Date(e.date) >= monthStart)
    .reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const monthProfit = monthRevenue - monthCost - monthExpenses;

  const stats = [
    { label: "Locations actives", value: active.length, color: C.green, icon: "🚗" },
    { label: "À venir", value: upcoming.length, color: C.blue, icon: "📅" },
    { label: "Revenus du mois", value: fmtAED(monthRevenue), color: C.gold, icon: "💰" },
    { label: "Bénéfice net", value: fmtAED(monthProfit), color: monthProfit >= 0 ? C.green : C.red, icon: "📊" },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 16, padding: "16px 14px",
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ color: s.color, fontSize: 20, fontWeight: 700 }}>{s.value}</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {active.length > 0 && (
        <>
          <div style={{ color: C.gold, fontWeight: 700, marginBottom: 10, fontSize: 14, letterSpacing: 1 }}>
            EN COURS
          </div>
          {active.map(r => <RentalCard key={r.id} rental={r} compact />)}
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <div style={{ color: C.blue, fontWeight: 700, margin: "16px 0 10px", fontSize: 14, letterSpacing: 1 }}>
            À VENIR
          </div>
          {upcoming.map(r => <RentalCard key={r.id} rental={r} compact />)}
        </>
      )}

      {active.length === 0 && upcoming.length === 0 && (
        <div style={{ textAlign: "center", color: C.muted, padding: "40px 0", fontSize: 15 }}>
          Aucune location active.<br />Appuie sur + pour en créer une.
        </div>
      )}
    </div>
  );
}

// ─── RENTAL CARD ───────────────────────────────────────────────────────────
function getBrandColor(car) {
  if (!car) return C.muted;
  for (const [b, { color }] of Object.entries(CAR_BRANDS)) {
    if (car.startsWith(b)) return color;
  }
  return C.muted;
}

function RentalCard({ rental, compact, onClick }) {
  const status = getRentalStatus(rental);
  const profit = calcProfit(rental);
  const color = getBrandColor(rental.car);

  return (
    <div onClick={onClick} style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: "14px 16px", marginBottom: 10,
      cursor: onClick ? "pointer" : "default",
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>{rental.car || "—"}</div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{rental.clientName || "—"}</div>
        </div>
        <div style={{
          background: color + "22", color, borderRadius: 20,
          padding: "3px 10px", fontSize: 12, fontWeight: 600,
        }}>{STATUS_LABELS[status]}</div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: C.muted, fontSize: 11 }}>Départ</div>
          <div style={{ color: C.text, fontSize: 13 }}>{fmtDate(rental.startDate)}</div>
        </div>
        <div>
          <div style={{ color: C.muted, fontSize: 11 }}>Retour</div>
          <div style={{ color: C.text, fontSize: 13 }}>{fmtDate(rental.endDate)}</div>
        </div>
        {!compact && profit && (
          <>
            <div>
              <div style={{ color: C.muted, fontSize: 11 }}>Revenu</div>
              <div style={{ color: C.gold, fontSize: 13 }}>{fmtAED(profit.revenue)}</div>
            </div>
            <div>
              <div style={{ color: C.muted, fontSize: 11 }}>Bénéfice</div>
              <div style={{ color: profit.profit >= 0 ? C.green : C.red, fontSize: 13, fontWeight: 700 }}>
                {fmtAED(profit.profit)}
              </div>
            </div>
          </>
        )}
        {rental.deposit && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, color: C.green }}>✓ Caution</span>
            {rental.depositAmount && <span style={{ color: C.green, fontSize: 11 }}>{fmtAED(rental.depositAmount)}</span>}
          </div>
        )}
        {rental.paymentStatus && (() => {
          const map = { pending: [C.orange, "En attente"], partial: [C.blue, "Acompte"], paid: [C.green, "Payé"] };
          const [col, lbl] = map[rental.paymentStatus] || [C.muted, "—"];
          return (
            <div style={{ background: col + "22", color: col, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
              {lbl}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── RENTALS VIEW ──────────────────────────────────────────────────────────
function RentalsView({ data, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("all");

  const filtered = data.rentals.filter(r => {
    if (filter === "all") return true;
    return getRentalStatus(r) === filter;
  });

  function saveRental(form) {
    const rentals = editing
      ? data.rentals.map(r => r.id === editing.id ? { ...form, id: r.id } : r)
      : [...data.rentals, { ...form, id: uid() }];
    onUpdate({ ...data, rentals });
    setShowForm(false); setEditing(null);
  }

  function deleteRental(id) {
    onUpdate({ ...data, rentals: data.rentals.filter(r => r.id !== id) });
    setShowForm(false); setEditing(null);
  }

  const tabs = [
    { k: "all", l: "Toutes" },
    { k: "active", l: "En cours" },
    { k: "upcoming", l: "À venir" },
    { k: "ended", l: "Terminées" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {tabs.map(t => (
          <button key={t.k} onClick={() => setFilter(t.k)} style={{
            padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
            background: filter === t.k ? C.gold : C.border,
            color: filter === t.k ? C.bg : C.text,
            fontWeight: 600, fontSize: 13, whiteSpace: "nowrap",
          }}>{t.l}</button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", color: C.muted, padding: "40px 0" }}>Aucune location</div>
      )}
      {filtered.map(r => (
        <RentalCard key={r.id} rental={r} onClick={() => { setEditing(r); setShowForm(true); }} />
      ))}

      <button onClick={() => { setEditing(null); setShowForm(true); }} style={{
        ...btnPrimary, position: "fixed", bottom: 90, right: 20,
        width: 56, height: 56, borderRadius: "50%", fontSize: 28,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0, boxShadow: `0 4px 20px ${C.gold}55`,
      }}>+</button>

      {showForm && (
        <Modal title={editing ? "Modifier la location" : "Nouvelle location"} onClose={() => { setShowForm(false); setEditing(null); }}>
          <RentalForm initial={editing} onSave={saveRental} onDelete={deleteRental} clients={data.clients} />
        </Modal>
      )}
    </div>
  );
}

// ─── ACCOUNTING VIEW ───────────────────────────────────────────────────────
function AccountingView({ data, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const [y, m] = month.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 1);

  const monthRentals = data.rentals.filter(r => {
    const s = new Date(r.startDate);
    return s >= monthStart && s < monthEnd;
  });

  const revenue = monthRentals.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.revenue : 0); }, 0);
  const brokerCost = monthRentals.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.cost : 0); }, 0);
  const expenses = data.expenses.filter(e => e.date && e.date.startsWith(month));
  const expenseTotal = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const profit = revenue - brokerCost - expenseTotal;

  function saveExpense(form) {
    const list = editing
      ? data.expenses.map(e => e.id === editing.id ? { ...form, id: e.id } : e)
      : [...data.expenses, { ...form, id: uid() }];
    onUpdate({ ...data, expenses: list });
    setShowForm(false); setEditing(null);
  }

  function deleteExpense(id) {
    onUpdate({ ...data, expenses: data.expenses.filter(e => e.id !== id) });
    setShowForm(false); setEditing(null);
  }

  return (
    <div>
      <input type="month" value={month} onChange={e => setMonth(e.target.value)}
        style={{ ...inputStyle, marginBottom: 16 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Revenus locations", v: revenue, c: C.gold },
          { l: "Coût brokers", v: brokerCost, c: C.orange },
          { l: "Autres dépenses", v: expenseTotal, c: C.red },
          { l: "Bénéfice net", v: profit, c: profit >= 0 ? C.green : C.red },
        ].map(s => (
          <div key={s.l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 12px" }}>
            <div style={{ color: s.c, fontWeight: 700, fontSize: 18 }}>{fmtAED(s.v)}</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ color: C.gold, fontWeight: 700, marginBottom: 10, fontSize: 13, letterSpacing: 1 }}>
        LOCATIONS DU MOIS ({monthRentals.length})
      </div>
      {monthRentals.map(r => {
        const p = calcProfit(r);
        return (
          <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: C.text, fontWeight: 600 }}>{r.car}</div>
              <div style={{ color: C.muted, fontSize: 12 }}>{r.clientName} · {p ? p.days.toFixed(1) + "j" : "—"}</div>
            </div>
            {p && (
              <div style={{ textAlign: "right" }}>
                <div style={{ color: C.gold, fontSize: 14 }}>{fmtAED(p.revenue)}</div>
                <div style={{ color: p.profit >= 0 ? C.green : C.red, fontSize: 12 }}>{fmtAED(p.profit)}</div>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ color: C.muted, fontWeight: 700, margin: "16px 0 10px", fontSize: 13, letterSpacing: 1 }}>
        DÉPENSES DU MOIS
      </div>
      {expenses.map(e => (
        <div key={e.id} onClick={() => { setEditing(e); setShowForm(true); }}
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
          <div>
            <div style={{ color: C.text }}>{e.label}</div>
            <div style={{ color: C.muted, fontSize: 12 }}>{e.category} · {fmtDate(e.date)}</div>
          </div>
          <div style={{ color: C.red, fontWeight: 700 }}>{fmtAED(e.amount)}</div>
        </div>
      ))}
      {expenses.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: "20px 0" }}>Aucune dépense ce mois</div>}

      <button onClick={() => { setEditing(null); setShowForm(true); }} style={{
        ...btnPrimary, position: "fixed", bottom: 90, right: 20,
        width: 56, height: 56, borderRadius: "50%", fontSize: 28,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0, boxShadow: `0 4px 20px ${C.gold}55`,
      }}>+</button>

      {showForm && (
        <Modal title={editing ? "Modifier la dépense" : "Nouvelle dépense"} onClose={() => { setShowForm(false); setEditing(null); }}>
          <ExpenseForm initial={editing} onSave={saveExpense} onDelete={deleteExpense} />
        </Modal>
      )}
    </div>
  );
}

// ─── CLIENTS VIEW ──────────────────────────────────────────────────────────
function ClientsView({ data }) {
  const clientMap = {};
  data.rentals.forEach(r => {
    if (!r.clientName) return;
    if (!clientMap[r.clientName]) clientMap[r.clientName] = { name: r.clientName, rentals: [] };
    clientMap[r.clientName].rentals.push(r);
  });
  const clients = Object.values(clientMap).sort((a, b) => b.rentals.length - a.rentals.length);

  return (
    <div>
      {clients.length === 0 && (
        <div style={{ textAlign: "center", color: C.muted, padding: "40px 0" }}>
          Les clients apparaîtront ici automatiquement.<br />Crée d'abord des locations.
        </div>
      )}
      {clients.map(c => {
        const totalRevenue = c.rentals.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.profit : 0); }, 0);
        return (
          <div key={c.name} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>{c.name}</div>
                <div style={{ color: C.muted, fontSize: 13 }}>{c.rentals.length} location{c.rentals.length > 1 ? "s" : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: C.gold, fontWeight: 700 }}>{fmtAED(totalRevenue)}</div>
                <div style={{ color: C.muted, fontSize: 11 }}>bénéfice total</div>
              </div>
            </div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {c.rentals.map(r => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: C.surface, borderRadius: 8 }}>
                  <span style={{ color: C.muted, fontSize: 13 }}>{r.car}</span>
                  <span style={{ color: C.text, fontSize: 13 }}>{fmtDate(r.startDate)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── SHARED STYLES ─────────────────────────────────────────────────────────
const inputStyle = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 10, color: C.text, padding: "11px 14px",
  fontSize: 15, width: "100%", boxSizing: "border-box", outline: "none",
};
const selStyle = { ...inputStyle };
const labelStyle = { color: C.muted, fontSize: 12, fontWeight: 600, letterSpacing: 0.5 };
const btnPrimary = {
  background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
  border: "none", borderRadius: 12, color: C.bg,
  padding: "14px", fontSize: 15, fontWeight: 700,
  cursor: "pointer", width: "100%",
};
const btnDanger = {
  background: "transparent", border: `1px solid ${C.red}`,
  borderRadius: 12, color: C.red,
  padding: "12px", fontSize: 14, fontWeight: 600,
  cursor: "pointer", width: "100%", marginTop: 4,
};

// ─── NAV TABS ──────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", icon: "◈", label: "Accueil" },
  { id: "rentals", icon: "🚗", label: "Locations" },
  { id: "accounting", icon: "₿", label: "Compta" },
  { id: "clients", icon: "👤", label: "Clients" },
];

// ═══════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [tab, setTab] = useState("dashboard");
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | saving | saved | error
  const saveTimer = useRef(null);

  // Load — Supabase en priorité, polling toutes les 10s pour sync temps réel
  useEffect(() => {
    const local = loadLocal();
    if (local) setData(local);
    const fetchRemote = () => {
      supabase.from("nld_data").select("data").eq("id", DB_KEY).single()
        .then(({ data: row }) => {
          if (row?.data) { setData(row.data); saveLocal(row.data); }
        });
    };
    fetchRemote();
    const interval = setInterval(fetchRemote, 10000);
    return () => clearInterval(interval);
  }, []);

  // Save
  const persist = useCallback((newData) => {
    saveLocal(newData);
    setSyncStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("nld_data").upsert({ id: DB_KEY, data: newData, updated_at: new Date().toISOString() });
      setSyncStatus(error ? "error" : "saved");
      setTimeout(() => setSyncStatus("idle"), 2000);
    }, 700);
  }, []);

  function update(newData) {
    setData(newData);
    persist(newData);
  }

  const syncIcon = { idle: "✓", saving: "↑", saved: "✓", error: "!" };
  const syncColor = { idle: C.muted, saving: C.gold, saved: C.green, error: C.red };

  return (
    <div style={{
      background: C.bg, minHeight: "100vh", color: C.text,
      fontFamily: "'Inter', -apple-system, sans-serif",
      maxWidth: 540, margin: "0 auto", paddingBottom: 80,
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px 12px",
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div>
          <div style={{ fontSize: 11, color: C.goldDim, fontWeight: 700, letterSpacing: 2 }}>NEWS LOC</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.gold, lineHeight: 1.1 }}>DUBAI</div>
        </div>
        <div style={{
          fontSize: 12, color: syncColor[syncStatus],
          background: C.bg, borderRadius: 20, padding: "4px 12px",
          border: `1px solid ${C.border}`,
        }}>
          {syncIcon[syncStatus]} {syncStatus === "saving" ? "Sync..." : syncStatus === "error" ? "Erreur sync" : "Synchronisé"}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 16px" }}>
        {tab === "dashboard" && <Dashboard data={data} />}
        {tab === "rentals" && <RentalsView data={data} onUpdate={update} />}
        {tab === "accounting" && <AccountingView data={data} onUpdate={update} />}
        {tab === "clients" && <ClientsView data={data} />}
      </div>

      {/* Bottom Nav */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 540,
        background: C.surface, borderTop: `1px solid ${C.border}`,
        display: "flex",
      }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{
            flex: 1, padding: "10px 0 14px", background: "none", border: "none",
            cursor: "pointer", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 3,
          }}>
            <span style={{ fontSize: 20 }}>{n.icon}</span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: tab === n.id ? C.gold : C.muted,
              letterSpacing: 0.3,
            }}>{n.label}</span>
            {tab === n.id && (
              <div style={{ width: 20, height: 2, background: C.gold, borderRadius: 1, position: "absolute", bottom: 6 }} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
