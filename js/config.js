/**
 * Balance- und Inhaltsdaten für den Drug Dealer Simulator.
 * Alle Zahlen an einem Ort, damit sich das Spiel leicht nachjustieren lässt.
 */

export const SAVE_KEY = 'dds.save.v1';
export const TICK_MS = 100;

/** Sorten. Freischalten kostet Geld, danach kann man sie im Einkauf ordern. */
export const STRAINS = [
  { id: 'bahnhof',  name: 'Bahnhofs-Gras', emoji: '🌿', color: '#8bd93f', buy: 3,    sell: 7,    unlock: 0,        blurb: 'Kratzt im Hals, geht aber weg wie nix.' },
  { id: 'crack',    name: 'Green Crack',   emoji: '🍏', color: '#5cff9d', buy: 5,    sell: 13,   unlock: 300,      blurb: 'Wach macht es, teuer auch.' },
  { id: 'amnesia',  name: 'Amnesia Haze',  emoji: '💨', color: '#9dffd6', buy: 9,    sell: 24,   unlock: 1500,     blurb: 'Der Klassiker vom Block.' },
  { id: 'bluedream',name: 'Blue Dream',    emoji: '💙', color: '#5ec8ff', buy: 15,   sell: 42,   unlock: 8000,     blurb: 'Die Kundschaft träumt blau.' },
  { id: 'ogkush',   name: 'OG Kush',       emoji: '👑', color: '#c08bff', buy: 26,   sell: 74,   unlock: 42000,    blurb: 'Original Gangster. Fragt keiner nach dem Preis.' },
  { id: 'glue',     name: 'Gorilla Glue',  emoji: '🦍', color: '#ffb45c', buy: 45,   sell: 132,  unlock: 220000,   blurb: 'Klebt dich ans Sofa.' },
  { id: 'purple',   name: 'Purple Haze',   emoji: '🟣', color: '#e05cff', buy: 80,   sell: 235,  unlock: 1.2e6,    blurb: 'Lila Nebel, fette Marge.' },
  { id: 'zkittlez', name: 'Zkittlez',      emoji: '🌈', color: '#ff5ca8', buy: 140,  sell: 420,  unlock: 6.5e6,    blurb: 'Schmeckt den Regenbogen.' },
  { id: 'runtz',    name: 'Runtz',         emoji: '🍬', color: '#ff7ad9', buy: 250,  sell: 760,  unlock: 35e6,     blurb: 'Instagram-Weed. Zahlt jeder.' },
  { id: 'gelato',   name: 'Gelato 41',     emoji: '🍨', color: '#ffd45c', buy: 440,  sell: 1360, unlock: 180e6,    blurb: 'Dessert für Fortgeschrittene.' },
  { id: 'moon',     name: 'Moonrock',      emoji: '🌕', color: '#e8e8ff', buy: 800,  sell: 2500, unlock: 950e6,    blurb: 'Mit Oel und Kief paniert.' },
  { id: 'godfather',name: 'Godfather OG',  emoji: '🎩', color: '#ff3b3b', buy: 1500, sell: 4800, unlock: 5e9,      blurb: 'Das Angebot, das man nicht ablehnt.' },
];

/** Kundentypen: je weiter oben, desto härter die Bestellung. */
export const CUSTOMER_TYPES = {
  foot: {
    id: 'foot', label: 'Fußgänger', minG: 1, maxG: 4,
    speed: 42, tip: 0.0, heat: 1, weight: 55, patience: 14,
  },
  bike: {
    id: 'bike', label: 'Fahrrad', minG: 4, maxG: 12,
    speed: 92, tip: 0.12, heat: 2, weight: 30, patience: 11,
  },
  car: {
    id: 'car', label: 'Auto', minG: 12, maxG: 40,
    speed: 150, tip: 0.3, heat: 4, weight: 15, patience: 9,
  },
};

/**
 * Upgrades. cost(n) = base * growth^n, effect ergibt sich aus dem Level.
 * `max` = null bedeutet unbegrenzt.
 */
export const UPGRADES = [
  {
    id: 'corner', name: 'Bessere Ecke', emoji: '📍', max: 40,
    base: 60, growth: 1.28,
    desc: 'Mehr Laufkundschaft pro Minute.',
    effect: (lv) => `+${Math.round(lv * 12)}% Andrang`,
  },
  {
    id: 'homie', name: 'Homie anheuern', emoji: '🧢', max: 12,
    base: 750, growth: 2.1,
    desc: 'Verkauft automatisch für dich, auch wenn du wegschaust.',
    effect: (lv) => `${lv} Homie${lv === 1 ? '' : 's'} am Start`,
  },
  {
    id: 'hands', name: 'Schnelle Hände', emoji: '🤲', max: 25,
    base: 400, growth: 1.42,
    desc: 'Homies wickeln Deals schneller ab.',
    effect: (lv) => `-${Math.round((1 - Math.pow(0.92, lv)) * 100)}% Dealzeit`,
  },
  {
    id: 'scale', name: 'Getunte Waage', emoji: '⚖️', max: 30,
    base: 500, growth: 1.5,
    desc: 'Jedes Gramm bringt mehr Umsatz.',
    effect: (lv) => `+${Math.round(lv * 8)}% Verkaufspreis`,
  },
  {
    id: 'plug', name: 'Fetter Kontakt', emoji: '🤝', max: 20,
    base: 900, growth: 1.62,
    desc: 'Dein Großhändler macht dir bessere Preise.',
    effect: (lv) => `-${Math.round((1 - Math.pow(0.94, lv)) * 100)}% Einkauf`,
  },
  {
    id: 'bunker', name: 'Bunker ausbauen', emoji: '📦', max: 30,
    base: 300, growth: 1.44,
    desc: 'Mehr Platz im Versteck.',
    effect: (lv) => `${fmtInt(500 + lv * 750)} g Lager`,
  },
  {
    id: 'lookout', name: 'Späher posten', emoji: '👀', max: 20,
    base: 1200, growth: 1.7,
    desc: 'Weniger Aufmerksamkeit von der Streife.',
    effect: (lv) => `-${Math.round((1 - Math.pow(0.9, lv)) * 100)}% Hitze`,
  },
  {
    id: 'phone', name: 'Zweithandy', emoji: '📱', max: 15,
    base: 650, growth: 1.55,
    desc: 'Kunden warten länger, bevor sie abhauen.',
    effect: (lv) => `+${Math.round(lv * 10)}% Geduld`,
  },
  {
    id: 'word', name: 'Mundpropaganda', emoji: '🗣️', max: 25,
    base: 1100, growth: 1.58,
    desc: 'Zufriedene Kunden geben Trinkgeld.',
    effect: (lv) => `+${Math.round(lv * 6)}% Trinkgeld`,
  },
  {
    id: 'auto', name: 'Dauerauftrag', emoji: '🔁', max: 1,
    base: 5000, growth: 3,
    desc: 'Kauft automatisch nach, wenn eine Sorte fast leer ist.',
    effect: () => 'Auto-Nachschub aktiv',
  },
];

/** Hitze / Razzia */
export const HEAT = {
  max: 100,
  decayPerSec: 2.2,
  raidCashLoss: 0.25,
  raidStockLoss: 0.5,
  warnAt: 65,
};

/** Prestige: Stadt wechseln */
export const PRESTIGE = {
  minEarned: 250000,
  /** Ruf-Punkte für den bisherigen Gesamtumsatz. */
  points: (earned) => Math.floor(Math.pow(earned / PRESTIGE.minEarned, 0.55) * 5),
  bonusPerPoint: 0.04,
};

export function fmtInt(n) {
  return Math.floor(n).toLocaleString('de-DE');
}
