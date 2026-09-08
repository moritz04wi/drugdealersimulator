/**
 * Spielzustand und Regeln. Kennt kein DOM und kein Canvas -
 * die Oberfläche hängt sich über `on()` an die Events.
 */
import {
  SAVE_KEY, STRAINS, CUSTOMER_TYPES, UPGRADES, HEAT, PRESTIGE,
} from './config.js';

const BASE_SPAWN = 3.4;      // Sekunden zwischen Kunden, Level 0
const BASE_SERVE = 1.8;      // Sekunden, die ein Homie pro Deal braucht
const OFFLINE_CAP_H = 8;     // maximal so viele Stunden werden nachgerechnet
const OFFLINE_EFF = 0.6;     // Offline läuft das Geschäft gedrosselt

const upgradeById = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
const strainById = Object.fromEntries(STRAINS.map((s) => [s.id, s]));

function freshState() {
  return {
    cash: 60,
    totalEarned: 0,
    totalGrams: 0,
    deals: 0,
    lostDeals: 0,
    raids: 0,
    heat: 0,
    rep: 0,               // Ruf-Punkte aus Umzügen
    moves: 0,             // Anzahl Stadtwechsel
    runEarned: 0,         // Umsatz seit dem letzten Umzug
    unlocked: [STRAINS[0].id],
    stock: { [STRAINS[0].id]: 0 },
    upgrades: {},
    lastSeen: Date.now(),
    started: Date.now(),
  };
}

export class Game {
  constructor() {
    this.state = freshState();
    this.customers = [];
    this.listeners = {};
    this.spawnTimer = 1.5;
    this.nextId = 1;
    this.offlineReport = null;
  }

  // --- Events -------------------------------------------------------------
  on(event, fn) {
    (this.listeners[event] ||= []).push(fn);
    return this;
  }

  emit(event, payload) {
    (this.listeners[event] || []).forEach((fn) => fn(payload));
  }

  // --- Abgeleitete Werte --------------------------------------------------
  lvl(id) { return this.state.upgrades[id] || 0; }

  get spawnInterval() { return BASE_SPAWN / (1 + 0.12 * this.lvl('corner')); }
  get serveTime() { return BASE_SERVE * Math.pow(0.92, this.lvl('hands')); }
  get homies() { return this.lvl('homie'); }
  get capacity() { return 500 + 750 * this.lvl('bunker'); }
  get buyMult() { return Math.pow(0.94, this.lvl('plug')); }
  get heatMult() { return Math.pow(0.9, this.lvl('lookout')); }
  get patienceMult() { return 1 + 0.1 * this.lvl('phone'); }
  get tipMult() { return 1 + 0.06 * this.lvl('word'); }
  get repMult() { return 1 + this.state.rep * PRESTIGE.bonusPerPoint; }
  get priceMult() { return (1 + 0.08 * this.lvl('scale')) * this.repMult; }
  get autoRestock() { return this.lvl('auto') > 0; }

  get stockTotal() {
    return Object.values(this.state.stock).reduce((a, b) => a + b, 0);
  }

  get freeSpace() { return Math.max(0, this.capacity - this.stockTotal); }

  unlockedStrains() {
    return STRAINS.filter((s) => this.state.unlocked.includes(s.id));
  }

  nextLockedStrain() {
    return STRAINS.find((s) => !this.state.unlocked.includes(s.id)) || null;
  }

  upgradeCost(id, level = this.lvl(id)) {
    const u = upgradeById[id];
    return Math.ceil(u.base * Math.pow(u.growth, level));
  }

  buyPrice(strainId) { return strainById[strainId].buy * this.buyMult; }
  sellPrice(strainId) { return strainById[strainId].sell * this.priceMult; }

  /** Verkaufspreis pro Gramm inkl. Trinkgeld des Kundentyps. */
  dealPrice(strainId, typeId) {
    const type = CUSTOMER_TYPES[typeId];
    return this.sellPrice(strainId) * (1 + type.tip * this.tipMult);
  }

  // --- Aktionen -----------------------------------------------------------
  /** Kauft `grams` einer Sorte ein. Gibt die tatsächlich gekaufte Menge zurück. */
  buyStock(strainId, grams) {
    if (!this.state.unlocked.includes(strainId)) return 0;
    const price = this.buyPrice(strainId);
    const affordable = Math.floor(this.state.cash / price);
    const amount = Math.min(grams, affordable, this.freeSpace);
    if (amount <= 0) {
      this.emit('denied', this.freeSpace <= 0 ? 'Bunker ist voll!' : 'Zu wenig Kohle!');
      return 0;
    }
    this.state.cash -= amount * price;
    this.state.stock[strainId] = (this.state.stock[strainId] || 0) + amount;
    this.emit('bought', { strainId, amount, cost: amount * price });
    this.emit('change');
    return amount;
  }

  /** Kauft so viel wie möglich von einer Sorte. */
  buyMax(strainId) {
    return this.buyStock(strainId, this.freeSpace);
  }

  unlockStrain(strainId) {
    const strain = strainById[strainId];
    if (!strain || this.state.unlocked.includes(strainId)) return false;
    if (this.state.cash < strain.unlock) {
      this.emit('denied', 'Zu wenig Kohle!');
      return false;
    }
    this.state.cash -= strain.unlock;
    this.state.unlocked.push(strainId);
    this.state.stock[strainId] = this.state.stock[strainId] || 0;
    this.emit('unlocked', strain);
    this.emit('change');
    return true;
  }

  buyUpgrade(id) {
    const u = upgradeById[id];
    const level = this.lvl(id);
    if (u.max != null && level >= u.max) return false;
    const cost = this.upgradeCost(id, level);
    if (this.state.cash < cost) {
      this.emit('denied', 'Zu wenig Kohle!');
      return false;
    }
    this.state.cash -= cost;
    this.state.upgrades[id] = level + 1;
    this.emit('upgraded', { upgrade: u, level: level + 1 });
    this.emit('change');
    return true;
  }

  // --- Kunden -------------------------------------------------------------
  /** Sorte, die ein Kunde haben will - je hochwertiger, desto begehrter. */
  pickStrain() {
    const list = this.unlockedStrains();
    const weights = list.map((_, i) => Math.pow(1.7, i));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  pickType() {
    const types = Object.values(CUSTOMER_TYPES);
    const total = types.reduce((a, t) => a + t.weight, 0);
    let roll = Math.random() * total;
    for (const t of types) {
      roll -= t.weight;
      if (roll <= 0) return t;
    }
    return types[0];
  }

  spawnCustomer() {
    const type = this.pickType();
    const strain = this.pickStrain();
    const grams = Math.round(type.minG + Math.random() * (type.maxG - type.minG));
    const customer = {
      id: this.nextId++,
      type: type.id,
      strainId: strain.id,
      grams,
      speed: type.speed,
      patience: type.patience * this.patienceMult,
      maxPatience: type.patience * this.patienceMult,
      dir: Math.random() < 0.5 ? 1 : -1,
      x: 0,                 // wird von der Szene gesetzt
      lane: type.id === 'car' ? 0 : type.id === 'bike' ? 1 : 2,
      phase: 'arriving',    // arriving -> waiting -> leaving
      anim: Math.random() * 10,
      servedBy: null,
      serveLeft: 0,
      bounce: 0,
    };
    this.customers.push(customer);
    this.emit('spawn', customer);
    return customer;
  }

  /** Verkauft an einen Kunden. `manual` gibt einen kleinen Bonus. */
  serve(customer, manual = false) {
    if (customer.phase === 'leaving' || customer.done) return null;
    const have = this.state.stock[customer.strainId] || 0;
    if (have <= 0) {
      customer.done = true;
      customer.phase = 'leaving';
      customer.mood = 'angry';
      this.state.lostDeals++;
      this.emit('missed', customer);
      this.emit('change');
      return null;
    }
    const grams = Math.min(have, customer.grams);
    const partial = grams < customer.grams;
    const price = this.dealPrice(customer.strainId, customer.type);
    const bonus = manual ? 1.1 : 1;      // Selber dealen zahlt sich aus
    const revenue = grams * price * bonus;

    this.state.stock[customer.strainId] = have - grams;
    this.state.cash += revenue;
    this.state.totalEarned += revenue;
    this.state.runEarned += revenue;
    this.state.totalGrams += grams;
    this.state.deals++;
    // Große Deals fallen mehr auf als ein Gramm für den Nachbarn.
    this.addHeat(CUSTOMER_TYPES[customer.type].heat * (1 + grams / 40));

    customer.done = true;
    customer.phase = 'leaving';
    customer.mood = partial ? 'meh' : 'happy';
    this.emit('sold', { customer, grams, revenue, partial, manual });
    this.emit('change');
    return revenue;
  }

  addHeat(amount) {
    this.state.heat = Math.min(HEAT.max, this.state.heat + amount * this.heatMult);
    if (this.state.heat >= HEAT.max) this.raid();
  }

  raid() {
    const lostCash = this.state.cash * HEAT.raidCashLoss;
    this.state.cash -= lostCash;
    let lostGrams = 0;
    for (const id of Object.keys(this.state.stock)) {
      const gone = this.state.stock[id] * HEAT.raidStockLoss;
      this.state.stock[id] -= gone;
      lostGrams += gone;
    }
    this.state.heat = 0;
    this.state.raids++;
    this.customers.forEach((c) => { c.phase = 'leaving'; c.done = true; });
    this.emit('raid', { lostCash, lostGrams });
    this.emit('change');
  }

  // --- Prestige -----------------------------------------------------------
  prestigePoints() {
    if (this.state.runEarned < PRESTIGE.minEarned) return 0;
    return Math.max(1, PRESTIGE.points(this.state.runEarned));
  }

  canPrestige() { return this.prestigePoints() > 0; }

  prestige() {
    const points = this.prestigePoints();
    if (points <= 0) return false;
    const keep = {
      rep: this.state.rep + points,
      moves: this.state.moves + 1,
      totalEarned: this.state.totalEarned,
      totalGrams: this.state.totalGrams,
      deals: this.state.deals,
      lostDeals: this.state.lostDeals,
      raids: this.state.raids,
      started: this.state.started,
    };
    this.state = { ...freshState(), ...keep, runEarned: 0 };
    this.customers = [];
    this.emit('prestige', { points });
    this.emit('change');
    return true;
  }

  // --- Auto-Nachschub -----------------------------------------------------
  runAutoRestock() {
    if (!this.autoRestock) return;
    const list = this.unlockedStrains();
    // Von hinten: die teuerste freigeschaltete Sorte bekommt zuerst Nachschub.
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      const have = this.state.stock[s.id] || 0;
      const target = Math.floor(this.capacity / Math.min(3, list.length));
      if (have >= target * 0.25) continue;
      const price = this.buyPrice(s.id);
      const budget = this.state.cash * 0.5;
      const want = Math.min(target - have, Math.floor(budget / price), this.freeSpace);
      if (want > 0) {
        this.state.cash -= want * price;
        this.state.stock[s.id] = have + want;
      }
    }
  }

  // --- Hauptschleife ------------------------------------------------------
  tick(dt) {
    this.state.heat = Math.max(0, this.state.heat - HEAT.decayPerSec * dt);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer += this.spawnInterval;
      if (this.customers.length < 14) this.spawnCustomer();
    }

    let busyHomies = this.customers.filter((c) => c.servedBy != null).length;

    for (const c of this.customers) {
      c.anim += dt;
      if (c.phase !== 'waiting') continue;

      if (c.servedBy == null && busyHomies < this.homies) {
        c.servedBy = 'homie';
        c.serveLeft = this.serveTime;
        busyHomies++;
      }
      if (c.servedBy != null) {
        c.serveLeft -= dt;
        if (c.serveLeft <= 0) this.serve(c, false);
        continue;
      }
      c.patience -= dt;
      if (c.patience <= 0) {
        c.phase = 'leaving';
        c.done = true;
        c.mood = 'angry';
        this.state.lostDeals++;
        this.emit('missed', c);
      }
    }

    this.customers = this.customers.filter((c) => !c.remove);

    if (this.autoRestock) {
      this.autoTimer = (this.autoTimer || 0) - dt;
      if (this.autoTimer <= 0) {
        this.autoTimer = 2;
        this.runAutoRestock();
      }
    }
  }

  // --- Speichern / Laden --------------------------------------------------
  save() {
    this.state.lastSeen = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
      return true;
    } catch (err) {
      return false;
    }
  }

  load() {
    let raw;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (err) {
      return false;
    }
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      this.state = { ...freshState(), ...data };
      // Sorten, die es (noch) nicht gibt, rausfiltern.
      this.state.unlocked = this.state.unlocked.filter((id) => strainById[id]);
      if (!this.state.unlocked.length) this.state.unlocked = [STRAINS[0].id];
      this.offlineReport = this.simulateOffline();
      return true;
    } catch (err) {
      return false;
    }
  }

  reset() {
    this.state = freshState();
    this.customers = [];
    try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* egal */ }
    this.emit('change');
  }

  /**
   * Rechnet grob nach, was die Homies während der Abwesenheit verdient haben.
   * Ohne Homies passiert nichts - der Laden macht sich nicht von allein.
   */
  simulateOffline() {
    const seconds = Math.min(
      OFFLINE_CAP_H * 3600,
      Math.max(0, (Date.now() - (this.state.lastSeen || Date.now())) / 1000),
    );
    if (seconds < 60 || this.homies <= 0) return null;

    const rate = Math.min(1 / this.spawnInterval, this.homies / this.serveTime);
    let customers = Math.floor(rate * seconds * OFFLINE_EFF);
    if (customers <= 0) return null;

    // Durchschnittlicher Kunde
    const types = Object.values(CUSTOMER_TYPES);
    const wSum = types.reduce((a, t) => a + t.weight, 0);
    const avgG = types.reduce((a, t) => a + t.weight * (t.minG + t.maxG) / 2, 0) / wSum;
    const avgTip = types.reduce((a, t) => a + t.weight * t.tip, 0) / wSum;

    const list = this.unlockedStrains();
    const weights = list.map((_, i) => Math.pow(1.7, i));
    const total = weights.reduce((a, b) => a + b, 0);
    const share = weights.map((w) => w / total);

    let grams = 0;
    let revenue = 0;
    let spent = 0;

    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      let want = customers * share[i] * avgG;
      const have = this.state.stock[s.id] || 0;
      let sold = Math.min(want, have);
      this.state.stock[s.id] = have - sold;

      if (this.autoRestock && sold < want) {
        // Dauerauftrag kauft nach, solange Geld da ist.
        const missing = want - sold;
        const price = this.buyPrice(s.id);
        const affordable = Math.floor((this.state.cash - spent) / price);
        const extra = Math.max(0, Math.min(missing, affordable));
        spent += extra * price;
        sold += extra;
      }
      grams += sold;
      revenue += sold * this.sellPrice(s.id) * (1 + avgTip * this.tipMult);
    }

    if (grams <= 0) return null;
    const profit = revenue - spent;
    this.state.cash += profit;
    this.state.totalEarned += Math.max(0, profit);
    this.state.runEarned += Math.max(0, profit);
    this.state.totalGrams += grams;
    this.state.deals += Math.round(grams / avgG);
    this.state.heat = 0;
    return { seconds, profit, grams };
  }
}
