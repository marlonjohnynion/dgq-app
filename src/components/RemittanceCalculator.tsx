"use client";

import { useState, useMemo, useCallback, useRef } from "react";

const DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 1] as const;
const CASHIERS = ["Daisy", "Lyn"] as const;
const CASH_OUT_ROWS = 6;
const GCASH_ROWS = 4;
const BANK_ROWS = 4;

type Counts = Record<number, number>;
type Entry = { description: string; amount: number };
type Tab = "cashout" | "gcash" | "bank";

function fmt(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function emptyEntries(n: number): Entry[] {
  return Array.from({ length: n }, () => ({ description: "", amount: 0 }));
}

export default function RemittanceCalculator() {
  const [openingFund, setOpeningFund] = useState(0);
  const [counts, setCounts] = useState<Counts>(() => Object.fromEntries(DENOMS.map((d) => [d, 0])));
  const [coins, setCoins] = useState(0);
  const [cashOut, setCashOut] = useState<Entry[]>(() => emptyEntries(CASH_OUT_ROWS));
  const [gcash, setGcash] = useState<Entry[]>(() => emptyEntries(GCASH_ROWS));
  const [bank, setBank] = useState<Entry[]>(() => emptyEntries(BANK_ROWS));
  const [sales, setSales] = useState(0);
  const [tab, setTab] = useState<Tab>("cashout");

  // transaction metadata
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const [txDate, setTxDate] = useState(todayStr);
  const [txTime, setTxTime] = useState(nowTime);
  const [cashier, setCashier] = useState("");
  const [txFrom, setTxFrom] = useState("");
  const [txTo, setTxTo] = useState("");

  const closingTotal = useMemo(() => DENOMS.reduce((s, d) => s + d * (counts[d] || 0), 0) + coins, [counts, coins]);
  const cashOutTotal = useMemo(() => cashOut.reduce((s, e) => s + (e.amount || 0), 0), [cashOut]);
  const gcashTotal = useMemo(() => gcash.reduce((s, e) => s + (e.amount || 0), 0), [gcash]);
  const bankTotal = useMemo(() => bank.reduce((s, e) => s + (e.amount || 0), 0), [bank]);

  const accountedFor = closingTotal + cashOutTotal + gcashTotal + bankTotal;
  const accountability = sales + openingFund;
  const variance = accountedFor - accountability;

  const updateCount = useCallback((d: number, v: string) => {
    setCounts((p) => ({ ...p, [d]: parseInt(v) || 0 }));
  }, []);

  const makeUpdater = useCallback(
    (set: React.Dispatch<React.SetStateAction<Entry[]>>) =>
      (i: number, f: keyof Entry, v: string) =>
        set((p) => {
          const n = [...p];
          n[i] = f === "amount" ? { ...n[i], amount: parseFloat(v) || 0 } : { ...n[i], description: v };
          return n;
        }),
    []
  );
  const updCashOut = useMemo(() => makeUpdater(setCashOut), [makeUpdater]);
  const updGcash = useMemo(() => makeUpdater(setGcash), [makeUpdater]);
  const updBank = useMemo(() => makeUpdater(setBank), [makeUpdater]);

  const reset = () => {
    setOpeningFund(0);
    setCounts(Object.fromEntries(DENOMS.map((d) => [d, 0])));
    setCoins(0);
    setCashOut(emptyEntries(CASH_OUT_ROWS));
    setGcash(emptyEntries(GCASH_ROWS));
    setBank(emptyEntries(BANK_ROWS));
    setSales(0);
    const n = new Date();
    setTxDate(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`);
    setTxTime(`${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`);
    setCashier("");
    setTxFrom("");
    setTxTo("");
  };

  const addRow = useCallback((set: React.Dispatch<React.SetStateAction<Entry[]>>) => {
    set((p) => [...p, { description: "", amount: 0 }]);
  }, []);

  const removeRow = useCallback((set: React.Dispatch<React.SetStateAction<Entry[]>>, i: number) => {
    set((p) => p.filter((_, idx) => idx !== i));
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildFileName = () => {
    const datePart = txDate.replace(/-/g, "");
    const fromPart = (txFrom || "shift").replace(/\s+/g, "-").toLowerCase();
    const toPart = (txTo || "shift").replace(/\s+/g, "-").toLowerCase();
    return `${datePart}_${fromPart}-to-${toPart}.json`;
  };

  const handleSave = () => {
    const data = {
      txDate, txTime, cashier, txFrom, txTo,
      openingFund, counts, coins,
      cashOut, gcash, bank, sales,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildFileName();
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.txDate) setTxDate(data.txDate);
        if (data.txTime) setTxTime(data.txTime);
        if (data.cashier != null) setCashier(data.cashier);
        if (data.txFrom != null) setTxFrom(data.txFrom);
        if (data.txTo != null) setTxTo(data.txTo);
        if (data.openingFund != null) setOpeningFund(data.openingFund);
        if (data.counts) setCounts(data.counts);
        if (data.coins != null) setCoins(data.coins);
        if (data.cashOut) setCashOut(data.cashOut);
        if (data.gcash) setGcash(data.gcash);
        if (data.bank) setBank(data.bank);
        if (data.sales != null) setSales(data.sales);
      } catch {
        alert("Invalid file format.");
      }
    };
    reader.readAsText(file);
    // reset input so the same file can be loaded again
    e.target.value = "";
  };

  const fundsFilled = sales > 0 && openingFund > 0;
  const entriesValid = [...cashOut, ...gcash, ...bank].every(
    (e) => (e.description && e.amount > 0) || (!e.description && !e.amount)
  );
  const missingItems: string[] = [];
  if (!txDate) missingItems.push("Date");
  if (!txTime) missingItems.push("Time");
  if (!cashier) missingItems.push("Cashier");
  if (!txFrom) missingItems.push("From");
  if (!txTo) missingItems.push("To");
  if (!(openingFund > 0)) missingItems.push("Opening Fund");
  if (!(sales > 0)) missingItems.push("Sales");
  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const incompleteRows = (entries: Entry[]) =>
    entries.reduce<{ row: number; missing: string }[]>((acc, e, i) => {
      if (e.description && !e.amount) acc.push({ row: i + 1, missing: "amount" });
      else if (!e.description && e.amount > 0) acc.push({ row: i + 1, missing: "description" });
      return acc;
    }, []);
  const pushIncomplete = (label: string, entries: Entry[]) => {
    for (const { row, missing } of incompleteRows(entries)) {
      missingItems.push(`${label} — ${ordinal(row)} row has no ${missing}`);
    }
  };
  pushIncomplete("Cash-Out", cashOut);
  pushIncomplete("GCash", gcash);
  pushIncomplete("Bank Transfer", bank);
  const canRecord = missingItems.length === 0;

  // builds the plain-text receipt lines used by both print and image export
  const buildReceipt = () => {
    // epson TM-U220D: 76mm paper, 16 cpi, 33 cols native
    // browser print adds its own margins, so use 25 cols to
    // stay safely inside the printable area on both sides
    const W = 25;

    // use P instead of ₱ — the unicode peso sign smears on 9-pin dot matrix
    const r = (n: number) => {
      const formatted = n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `P${formatted}`;
    };

    const pad = (l: string, v: string) => {
      const gap = W - l.length - v.length;
      return l + (gap > 0 ? " ".repeat(gap) : " ") + v;
    };
    const sep = "-".repeat(W);
    const dblSep = "=".repeat(W);
    const center = (s: string) => {
      const left = Math.floor((W - s.length) / 2);
      return " ".repeat(Math.max(0, left)) + s;
    };

    const lines: string[] = [];
    const add = (...s: string[]) => lines.push(...s);

    add(center("DGQ MINIMART"), center("Remittance Report"), dblSep);

    // metadata
    add(pad("Date:", txDate));
    add(pad("Time:", txTime));
    add(pad("Cashier:", cashier || "--"));
    add(pad("From:", txFrom || "--"));
    add(pad("To:", txTo || "--"));
    add(sep);

    // opening fund
    add("OPENING FUND");
    add(pad("  Total", r(openingFund)));
    add(sep);

    // cash payments (closing fund)
    add("CASH PAYMENTS");
    DENOMS.forEach((d) => {
      if ((counts[d] || 0) > 0) {
        const label = `  ${d >= 1000 ? `${d / 1000}K` : d} x ${counts[d]}`;
        add(pad(label, r(d * counts[d])));
      }
    });
    if (coins > 0) add(pad("  Coins", r(coins)));
    add(pad("  TOTAL", r(closingTotal)));
    add(sep);

    // renders individual entry lines with description + amount
    const addEntryLines = (entries: Entry[], indent = "  ") => {
      entries.forEach((e) => {
        if (e.amount > 0) {
          const desc = e.description || "--";
          const amt = r(e.amount);
          const inlined = `${indent}${desc}`;
          // if it fits on one line, keep it inline
          if (inlined.length + amt.length + 1 <= W) {
            add(pad(inlined, amt));
          } else {
            // description on its own line(s), amount right-aligned below
            const maxDesc = W - indent.length;
            for (let ci = 0; ci < desc.length; ci += maxDesc) {
              add(`${indent}${desc.substring(ci, ci + maxDesc)}`);
            }
            add(" ".repeat(W - amt.length) + amt);
          }
        }
      });
    };

    // online payments — segmented by gcash and bank transfer
    const paymentsTotal = gcashTotal + bankTotal;
    if (paymentsTotal > 0) {
      add("ONLINE PAYMENTS");
      if (gcashTotal > 0) {
        add("  GCash");
        addEntryLines(gcash, "    ");
        add(pad("    Subtotal", r(gcashTotal)));
      }
      if (bankTotal > 0) {
        add("  Bank Transfer");
        addEntryLines(bank, "    ");
        add(pad("    Subtotal", r(bankTotal)));
      }
      add(pad("  TOTAL", r(paymentsTotal)));
      add(sep);
    }

    // cash-out
    if (cashOutTotal > 0) {
      add("CASH-OUT");
      addEntryLines(cashOut);
      add(pad("  TOTAL", r(cashOutTotal)));
      add(sep);
    }

    // accounted for
    add("ACCOUNTED FOR");
    add(pad("  Cash Payments", r(closingTotal)));
    add(pad("  Online Payments", r(paymentsTotal)));
    add(pad("  Cash-Out", r(cashOutTotal)));
    add(pad("  TOTAL", r(accountedFor)));
    add(sep);

    // accountability
    add("ACCOUNTABILITY");
    add(pad("  Sales", r(sales)));
    add(pad("  Opening Fund", r(openingFund)));
    add(pad("  TOTAL", r(accountability)));
    add(dblSep);

    // variance
    const varianceLabel = variance === 0 ? "BALANCED" : variance > 0 ? "OVERAGE" : "SHORTAGE";
    add(center(varianceLabel), center(r(Math.abs(variance))));
    add(dblSep);

    // footer
    const now2 = new Date();
    add(center(now2.toLocaleDateString("en-PH")));
    add(center(now2.toLocaleTimeString("en-PH")));
    add("", "");

    return lines;
  };

  const handlePrintReport = () => {
    const lines = buildReceipt();

    // indent every line by 2 chars so the left edge
    // doesn't get clipped by the printer's margin
    const receipt = lines.map((l) => `  ${l}`).join("\n");

    // 28 cols × ~2mm/char = ~56mm fits within 76mm paper
    // after browser + driver margins on both sides
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page {
    size: 76mm auto;
    margin: 0;
  }
  * { margin: 0; padding: 0; }
  body {
    margin: 0;
    padding: 0;
    background: #fff;
  }
  pre {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11pt;
    line-height: 1.1;
    white-space: pre;
    overflow: visible;
    color: #000;
    padding: 2mm;
  }
  @media screen {
    body { padding: 24px; background: #eee; }
    pre {
      max-width: 400px;
      margin: 0 auto;
      border: 1px dashed #999;
      padding: 20px;
      background: #fff;
    }
  }
</style>
</head><body>
<pre>${receipt}</pre>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;

    const w = window.open("", "_blank", "width=800,height=900");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  // renders receipt lines to a PNG blob
  const buildReceiptBlob = async (): Promise<Blob> => {
    const lines = buildReceipt();

    const fontSize = 20;
    const lineHeight = fontSize * 1.25;
    const fontFamily = "'Courier New', Courier, monospace";
    const paddingX = 32;
    const paddingY = 24;

    // measure the widest line to size the canvas
    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d")!;
    measureCtx.font = `${fontSize}px ${fontFamily}`;
    let maxWidth = 0;
    for (const line of lines) {
      const w = measureCtx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
    }

    const canvasWidth = Math.ceil(maxWidth + paddingX * 2);
    const canvasHeight = Math.ceil(lines.length * lineHeight + paddingY * 2);

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d")!;

    // white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // draw text
    ctx.fillStyle = "#000000";
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = "top";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], paddingX, paddingY + i * lineHeight);
    }

    return new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/png")
    );
  };

  const handleCopyImage = async () => {
    const blob = await buildReceiptBlob();
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    } catch {
      // clipboard write can fail in some browsers / contexts
    }
  };


  const tabData: Record<Tab, { label: string; short: string; entries: Entry[]; updater: typeof updCashOut; total: number; setter: React.Dispatch<React.SetStateAction<Entry[]>> }> = {
    cashout: { label: "Cash-Out", short: "Cash", entries: cashOut, updater: updCashOut, total: cashOutTotal, setter: setCashOut },
    gcash: { label: "GCash", short: "GCash", entries: gcash, updater: updGcash, total: gcashTotal, setter: setGcash },
    bank: { label: "Bank Transfer", short: "Bank", entries: bank, updater: updBank, total: bankTotal, setter: setBank },
  };
  const cur = tabData[tab];

  return (
    <div className="max-w-[1200px] mx-auto px-3 pt-3 pb-44 lg:pb-4">
      {/* ── header ── */}
      <header className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-md bg-accent flex items-center justify-center shrink-0">
            <span className="text-base font-extrabold text-[11px] tracking-tighter leading-none">DGQ</span>
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-text-0 tracking-wide leading-none">DGQ MINIMART</h1>
            <p className="text-[11px] text-text-2 mt-0.5 font-medium">Remittance Calculator</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <MetaField label="Date" value={txDate} onChange={setTxDate} type="date" required />
          <MetaField label="Time" value={txTime} onChange={setTxTime} type="time" required />
          <div>
            <label className="block text-[10px] font-semibold text-text-3 uppercase tracking-wider mb-1">
              Cashier <span className="text-accent">*</span>
            </label>
            <select
              value={cashier}
              onChange={(e) => setCashier(e.target.value)}
              className={`w-full bg-surface-1 border border-surface-3 rounded pl-2.5 pr-7 py-[7px] text-[12px] focus:outline-none focus:border-accent/40 transition-colors focus-ring shadow-sm cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238c8680%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat ${
                cashier ? "text-text-0" : "text-text-3"
              }`}
            >
              <option value="">Select cashier</option>
              {CASHIERS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <MetaField label="From" value={txFrom} onChange={setTxFrom} placeholder="Shift / Source" required />
          <MetaField label="To" value={txTo} onChange={setTxTo} placeholder="Shift / Destination" required />
        </div>
      </header>

      {/* ── main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-3">

        {/* ── col 1: funds ── */}
        <div className="space-y-3">
          <Panel title="Sales & Opening" accent>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-text-2 font-medium mb-1.5">
                  Opening Fund <span className="text-accent">*</span>
                </label>
                <MoneyInput value={openingFund} onChange={(v) => setOpeningFund(parseFloat(v) || 0)} />
              </div>
              <div>
                <label className="block text-[11px] text-text-2 font-medium mb-1.5">
                  Sales <span className="text-accent">*</span>
                </label>
                <MoneyInput value={sales} onChange={(v) => setSales(parseFloat(v) || 0)} />
              </div>
            </div>
          </Panel>

          <Panel title="Closing Fund">
            <div className="divide-y divide-surface-3">
              {DENOMS.map((d) => (
                <div key={d} className="flex items-center gap-2 py-[6px]">
                  <span className="w-10 text-[12px] font-semibold text-text-2 tabular-nums">{d >= 1000 ? `${d / 1000}K` : d}</span>
                  <div className="flex-1">
                    <PcsInput value={counts[d]} onChange={(v) => updateCount(d, v)} />
                  </div>
                  <span className="w-[88px] text-right text-[12px] font-mono text-text-1 tabular-nums">
                    {fmt(d * (counts[d] || 0))}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 py-[6px]">
                <span className="w-10 text-[12px] font-semibold text-text-2">Coins</span>
                <div className="flex-1">
                  <PcsInput value={coins} onChange={(v) => setCoins(parseFloat(v) || 0)} step="0.01" />
                </div>
                <span className="w-[88px] text-right text-[12px] font-mono text-text-1 tabular-nums">
                  {fmt(coins)}
                </span>
              </div>
            </div>
            <SumBar amount={closingTotal} />
          </Panel>
        </div>

        {/* ── col 2: cash-out & payments ── */}
        <Panel title="Cash-Out & Payments" noPad flush>
          {/* tabs */}
          <div className="flex border-b border-surface-3">
            {(Object.keys(tabData) as Tab[]).map((k) => {
              const t = tabData[k];
              const active = tab === k;
              return (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`relative flex-1 py-3 text-[12px] font-semibold tracking-wide transition-colors cursor-pointer ${
                    active ? "text-accent" : "text-text-3 hover:text-text-2"
                  }`}
                >
                  <span>{t.short}</span>
                  {t.total > 0 && (
                    <span className={`ml-1 text-[10px] font-mono ${active ? "text-accent/60" : "text-text-3"}`}>
                      {fmt(t.total)}
                    </span>
                  )}
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-accent" />
                  )}
                </button>
              );
            })}
          </div>

          {/* entries */}
          <div className="p-3">
            <div className="grid grid-cols-[1fr_110px_24px] gap-x-2 text-[10px] font-semibold text-text-3 uppercase tracking-wider mb-1 px-0.5">
              <span>Description</span>
              <span className="text-right">Amount</span>
              <span></span>
            </div>
            <div className="divide-y divide-surface-3/60">
              {cur.entries.map((entry, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_24px] gap-2 py-[5px] items-center">
                  <input
                    type="text"
                    value={entry.description}
                    onChange={(e) => cur.updater(i, "description", e.target.value)}
                    className="w-full bg-surface-2 border border-surface-3 rounded px-2.5 py-2 text-[12px] text-text-0 placeholder:text-text-3 focus:outline-none focus:border-accent/40 focus:bg-accent-ghost transition-colors focus-ring"
                    placeholder="..."
                  />
                  <PcsInput value={entry.amount} onChange={(v) => cur.updater(i, "amount", v)} step="0.01" />
                  <button
                    onClick={() => removeRow(cur.setter, i)}
                    className="w-6 h-6 flex items-center justify-center rounded text-text-3 hover:text-negative hover:bg-negative/10 transition-colors cursor-pointer text-[14px] leading-none"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => addRow(cur.setter)}
              className="w-full mt-2 py-1.5 text-[11px] font-medium text-text-3 hover:text-accent border border-dashed border-surface-3 hover:border-accent/30 rounded transition-colors cursor-pointer"
            >
              + Add row
            </button>
            <SumBar label={cur.label} amount={cur.total} />
          </div>

          {/* summary */}
          {(cashOutTotal + gcashTotal + bankTotal) > 0 && (
            <div className="mx-3 mb-3 bg-surface-2 border border-surface-3 rounded p-2.5 space-y-2">
              {cashOutTotal > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-text-3 uppercase tracking-wider mb-1">Cash-Out</p>
                  <Row label="Total" value={cashOutTotal} bold />
                </div>
              )}
              {(gcashTotal + bankTotal) > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-text-3 uppercase tracking-wider mb-1">Payments</p>
                  {gcashTotal > 0 && <Row label="GCash" value={gcashTotal} />}
                  {bankTotal > 0 && <Row label="Bank Transfer" value={bankTotal} />}
                </div>
              )}
              <div className="border-t border-surface-3 pt-1.5">
                <Row label="Grand Total" value={cashOutTotal + gcashTotal + bankTotal} bold />
              </div>
            </div>
          )}
        </Panel>

        {/* ── col 3: audit ── */}
        <div className="space-y-3">
          <Panel title="Audit" noPad>
            <div className="p-3 space-y-4">
              {/* accounted for */}
              <div>
                <p className="text-[10px] font-bold text-text-3 uppercase tracking-[0.1em] mb-2">Accounted For</p>
                <div className="space-y-1">
                  <Row label="Closing Fund" value={closingTotal} />
                  <Row label="Cash-Out" value={cashOutTotal} />
                  <Row label="GCash (payment)" value={gcashTotal} />
                  <Row label="Bank (payment)" value={bankTotal} />
                  <div className="border-t border-surface-3 pt-1.5 mt-1.5">
                    <Row label="Total" value={accountedFor} bold />
                  </div>
                </div>
              </div>

              {/* accountability */}
              <div>
                <p className="text-[10px] font-bold text-text-3 uppercase tracking-[0.1em] mb-2">Accountability</p>
                <div className="space-y-1.5">
                  <Row label="Sales" value={sales} />
                  <Row label="Opening Fund" value={openingFund} />
                  <div className="border-t border-surface-3 pt-1.5 mt-1.5">
                    <Row label="Total" value={accountability} bold />
                  </div>
                </div>
              </div>
            </div>

            {/* ── variance hero ── */}
            <div className={`mx-3 mb-3 rounded-md p-5 text-center border ${
              variance === 0
                ? "bg-neutral-bg border-surface-3"
                : variance > 0
                  ? "bg-positive-bg border-positive-border"
                  : "bg-negative-bg border-negative-border"
            }`}>
              <p className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-2 ${
                variance === 0 ? "text-text-3" : variance > 0 ? "text-positive/70" : "text-negative/70"
              }`}>
                {variance === 0 ? "Balanced" : variance > 0 ? "Overage" : "Shortage"}
              </p>
              <p className={`text-[32px] font-mono font-bold leading-none tracking-tight ${
                variance === 0 ? "text-text-3" : variance > 0 ? "text-positive" : "text-negative"
              }`}>
                {fmt(Math.abs(variance))}
              </p>
            </div>
          </Panel>

          {/* actions (desktop) */}
          <div className="hidden lg:grid grid-cols-2 gap-2 no-print">
            <button
              onClick={reset}
              className="py-2.5 rounded-md text-[12px] font-bold tracking-wide bg-surface-1 border border-surface-3 text-text-2 hover:text-text-1 hover:border-surface-4 transition-colors cursor-pointer focus-ring"
            >
              Reset
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="py-2.5 rounded-md text-[12px] font-bold tracking-wide bg-surface-1 border border-surface-3 text-text-2 hover:text-text-1 hover:border-surface-4 transition-colors cursor-pointer focus-ring"
            >
              Load
            </button>
            <button
              onClick={handlePrintReport}
              disabled={!canRecord}
              className={`py-2.5 rounded-md text-[12px] font-bold tracking-wide transition-colors focus-ring ${
                canRecord
                  ? "bg-surface-1 border border-surface-3 text-text-2 hover:text-text-1 hover:border-surface-4 cursor-pointer"
                  : "bg-surface-3 text-text-3 cursor-not-allowed"
              }`}
            >
              Print Report
            </button>
            <button
              onClick={handleCopyImage}
              disabled={!canRecord}
              className={`py-2.5 rounded-md text-[12px] font-bold tracking-wide transition-colors focus-ring ${
                canRecord
                  ? "bg-surface-1 border border-surface-3 text-text-2 hover:text-text-1 hover:border-surface-4 cursor-pointer"
                  : "bg-surface-3 text-text-3 cursor-not-allowed"
              }`}
            >
              Copy Image
            </button>
            <button
              onClick={handleSave}
              disabled={!canRecord}
              className={`py-2.5 rounded-md text-[12px] font-bold tracking-wide transition-colors focus-ring ${
                canRecord
                  ? "bg-accent text-base hover:bg-accent-hover cursor-pointer"
                  : "bg-surface-3 text-text-3 cursor-not-allowed"
              }`}
            >
              Record
            </button>
          </div>
          {!canRecord && (
            <div className="hidden lg:block mt-2 px-1 no-print">
              <p className="text-[10px] font-semibold text-negative/70 mb-1">Missing:</p>
              <ul className="space-y-0.5">
                {missingItems.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-[10px] text-text-3">
                    <span className="text-negative/50 leading-[1.4]">&#x2717;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── mobile sticky bar ── */}
      <div className="fixed bottom-0 inset-x-0 lg:hidden no-print z-50">
        <div className={`backdrop-blur-xl border-t px-4 py-3 flex items-center gap-4 ${
          variance === 0
            ? "bg-surface-0/95 border-surface-3"
            : variance > 0
              ? "bg-surface-0/95 border-positive/20"
              : "bg-surface-0/95 border-negative/20"
        }`}>
          <div className="flex-1 min-w-0">
            <p className={`text-[9px] font-bold uppercase tracking-[0.15em] ${
              variance === 0 ? "text-text-3" : variance > 0 ? "text-positive/70" : "text-negative/70"
            }`}>
              {variance === 0 ? "Balanced" : variance > 0 ? "Overage" : "Shortage"}
            </p>
            <p className={`text-[22px] font-mono font-bold leading-tight tracking-tight ${
              variance === 0 ? "text-text-3" : variance > 0 ? "text-positive" : "text-negative"
            }`}>
              {fmt(Math.abs(variance))}
            </p>
          </div>
          <button onClick={reset} className="px-3 py-2.5 rounded-md text-[11px] font-bold bg-surface-2 border border-surface-3 text-text-2 cursor-pointer">
            Reset
          </button>
          <button
            onClick={handleCopyImage}
            disabled={!canRecord}
            className={`px-3 py-2.5 rounded-md text-[11px] font-bold ${
              canRecord ? "bg-surface-2 border border-surface-3 text-text-2 cursor-pointer" : "bg-surface-3 text-text-3 cursor-not-allowed"
            }`}
          >
            Copy
          </button>
          <button
            onClick={handleSave}
            disabled={!canRecord}
            className={`px-4 py-2.5 rounded-md text-[11px] font-bold ${
              canRecord ? "bg-accent text-base cursor-pointer" : "bg-surface-3 text-text-3 cursor-not-allowed"
            }`}
          >
            Record
          </button>
        </div>
      </div>

      {/* hidden file input for loading */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleLoad}
        className="hidden"
      />
    </div>
  );
}

/* ─── sub-components ─── */

function MetaField({ label, value, onChange, type, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-text-3 uppercase tracking-wider mb-1">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface-1 border border-surface-3 rounded px-2.5 py-[7px] text-[12px] text-text-0 placeholder:text-text-3 focus:outline-none focus:border-accent/40 transition-colors focus-ring shadow-sm"
      />
    </div>
  );
}

function Panel({ title, children, accent, noPad, flush }: {
  title: string; children: React.ReactNode; accent?: boolean; noPad?: boolean; flush?: boolean;
}) {
  return (
    <div className="bg-surface-1 rounded-lg border border-surface-3 overflow-hidden shadow-sm">
      <div className="px-3.5 py-2.5 flex items-center gap-2 border-b border-surface-3">
        {accent && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
        <h2 className="text-[11px] font-bold text-text-2 uppercase tracking-[0.08em]">{title}</h2>
      </div>
      <div className={flush ? "" : noPad ? "" : "p-3.5"}>{children}</div>
    </div>
  );
}

function MoneyInput({ value, onChange }: { value: number; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-mono text-accent/40">₱</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        className="w-full pl-7 pr-3 py-2.5 bg-accent-ghost border border-accent/20 rounded-md text-[16px] font-mono font-semibold text-text-0 text-right placeholder:text-text-3 focus:outline-none focus:border-accent/50 transition-colors focus-ring"
      />
    </div>
  );
}

function PcsInput({ value, onChange, step }: { value: number; onChange: (v: string) => void; step?: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      step={step}
      placeholder="0"
      className="w-full bg-surface-2 border border-surface-3 rounded px-2 py-[7px] text-[12px] font-mono text-text-0 text-right placeholder:text-text-3 focus:outline-none focus:border-accent/40 focus:bg-accent-ghost transition-colors focus-ring"
    />
  );
}

function SalesInput({ value, onChange }: { value: number; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="0.01"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0.00"
      className="w-full bg-positive-bg border border-positive-border rounded px-2.5 py-[7px] text-[12px] font-mono font-semibold text-positive-strong text-right placeholder:text-positive/30 focus:outline-none focus:border-positive-strong/40 transition-colors focus-ring"
    />
  );
}

function SumBar({ label, amount }: { label?: string; amount: number }) {
  return (
    <div className="flex items-center justify-between bg-accent-subtle rounded-md px-3.5 py-2.5 mt-3">
      <span className="text-[11px] font-bold text-accent/70 uppercase tracking-wide">{label ?? "Total"}</span>
      <span className="text-[15px] font-mono font-bold text-accent tabular-nums">{fmt(amount)}</span>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[12px] ${bold ? "font-bold text-text-0" : "font-medium text-text-2"}`}>{label}</span>
      <span className={`text-[12px] font-mono tabular-nums ${bold ? "font-bold text-text-0" : "text-text-1"}`}>{fmt(value)}</span>
    </div>
  );
}
