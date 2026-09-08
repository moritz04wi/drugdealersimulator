/**
 * DOM-Oberfläche: HUD, Tabs, Panels, Toasts, Dialoge.
 */
import { STRAINS, UPGRADES, HEAT, PRESTIGE } from './config.js';
import { formatShort } from './scene.js';

const $ = (sel, root = document) => root.querySelector(sel);
const euro = (n) => `${formatShort(Math.max(0, n))} €`;

export class UI {
  constructor(game) {
    this.game = game;
    this.tab = 'street';
    this.el = {
      cash: $('#cash'),
      rate: $('#rate'),
      heatBar: $('#heat-bar'),
      heatLabel: $('#heat-label'),
      stashBar: $('#stash-bar'),
      stashLabel: $('#stash-label'),
      rep: $('#rep'),
      panel: $('#panel'),
      panelTitle: $('#panel-title'),
      panelBody: $('#panel-body'),
      toasts: $('#toasts'),
      hint: $('#hint'),
      tabs: document.querySelectorAll('.tab'),
      modal: $('#modal'),
      modalBody: $('#modal-body'),
    };

    this.el.tabs.forEach((btn) => {
      btn.addEventListener('click', () => this.openTab(btn.dataset.tab));
    });
    $('#panel-close').addEventListener('click', () => this.openTab('street'));
    $('#modal-close').addEventListener('click', () => this.closeModal());

    game.on('change', () => this.markDirty());
    game.on('denied', (msg) => this.toast(msg, 'bad'));
    game.on('unlocked', (s) => this.toast(`${s.emoji} ${s.name} freigeschaltet!`, 'good'));
    game.on('upgraded', ({ upgrade, level }) => this.toast(`${upgrade.emoji} ${upgrade.name} Lv.${level}`, 'good'));
    game.on('raid', ({ lostCash, lostGrams }) => {
      this.toast(`🚨 RAZZIA! ${euro(lostCash)} und ${Math.round(lostGrams)} g weg.`, 'bad', 4000);
    });
    game.on('prestige', ({ points }) => this.toast(`🏙️ Neue Stadt! +${points} Ruf`, 'good', 4000));
    game.on('missed', () => { this.missedFlash = 1; });

    this.dirty = true;
    this.lastEarned = game.state.totalEarned;
    this.rateSamples = [];
  }

  markDirty() { this.dirty = true; }

  openTab(tab) {
    this.tab = tab;
    this.el.tabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'street') {
      this.el.panel.classList.remove('open');
      return;
    }
    this.el.panel.classList.add('open');
    this.renderPanel();
  }

  toast(text, kind = 'info', ms = 2200) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.el.toasts.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    }, ms);
  }

  showModal(html) {
    this.el.modalBody.innerHTML = html;
    this.el.modal.classList.add('open');
  }

  closeModal() { this.el.modal.classList.remove('open'); }

  // --- HUD ----------------------------------------------------------------
  update(dt) {
    const g = this.game;
    const s = g.state;

    // Umsatz pro Minute aus einem gleitenden Fenster
    const delta = s.totalEarned - this.lastEarned;
    this.lastEarned = s.totalEarned;
    this.rateSamples.push({ delta, dt });
    this.rateSpan = (this.rateSpan || 0) + dt;
    while (this.rateSpan > 15 && this.rateSamples.length > 1) {
      this.rateSpan -= this.rateSamples.shift().dt;
    }
    const sum = this.rateSamples.reduce((a, x) => a + x.delta, 0);
    const span = Math.max(3, this.rateSpan);

    this.el.cash.textContent = euro(s.cash);
    this.el.rate.textContent = `${euro(sum / span * 60)}/min`;

    const heatPct = (s.heat / HEAT.max) * 100;
    this.el.heatBar.style.width = `${heatPct}%`;
    this.el.heatBar.classList.toggle('hot', s.heat >= HEAT.warnAt);
    this.el.heatLabel.textContent = `${Math.round(heatPct)}%`;

    const stash = g.stockTotal;
    this.el.stashBar.style.width = `${Math.min(100, (stash / g.capacity) * 100)}%`;
    this.el.stashLabel.textContent = `${formatShort(stash)}/${formatShort(g.capacity)} g`;

    this.el.rep.textContent = s.rep > 0 ? `★ ${s.rep} (+${Math.round(s.rep * PRESTIGE.bonusPerPoint * 100)}%)` : '★ 0';

    this.updateHint();

    if (this.dirty && this.tab !== 'street') {
      this.renderPanel();
      this.dirty = false;
    }
  }

  updateHint() {
    const g = this.game;
    let msg = '';
    if (g.stockTotal <= 0) {
      msg = g.state.cash >= g.buyPrice(STRAINS[0].id)
        ? '📦 Erst Ware kaufen! Tippe unten auf „Einkauf".'
        : '😬 Kein Stoff, keine Kohle. Warte auf den Umzug oder fang neu an.';
    } else if (g.state.deals === 0) {
      msg = '👆 Tippe die Kundschaft an, um zu dealen.';
    } else if (g.state.heat >= HEAT.warnAt) {
      msg = '🚨 Die Streife wird aufmerksam - Späher posten!';
    }
    const hint = this.el.hint;
    if (msg) {
      hint.textContent = msg;
      hint.classList.add('show');
    } else {
      hint.classList.remove('show');
    }
  }

  // --- Panels -------------------------------------------------------------
  renderPanel() {
    const map = {
      buy: ['Einkauf', () => this.renderBuy()],
      strains: ['Sorten', () => this.renderStrains()],
      upgrades: ['Upgrades', () => this.renderUpgrades()],
      more: ['Mehr', () => this.renderMore()],
    };
    const entry = map[this.tab];
    if (!entry) return;
    this.el.panelTitle.textContent = entry[0];
    this.el.panelBody.innerHTML = entry[1]();
    this.bindPanel();
  }

  bindPanel() {
    this.el.panelBody.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [id, amount] = btn.dataset.buy.split(':');
        if (amount === 'max') this.game.buyMax(id);
        else this.game.buyStock(id, Number(amount));
      });
    });
    this.el.panelBody.querySelectorAll('[data-unlock]').forEach((btn) => {
      btn.addEventListener('click', () => this.game.unlockStrain(btn.dataset.unlock));
    });
    this.el.panelBody.querySelectorAll('[data-upgrade]').forEach((btn) => {
      btn.addEventListener('click', () => this.game.buyUpgrade(btn.dataset.upgrade));
    });
    const prestigeBtn = this.el.panelBody.querySelector('#do-prestige');
    if (prestigeBtn) {
      prestigeBtn.addEventListener('click', () => {
        const points = this.game.prestigePoints();
        this.showModal(`
          <h3>Stadt wechseln?</h3>
          <p>Du lässt alles zurück: Kohle, Ware, Upgrades und Sorten.</p>
          <p>Dafür bekommst du <b>${points} Ruf-Punkte</b> und damit dauerhaft
          <b>+${Math.round(points * PRESTIGE.bonusPerPoint * 100)}%</b> auf alle Verkaufspreise.</p>
          <div class="modal-actions">
            <button class="btn ghost" id="cancel-prestige">Doch nicht</button>
            <button class="btn go" id="confirm-prestige">Umziehen</button>
          </div>`);
        $('#cancel-prestige').addEventListener('click', () => this.closeModal());
        $('#confirm-prestige').addEventListener('click', () => {
          this.game.prestige();
          this.closeModal();
          this.openTab('street');
        });
      });
    }
    const resetBtn = this.el.panelBody.querySelector('#do-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.showModal(`
          <h3>Alles löschen?</h3>
          <p>Der komplette Spielstand wird gelöscht. Das lässt sich nicht rückgängig machen.</p>
          <div class="modal-actions">
            <button class="btn ghost" id="cancel-reset">Abbrechen</button>
            <button class="btn danger" id="confirm-reset">Löschen</button>
          </div>`);
        $('#cancel-reset').addEventListener('click', () => this.closeModal());
        $('#confirm-reset').addEventListener('click', () => {
          this.game.reset();
          this.closeModal();
          this.openTab('street');
          this.toast('Neues Spiel. Viel Glück.', 'info');
        });
      });
    }
  }

  renderBuy() {
    const g = this.game;
    const rows = g.unlockedStrains().map((s) => {
      const price = g.buyPrice(s.id);
      const stock = g.state.stock[s.id] || 0;
      const margin = ((g.sellPrice(s.id) / price - 1) * 100).toFixed(0);
      const amounts = [10, 50, 250];
      const buttons = amounts.map((a) => {
        const afford = g.state.cash >= a * price && g.freeSpace >= a;
        return `<button class="chip ${afford ? '' : 'off'}" data-buy="${s.id}:${a}">${a}g</button>`;
      }).join('');
      return `
        <div class="card" style="--accent:${s.color}">
          <div class="card-head">
            <span class="emoji">${s.emoji}</span>
            <div class="card-title">
              <b>${s.name}</b>
              <small>${euro(price)}/g einkaufen · ${euro(g.sellPrice(s.id))}/g raus · <span class="up">+${margin}%</span></small>
            </div>
            <span class="stock">${formatShort(stock)} g</span>
          </div>
          <div class="chips">${buttons}
            <button class="chip max ${g.freeSpace > 0 && g.state.cash >= price ? '' : 'off'}"
              data-buy="${s.id}:max">MAX</button>
          </div>
        </div>`;
    }).join('');

    return `
      <p class="lead">Ohne Ware kein Deal. Kauf beim Großhändler ein, verkauf auf der Straße.</p>
      ${rows}
      <p class="foot">Lager: ${formatShort(g.stockTotal)} / ${formatShort(g.capacity)} g
      ${g.autoRestock ? '· 🔁 Dauerauftrag läuft' : ''}</p>`;
  }

  renderStrains() {
    const g = this.game;
    return STRAINS.map((s) => {
      const owned = g.state.unlocked.includes(s.id);
      const afford = g.state.cash >= s.unlock;
      return `
        <div class="card ${owned ? 'owned' : ''}" style="--accent:${s.color}">
          <div class="card-head">
            <span class="emoji">${owned ? s.emoji : '🔒'}</span>
            <div class="card-title">
              <b>${s.name}</b>
              <small>${s.blurb}</small>
              <small>${euro(s.buy)}/g ein · ${euro(s.sell)}/g raus</small>
            </div>
            ${owned
              ? '<span class="tag">dabei</span>'
              : `<button class="btn ${afford ? 'go' : 'off'}" data-unlock="${s.id}">${euro(s.unlock)}</button>`}
          </div>
        </div>`;
    }).join('');
  }

  renderUpgrades() {
    const g = this.game;
    return UPGRADES.map((u) => {
      const lv = g.lvl(u.id);
      const maxed = u.max != null && lv >= u.max;
      const cost = g.upgradeCost(u.id, lv);
      const afford = g.state.cash >= cost;
      return `
        <div class="card" style="--accent:#7cff3f">
          <div class="card-head">
            <span class="emoji">${u.emoji}</span>
            <div class="card-title">
              <b>${u.name} ${lv > 0 ? `<span class="lvl">Lv.${lv}</span>` : ''}</b>
              <small>${u.desc}</small>
              <small class="${lv > 0 ? 'up' : ''}">${lv > 0 ? u.effect(lv) : 'noch nicht gekauft'}</small>
            </div>
            ${maxed
              ? '<span class="tag">MAX</span>'
              : `<button class="btn ${afford ? 'go' : 'off'}" data-upgrade="${u.id}">${euro(cost)}</button>`}
          </div>
        </div>`;
    }).join('');
  }

  renderMore() {
    const g = this.game;
    const s = g.state;
    const days = Math.max(1, Math.round((Date.now() - s.started) / 86400000));
    const canPrestige = g.canPrestige();
    const points = g.prestigePoints();
    return `
      <div class="stats">
        <div><span>Umsatz gesamt</span><b>${euro(s.totalEarned)}</b></div>
        <div><span>Verkauft</span><b>${formatShort(s.totalGrams)} g</b></div>
        <div><span>Deals</span><b>${formatShort(s.deals)}</b></div>
        <div><span>Verpasst</span><b>${formatShort(s.lostDeals)}</b></div>
        <div><span>Razzien</span><b>${formatShort(s.raids)}</b></div>
        <div><span>Umzüge</span><b>${formatShort(s.moves)}</b></div>
        <div><span>Ruf</span><b>★ ${s.rep}</b></div>
        <div><span>Am Start seit</span><b>${days} Tag${days === 1 ? '' : 'en'}</b></div>
      </div>

      <div class="card" style="--accent:#ff2e9a">
        <div class="card-head">
          <span class="emoji">🏙️</span>
          <div class="card-title">
            <b>Stadt wechseln</b>
            <small>Neustart mit Ruf-Bonus auf alle Verkaufspreise. Ab ${euro(PRESTIGE.minEarned)} Umsatz pro Stadt.</small>
            <small class="up">${canPrestige
              ? `+${points} Ruf (aktuell ★ ${s.rep})`
              : `noch ${euro(PRESTIGE.minEarned - s.runEarned)} Umsatz nötig`}</small>
          </div>
          <button class="btn ${canPrestige ? 'go' : 'off'}" id="do-prestige">Umziehen</button>
        </div>
      </div>

      <div class="card" style="--accent:#ff3b3b">
        <div class="card-head">
          <span class="emoji">🗑️</span>
          <div class="card-title">
            <b>Spielstand löschen</b>
            <small>Alles auf Anfang, inklusive Ruf.</small>
          </div>
          <button class="btn danger" id="do-reset">Reset</button>
        </div>
      </div>

      <p class="foot">Gespeichert wird automatisch auf diesem Gerät.<br>
      Fürs Handy: im Browser-Menü „Zum Startbildschirm hinzufügen".</p>`;
  }
}
