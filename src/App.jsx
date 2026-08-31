import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";

const C = {
  bg: "#050508",
  surface: "#0A0A14",
  card: "#0E0E1A",
  border: "#1A1A28",
  borderLight: "#242436",
  gold: "#D4AF6A",
  goldDim: "#6A5A30",
  goldLight: "#E8C97A",
  text: "#E8E4DC",
  muted: "#3A3A52",
  green: "#2ECC8A",
  red: "#E05555",
  blue: "#5B8DEF",
  orange: "#E8894A",
};

const CAR_BRANDS = {
  Lamborghini:   { models: ["Urus", "Urus Mansory", "STO", "Huracán Tecnica", "Revuelto"], color: "#D4AF6A" },
  Mercedes:      { models: ["G 63 AMG", "GT 63", "A 45 AMG", "G-Brabus"], color: "#A8B8C8" },
  Ferrari:       { models: ["F8 Tributo", "Roma", "Purosangue", "296 GTB", "296 GTS", "812 GTS", "SF90 Stradale"], color: "#CC2222" },
  Porsche:       { models: ["911", "911 GTS", "GT3", "GT3 RS"], color: "#8B9E6E" },
  "Rolls-Royce": { models: ["Cullinan", "Phantom", "Spectre"], color: "#9B8BAB" },
  "Range Rover": { models: ["SVR", "Vogue"], color: "#6B9B7A" },
  Audi:          { models: ["RS3", "RS6", "R8", "RSQ3", "RSQ8"], color: "#C0C0C0" },
  McLaren:       { models: ["570S", "720S", "765LT", "Artura"], color: "#FF8C00" },
  Autre:         { models: [], color: "#3A3A52" },
};

const DURATIONS = [
  { label: "1 jour", days: 1 },
  { label: "2 jours", days: 2 },
  { label: "3 jours", days: 3 },
  { label: "1 semaine", days: 7 },
  { label: "Personnalisé", days: null },
];

const COMPANY = {
  name: "NEWS LOC CAR RENTAL L.L.C S.O.C",
  nameAr: "نيوز لوك لتأجير السيارات ذ.م.م ش.ش.و",
  license: "1638113",
  register: "2894629",
  address: "Office 751-G01, Dubai Investment Complex 1",
  phone: "971-55-7700003",
  email: "Aaa@gmail.com",
  expiry: "19/07/2027",
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtAED(n) {
  if (n == null || n === "") return "—";
  return Math.round(Number(n)).toLocaleString("fr-FR") + " AED";
}

function getRentalStatus(rental) {
  if (rental.closed) return "ended";
  const now = new Date();
  const start = new Date(rental.startDate);
  const end = new Date(rental.endDate);
  if (now < start) return "upcoming";
  if (now > end) return "overdue";
  return "active";
}

function calcProfit(rental) {
  if (!rental.pricePerDay || !rental.startDate || !rental.endDate) return null;
  const ms = new Date(rental.endDate) - new Date(rental.startDate);
  const days = ms / (1000 * 60 * 60 * 24);
  const revenue = parseFloat(rental.pricePerDay) * days;
  const cost = (parseFloat(rental.costBroker) || 0) * days;
  return { revenue, cost, profit: revenue - cost, days };
}

function getBrandColor(car) {
  if (!car) return C.muted;
  for (const [b, { color }] of Object.entries(CAR_BRANDS)) {
    if (car.startsWith(b)) return color;
  }
  return C.muted;
}

const STATUS_LABELS = { active: "En cours", ended: "Terminée", upcoming: "À venir", overdue: "En retard" };
const STATUS_COLORS = { active: C.green, ended: C.muted, upcoming: C.blue, overdue: C.red };

const DB_KEY = "nld_main";
const LS_KEY = "nld_data_v4";

function loadLocal() {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveLocal(d) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {}
}

const DEFAULT_DATA = { rentals: [], clients: [], expenses: [], settlements: [] };

// ─── STYLES ──────────────────────────────────────────────────────────────────
const inputStyle = {
  background: C.surface, border: `0.5px solid ${C.borderLight}`,
  borderRadius: 10, color: C.text, padding: "11px 14px",
  fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none",
  fontFamily: "Inter, -apple-system, sans-serif",
};
const labelStyle = {
  color: C.muted, fontSize: 10, fontWeight: 600,
  letterSpacing: "0.15em", textTransform: "uppercase",
};
const btnPrimary = {
  background: C.gold, border: "none", borderRadius: 12, color: C.bg,
  padding: "14px", fontSize: 13, fontWeight: 700, letterSpacing: "0.05em",
  cursor: "pointer", width: "100%", fontFamily: "Inter, sans-serif",
};
const btnDanger = {
  background: "transparent", border: `0.5px solid ${C.red}44`,
  borderRadius: 12, color: C.red, padding: "12px", fontSize: 13,
  fontWeight: 600, cursor: "pointer", width: "100%", marginTop: 4,
};
const btnSecondary = {
  background: "transparent", border: `0.5px solid ${C.borderLight}`,
  borderRadius: 12, color: C.text, padding: "12px", fontSize: 13,
  fontWeight: 600, cursor: "pointer", width: "100%", marginTop: 4,
};

// ─── MODAL ───────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, border: `0.5px solid ${C.borderLight}`, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 540, maxHeight: "92vh", overflow: "auto", padding: "24px 20px 44px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ color: C.gold, fontWeight: 700, fontSize: 16, letterSpacing: "0.05em" }}>{title}</span>
          <button onClick={onClose} style={{ background: C.surface, border: `0.5px solid ${C.border}`, borderRadius: 20, color: C.muted, fontSize: 14, cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── CAR SELECTOR ────────────────────────────────────────────────────────────
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

  const brandShort = (b) => {
    const map = { "Lamborghini": "LAMBO", "Rolls-Royce": "ROLLS\nROYCE", "Range Rover": "RANGE\nROVER" };
    return map[b] || b.toUpperCase();
  };

  const brandFont = (b) => {
    if (b === "Rolls-Royce" || b === "Mercedes") return "Georgia, 'Times New Roman', serif";
    return "Inter, -apple-system, sans-serif";
  };

  const brandWeight = (b) => {
    if (b === "Lamborghini" || b === "McLaren") return 900;
    if (b === "Rolls-Royce" || b === "Mercedes" || b === "Audi") return 300;
    return 600;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {Object.entries(CAR_BRANDS).map(([b, { color }]) => {
          const active = brand === b;
          return (
            <button key={b} onClick={() => { setBrand(b); setModel(""); setCustom(""); update(b, "", ""); }} style={{
              padding: "14px 4px 10px",
              borderRadius: 14,
              border: active ? `1px solid ${color}55` : `0.5px solid ${C.border}`,
              cursor: "pointer",
              background: active ? color + "12" : C.surface,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            }}>
              {b === "Autre" ? (
                <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 22, color: active ? color : C.muted }}>+</span>
                </div>
              ) : (
                <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
                  <span style={{
                    fontSize: b === "Lamborghini" ? 7 : b === "Rolls-Royce" || b === "Range Rover" ? 7 : b === "Audi" ? 11 : 8,
                    fontWeight: brandWeight(b),
                    letterSpacing: b === "Audi" ? "0.35em" : "0.12em",
                    color: active ? color : C.muted,
                    fontFamily: brandFont(b),
                    whiteSpace: "pre",
                    textAlign: "center",
                    lineHeight: 1.3,
                  }}>{brandShort(b)}</span>
                </div>
              )}
              <div style={{ width: 20, height: "0.5px", background: active ? color + "60" : C.border }} />
            </button>
          );
        })}
      </div>

      {brand && brand !== "Autre" && (
        <div>
          <div style={{ ...labelStyle, marginBottom: 8, color: CAR_BRANDS[brand].color }}>
            Modèle — {brand}
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {CAR_BRANDS[brand].models.map(m => {
              const active = model === m;
              const col = CAR_BRANDS[brand].color;
              return (
                <button key={m} onClick={() => { setModel(m); update(brand, m, ""); }} style={{
                  padding: "7px 16px", borderRadius: 20,
                  border: active ? `1px solid ${col}` : `0.5px solid ${C.borderLight}`,
                  cursor: "pointer", fontWeight: active ? 700 : 400, fontSize: 12,
                  background: active ? col + "18" : "transparent",
                  color: active ? col : C.text, letterSpacing: "0.03em",
                  fontFamily: "Inter, sans-serif",
                }}>{m}</button>
              );
            })}
          </div>
        </div>
      )}

      {brand === "Autre" && (
        <input style={inputStyle} placeholder="Modèle (ex: Bentley Continental)" value={custom}
          onChange={e => { setCustom(e.target.value); update("Autre", "", e.target.value); }} />
      )}

      {value && (
        <div style={{ padding: "12px 16px", borderRadius: 14, background: (CAR_BRANDS[brand]?.color || C.muted) + "10", border: `0.5px solid ${(CAR_BRANDS[brand]?.color || C.muted)}30`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ color: CAR_BRANDS[brand]?.color || C.muted, fontSize: 13, fontWeight: 700, letterSpacing: "0.05em" }}>{value}</div>
          <div style={{ marginLeft: "auto", color: C.green, fontSize: 16 }}>✓</div>
        </div>
      )}
    </div>
  );
}

// ─── RENTAL FORM ─────────────────────────────────────────────────────────────
function RentalForm({ initial, onSave, onDelete, clients }) {
  const [form, setForm] = useState(initial || {
    car: "", clientId: "", clientName: "", clientPhone: "",
    licenseRef: "", passportRef: "",
    startDate: "", endDate: "", durationPreset: "1 jour", customDays: "",
    pricePerDay: "", costBroker: "",
    deposit: false, depositAmount: "",
    paymentStatus: "pending", collectedBy: "", notes: "", closed: false,
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function applyDuration(preset, start) {
    const s = start || form.startDate;
    if (!s) return;
    const dur = DURATIONS.find(d => d.label === preset);
    if (!dur || !dur.days) return;
    const end = new Date(s);
    end.setDate(end.getDate() + dur.days);
    set("endDate", end.toISOString().slice(0, 10));
  }

  const profit = (() => {
    if (!form.startDate || !form.endDate || !form.pricePerDay) return null;
    const ms = new Date(form.endDate) - new Date(form.startDate);
    const days = ms / (1000 * 60 * 60 * 24);
    const revenue = parseFloat(form.pricePerDay) * days;
    const cost = (parseFloat(form.costBroker) || 0) * days;
    return { revenue, cost, profit: revenue - cost, days };
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={labelStyle}>Véhicule</div>
      <CarSelector value={form.car} onChange={v => set("car", v)} />

      <div style={labelStyle}>Client</div>
      {clients.length > 0 && (
        <select style={inputStyle} value={form.clientId}
          onChange={e => {
            const c = clients.find(cl => cl.id === e.target.value);
            if (c) setForm(f => ({ ...f, clientId: c.id, clientName: c.name, clientPhone: c.phone || "", licenseRef: c.licenseRef || "", passportRef: c.passportRef || "" }));
            else set("clientId", "");
          }}>
          <option value="">— Nouveau client —</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.vip ? "⭐ " : ""}{c.blacklist ? "🚫 " : ""}{c.name}</option>)}
        </select>
      )}
      <input style={inputStyle} placeholder="Nom complet *" value={form.clientName} onChange={e => set("clientName", e.target.value)} />
      <input style={inputStyle} placeholder="Téléphone" value={form.clientPhone || ""} onChange={e => set("clientPhone", e.target.value)} />

      <div style={labelStyle}>Documents (optionnels)</div>
      <input style={inputStyle} placeholder="N° Permis de conduire" value={form.licenseRef || ""} onChange={e => set("licenseRef", e.target.value)} />
      <input style={inputStyle} placeholder="N° Passeport" value={form.passportRef || ""} onChange={e => set("passportRef", e.target.value)} />

      <div style={labelStyle}>Dates</div>
      <input type="date" style={inputStyle} value={form.startDate}
        onChange={e => { set("startDate", e.target.value); applyDuration(form.durationPreset, e.target.value); }} />

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {DURATIONS.map(d => (
          <button key={d.label} onClick={() => { set("durationPreset", d.label); applyDuration(d.label, null); }} style={{
            padding: "6px 14px", borderRadius: 20,
            border: form.durationPreset === d.label ? `1px solid ${C.gold}` : `0.5px solid ${C.borderLight}`,
            cursor: "pointer", background: form.durationPreset === d.label ? C.gold + "18" : "transparent",
            color: form.durationPreset === d.label ? C.gold : C.muted, fontWeight: 600, fontSize: 12,
          }}>{d.label}</button>
        ))}
      </div>
      {form.durationPreset === "Personnalisé" && (
        <input type="number" style={inputStyle} placeholder="Nombre de jours" value={form.customDays}
          onChange={e => {
            set("customDays", e.target.value);
            if (form.startDate && e.target.value) {
              const end = new Date(form.startDate);
              end.setDate(end.getDate() + parseInt(e.target.value));
              set("endDate", end.toISOString().slice(0, 10));
            }
          }} />
      )}
      <input type="date" style={inputStyle} value={form.endDate} onChange={e => set("endDate", e.target.value)} />

      <div style={labelStyle}>Prix / jour (AED)</div>
      <input type="number" style={inputStyle} placeholder="ex: 2 500" value={form.pricePerDay} onChange={e => set("pricePerDay", e.target.value)} />
      <div style={labelStyle}>Prix broker / jour (AED)</div>
      <input type="number" style={inputStyle} placeholder="ex: 1 800" value={form.costBroker} onChange={e => set("costBroker", e.target.value)} />

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="checkbox" checked={form.deposit} onChange={e => set("deposit", e.target.checked)} style={{ width: 16, height: 16, accentColor: C.gold }} />
        <span style={{ color: C.text, fontSize: 13 }}>Caution encaissée</span>
      </div>
      {form.deposit && <input type="number" style={inputStyle} placeholder="Montant caution (AED)" value={form.depositAmount} onChange={e => set("depositAmount", e.target.value)} />}

      <div style={labelStyle}>Paiement</div>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ k: "pending", l: "En attente", c: C.orange }, { k: "partial", l: "Acompte", c: C.blue }, { k: "paid", l: "Payé", c: C.green }].map(s => (
          <button key={s.k} onClick={() => set("paymentStatus", s.k)} style={{
            flex: 1, padding: "8px 4px", borderRadius: 10,
            border: `0.5px solid ${form.paymentStatus === s.k ? s.c : C.borderLight}`,
            cursor: "pointer", fontSize: 11, fontWeight: 600,
            background: form.paymentStatus === s.k ? s.c + "18" : "transparent",
            color: form.paymentStatus === s.k ? s.c : C.muted,
          }}>{s.l}</button>
        ))}
      </div>

      <div style={labelStyle}>Encaissé par *</div>
      <div style={{ display: "flex", gap: 8 }}>
        {["JDJ", "NEWLOC"].map(p => (
          <button key={p} onClick={() => set("collectedBy", p)} style={{
            flex: 1, padding: "12px", borderRadius: 12,
            border: `0.5px solid ${form.collectedBy === p ? C.gold : C.borderLight}`,
            cursor: "pointer", fontWeight: 800, fontSize: 14, letterSpacing: "0.1em",
            background: form.collectedBy === p ? C.gold + "18" : "transparent",
            color: form.collectedBy === p ? C.gold : C.muted,
          }}>{p}</button>
        ))}
      </div>
      {!form.collectedBy && <div style={{ color: C.red, fontSize: 11, letterSpacing: "0.05em" }}>* Obligatoire</div>}

      {profit && (
        <div style={{ background: C.surface, border: `0.5px solid ${C.gold}30`, borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ ...labelStyle, color: C.gold, marginBottom: 12 }}>Récap automatique</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><div style={{ ...labelStyle, marginBottom: 3 }}>Durée</div><div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{profit.days.toFixed(0)}j</div></div>
            <div><div style={{ ...labelStyle, marginBottom: 3 }}>Revenu</div><div style={{ color: C.gold, fontSize: 14, fontWeight: 600 }}>{fmtAED(profit.revenue)}</div></div>
          </div>
          <div style={{ borderTop: `0.5px solid ${C.border}`, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ ...labelStyle }}>Bénéfice net</div>
            <div style={{ color: profit.profit >= 0 ? C.green : C.red, fontWeight: 800, fontSize: 20 }}>{fmtAED(profit.profit)}</div>
          </div>
        </div>
      )}

      <div style={labelStyle}>Notes</div>
      <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} placeholder="Infos complémentaires..." value={form.notes} onChange={e => set("notes", e.target.value)} />

      <button onClick={() => { if (!form.collectedBy) { alert("Veuillez choisir qui a encaissé."); return; } onSave(form); }} style={btnPrimary}>
        {initial ? "Mettre à jour" : "Créer la location"}
      </button>
      {initial && !initial.closed && (
        <button onClick={() => { if (!form.collectedBy) { alert("Veuillez choisir qui a encaissé."); return; } onSave({ ...form, closed: true }); }} style={{ ...btnSecondary, borderColor: C.green + "44", color: C.green }}>
          ✓ Clôturer
        </button>
      )}
      {initial && <button onClick={() => onDelete(initial.id)} style={btnDanger}>Supprimer</button>}
    </div>
  );
}

// ─── RENTAL CARD ─────────────────────────────────────────────────────────────
function RentalCard({ rental, onClick }) {
  const status = getRentalStatus(rental);
  const profit = calcProfit(rental);
  const brandColor = getBrandColor(rental.car);
  const statusColor = STATUS_COLORS[status];

  return (
    <div onClick={onClick} style={{
      background: C.card, border: `0.5px solid ${C.border}`,
      borderRadius: 18, padding: "16px", marginBottom: 8,
      cursor: onClick ? "pointer" : "default",
      borderLeft: `1px solid ${brandColor}44`,
      opacity: status === "ended" ? 0.6 : 1,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: brandColor + "12", border: `0.5px solid ${brandColor}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 900, color: brandColor, letterSpacing: "0.5px" }}>
            {rental.car?.split(" ")[0]?.slice(0, 5).toUpperCase() || "—"}
          </div>
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 13, letterSpacing: "0.01em" }}>{rental.car || "—"}</div>
            <div style={{ color: C.muted, fontSize: 10, marginTop: 2, letterSpacing: "0.03em" }}>{rental.clientName || "—"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {rental.collectedBy && <div style={{ background: C.gold + "18", color: C.gold, borderRadius: 6, padding: "2px 7px", fontSize: 8, fontWeight: 700, letterSpacing: "0.08em" }}>{rental.collectedBy}</div>}
          <div style={{ background: statusColor + "12", border: `0.5px solid ${statusColor}40`, color: statusColor, borderRadius: 20, padding: "3px 9px", fontSize: 8, fontWeight: 600, letterSpacing: "0.05em" }}>{STATUS_LABELS[status]}</div>
        </div>
      </div>
      <div style={{ background: C.bg, borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between" }}>
        <div><div style={{ ...labelStyle, marginBottom: 3 }}>Départ</div><div style={{ color: C.text, fontSize: 11, fontWeight: 600 }}>{fmtDate(rental.startDate)}</div></div>
        <div style={{ width: "0.5px", background: C.border }} />
        <div><div style={{ ...labelStyle, marginBottom: 3 }}>Retour</div><div style={{ color: C.text, fontSize: 11, fontWeight: 600 }}>{fmtDate(rental.endDate)}</div></div>
        <div style={{ width: "0.5px", background: C.border }} />
        <div><div style={{ ...labelStyle, marginBottom: 3 }}>Bénéfice</div><div style={{ color: profit && profit.profit >= 0 ? C.green : C.red, fontSize: 11, fontWeight: 700 }}>{profit ? fmtAED(profit.profit) : "—"}</div></div>
      </div>
    </div>
  );
}

// ─── EXPENSE FORM ─────────────────────────────────────────────────────────────
function ExpenseForm({ initial, onSave, onDelete }) {
  const [form, setForm] = useState(initial || { label: "", amount: "", date: new Date().toISOString().slice(0, 10), category: "Broker" });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={labelStyle}>Libellé</div>
      <input style={inputStyle} placeholder="ex: Réparation" value={form.label} onChange={e => set("label", e.target.value)} />
      <div style={labelStyle}>Montant (AED)</div>
      <input type="number" style={inputStyle} value={form.amount} onChange={e => set("amount", e.target.value)} />
      <div style={labelStyle}>Date</div>
      <input type="date" style={inputStyle} value={form.date} onChange={e => set("date", e.target.value)} />
      <div style={labelStyle}>Catégorie</div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {["Broker", "Carburant", "Assurance", "Autre"].map(c => (
          <button key={c} onClick={() => set("category", c)} style={{ padding: "6px 14px", borderRadius: 20, border: `0.5px solid ${form.category === c ? C.gold : C.borderLight}`, cursor: "pointer", background: form.category === c ? C.gold + "18" : "transparent", color: form.category === c ? C.gold : C.muted, fontWeight: 600, fontSize: 12 }}>{c}</button>
        ))}
      </div>
      <button onClick={() => onSave(form)} style={btnPrimary}>{initial ? "Mettre à jour" : "Ajouter"}</button>
      {initial && <button onClick={() => onDelete(initial.id)} style={btnDanger}>Supprimer</button>}
    </div>
  );
}

// ─── CLIENT FORM ──────────────────────────────────────────────────────────────
function ClientForm({ initial, onSave, onDelete }) {
  const [form, setForm] = useState(initial || { name: "", phone: "", nationality: "", licenseRef: "", passportRef: "", notes: "", vip: false, blacklist: false });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {[["Nom complet *", "name", "Prénom Nom"], ["Téléphone", "clientPhone", "+971 50 000 0000"], ["Nationalité", "nationality", "ex: Français, Émirati..."], ["N° Permis", "licenseRef", "ex: 123456789"], ["N° Passeport", "passportRef", "ex: AB1234567"]].map(([lbl, key, ph]) => (
        <div key={key}>
          <div style={{ ...labelStyle, marginBottom: 6 }}>{lbl}</div>
          <input style={inputStyle} placeholder={ph} value={form[key] || ""} onChange={e => set(key, e.target.value)} />
        </div>
      ))}
      <div style={labelStyle}>Notes internes</div>
      <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder="ex: Paye cash, régulier..." value={form.notes || ""} onChange={e => set("notes", e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => set("vip", !form.vip)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `0.5px solid ${form.vip ? C.gold : C.borderLight}`, background: form.vip ? C.gold + "18" : "transparent", color: form.vip ? C.gold : C.muted, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>⭐ VIP</button>
        <button onClick={() => set("blacklist", !form.blacklist)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `0.5px solid ${form.blacklist ? C.red : C.borderLight}`, background: form.blacklist ? C.red + "18" : "transparent", color: form.blacklist ? C.red : C.muted, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>🚫 Blacklist</button>
      </div>
      <button onClick={() => onSave(form)} style={btnPrimary}>{initial ? "Mettre à jour" : "Créer"}</button>
      {initial && <button onClick={() => onDelete(initial.id)} style={btnDanger}>Supprimer</button>}
    </div>
  );
}

// ─── CLIENT PROFILE ───────────────────────────────────────────────────────────
function ClientProfile({ client, rentals, onEdit, onClose }) {
  const cr = rentals.filter(r => r.clientId === client.id || r.clientName === client.name);
  const totalProfit = cr.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.profit : 0); }, 0);
  const carCount = {};
  cr.forEach(r => { if (r.car) carCount[r.car] = (carCount[r.car] || 0) + 1; });
  const favCar = Object.entries(carCount).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <div>
      <button onClick={onClose} style={{ background: "none", border: "none", color: C.gold, cursor: "pointer", marginBottom: 16, fontSize: 13, letterSpacing: "0.05em" }}>← Retour</button>
      <div style={{ background: C.card, border: `0.5px solid ${C.borderLight}`, borderRadius: 18, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.gold + "20", border: `0.5px solid ${C.gold}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: C.gold }}>
              {client.name?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>{client.name}</div>
                {client.vip && <span>⭐</span>}
                {client.blacklist && <span>🚫</span>}
              </div>
              {client.nationality && <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{client.nationality}</div>}
              {client.phone && <div style={{ color: C.blue, fontSize: 11, marginTop: 2 }}>📞 {client.phone}</div>}
            </div>
          </div>
          <button onClick={onEdit} style={{ background: C.surface, border: `0.5px solid ${C.borderLight}`, borderRadius: 8, color: C.text, padding: "5px 10px", cursor: "pointer", fontSize: 11 }}>Modifier</button>
        </div>
        {(client.licenseRef || client.passportRef) && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {client.licenseRef && <div style={{ background: C.surface, borderRadius: 8, padding: "6px 10px" }}><div style={{ ...labelStyle, marginBottom: 2 }}>Permis</div><div style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{client.licenseRef}</div></div>}
            {client.passportRef && <div style={{ background: C.surface, borderRadius: 8, padding: "6px 10px" }}><div style={{ ...labelStyle, marginBottom: 2 }}>Passeport</div><div style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{client.passportRef}</div></div>}
          </div>
        )}
        {client.notes && <div style={{ padding: "8px 10px", background: C.surface, borderRadius: 8, color: C.muted, fontSize: 12, fontStyle: "italic" }}>"{client.notes}"</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[{ v: cr.length, l: "Locations", c: C.gold }, { v: fmtAED(totalProfit), l: "Bénéfice", c: C.green }, { v: favCar?.split(" ").slice(-1)[0] || "—", l: "Voiture fav.", c: C.text }].map(s => (
          <div key={s.l} style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ color: s.c, fontWeight: 700, fontSize: s.l === "Bénéfice" ? 11 : 18, marginBottom: 2 }}>{s.v}</div>
            <div style={{ ...labelStyle }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ ...labelStyle, marginBottom: 10 }}>Historique</div>
      {cr.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: "20px 0", fontSize: 13 }}>Aucune location</div>}
      {cr.sort((a, b) => new Date(b.startDate) - new Date(a.startDate)).map(r => {
        const p = calcProfit(r);
        const status = getRentalStatus(r);
        return (
          <div key={r.id} style={{ background: C.card, border: `0.5px solid ${C.border}`, borderLeft: `1px solid ${getBrandColor(r.car)}44`, borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{r.car}</div>
              <div style={{ color: STATUS_COLORS[status], fontSize: 10, fontWeight: 600 }}>{STATUS_LABELS[status]}</div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
              <div style={{ color: C.muted, fontSize: 11 }}>{fmtDate(r.startDate)} → {fmtDate(r.endDate)}</div>
              {p && <div style={{ color: p.profit >= 0 ? C.green : C.red, fontSize: 11, fontWeight: 700 }}>{fmtAED(p.profit)}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── BALANCE CARD ─────────────────────────────────────────────────────────────
function BalanceCard({ data, onUpdate }) {
  const [showSettle, setShowSettle] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");

  let newlocHolds = 0, jdjHolds = 0;
  data.rentals.forEach(r => {
    const p = calcProfit(r);
    if (!p || !r.collectedBy) return;
    const share = p.profit / 2;
    if (r.collectedBy === "NEWLOC") newlocHolds += share;
    else if (r.collectedBy === "JDJ") jdjHolds += share;
  });

  const settleOffset = (data.settlements || []).reduce((s, st) => {
    if (st.from === "NEWLOC" && st.to === "JDJ") return s - st.amount;
    if (st.from === "JDJ" && st.to === "NEWLOC") return s + st.amount;
    return s;
  }, 0);

  const rawBalance = newlocHolds - jdjHolds;
  const netBalance = rawBalance + settleOffset;
  const absNet = Math.abs(netBalance);
  const debtor = netBalance > 0 ? "NEWLOC" : "JDJ";
  const creditor = netBalance > 0 ? "JDJ" : "NEWLOC";
  const color = netBalance > 0 ? C.green : C.red;

  function saveSettlement() {
    if (!amount || !paidBy) return;
    const to = paidBy === "JDJ" ? "NEWLOC" : "JDJ";
    const s = { id: uid(), from: paidBy, to, amount: parseFloat(amount), date: new Date().toISOString().slice(0, 10) };
    onUpdate({ ...data, settlements: [...(data.settlements || []), s] });
    setShowSettle(false); setAmount(""); setPaidBy("");
  }

  return (
    <>
      <div style={{ background: C.card, border: `0.5px solid ${absNet < 1 ? C.green + "40" : color + "30"}`, borderRadius: 18, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ ...labelStyle }}>Balance</div>
          {absNet >= 1 && <button onClick={() => setShowSettle(true)} style={{ background: C.gold, border: "none", borderRadius: 8, color: C.bg, padding: "5px 12px", fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em" }}>RÉGLER</button>}
        </div>
        {absNet < 1 ? (
          <div style={{ color: C.green, fontWeight: 700, fontSize: 14, textAlign: "center", letterSpacing: "0.05em" }}>✓ Vous êtes quittes</div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.1em", marginBottom: 4 }}>{debtor} DOIT À {creditor}</div>
              <div style={{ color, fontWeight: 900, fontSize: 26, letterSpacing: "-0.5px" }}>{Math.round(absNet).toLocaleString("fr-FR")} <span style={{ fontSize: 12, fontWeight: 400, color: C.muted }}>AED</span></div>
            </div>
            <div style={{ fontSize: 24, color: C.muted }}>→</div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: C.gold, fontWeight: 800, fontSize: 18, letterSpacing: "0.08em" }}>{creditor}</div>
            </div>
          </div>
        )}
        {(data.settlements || []).length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${C.border}` }}>
            {(data.settlements || []).slice().reverse().slice(0, 3).map(s => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.05em" }}>{s.from} → {s.to} · {fmtDate(s.date)}</div>
                <div style={{ color: C.green, fontSize: 10, fontWeight: 700 }}>{fmtAED(s.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showSettle && (
        <Modal title="Enregistrer un règlement" onClose={() => setShowSettle(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={labelStyle}>Qui a payé ?</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["JDJ", "NEWLOC"].map(p => (
                <button key={p} onClick={() => setPaidBy(p)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: `0.5px solid ${paidBy === p ? C.gold : C.borderLight}`, background: paidBy === p ? C.gold + "18" : "transparent", color: paidBy === p ? C.gold : C.muted, cursor: "pointer", fontWeight: 800, fontSize: 14, letterSpacing: "0.1em" }}>{p}</button>
              ))}
            </div>
            <div style={labelStyle}>Montant (AED)</div>
            <input type="number" style={inputStyle} placeholder={`Max: ${Math.round(absNet)} AED`} value={amount} onChange={e => setAmount(e.target.value)} />
            <button onClick={saveSettlement} style={btnPrimary}>Confirmer</button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ data, onUpdate }) {
  const now = new Date();
  const active = data.rentals.filter(r => getRentalStatus(r) === "active");
  const upcoming = data.rentals.filter(r => getRentalStatus(r) === "upcoming");
  const overdue = data.rentals.filter(r => getRentalStatus(r) === "overdue");
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRentals = data.rentals.filter(r => new Date(r.startDate) >= monthStart);
  const monthRevenue = monthRentals.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.revenue : 0); }, 0);
  const monthCost = monthRentals.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.cost : 0); }, 0);
  const monthExpenses = data.expenses.filter(e => new Date(e.date) >= monthStart).reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const monthProfit = monthRevenue - monthCost - monthExpenses;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { l: "En cours", v: active.length + overdue.length, c: C.green },
          { l: "À venir", v: upcoming.length, c: C.blue },
          { l: "Revenus mois", v: fmtAED(monthRevenue), c: C.gold },
          { l: "Bénéfice net", v: fmtAED(monthProfit), c: monthProfit >= 0 ? C.green : C.red },
        ].map(s => (
          <div key={s.l} style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: "14px 14px" }}>
            <div style={{ color: s.c, fontSize: 20, fontWeight: 800, marginBottom: 4, letterSpacing: "-0.3px" }}>{s.v}</div>
            <div style={{ ...labelStyle }}>{s.l}</div>
          </div>
        ))}
      </div>
      <BalanceCard data={data} onUpdate={onUpdate} />
      {overdue.length > 0 && <><div style={{ ...labelStyle, color: C.red, marginBottom: 8 }}>⚠ En retard</div>{overdue.map(r => <RentalCard key={r.id} rental={r} />)}</>}
      {active.length > 0 && <><div style={{ ...labelStyle, color: C.green, marginTop: 12, marginBottom: 8 }}>En cours</div>{active.map(r => <RentalCard key={r.id} rental={r} />)}</>}
      {upcoming.length > 0 && <><div style={{ ...labelStyle, color: C.blue, marginTop: 12, marginBottom: 8 }}>À venir</div>{upcoming.map(r => <RentalCard key={r.id} rental={r} />)}</>}
      {active.length === 0 && upcoming.length === 0 && overdue.length === 0 && (
        <div style={{ textAlign: "center", color: C.muted, padding: "48px 0", fontSize: 13, letterSpacing: "0.05em" }}>Aucune location active</div>
      )}
    </div>
  );
}

// ─── RENTALS VIEW ─────────────────────────────────────────────────────────────
function RentalsView({ data, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("all");
  const filtered = data.rentals.filter(r => filter === "all" ? true : getRentalStatus(r) === filter);

  function saveRental(form) {
    let newClients = [...data.clients];
    if (!form.clientId && form.clientName) {
      const existing = data.clients.find(c => c.name.toLowerCase() === form.clientName.toLowerCase());
      if (existing) form.clientId = existing.id;
      else { const nc = { id: uid(), name: form.clientName, phone: form.clientPhone || "", licenseRef: form.licenseRef || "", passportRef: form.passportRef || "" }; newClients = [...data.clients, nc]; form.clientId = nc.id; }
    }
    const rentals = editing ? data.rentals.map(r => r.id === editing.id ? { ...form, id: r.id } : r) : [...data.rentals, { ...form, id: uid() }];
    onUpdate({ ...data, rentals, clients: newClients });
    setShowForm(false); setEditing(null);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 7, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {[{ k: "all", l: "Toutes" }, { k: "active", l: "En cours" }, { k: "overdue", l: "En retard" }, { k: "upcoming", l: "À venir" }, { k: "ended", l: "Terminées" }].map(t => (
          <button key={t.k} onClick={() => setFilter(t.k)} style={{ padding: "6px 14px", borderRadius: 20, border: `0.5px solid ${filter === t.k ? C.gold : C.borderLight}`, cursor: "pointer", background: filter === t.k ? C.gold + "18" : "transparent", color: filter === t.k ? C.gold : C.muted, fontWeight: 600, fontSize: 11, whiteSpace: "nowrap", letterSpacing: "0.05em" }}>{t.l}</button>
        ))}
      </div>
      {filtered.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: "48px 0", fontSize: 13 }}>Aucune location</div>}
      {filtered.map(r => <RentalCard key={r.id} rental={r} onClick={() => { setEditing(r); setShowForm(true); }} />)}
      <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ position: "fixed", bottom: 90, right: 20, width: 52, height: 52, borderRadius: "50%", background: C.gold, border: "none", color: C.bg, fontSize: 26, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 24px ${C.gold}40` }}>+</button>
      {showForm && (
        <Modal title={editing ? "Modifier" : "Nouvelle location"} onClose={() => { setShowForm(false); setEditing(null); }}>
          <RentalForm initial={editing} onSave={saveRental} onDelete={id => { onUpdate({ ...data, rentals: data.rentals.filter(r => r.id !== id) }); setShowForm(false); setEditing(null); }} clients={data.clients} />
        </Modal>
      )}
    </div>
  );
}

// ─── ACCOUNTING VIEW ──────────────────────────────────────────────────────────
function AccountingView({ data, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [y, m] = month.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 1);
  const monthRentals = data.rentals.filter(r => { const s = new Date(r.startDate); return s >= monthStart && s < monthEnd; });
  const revenue = monthRentals.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.revenue : 0); }, 0);
  const brokerCost = monthRentals.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.cost : 0); }, 0);
  const expenses = data.expenses.filter(e => e.date && e.date.startsWith(month));
  const expenseTotal = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const profit = revenue - brokerCost - expenseTotal;

  function saveExpense(form) {
    const list = editing ? data.expenses.map(e => e.id === editing.id ? { ...form, id: e.id } : e) : [...data.expenses, { ...form, id: uid() }];
    onUpdate({ ...data, expenses: list });
    setShowForm(false); setEditing(null);
  }

  return (
    <div>
      <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[{ l: "Revenus", v: revenue, c: C.gold }, { l: "Coût brokers", v: brokerCost, c: C.orange }, { l: "Dépenses", v: expenseTotal, c: C.red }, { l: "Bénéfice net", v: profit, c: profit >= 0 ? C.green : C.red }].map(s => (
          <div key={s.l} style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "14px 12px" }}>
            <div style={{ color: s.c, fontWeight: 700, fontSize: 16 }}>{fmtAED(s.v)}</div>
            <div style={{ ...labelStyle, marginTop: 4 }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ ...labelStyle, marginBottom: 10 }}>Locations ({monthRentals.length})</div>
      {monthRentals.map(r => {
        const p = calcProfit(r);
        return (
          <div key={r.id} style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
            <div><div style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{r.car}</div><div style={{ color: C.muted, fontSize: 11 }}>{r.clientName} · {p ? p.days.toFixed(0) + "j" : "—"}</div></div>
            {p && <div style={{ textAlign: "right" }}><div style={{ color: C.gold, fontSize: 13 }}>{fmtAED(p.revenue)}</div><div style={{ color: p.profit >= 0 ? C.green : C.red, fontSize: 12 }}>{fmtAED(p.profit)}</div></div>}
          </div>
        );
      })}
      <div style={{ ...labelStyle, marginTop: 16, marginBottom: 10 }}>Dépenses</div>
      {expenses.map(e => (
        <div key={e.id} onClick={() => { setEditing(e); setShowForm(true); }} style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
          <div><div style={{ color: C.text, fontSize: 13 }}>{e.label}</div><div style={{ color: C.muted, fontSize: 11 }}>{e.category} · {fmtDate(e.date)}</div></div>
          <div style={{ color: C.red, fontWeight: 700, fontSize: 13 }}>{fmtAED(e.amount)}</div>
        </div>
      ))}
      {expenses.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: "20px 0", fontSize: 13 }}>Aucune dépense ce mois</div>}
      <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ position: "fixed", bottom: 90, right: 20, width: 52, height: 52, borderRadius: "50%", background: C.gold, border: "none", color: C.bg, fontSize: 26, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 24px ${C.gold}40` }}>+</button>
      {showForm && (
        <Modal title={editing ? "Modifier" : "Nouvelle dépense"} onClose={() => { setShowForm(false); setEditing(null); }}>
          <ExpenseForm initial={editing} onSave={saveExpense} onDelete={id => { onUpdate({ ...data, expenses: data.expenses.filter(e => e.id !== id) }); setShowForm(false); setEditing(null); }} />
        </Modal>
      )}
    </div>
  );
}

// ─── CLIENTS VIEW ─────────────────────────────────────────────────────────────
function ClientsView({ data, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [profile, setProfile] = useState(null);

  if (profile) {
    const client = data.clients.find(c => c.id === profile);
    if (client) return <ClientProfile client={client} rentals={data.rentals} onEdit={() => { setEditing(client); setShowForm(true); }} onClose={() => setProfile(null)} />;
  }

  function saveClient(form) {
    const clients = editing ? data.clients.map(c => c.id === editing.id ? { ...form, id: c.id } : c) : [...data.clients, { ...form, id: uid() }];
    onUpdate({ ...data, clients });
    setShowForm(false); setEditing(null);
  }

  return (
    <div>
      {data.clients.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: "48px 0", fontSize: 13 }}>Les clients apparaissent automatiquement lors d'une location.</div>}
      {data.clients.map(c => {
        const cr = data.rentals.filter(r => r.clientId === c.id || r.clientName === c.name);
        const totalProfit = cr.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.profit : 0); }, 0);
        return (
          <div key={c.id} onClick={() => setProfile(c.id)} style={{ background: C.card, border: `0.5px solid ${C.border}`, borderLeft: `1px solid ${c.vip ? C.gold : c.blacklist ? C.red : C.border}44`, borderRadius: 16, padding: "14px 16px", marginBottom: 8, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.gold + "18", border: `0.5px solid ${C.gold}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: C.gold }}>
                  {c.name?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                    {c.vip && <span style={{ fontSize: 11 }}>⭐</span>}
                    {c.blacklist && <span style={{ fontSize: 11 }}>🚫</span>}
                  </div>
                  <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{cr.length} location{cr.length > 1 ? "s" : ""}{c.nationality ? ` · ${c.nationality}` : ""}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: C.gold, fontWeight: 700, fontSize: 13 }}>{fmtAED(totalProfit)}</div>
                <div style={{ ...labelStyle }}>bénéfice</div>
              </div>
            </div>
          </div>
        );
      })}
      <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ position: "fixed", bottom: 90, right: 20, width: 52, height: 52, borderRadius: "50%", background: C.gold, border: "none", color: C.bg, fontSize: 26, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 24px ${C.gold}40` }}>+</button>
      {showForm && (
        <Modal title={editing ? "Modifier" : "Nouveau client"} onClose={() => { setShowForm(false); setEditing(null); setProfile(null); }}>
          <ClientForm initial={editing} onSave={saveClient} onDelete={id => { onUpdate({ ...data, clients: data.clients.filter(c => c.id !== id) }); setShowForm(false); setEditing(null); }} />
        </Modal>
      )}
    </div>
  );
}

// ─── ANALYTICS VIEW ───────────────────────────────────────────────────────────
function AnalyticsView({ data }) {
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("fr-FR", { month: "short" });
    const rentals = data.rentals.filter(r => r.startDate && r.startDate.startsWith(key));
    const revenue = rentals.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.revenue : 0); }, 0);
    const profit = rentals.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.profit : 0); }, 0);
    months.push({ key, label, revenue, profit });
  }
  const maxRevenue = Math.max(...months.map(m => m.revenue), 1);
  const bestMonth = months.reduce((a, b) => a.profit > b.profit ? a : b, months[0]);
  const carProfits = {};
  data.rentals.forEach(r => {
    if (!r.car) return;
    const p = calcProfit(r);
    if (!p) return;
    if (!carProfits[r.car]) carProfits[r.car] = { profit: 0, count: 0 };
    carProfits[r.car].profit += p.profit;
    carProfits[r.car].count += 1;
  });
  const topCars = Object.entries(carProfits).sort((a, b) => b[1].profit - a[1].profit).slice(0, 5);

  return (
    <div>
      <div style={{ ...labelStyle, marginBottom: 10 }}>Revenus 12 mois</div>
      <div style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: "16px 12px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 70 }}>
          {months.map((m, i) => {
            const h = Math.max((m.revenue / maxRevenue) * 60, 2);
            const isLast = i === months.length - 1;
            return (
              <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", height: h, background: isLast ? C.gold : C.gold + "33", borderRadius: "3px 3px 0 0" }} />
                <div style={{ fontSize: 7, color: isLast ? C.gold : C.muted, fontWeight: isLast ? 700 : 400 }}>{m.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ ...labelStyle, marginBottom: 10 }}>Meilleur mois</div>
      <div style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: "14px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: C.gold, fontWeight: 800, fontSize: 18, letterSpacing: "-0.3px" }}>{bestMonth?.label} {now.getFullYear()}</div>
          <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Meilleur bénéfice de l'année</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: C.green, fontWeight: 700, fontSize: 15 }}>{fmtAED(bestMonth?.profit)}</div>
        </div>
      </div>

      <div style={{ ...labelStyle, marginBottom: 10 }}>Voitures les plus rentables</div>
      {topCars.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: "20px 0", fontSize: 13 }}>Aucune donnée</div>}
      {topCars.map(([car, stats], i) => (
        <div key={car} style={{ background: C.card, border: `0.5px solid ${C.border}`, borderLeft: `1px solid ${getBrandColor(car)}44`, borderRadius: 14, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{i === 0 ? "🏆 " : ""}{car}</div>
            <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{stats.count} location{stats.count > 1 ? "s" : ""}</div>
          </div>
          <div style={{ color: stats.profit >= 0 ? C.green : C.red, fontWeight: 700, fontSize: 13 }}>{fmtAED(stats.profit)}</div>
        </div>
      ))}
    </div>
  );
}

// ─── CALENDAR VIEW ────────────────────────────────────────────────────────────
function CalendarView({ data }) {
  const [current, setCurrent] = useState(new Date());
  const [selected, setSelected] = useState(null);
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay + 6) % 7;
  const today = new Date().toISOString().slice(0, 10);

  function getRentalsForDay(day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return data.rentals.filter(r => r.startDate && r.endDate && dateStr >= r.startDate && dateStr <= r.endDate);
  }

  const cells = Array.from({ length: offset + daysInMonth }, (_, i) => i < offset ? null : i - offset + 1);
  const selectedRentals = selected ? getRentalsForDay(selected) : [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ color: C.gold, fontWeight: 700, fontSize: 15, textTransform: "capitalize", letterSpacing: "0.02em" }}>
          {current.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCurrent(new Date(year, month - 1, 1))} style={{ background: C.card, border: `0.5px solid ${C.borderLight}`, borderRadius: 8, color: C.text, padding: "6px 12px", cursor: "pointer" }}>‹</button>
          <button onClick={() => setCurrent(new Date(year, month + 1, 1))} style={{ background: C.card, border: `0.5px solid ${C.borderLight}`, borderRadius: 8, color: C.text, padding: "6px 12px", cursor: "pointer" }}>›</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"].map(d => <div key={d} style={{ ...labelStyle, textAlign: "center", padding: "4px 0" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 16 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const rentals = getRentalsForDay(day);
          const isToday = dateStr === today;
          const isSelected = selected === day;
          const colors = [...new Set(rentals.map(r => getBrandColor(r.car)))];
          return (
            <div key={i} onClick={() => setSelected(isSelected ? null : day)} style={{
              background: isSelected ? C.gold + "20" : isToday ? C.card : "transparent",
              border: `0.5px solid ${isToday ? C.gold + "60" : isSelected ? C.gold + "40" : "transparent"}`,
              borderRadius: 10, padding: "5px 3px", textAlign: "center", cursor: "pointer", minHeight: 38,
            }}>
              <div style={{ fontSize: 11, color: isToday ? C.gold : C.text, fontWeight: isToday ? 700 : 400, marginBottom: 3 }}>{day}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 2 }}>
                {colors.slice(0, 3).map((col, ci) => <div key={ci} style={{ width: 4, height: 4, borderRadius: "50%", background: col }} />)}
              </div>
            </div>
          );
        })}
      </div>
      {selected && (
        <div>
          <div style={{ ...labelStyle, marginBottom: 10 }}>
            {selected} {current.toLocaleDateString("fr-FR", { month: "long" })}
          </div>
          {selectedRentals.length === 0 ? <div style={{ color: C.muted, textAlign: "center", padding: "20px 0", fontSize: 13 }}>Aucune location ce jour</div> : selectedRentals.map(r => <RentalCard key={r.id} rental={r} />)}
        </div>
      )}
    </div>
  );
}

// ─── EXPORT VIEW ──────────────────────────────────────────────────────────────
function ExportView({ data }) {
  const [period, setPeriod] = useState("month");
  const [reportType, setReportType] = useState("financial");
  const [generating, setGenerating] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  function getDateRange() {
    const now = new Date();
    if (period === "custom" && customStart && customEnd) return { start: new Date(customStart), end: new Date(customEnd) };
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    let start;
    if (period === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === "quarter") start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    else if (period === "6months") start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    else start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return { start, end };
  }

  async function generatePDF() {
    setGenerating(true);
    const { start, end } = getDateRange();
    const rentals = data.rentals.filter(r => { if (!r.startDate) return false; const d = new Date(r.startDate); return d >= start && d <= end; });
    const revenue = rentals.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.revenue : 0); }, 0);
    const cost = rentals.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.cost : 0); }, 0);
    const profit = revenue - cost;
    const periodLabel = period === "custom" && customStart && customEnd ? `${customStart} to ${customEnd}` : { month: "Current Month", quarter: "Quarter", "6months": "6 Months", year: "12 Months" }[period] || "Custom";
    const reportTitle = reportType === "financial" ? "Financial Report" : reportType === "rentals" ? "Rental Report" : "Client Report";

    const { jsPDF } = await import("https://esm.sh/jspdf@2.5.1");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297, margin = 15;
    let y = 15;
    const gold = [212, 175, 106], dark = [20, 20, 28], muted = [80, 80, 100], green = [46, 204, 138], red = [224, 85, 85];

    doc.setFillColor(...gold);
    doc.rect(0, 0, W, 22, "F");
    doc.setTextColor(20, 20, 28);
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text(COMPANY.name, W / 2, 9, { align: "center" });
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`License No. ${COMPANY.license}  |  Register No. ${COMPANY.register}  |  Tel: ${COMPANY.phone}  |  Expiry: ${COMPANY.expiry}`, W / 2, 15, { align: "center" });
    doc.text(COMPANY.address, W / 2, 20, { align: "center" });

    y = 30;
    doc.setTextColor(...dark); doc.setFontSize(15); doc.setFont("helvetica", "bold");
    doc.text(reportTitle, margin, y); y += 7;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...muted);
    doc.text(`Period: ${periodLabel}  |  Generated: ${new Date().toLocaleDateString("en-GB")}`, margin, y); y += 10;

    if (reportType === "financial") {
      const boxes = [{ l: "Rentals", v: String(rentals.length), c: gold }, { l: "Gross Revenue", v: `${Math.round(revenue)} AED`, c: gold }, { l: "Net Profit", v: `${Math.round(profit)} AED`, c: profit >= 0 ? green : red }];
      const bw = (W - margin * 2 - 10) / 3;
      boxes.forEach((b, i) => {
        const x = margin + i * (bw + 5);
        doc.setFillColor(245, 242, 235); doc.setDrawColor(...b.c); doc.roundedRect(x, y, bw, 18, 3, 3, "FD");
        doc.setTextColor(...b.c); doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.text(b.v, x + bw / 2, y + 9, { align: "center" });
        doc.setTextColor(...muted); doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.text(b.l, x + bw / 2, y + 15, { align: "center" });
      });
      y += 25;

      doc.setFillColor(...gold); doc.rect(margin, y, W - margin * 2, 7, "F");
      doc.setTextColor(20, 20, 28); doc.setFontSize(8); doc.setFont("helvetica", "bold");
      const cols = ["Vehicle", "Client", "Start", "End", "Days", "Revenue", "Broker", "Profit"];
      const cw = [60, 45, 24, 24, 14, 30, 30, 30];
      let cx = margin + 2;
      cols.forEach((c, i) => { doc.text(c, cx, y + 5); cx += cw[i]; }); y += 8;

      rentals.forEach((r, ri) => {
        if (y > 185) { doc.addPage(); y = 15; }
        const p = calcProfit(r);
        if (ri % 2 === 0) { doc.setFillColor(250, 249, 245); doc.rect(margin, y - 1, W - margin * 2, 7, "F"); }
        doc.setTextColor(...dark); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        cx = margin + 2;
        const row = [(r.car || "—").slice(0, 22), (r.clientName || "—").slice(0, 18), fmtDate(r.startDate), fmtDate(r.endDate), p ? p.days.toFixed(0) : "—", p ? `${Math.round(p.revenue)} AED` : "—", p ? `${Math.round(p.cost)} AED` : "—", p ? `${Math.round(p.profit)} AED` : "—"];
        row.forEach((v, i) => {
          if (i === 7 && p) doc.setTextColor(...(p.profit >= 0 ? green : red));
          else doc.setTextColor(...dark);
          doc.text(String(v), cx, y + 4); cx += cw[i];
        }); y += 7;
      });

    } else if (reportType === "rentals") {
      doc.setFillColor(...gold); doc.rect(margin, y, W - margin * 2, 7, "F");
      doc.setTextColor(20, 20, 28); doc.setFontSize(8); doc.setFont("helvetica", "bold");
      const cols = ["Vehicle", "Client", "Phone", "License", "Passport", "Start", "End", "Price/day", "Payment"];
      const cw = [50, 38, 28, 24, 22, 22, 22, 20, 18];
      let cx = margin + 2;
      cols.forEach((c, i) => { doc.text(c, cx, y + 5); cx += cw[i]; }); y += 8;
      rentals.forEach((r, ri) => {
        if (y > 185) { doc.addPage(); y = 15; }
        if (ri % 2 === 0) { doc.setFillColor(250, 249, 245); doc.rect(margin, y - 1, W - margin * 2, 7, "F"); }
        doc.setTextColor(...dark); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        cx = margin + 2;
        const pay = r.paymentStatus === "paid" ? "Paid" : r.paymentStatus === "partial" ? "Deposit" : "Pending";
        const row = [(r.car || "—").slice(0, 20), (r.clientName || "—").slice(0, 16), r.clientPhone || "—", r.licenseRef || "—", r.passportRef || "—", fmtDate(r.startDate), fmtDate(r.endDate), r.pricePerDay ? `${r.pricePerDay} AED` : "—", pay];
        row.forEach((v, i) => { doc.text(String(v), cx, y + 4); cx += cw[i]; }); y += 7;
      });

    } else {
      data.clients.forEach(c => {
        const cr = data.rentals.filter(r => (r.clientId === c.id || r.clientName === c.name) && r.startDate && new Date(r.startDate) >= start && new Date(r.startDate) <= end);
        if (cr.length === 0) return;
        if (y > 175) { doc.addPage(); y = 15; }
        const tp = cr.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.profit : 0); }, 0);
        doc.setFillColor(...gold); doc.rect(margin, y, W - margin * 2, 7, "F");
        doc.setTextColor(20, 20, 28); doc.setFontSize(10); doc.setFont("helvetica", "bold");
        doc.text(`${c.name}${c.nationality ? " · " + c.nationality : ""}`, margin + 3, y + 5);
        doc.text(`Profit: ${Math.round(tp)} AED`, W - margin - 3, y + 5, { align: "right" });
        y += 9;
        cr.forEach((r, ri) => {
          if (y > 185) { doc.addPage(); y = 15; }
          const p = calcProfit(r);
          if (ri % 2 === 0) { doc.setFillColor(250, 249, 245); doc.rect(margin, y - 1, W - margin * 2, 6, "F"); }
          doc.setTextColor(...dark); doc.setFontSize(8); doc.setFont("helvetica", "normal");
          doc.text(`${r.car || "—"}`, margin + 2, y + 3);
          doc.text(`${fmtDate(r.startDate)} → ${fmtDate(r.endDate)}`, margin + 70, y + 3);
          if (p) { doc.setTextColor(...(p.profit >= 0 ? green : red)); doc.text(`${Math.round(p.profit)} AED`, W - margin - 2, y + 3, { align: "right" }); }
          y += 6;
        }); y += 6;
      });
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(...gold); doc.rect(0, 200, W, 10, "F");
      doc.setTextColor(20, 20, 28); doc.setFontSize(8);
      doc.text(`${COMPANY.name}  |  License No. ${COMPANY.license}  |  ${new Date().toLocaleDateString("en-GB")}  |  Page ${i}/${pageCount}`, W / 2, 206, { align: "center" });
    }
    doc.save(`newsloc-${reportType}-${period}-${new Date().toISOString().slice(0, 10)}.pdf`);
    setGenerating(false);
  }

  return (
    <div>
      <div style={{ ...labelStyle, marginBottom: 10 }}>Période</div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
        {[{ k: "month", l: "Ce mois" }, { k: "quarter", l: "Trimestre" }, { k: "6months", l: "6 mois" }, { k: "year", l: "12 mois" }, { k: "custom", l: "Personnalisé" }].map(p => (
          <button key={p.k} onClick={() => setPeriod(p.k)} style={{ padding: "7px 14px", borderRadius: 20, border: `0.5px solid ${period === p.k ? C.gold : C.borderLight}`, cursor: "pointer", background: period === p.k ? C.gold + "18" : "transparent", color: period === p.k ? C.gold : C.muted, fontWeight: 600, fontSize: 11, letterSpacing: "0.03em" }}>{p.l}</button>
        ))}
      </div>
      {period === "custom" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <input type="date" style={{ ...inputStyle, flex: 1 }} value={customStart} onChange={e => setCustomStart(e.target.value)} />
          <span style={{ color: C.muted }}>→</span>
          <input type="date" style={{ ...inputStyle, flex: 1 }} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
        </div>
      )}

      <div style={{ ...labelStyle, marginBottom: 10 }}>Type de rapport</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {[{ k: "financial", l: "Bilan financier", d: "Revenus, coûts, bénéfice net", icon: "📊" }, { k: "rentals", l: "Toutes les locations", d: "Liste complète avec détails clients", icon: "🚗" }, { k: "clients", l: "Par client", d: "Historique et stats par client", icon: "👤" }].map(t => (
          <div key={t.k} onClick={() => setReportType(t.k)} style={{ background: C.card, border: `0.5px solid ${reportType === t.k ? C.gold + "60" : C.border}`, borderRadius: 14, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <div>
              <div style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{t.l}</div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{t.d}</div>
            </div>
            {reportType === t.k && <div style={{ marginLeft: "auto", color: C.gold, fontSize: 16 }}>✓</div>}
          </div>
        ))}
      </div>

      <button onClick={generatePDF} disabled={generating} style={{ ...btnPrimary, opacity: generating ? 0.7 : 1 }}>
        {generating ? "Génération..." : "📄 Générer le PDF"}
      </button>
    </div>
  );
}

// ─── NAV + APP ROOT ───────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", icon: "◈", label: "Accueil" },
  { id: "rentals", icon: "🚗", label: "Locations" },
  { id: "analytics", icon: "📊", label: "Stats" },
  { id: "calendar", icon: "📅", label: "Agenda" },
  { id: "clients", icon: "👤", label: "Clients" },
  { id: "export", icon: "📄", label: "Export" },
];

export default function App() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [tab, setTab] = useState("dashboard");
  const [syncStatus, setSyncStatus] = useState("idle");
  const saveTimer = useRef(null);

  useEffect(() => {
    const local = loadLocal();
    if (local) setData(local);
    const fetchRemote = () => {
      supabase.from("nld_data").select("data").eq("id", DB_KEY).single()
        .then(({ data: row }) => { if (row?.data) { setData(row.data); saveLocal(row.data); } });
    };
    fetchRemote();
    const interval = setInterval(fetchRemote, 10000);
    return () => clearInterval(interval);
  }, []);

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

  function update(newData) { setData(newData); persist(newData); }

  const syncColor = { idle: C.muted, saving: C.gold, saved: C.green, error: C.red };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "Inter, -apple-system, sans-serif", maxWidth: 540, margin: "0 auto", paddingBottom: 80 }}>

      {/* HEADER */}
      <div style={{ background: C.surface, borderBottom: `0.5px solid ${C.border}`, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ padding: "16px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, color: C.goldDim, fontWeight: 700, letterSpacing: "0.25em", marginBottom: 3 }}>NEWS LOC DUBAI</div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em" }}>Tableau de bord</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: syncColor[syncStatus] }} />
              <span style={{ fontSize: 9, color: syncColor[syncStatus], letterSpacing: "0.08em" }}>
                {syncStatus === "saving" ? "SYNC..." : syncStatus === "error" ? "ERREUR" : "LIVE"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: "20px 16px" }}>
        {tab === "dashboard" && <Dashboard data={data} onUpdate={update} />}
        {tab === "rentals" && <RentalsView data={data} onUpdate={update} />}
        {tab === "analytics" && <AnalyticsView data={data} />}
        {tab === "calendar" && <CalendarView data={data} />}
        {tab === "clients" && <ClientsView data={data} onUpdate={update} />}
        {tab === "accounting" && <AccountingView data={data} onUpdate={update} />}
        {tab === "export" && <ExportView data={data} />}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 540, background: C.surface, borderTop: `0.5px solid ${C.border}`, display: "flex" }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, padding: "10px 0 16px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, position: "relative" }}>
            <span style={{ fontSize: 16 }}>{n.icon}</span>
            <span style={{ fontSize: 7, fontWeight: 600, color: tab === n.id ? C.gold : C.muted, letterSpacing: "0.08em" }}>{n.label.toUpperCase()}</span>
            {tab === n.id && <div style={{ width: 16, height: 1.5, background: C.gold, borderRadius: 1, position: "absolute", bottom: 8 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}
