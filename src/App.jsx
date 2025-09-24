import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const RANKS = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
const SUITS = ["c","d","h","s"];
const DECK = RANKS.flatMap(r => SUITS.map(s => r + s));

const PAYTABLE = {
  royal_flush: 1000,
  straight_flush: 200,
  four_kind: 50,
  full_house: 11,
  flush: 8,
  straight: 5,
  three_kind: 3,
  two_pair: 2,
  pair_10_or_better: 1,
  nothing: -1,
};

const CATEGORIES = [
  "royal_flush",
  "straight_flush",
  "four_kind",
  "full_house",
  "flush",
  "straight",
  "three_kind",
  "two_pair",
  "pair_10_or_better",
  "nothing",
];

function rankIndex(r) {
  return RANKS.indexOf(r);
}

function classify5(cards) {
  const ranks = cards.map(c => c[0]);
  const suits = cards.map(c => c[1]);
  const counts = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const freqs = Object.values(counts).sort((a,b)=>b-a);
  const isFlush = new Set(suits).size === 1;
  const vals = ranks.map(rankIndex).sort((a,b)=>a-b);
  let isStraight = false;

  if (vals.length === 5 && vals[0] === 0 && vals[1] === 1 && vals[2] === 2 && vals[3] === 3 && vals[4] === 12) {
    isStraight = true;
  } else if (vals.length === 5 && (vals[4] - vals[0] === 4) && new Set(vals).size === 5) {
    isStraight = true;
  }

  if (isStraight && isFlush) {
    const ranksSet = new Set(ranks);
    if (ranksSet.size === 5 && ranksSet.has('T') && ranksSet.has('J') && ranksSet.has('Q') && ranksSet.has('K') && ranksSet.has('A')) {
      return 'royal_flush';
    }
    return 'straight_flush';
  }
  if (freqs[0] === 4) return 'four_kind';
  if (freqs[0] === 3 && freqs[1] === 2) return 'full_house';
  if (isFlush) return 'flush';
  if (isStraight) return 'straight';
  if (freqs[0] === 3) return 'three_kind';
  if (freqs[0] === 2 && freqs[1] === 2) return 'two_pair';
  if (freqs[0] === 2) {
    const pairRank = Object.keys(counts).find(k => counts[k] === 2);
    if (["T","J","Q","K","A"].includes(pairRank)) return 'pair_10_or_better';
    return 'nothing';
  }
  return 'nothing';
}

export default function LetItRideApp() {
  const [cardA, setCardA] = useState('');
  const [cardB, setCardB] = useState('');
  const [cardC, setCardC] = useState('');
  const [board, setBoard] = useState('');
  const [result, setResult] = useState(null);

  const availableDeck = useMemo(() => DECK, []);

  function disabledOption(option) {
    return [cardA, cardB, cardC, board].includes(option);
  }

  function computeEV() {
    if (!cardA || !cardB || !cardC || !board) {
      setResult({ error: 'Please select all 3 hole cards and the shown community card.'});
      return;
    }
    const known = new Set([cardA, cardB, cardC, board]);
    if (known.size < 4) {
      setResult({ error: 'Duplicate card detected. Please choose distinct cards.'});
      return;
    }

    const remaining = DECK.filter(c => !known.has(c)); // 48 cards
    const counts = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
    let evSum = 0;
    const breakdown = [];

    for (const finalCard of remaining) {
      const final5 = [cardA, cardB, cardC, board, finalCard];
      const cat = classify5(final5);
      counts[cat] += 1;
      const payout = PAYTABLE[cat];
      evSum += payout;
      breakdown.push({ finalCard, cat, payout });
    }

    const total = remaining.length;
    const ev = evSum / total;
    const probs = Object.fromEntries(CATEGORIES.map(c => [c, counts[c] / total]));

    setResult({ ev, probs, counts, total, breakdown });
  }

  function downloadCSV() {
    if (!result) return;
    const headers = ['metric','value'];
    const rows = [];
    rows.push(['EV_per_unit', result.ev.toFixed(6)]);
    for (const cat of CATEGORIES) {
      rows.push([`P_${cat}`, result.probs[cat].toFixed(6)]);
      rows.push([`Count_${cat}`, result.counts[cat]]);
    }
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'let_it_ride_ev_summary.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const chartData = result
    ? CATEGORIES.map(cat => ({ name: cat, value: Math.round((result.probs[cat] || 0) * 100000) / 1000 }))
    : [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Let It Ride — EV Calculator (3 hole cards + 1 shown)</h1>
      <p className="text-sm text-gray-600 mb-6">Select your 3 hole cards and the shown community card. The app will average over the 48 possible final community cards and return the expected net payout per 1 unit wager using the standard Let It Ride paytable.</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Hole card 1</label>
          <select className="mt-1 block w-full border rounded p-2" value={cardA} onChange={e=>setCardA(e.target.value)}>
            <option value="">-- select --</option>
            {availableDeck.map(d => (
              <option key={d} value={d} disabled={disabledOption(d)}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Hole card 2</label>
          <select className="mt-1 block w-full border rounded p-2" value={cardB} onChange={e=>setCardB(e.target.value)}>
            <option value="">-- select --</option>
            {availableDeck.map(d => (
              <option key={d} value={d} disabled={disabledOption(d)}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Hole card 3</label>
          <select className="mt-1 block w-full border rounded p-2" value={cardC} onChange={e=>setCardC(e.target.value)}>
            <option value="">-- select --</option>
            {availableDeck.map(d => (
              <option key={d} value={d} disabled={disabledOption(d)}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Shown community card</label>
          <select className="mt-1 block w-full border rounded p-2" value={board} onChange={e=>setBoard(e.target.value)}>
            <option value="">-- select --</option>
            {availableDeck.map(d => (
              <option key={d} value={d} disabled={disabledOption(d)}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" onClick={computeEV}>Compute EV</button>
        <button className="bg-gray-200 px-3 py-2 rounded" onClick={()=>{setCardA('');setCardB('');setCardC('');setBoard('');setResult(null);}}>Reset</button>
        <button className="bg-green-600 text-white px-3 py-2 rounded" onClick={downloadCSV} disabled={!result}>Download CSV</button>
      </div>

      {result && result.error && (
        <div className="text-red-600">{result.error}</div>
      )}

      {result && !result.error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Your cards</div>
              <div className="text-lg font-medium">{cardA} {cardB} {cardC}</div>
              <div className="text-sm text-gray-500 mt-2">Shown community card</div>
              <div className="text-lg font-medium">{board}</div>
              <div className="mt-4">
                <div className="text-sm text-gray-500">Averaged over</div>
                <div className="text-xl font-semibold">{result.total} possible final cards</div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-500">Expected net payout (EV) per 1-unit wager</div>
                <div className="text-2xl font-bold">{result.ev.toFixed(6)}</div>
              </div>
            </div>

            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Probability breakdown (final 5-card hand)</div>
              <table className="w-full mt-2 text-sm">
                <thead>
                  <tr className="text-left text-gray-600"><th>Category</th><th>Prob</th><th>Count</th></tr>
                </thead>
                <tbody>
                  {CATEGORIES.map(cat => (
                    <tr key={cat} className="border-t">
                      <td className="py-2">{cat}</td>
                      <td>{(result.probs[cat]*100).toFixed(3)}%</td>
                      <td>{result.counts[cat]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500 mb-2">Chart: probabilities (×1000 for readability)</div>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(v) => `${v / 1000}%` } />
                  <Bar dataKey="value" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 text-sm text-gray-500">Paytable used (net payouts):</div>
            <ul className="mt-2 text-sm">
              {Object.entries(PAYTABLE).map(([k,v]) => (
                <li key={k}><strong>{k}</strong>: {v > 0 ? `+${v}` : v}</li>
              ))}
            </ul>

          </div>
        </div>
      )}

      {result && result.breakdown && (
        <div className="mt-6 text-sm text-gray-500">Tip: use "Download CSV" to save the summary. If you want a detailed per-final-card breakdown included in the CSV, tell me and I’ll add it.</div>
      )}

    </div>
  );
}
