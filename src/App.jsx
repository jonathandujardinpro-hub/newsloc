import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";

const C = {
  bg: "#0A0A0F", surface: "#12121A", card: "#1A1A26", border: "#2A2A3A",
  gold: "#C9A84C", goldLight: "#E8C97A", goldDim: "#7A6230",
  text: "#F0EDE8", muted: "#7A7A9A", green: "#2ECC8A",
  red: "#E05555", blue: "#5B8DEF", orange: "#E8894A",
};

const CAR_BRANDS = {
  Lamborghini: { models: ["Urus", "STO", "Huracán"], color: "#B8952A" },
  Mercedes:    { models: ["Classe G", "GT 63", "GT 63 S"], color: "#7A9EBF" },
  Ferrari:     { models: ["F8", "F8 Tributo"], color: "#CC3333" },
  Porsche:     { models: ["911", "911 GTS", "GT3 RS"], color: "#2E7D52" },
  "Rolls-Royce": { models: ["Cullinan", "Phantom"], color: "#7B5EA7" },
  "Range Rover": { models: ["SVR", "Vogue"], color: "#2E6B4F" },
  Autre: { models: [], color: "#7A7A9A" },
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
  type: "Limited Liability Company - Single Owner",
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
  return Number(n).toLocaleString("fr-FR") + " AED";
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
const LS_KEY = "nld_data_v3";

function loadLocal() {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveLocal(d) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {}
}

const DEFAULT_DATA = { rentals: [], clients: [], expenses: [], settlements: [] };

const inputStyle = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 10, color: C.text, padding: "11px 14px",
  fontSize: 15, width: "100%", boxSizing: "border-box", outline: "none",
};
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
const btnSecondary = {
  background: "transparent", border: `1px solid ${C.border}`,
  borderRadius: 12, color: C.text,
  padding: "12px", fontSize: 14, fontWeight: 600,
  cursor: "pointer", width: "100%", marginTop: 4,
};

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 540, maxHeight: "90vh", overflow: "auto", padding: "24px 20px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ color: C.gold, fontWeight: 700, fontSize: 18 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

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
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Object.entries(CAR_BRANDS).map(([b, { color }]) => {
          const active = brand === b;
          return (
            <button key={b} onClick={() => { setBrand(b); setModel(""); setCustom(""); update(b, "", ""); }} style={{
              padding: "6px 14px", borderRadius: 20, border: `2px solid ${active ? color : "transparent"}`,
              cursor: "pointer", fontWeight: 700, fontSize: 13,
              background: active ? color + "33" : C.border,
              color: active ? color : C.muted,
            }}>{b}</button>
          );
        })}
      </div>
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
        <input style={inputStyle} placeholder="Modèle (ex: McLaren 720S)" value={custom}
          onChange={e => { setCustom(e.target.value); update("Autre", "", e.target.value); }} />
      )}
      {value && (
        <div style={{ padding: "8px 12px", borderRadius: 10, background: (CAR_BRANDS[brand]?.color || C.muted) + "22", borderLeft: `3px solid ${CAR_BRANDS[brand]?.color || C.muted}`, color: CAR_BRANDS[brand]?.color || C.muted, fontSize: 14, fontWeight: 700 }}>
          🚗 {value}
        </div>
      )}
    </div>
  );
}

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={labelStyle}>Véhicule</label>
      <CarSelector value={form.car} onChange={v => set("car", v)} />

      <label style={labelStyle}>Client</label>
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
      <input style={inputStyle} placeholder="Téléphone (optionnel)" value={form.clientPhone || ""} onChange={e => set("clientPhone", e.target.value)} />

      <label style={labelStyle}>Documents (optionnels)</label>
      <input style={inputStyle} placeholder="N° Permis de conduire" value={form.licenseRef || ""} onChange={e => set("licenseRef", e.target.value)} />
      <input style={inputStyle} placeholder="N° Passeport" value={form.passportRef || ""} onChange={e => set("passportRef", e.target.value)} />

      <label style={labelStyle}>Début de location</label>
      <input type="date" style={inputStyle} value={form.startDate}
        onChange={e => { set("startDate", e.target.value); applyDuration(form.durationPreset, e.target.value); }} />

      <label style={labelStyle}>Durée</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {DURATIONS.map(d => (
          <button key={d.label} onClick={() => { set("durationPreset", d.label); applyDuration(d.label, null); }} style={{
            padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
            background: form.durationPreset === d.label ? C.gold : C.border,
            color: form.durationPreset === d.label ? C.bg : C.text,
            fontWeight: 600, fontSize: 13,
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

      <label style={labelStyle}>Fin de location</label>
      <input type="date" style={inputStyle} value={form.endDate} onChange={e => set("endDate", e.target.value)} />

      <label style={labelStyle}>Prix de vente / jour (AED)</label>
      <input type="number" style={inputStyle} placeholder="ex: 2500" value={form.pricePerDay} onChange={e => set("pricePerDay", e.target.value)} />

      <label style={labelStyle}>Prix d'achat broker / jour (AED)</label>
      <input type="number" style={inputStyle} placeholder="ex: 1800" value={form.costBroker} onChange={e => set("costBroker", e.target.value)} />

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input type="checkbox" checked={form.deposit} onChange={e => set("deposit", e.target.checked)} style={{ width: 18, height: 18, accentColor: C.gold }} />
        <span style={{ color: C.text }}>Caution encaissée</span>
      </div>
      {form.deposit && (
        <input type="number" style={inputStyle} placeholder="Montant caution (AED)" value={form.depositAmount} onChange={e => set("depositAmount", e.target.value)} />
      )}

      <label style={labelStyle}>Statut paiement</label>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ k: "pending", l: "En attente", c: C.orange }, { k: "partial", l: "Acompte", c: C.blue }, { k: "paid", l: "Payé", c: C.green }].map(s => (
          <button key={s.k} onClick={() => set("paymentStatus", s.k)} style={{
            flex: 1, padding: "8px 4px", borderRadius: 10, border: `2px solid ${form.paymentStatus === s.k ? s.c : C.border}`,
            cursor: "pointer", fontWeight: 600, fontSize: 12,
            background: form.paymentStatus === s.k ? s.c + "22" : C.surface,
            color: form.paymentStatus === s.k ? s.c : C.muted,
          }}>{s.l}</button>
        ))}
      </div>

      <label style={labelStyle}>Encaissé par *</label>
      <div style={{ display: "flex", gap: 8 }}>
        {["JDJ", "NEWLOC"].map(p => (
          <button key={p} onClick={() => set("collectedBy", p)} style={{
            flex: 1, padding: "12px", borderRadius: 10,
            border: `2px solid ${form.collectedBy === p ? C.gold : C.border}`,
            cursor: "pointer", fontWeight: 800, fontSize: 15,
            background: form.collectedBy === p ? C.gold + "22" : C.surface,
            color: form.collectedBy === p ? C.gold : C.muted,
          }}>{p}</button>
        ))}
      </div>
      {!form.collectedBy && <div style={{ color: C.red, fontSize: 12 }}>* Obligatoire</div>}

      <label style={labelStyle}>Notes</label>
      <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} placeholder="Infos complémentaires..." value={form.notes} onChange={e => set("notes", e.target.value)} />

      {form.startDate && form.endDate && form.pricePerDay && (() => {
        const ms = new Date(form.endDate) - new Date(form.startDate);
        const days = ms / (1000 * 60 * 60 * 24);
        const revenue = parseFloat(form.pricePerDay) * days;
        const cost = (parseFloat(form.costBroker) || 0) * days;
        const profit = revenue - cost;
        return (
          <div style={{ background: C.surface, border: `1px solid ${C.gold}44`, borderRadius: 12, padding: "14px 16px", borderLeft: `3px solid ${C.gold}` }}>
            <div style={{ color: C.gold, fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: 1 }}>RÉCAP AUTOMATIQUE</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><div style={{ color: C.muted, fontSize: 11 }}>Durée</div><div style={{ color: C.text, fontWeight: 600 }}>{days.toFixed(0)} jour{days > 1 ? "s" : ""}</div></div>
              <div><div style={{ color: C.muted, fontSize: 11 }}>Prix/jour</div><div style={{ color: C.text, fontWeight: 600 }}>{fmtAED(form.pricePerDay)}</div></div>
              <div><div style={{ color: C.muted, fontSize: 11 }}>Revenu total</div><div style={{ color: C.gold, fontWeight: 700 }}>{fmtAED(revenue)}</div></div>
              <div><div style={{ color: C.muted, fontSize: 11 }}>Coût broker</div><div style={{ color: C.orange, fontWeight: 600 }}>{cost ? fmtAED(cost) : "—"}</div></div>
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: C.muted, fontSize: 12 }}>Bénéfice net</span>
              <span style={{ color: profit >= 0 ? C.green : C.red, fontWeight: 800, fontSize: 18 }}>{fmtAED(profit)}</span>
            </div>
          </div>
        );
      })()}

      <button onClick={() => { if (!form.collectedBy) { alert("Veuillez choisir qui a encaissé."); return; } onSave(form); }} style={btnPrimary}>
        {initial ? "Mettre à jour" : "Créer la location"}
      </button>
      {initial && !initial.closed && (
        <button onClick={() => { if (!form.collectedBy) { alert("Veuillez choisir qui a encaissé."); return; } onSave({ ...form, closed: true }); }} style={{ ...btnSecondary, borderColor: C.green, color: C.green }}>
          ✓ Clôturer la location
        </button>
      )}
      {initial && <button onClick={() => onDelete(initial.id)} style={btnDanger}>Supprimer</button>}
    </div>
  );
}

function RentalCard({ rental, onClick }) {
  const status = getRentalStatus(rental);
  const profit = calcProfit(rental);
  const brandColor = getBrandColor(rental.car);
  const statusColor = STATUS_COLORS[status];
  return (
    <div onClick={onClick} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: onClick ? "pointer" : "default", borderLeft: `3px solid ${brandColor}`, opacity: status === "ended" ? 0.7 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>{rental.car || "—"}</div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{rental.clientName || "—"}</div>
        </div>
        <div style={{ background: statusColor + "22", color: statusColor, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{STATUS_LABELS[status]}</div>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
        <div><div style={{ color: C.muted, fontSize: 10 }}>Départ</div><div style={{ color: C.text, fontSize: 12 }}>{fmtDate(rental.startDate)}</div></div>
        <div><div style={{ color: C.muted, fontSize: 10 }}>Retour</div><div style={{ color: C.text, fontSize: 12 }}>{fmtDate(rental.endDate)}</div></div>
        {profit && <div><div style={{ color: C.muted, fontSize: 10 }}>Bénéfice</div><div style={{ color: profit.profit >= 0 ? C.green : C.red, fontSize: 12, fontWeight: 700 }}>{fmtAED(profit.profit)}</div></div>}
        {rental.collectedBy && <div style={{ background: C.gold + "22", color: C.gold, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{rental.collectedBy}</div>}
        {rental.paymentStatus && (() => {
          const map = { pending: [C.orange, "En attente"], partial: [C.blue, "Acompte"], paid: [C.green, "Payé"] };
          const [col, lbl] = map[rental.paymentStatus] || [C.muted, ""];
          return <div style={{ background: col + "22", color: col, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>{lbl}</div>;
        })()}
      </div>
    </div>
  );
}

function ExpenseForm({ initial, onSave, onDelete }) {
  const [form, setForm] = useState(initial || { label: "", amount: "", date: new Date().toISOString().slice(0, 10), category: "Entretien" });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={labelStyle}>Libellé</label>
      <input style={inputStyle} placeholder="ex: Réparation" value={form.label} onChange={e => set("label", e.target.value)} />
      <label style={labelStyle}>Montant (AED)</label>
      <input type="number" style={inputStyle} value={form.amount} onChange={e => set("amount", e.target.value)} />
      <label style={labelStyle}>Date</label>
      <input type="date" style={inputStyle} value={form.date} onChange={e => set("date", e.target.value)} />
      <label style={labelStyle}>Catégorie</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["Broker", "Carburant", "Assurance", "Autre"].map(c => (
          <button key={c} onClick={() => set("category", c)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", background: form.category === c ? C.gold : C.border, color: form.category === c ? C.bg : C.text, fontWeight: 600, fontSize: 13 }}>{c}</button>
        ))}
      </div>
      <button onClick={() => onSave(form)} style={btnPrimary}>{initial ? "Mettre à jour" : "Ajouter"}</button>
      {initial && <button onClick={() => onDelete(initial.id)} style={btnDanger}>Supprimer</button>}
    </div>
  );
}

function ClientForm({ initial, onSave, onDelete }) {
  const [form, setForm] = useState(initial || { name: "", phone: "", nationality: "", licenseRef: "", passportRef: "", notes: "", vip: false, blacklist: false });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={labelStyle}>Nom complet *</label>
      <input style={inputStyle} placeholder="Prénom Nom" value={form.name} onChange={e => set("name", e.target.value)} />
      <label style={labelStyle}>Téléphone</label>
      <input style={inputStyle} placeholder="+971 50 000 0000" value={form.phone || ""} onChange={e => set("phone", e.target.value)} />
      <label style={labelStyle}>Nationalité</label>
      <input style={inputStyle} placeholder="ex: Français, Émirati..." value={form.nationality || ""} onChange={e => set("nationality", e.target.value)} />
      <label style={labelStyle}>N° Permis de conduire</label>
      <input style={inputStyle} placeholder="ex: 123456789" value={form.licenseRef || ""} onChange={e => set("licenseRef", e.target.value)} />
      <label style={labelStyle}>N° Passeport</label>
      <input style={inputStyle} placeholder="ex: AB1234567" value={form.passportRef || ""} onChange={e => set("passportRef", e.target.value)} />
      <label style={labelStyle}>Notes internes</label>
      <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} placeholder="ex: Paye cash, client régulier..." value={form.notes || ""} onChange={e => set("notes", e.target.value)} />
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => set("vip", !form.vip)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `2px solid ${form.vip ? C.gold : C.border}`, background: form.vip ? C.gold + "22" : C.surface, color: form.vip ? C.gold : C.muted, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>⭐ VIP</button>
        <button onClick={() => set("blacklist", !form.blacklist)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `2px solid ${form.blacklist ? C.red : C.border}`, background: form.blacklist ? C.red + "22" : C.surface, color: form.blacklist ? C.red : C.muted, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>🚫 Blacklist</button>
      </div>
      <button onClick={() => onSave(form)} style={btnPrimary}>{initial ? "Mettre à jour" : "Créer le client"}</button>
      {initial && <button onClick={() => onDelete(initial.id)} style={btnDanger}>Supprimer</button>}
    </div>
  );
}

function ClientProfile({ client, rentals, onEdit, onClose }) {
  const cr = rentals.filter(r => r.clientId === client.id || r.clientName === client.name);
  const totalProfit = cr.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.profit : 0); }, 0);
  const carCount = {};
  cr.forEach(r => { if (r.car) carCount[r.car] = (carCount[r.car] || 0) + 1; });
  const favCar = Object.entries(carCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  return (
    <div>
      <button onClick={onClose} style={{ background: "none", border: "none", color: C.gold, cursor: "pointer", marginBottom: 16, fontSize: 14 }}>← Retour</button>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 20 }}>{client.name}</div>
              {client.vip && <span>⭐</span>}
              {client.blacklist && <span>🚫</span>}
            </div>
            {client.nationality && <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{client.nationality}</div>}
            {client.phone && <div style={{ color: C.blue, fontSize: 13, marginTop: 4 }}>📞 {client.phone}</div>}
          </div>
          <button onClick={onEdit} style={{ background: C.border, border: "none", borderRadius: 8, color: C.text, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>Modifier</button>
        </div>
        {(client.licenseRef || client.passportRef) && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {client.licenseRef && <div style={{ background: C.surface, borderRadius: 8, padding: "6px 10px" }}><div style={{ color: C.muted, fontSize: 10 }}>PERMIS</div><div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{client.licenseRef}</div></div>}
            {client.passportRef && <div style={{ background: C.surface, borderRadius: 8, padding: "6px 10px" }}><div style={{ color: C.muted, fontSize: 10 }}>PASSEPORT</div><div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{client.passportRef}</div></div>}
          </div>
        )}
        {client.notes && <div style={{ marginTop: 10, padding: "8px 10px", background: C.surface, borderRadius: 8, color: C.muted, fontSize: 13, fontStyle: "italic" }}>"{client.notes}"</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}><div style={{ color: C.gold, fontWeight: 800, fontSize: 20 }}>{cr.length}</div><div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>Locations</div></div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}><div style={{ color: C.green, fontWeight: 700, fontSize: 12 }}>{fmtAED(totalProfit)}</div><div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>Bénéfice</div></div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}><div style={{ color: C.text, fontWeight: 600, fontSize: 11 }}>{favCar ? favCar.split(" ").slice(-1)[0] : "—"}</div><div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>Voiture fav.</div></div>
      </div>
      <div style={{ color: C.gold, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 10 }}>HISTORIQUE</div>
      {cr.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: "20px 0" }}>Aucune location</div>}
      {cr.sort((a, b) => new Date(b.startDate) - new Date(a.startDate)).map(r => {
        const p = calcProfit(r);
        const status = getRentalStatus(r);
        return (
          <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${getBrandColor(r.car)}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ color: C.text, fontWeight: 600 }}>{r.car}</div>
              <div style={{ color: STATUS_COLORS[status], fontSize: 11, fontWeight: 600 }}>{STATUS_LABELS[status]}</div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
              <div style={{ color: C.muted, fontSize: 12 }}>{fmtDate(r.startDate)} → {fmtDate(r.endDate)}</div>
              {p && <div style={{ color: p.profit >= 0 ? C.green : C.red, fontSize: 12, fontWeight: 700 }}>{fmtAED(p.profit)}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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

  const debtor = netBalance > 0 ? "NEWLOC" : "JDJ";
  const creditor = netBalance > 0 ? "JDJ" : "NEWLOC";
  const absNet = Math.abs(netBalance);
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
      <div style={{ background: C.card, border: `1px solid ${absNet < 1 ? C.green : color}44`, borderRadius: 16, padding: "16px", marginBottom: 20, borderLeft: `3px solid ${absNet < 1 ? C.green : color}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ color: C.gold, fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>BALANCE</div>
          {absNet >= 1 && <button onClick={() => setShowSettle(true)} style={{ background: C.gold, border: "none", borderRadius: 8, color: C.bg, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💸 Régler</button>}
        </div>
        {absNet < 1 ? (
          <div style={{ color: C.green, fontWeight: 700, fontSize: 15, textAlign: "center" }}>✓ Vous êtes quittes</div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: C.muted, fontSize: 12 }}>{debtor} doit à {creditor}</div>
              <div style={{ color, fontWeight: 800, fontSize: 22 }}>{fmtAED(absNet)}</div>
            </div>
            <div style={{ fontSize: 28 }}>→</div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: C.gold, fontWeight: 800, fontSize: 18 }}>{creditor}</div>
            </div>
          </div>
        )}
        {(data.settlements || []).length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
            <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>HISTORIQUE RÈGLEMENTS</div>
            {(data.settlements || []).slice().reverse().map(s => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ color: C.muted, fontSize: 12 }}>{s.from} → {s.to} · {fmtDate(s.date)}</div>
                <div style={{ color: C.green, fontSize: 12, fontWeight: 700 }}>{fmtAED(s.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showSettle && (
        <Modal title="Enregistrer un règlement" onClose={() => setShowSettle(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={labelStyle}>Qui a payé ?</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["JDJ", "NEWLOC"].map(p => (
                <button key={p} onClick={() => setPaidBy(p)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `2px solid ${paidBy === p ? C.gold : C.border}`, background: paidBy === p ? C.gold + "22" : C.surface, color: paidBy === p ? C.gold : C.muted, cursor: "pointer", fontWeight: 800, fontSize: 15 }}>{p}</button>
              ))}
            </div>
            <label style={labelStyle}>Montant (AED)</label>
            <input type="number" style={inputStyle} placeholder={`Max: ${absNet.toFixed(0)} AED`} value={amount} onChange={e => setAmount(e.target.value)} />
            <button onClick={saveSettlement} style={btnPrimary}>Confirmer le règlement</button>
          </div>
        </Modal>
      )}
    </>
  );
}

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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {[
          { label: "En cours", value: active.length + overdue.length, color: C.green, icon: "🚗" },
          { label: "À venir", value: upcoming.length, color: C.blue, icon: "📅" },
          { label: "Revenus du mois", value: fmtAED(monthRevenue), color: C.gold, icon: "💰" },
          { label: "Bénéfice net", value: fmtAED(monthProfit), color: monthProfit >= 0 ? C.green : C.red, icon: "📊" },
        ].map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 14px" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ color: s.color, fontSize: 20, fontWeight: 700 }}>{s.value}</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <BalanceCard data={data} onUpdate={onUpdate} />
      {overdue.length > 0 && <><div style={{ color: C.red, fontWeight: 700, marginBottom: 10, fontSize: 13, letterSpacing: 1 }}>⚠ EN RETARD</div>{overdue.map(r => <RentalCard key={r.id} rental={r} />)}</>}
      {active.length > 0 && <><div style={{ color: C.green, fontWeight: 700, margin: "8px 0 10px", fontSize: 13, letterSpacing: 1 }}>EN COURS</div>{active.map(r => <RentalCard key={r.id} rental={r} />)}</>}
      {upcoming.length > 0 && <><div style={{ color: C.blue, fontWeight: 700, margin: "16px 0 10px", fontSize: 13, letterSpacing: 1 }}>À VENIR</div>{upcoming.map(r => <RentalCard key={r.id} rental={r} />)}</>}
      {active.length === 0 && upcoming.length === 0 && overdue.length === 0 && (
        <div style={{ textAlign: "center", color: C.muted, padding: "40px 0" }}>Aucune location active.<br />Appuie sur + pour en créer une.</div>
      )}
    </div>
  );
}

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
      else {
        const nc = { id: uid(), name: form.clientName, phone: form.clientPhone || "", licenseRef: form.licenseRef || "", passportRef: form.passportRef || "" };
        newClients = [...data.clients, nc];
        form.clientId = nc.id;
      }
    }
    const rentals = editing ? data.rentals.map(r => r.id === editing.id ? { ...form, id: r.id } : r) : [...data.rentals, { ...form, id: uid() }];
    onUpdate({ ...data, rentals, clients: newClients });
    setShowForm(false); setEditing(null);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {[{ k: "all", l: "Toutes" }, { k: "active", l: "En cours" }, { k: "overdue", l: "En retard" }, { k: "upcoming", l: "À venir" }, { k: "ended", l: "Terminées" }].map(t => (
          <button key={t.k} onClick={() => setFilter(t.k)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", background: filter === t.k ? C.gold : C.border, color: filter === t.k ? C.bg : C.text, fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{t.l}</button>
        ))}
      </div>
      {filtered.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: "40px 0" }}>Aucune location</div>}
      {filtered.map(r => <RentalCard key={r.id} rental={r} onClick={() => { setEditing(r); setShowForm(true); }} />)}
      <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ ...btnPrimary, position: "fixed", bottom: 90, right: 20, width: 56, height: 56, borderRadius: "50%", fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, boxShadow: `0 4px 20px ${C.gold}55` }}>+</button>
      {showForm && (
        <Modal title={editing ? "Modifier la location" : "Nouvelle location"} onClose={() => { setShowForm(false); setEditing(null); }}>
          <RentalForm initial={editing} onSave={saveRental} onDelete={id => { onUpdate({ ...data, rentals: data.rentals.filter(r => r.id !== id) }); setShowForm(false); setEditing(null); }} clients={data.clients} />
        </Modal>
      )}
    </div>
  );
}

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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[{ l: "Revenus", v: revenue, c: C.gold }, { l: "Coût brokers", v: brokerCost, c: C.orange }, { l: "Dépenses", v: expenseTotal, c: C.red }, { l: "Bénéfice net", v: profit, c: profit >= 0 ? C.green : C.red }].map(s => (
          <div key={s.l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 12px" }}>
            <div style={{ color: s.c, fontWeight: 700, fontSize: 18 }}>{fmtAED(s.v)}</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ color: C.gold, fontWeight: 700, marginBottom: 10, fontSize: 12, letterSpacing: 1 }}>LOCATIONS ({monthRentals.length})</div>
      {monthRentals.map(r => {
        const p = calcProfit(r);
        return (
          <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
            <div><div style={{ color: C.text, fontWeight: 600 }}>{r.car}</div><div style={{ color: C.muted, fontSize: 12 }}>{r.clientName} · {p ? p.days.toFixed(0) + "j" : "—"}</div></div>
            {p && <div style={{ textAlign: "right" }}><div style={{ color: C.gold, fontSize: 14 }}>{fmtAED(p.revenue)}</div><div style={{ color: p.profit >= 0 ? C.green : C.red, fontSize: 12 }}>{fmtAED(p.profit)}</div></div>}
          </div>
        );
      })}
      <div style={{ color: C.muted, fontWeight: 700, margin: "16px 0 10px", fontSize: 12, letterSpacing: 1 }}>DÉPENSES</div>
      {expenses.map(e => (
        <div key={e.id} onClick={() => { setEditing(e); setShowForm(true); }} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
          <div><div style={{ color: C.text }}>{e.label}</div><div style={{ color: C.muted, fontSize: 12 }}>{e.category} · {fmtDate(e.date)}</div></div>
          <div style={{ color: C.red, fontWeight: 700 }}>{fmtAED(e.amount)}</div>
        </div>
      ))}
      {expenses.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: "20px 0" }}>Aucune dépense ce mois</div>}
      <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ ...btnPrimary, position: "fixed", bottom: 90, right: 20, width: 56, height: 56, borderRadius: "50%", fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, boxShadow: `0 4px 20px ${C.gold}55` }}>+</button>
      {showForm && (
        <Modal title={editing ? "Modifier" : "Nouvelle dépense"} onClose={() => { setShowForm(false); setEditing(null); }}>
          <ExpenseForm initial={editing} onSave={saveExpense} onDelete={id => { onUpdate({ ...data, expenses: data.expenses.filter(e => e.id !== id) }); setShowForm(false); setEditing(null); }} />
        </Modal>
      )}
    </div>
  );
}

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
      {data.clients.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: "40px 0" }}>Aucun client.<br />Ils apparaissent automatiquement lors d'une location.</div>}
      {data.clients.map(c => {
        const cr = data.rentals.filter(r => r.clientId === c.id || r.clientName === c.name);
        const totalProfit = cr.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.profit : 0); }, 0);
        return (
          <div key={c.id} onClick={() => setProfile(c.id)} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${c.vip ? C.gold : c.blacklist ? C.red : C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                  {c.vip && <span>⭐</span>}
                  {c.blacklist && <span>🚫</span>}
                </div>
                <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{cr.length} location{cr.length > 1 ? "s" : ""}{c.nationality ? ` · ${c.nationality}` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}><div style={{ color: C.gold, fontWeight: 700, fontSize: 14 }}>{fmtAED(totalProfit)}</div><div style={{ color: C.muted, fontSize: 10 }}>bénéfice total</div></div>
            </div>
          </div>
        );
      })}
      <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ ...btnPrimary, position: "fixed", bottom: 90, right: 20, width: 56, height: 56, borderRadius: "50%", fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, boxShadow: `0 4px 20px ${C.gold}55` }}>+</button>
      {showForm && (
        <Modal title={editing ? "Modifier le client" : "Nouveau client"} onClose={() => { setShowForm(false); setEditing(null); setProfile(null); }}>
          <ClientForm initial={editing} onSave={saveClient} onDelete={id => { onUpdate({ ...data, clients: data.clients.filter(c => c.id !== id) }); setShowForm(false); setEditing(null); }} />
        </Modal>
      )}
    </div>
  );
}

function AnalyticsView({ data }) {
  const months = [];
  const now = new Date();
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
      <div style={{ color: C.gold, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 10 }}>REVENUS 12 MOIS</div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 12px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
          {months.map((m, i) => {
            const h = Math.max((m.revenue / maxRevenue) * 70, 2);
            const isLast = i === months.length - 1;
            return (
              <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: "100%", height: h, background: isLast ? C.gold : C.gold + "55", borderRadius: "3px 3px 0 0" }} />
                <div style={{ fontSize: 8, color: isLast ? C.gold : C.muted, fontWeight: isLast ? 700 : 400 }}>{m.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ color: C.gold, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 10 }}>MEILLEUR MOIS</div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: C.gold, fontWeight: 800, fontSize: 18 }}>{bestMonth?.label} {now.getFullYear()}</div>
          <div style={{ color: C.muted, fontSize: 12 }}>Meilleur bénéfice</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: C.green, fontWeight: 700, fontSize: 16 }}>{fmtAED(bestMonth?.profit)}</div>
          <div style={{ color: C.muted, fontSize: 11 }}>bénéfice net</div>
        </div>
      </div>

      <div style={{ color: C.gold, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 10 }}>VOITURES LES PLUS RENTABLES</div>
      {topCars.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: "20px 0" }}>Aucune donnée</div>}
      {topCars.map(([car, stats], i) => (
        <div key={car} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${getBrandColor(car)}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{i === 0 ? "🏆 " : ""}{car}</div>
            <div style={{ color: C.muted, fontSize: 12 }}>{stats.count} location{stats.count > 1 ? "s" : ""}</div>
          </div>
          <div style={{ color: stats.profit >= 0 ? C.green : C.red, fontWeight: 700, fontSize: 14 }}>{fmtAED(stats.profit)}</div>
        </div>
      ))}
    </div>
  );
}

function CalendarView({ data, onRentalClick }) {
  const [current, setCurrent] = useState(new Date());
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay + 6) % 7;
  const today = new Date().toISOString().slice(0, 10);

  function getRentalsForDay(day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return data.rentals.filter(r => {
      if (!r.startDate || !r.endDate) return false;
      return dateStr >= r.startDate && dateStr <= r.endDate;
    });
  }

  const monthStr = current.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const cells = Array.from({ length: offset + daysInMonth }, (_, i) => i < offset ? null : i - offset + 1);

  const [selected, setSelected] = useState(null);
  const selectedRentals = selected ? getRentalsForDay(selected) : [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ color: C.gold, fontWeight: 700, fontSize: 16, textTransform: "capitalize" }}>{monthStr}</span>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setCurrent(new Date(year, month - 1, 1))} style={{ background: C.border, border: "none", borderRadius: 8, color: C.text, padding: "6px 12px", cursor: "pointer", fontSize: 16 }}>‹</button>
          <button onClick={() => setCurrent(new Date(year, month + 1, 1))} style={{ background: C.border, border: "none", borderRadius: 8, color: C.text, padding: "6px 12px", cursor: "pointer", fontSize: 16 }}>›</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"].map(d => (
          <div key={d} style={{ color: C.muted, fontSize: 11, textAlign: "center", padding: "4px 0", fontWeight: 600 }}>{d}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 16 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const rentals = getRentalsForDay(day);
          const isToday = dateStr === today;
          const isSelected = selected === day;
          const colors = [...new Set(rentals.map(r => getBrandColor(r.car)))];

          return (
            <div key={i} onClick={() => setSelected(isSelected ? null : day)} style={{
              background: isSelected ? C.gold + "33" : isToday ? C.surface : "transparent",
              border: isToday ? `1px solid ${C.gold}` : `1px solid transparent`,
              borderRadius: 8, padding: "4px 2px", textAlign: "center", cursor: "pointer", minHeight: 36,
            }}>
              <div style={{ fontSize: 12, color: isToday ? C.gold : C.text, fontWeight: isToday ? 700 : 400, marginBottom: 2 }}>{day}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 2, flexWrap: "wrap" }}>
                {colors.slice(0, 3).map((col, ci) => (
                  <div key={ci} style={{ width: 5, height: 5, borderRadius: "50%", background: col }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div>
          <div style={{ color: C.gold, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 10 }}>
            {selected} {monthStr.split(" ")[0]}
          </div>
          {selectedRentals.length === 0 ? (
            <div style={{ color: C.muted, textAlign: "center", padding: "20px 0" }}>Aucune location ce jour</div>
          ) : selectedRentals.map(r => (
            <RentalCard key={r.id} rental={r} onClick={() => onRentalClick && onRentalClick(r)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExportView({ data }) {
  const [period, setPeriod] = useState("month");
  const [reportType, setReportType] = useState("financial");
  const [generating, setGenerating] = useState(false);

  function getDateRange() {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    let start;
    if (period === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === "quarter") start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    else if (period === "6months") start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    else start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return { start, end };
  }

  function generatePDF() {
    setGenerating(true);
    const { start, end } = getDateRange();
    const rentals = data.rentals.filter(r => {
      if (!r.startDate) return false;
      const d = new Date(r.startDate);
      return d >= start && d <= end;
    });
    const revenue = rentals.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.revenue : 0); }, 0);
    const cost = rentals.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.cost : 0); }, 0);
    const profit = revenue - cost;
    const periodLabel = { month: "Mois en cours", quarter: "Trimestre", "6months": "6 mois", year: "12 mois" }[period];

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #222; }
  .header { text-align: center; border-bottom: 3px solid #C9A84C; padding-bottom: 20px; margin-bottom: 30px; }
  .company-name { font-size: 22px; font-weight: bold; color: #C9A84C; }
  .company-ar { font-size: 16px; color: #666; direction: rtl; }
  .company-info { font-size: 12px; color: #888; margin-top: 8px; }
  .report-title { font-size: 18px; font-weight: bold; margin: 20px 0 5px; }
  .period { color: #888; font-size: 13px; margin-bottom: 20px; }
  .stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 30px; }
  .stat { background: #f8f6f0; border: 1px solid #e8d9a0; border-radius: 8px; padding: 15px; text-align: center; }
  .stat-value { font-size: 20px; font-weight: bold; color: #C9A84C; }
  .stat-label { font-size: 11px; color: #888; margin-top: 4px; }
  .profit-value { color: #2ECC8A; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #C9A84C; color: white; padding: 10px; text-align: left; font-size: 12px; }
  td { padding: 9px 10px; font-size: 12px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) td { background: #faf9f5; }
  .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 11px; color: #aaa; text-align: center; }
  .section-title { font-weight: bold; font-size: 14px; color: #C9A84C; margin: 25px 0 10px; border-bottom: 1px solid #e8d9a0; padding-bottom: 5px; }
</style>
</head>
<body>
<div class="header">
  <div class="company-name">${COMPANY.name}</div>
  <div class="company-ar">${COMPANY.nameAr}</div>
  <div class="company-info">
    License No. ${COMPANY.license} &nbsp;|&nbsp; Register No. ${COMPANY.register}<br>
    ${COMPANY.address}<br>
    Tel: ${COMPANY.phone} &nbsp;|&nbsp; ${COMPANY.email}<br>
    License Expiry: ${COMPANY.expiry}
  </div>
</div>

<div class="report-title">${reportType === "financial" ? "Bilan Financier" : reportType === "rentals" ? "Rapport des Locations" : "Rapport par Client"}</div>
<div class="period">Période : ${periodLabel} &nbsp;|&nbsp; Généré le ${new Date().toLocaleDateString("fr-FR")}</div>

${reportType === "financial" ? `
<div class="stats">
  <div class="stat"><div class="stat-value">${rentals.length}</div><div class="stat-label">Locations</div></div>
  <div class="stat"><div class="stat-value">${Number(revenue).toLocaleString("fr-FR")} AED</div><div class="stat-label">Revenus bruts</div></div>
  <div class="stat"><div class="stat-value profit-value">${Number(profit).toLocaleString("fr-FR")} AED</div><div class="stat-label">Bénéfice net</div></div>
</div>
<div class="section-title">Détail des locations</div>
<table>
  <tr><th>Véhicule</th><th>Client</th><th>Départ</th><th>Retour</th><th>Jours</th><th>Revenu</th><th>Broker</th><th>Bénéfice</th><th>Encaissé</th></tr>
  ${rentals.map(r => {
    const p = calcProfit(r);
    return `<tr><td>${r.car || "—"}</td><td>${r.clientName || "—"}</td><td>${fmtDate(r.startDate)}</td><td>${fmtDate(r.endDate)}</td><td>${p ? p.days.toFixed(0) : "—"}</td><td>${p ? Number(p.revenue).toLocaleString("fr-FR") + " AED" : "—"}</td><td>${p ? Number(p.cost).toLocaleString("fr-FR") + " AED" : "—"}</td><td style="color:${p && p.profit >= 0 ? "#2ECC8A" : "#E05555"};font-weight:bold">${p ? Number(p.profit).toLocaleString("fr-FR") + " AED" : "—"}</td><td>${r.collectedBy || "—"}</td></tr>`;
  }).join("")}
</table>
` : reportType === "rentals" ? `
<table>
  <tr><th>Véhicule</th><th>Client</th><th>Tél</th><th>Permis</th><th>Passeport</th><th>Départ</th><th>Retour</th><th>Prix/j</th><th>Caution</th><th>Paiement</th></tr>
  ${rentals.map(r => `<tr><td>${r.car || "—"}</td><td>${r.clientName || "—"}</td><td>${r.clientPhone || "—"}</td><td>${r.licenseRef || "—"}</td><td>${r.passportRef || "—"}</td><td>${fmtDate(r.startDate)}</td><td>${fmtDate(r.endDate)}</td><td>${r.pricePerDay ? Number(r.pricePerDay).toLocaleString("fr-FR") + " AED" : "—"}</td><td>${r.deposit ? "✓ " + (r.depositAmount ? Number(r.depositAmount).toLocaleString("fr-FR") + " AED" : "") : "Non"}</td><td>${r.paymentStatus === "paid" ? "Payé" : r.paymentStatus === "partial" ? "Acompte" : "En attente"}</td></tr>`).join("")}
</table>
` : `
${Object.values(data.clients.reduce((acc, c) => { acc[c.id] = c; return acc; }, {})).map(c => {
  const cr = data.rentals.filter(r => r.clientId === c.id || r.clientName === c.name).filter(r => { const d = new Date(r.startDate); return d >= start && d <= end; });
  if (cr.length === 0) return "";
  const tp = cr.reduce((s, r) => { const p = calcProfit(r); return s + (p ? p.profit : 0); }, 0);
  return `<div class="section-title">${c.name}${c.vip ? " ⭐" : ""}${c.nationality ? " · " + c.nationality : ""}</div>
  <p style="font-size:12px;color:#666">${c.phone ? "Tel: " + c.phone + " | " : ""}${c.licenseRef ? "Permis: " + c.licenseRef + " | " : ""}${c.passportRef ? "Passeport: " + c.passportRef : ""}</p>
  <p style="font-size:13px;font-weight:bold;color:#2ECC8A">Bénéfice total : ${Number(tp).toLocaleString("fr-FR")} AED</p>
  <table><tr><th>Véhicule</th><th>Départ</th><th>Retour</th><th>Revenu</th><th>Bénéfice</th></tr>
  ${cr.map(r => { const p = calcProfit(r); return `<tr><td>${r.car || "—"}</td><td>${fmtDate(r.startDate)}</td><td>${fmtDate(r.endDate)}</td><td>${p ? Number(p.revenue).toLocaleString("fr-FR") + " AED" : "—"}</td><td>${p ? Number(p.profit).toLocaleString("fr-FR") + " AED" : "—"}</td></tr>`; }).join("")}
  </table>`;
}).join("")}
`}

<div class="footer">
  ${COMPANY.name} &nbsp;|&nbsp; License No. ${COMPANY.license} &nbsp;|&nbsp; Document généré le ${new Date().toLocaleDateString("fr-FR")}
</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `newsloc-rapport-${period}-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setGenerating(false);
  }

  const periods = [{ k: "month", l: "Ce mois" }, { k: "quarter", l: "Trimestre" }, { k: "6months", l: "6 mois" }, { k: "year", l: "12 mois" }];
  const types = [
    { k: "financial", l: "Bilan financier", d: "Revenus, coûts, bénéfice net", icon: "📊" },
    { k: "rentals", l: "Toutes les locations", d: "Liste complète avec détails clients", icon: "🚗" },
    { k: "clients", l: "Par client", d: "Historique et stats par client", icon: "👤" },
  ];

  return (
    <div>
      <div style={{ color: C.gold, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 10 }}>PÉRIODE</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {periods.map(p => (
          <button key={p.k} onClick={() => setPeriod(p.k)} style={{ padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer", background: period === p.k ? C.gold : C.border, color: period === p.k ? C.bg : C.text, fontWeight: 600, fontSize: 13 }}>{p.l}</button>
        ))}
      </div>

      <div style={{ color: C.gold, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 10 }}>TYPE DE RAPPORT</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {types.map(t => (
          <div key={t.k} onClick={() => setReportType(t.k)} style={{ background: C.card, border: `1px solid ${reportType === t.k ? C.gold : C.border}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <div>
              <div style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{t.l}</div>
              <div style={{ color: C.muted, fontSize: 12 }}>{t.d}</div>
            </div>
            {reportType === t.k && <div style={{ marginLeft: "auto", color: C.gold, fontSize: 16 }}>✓</div>}
          </div>
        ))}
      </div>

      <button onClick={generatePDF} disabled={generating} style={{ ...btnPrimary, opacity: generating ? 0.7 : 1 }}>
        {generating ? "Génération..." : "📄 Générer et télécharger"}
      </button>
      <div style={{ color: C.muted, fontSize: 12, textAlign: "center", marginTop: 10 }}>
        Le fichier s'ouvre dans votre navigateur — imprimez-le en PDF via Fichier → Imprimer → Enregistrer en PDF
      </div>
    </div>
  );
}

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
        .then(({ data: row }) => {
          if (row?.data) { setData(row.data); saveLocal(row.data); }
        });
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

  const syncIcon = { idle: "✓", saving: "↑", saved: "✓", error: "!" };
  const syncColor = { idle: C.muted, saving: C.gold, saved: C.green, error: C.red };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Inter', -apple-system, sans-serif", maxWidth: 540, margin: "0 auto", paddingBottom: 80 }}>
      <div style={{ padding: "16px 20px 12px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontSize: 11, color: C.goldDim, fontWeight: 700, letterSpacing: 2 }}>NEWS LOC</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.gold, lineHeight: 1.1 }}>DUBAI</div>
        </div>
        <div style={{ fontSize: 12, color: syncColor[syncStatus], background: C.bg, borderRadius: 20, padding: "4px 12px", border: `1px solid ${C.border}` }}>
          {syncIcon[syncStatus]} {syncStatus === "saving" ? "Sync..." : syncStatus === "error" ? "Erreur" : "Synchronisé"}
        </div>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {tab === "dashboard" && <Dashboard data={data} onUpdate={update} />}
        {tab === "rentals" && <RentalsView data={data} onUpdate={update} />}
        {tab === "analytics" && <AnalyticsView data={data} />}
        {tab === "calendar" && <CalendarView data={data} />}
        {tab === "clients" && <ClientsView data={data} onUpdate={update} />}
        {tab === "export" && <ExportView data={data} />}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 540, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex" }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, padding: "10px 0 14px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, position: "relative" }}>
            <span style={{ fontSize: 18 }}>{n.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: tab === n.id ? C.gold : C.muted }}>{n.label}</span>
            {tab === n.id && <div style={{ width: 16, height: 2, background: C.gold, borderRadius: 1, position: "absolute", bottom: 6 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}
