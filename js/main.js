/**
 * Startpunkt: verdrahtet Spiel, Szene und Oberfläche und lässt die Schleife laufen.
 */
import { Game } from './game.js';
import { Scene, formatShort } from './scene.js';
import { UI } from './ui.js';

const canvas = document.getElementById('scene');
const game = new Game();
const loaded = game.load();
const scene = new Scene(canvas, game);
const ui = new UI(game);

// Offline-Bericht zeigen, falls die Homies weitergearbeitet haben.
if (loaded && game.offlineReport) {
  const { seconds, profit, grams } = game.offlineReport;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  ui.showModal(`
    <h3>🧢 Deine Homies haben durchgezogen</h3>
    <p>Du warst <b>${h > 0 ? `${h} h ` : ''}${m} min</b> weg.</p>
    <p>In der Zeit sind <b>${formatShort(grams)} g</b> über den Tresen gegangen:</p>
    <p class="big">+ ${formatShort(Math.max(0, profit))} €</p>
    <div class="modal-actions">
      <button class="btn go" id="offline-ok">Weiter dealen</button>
    </div>`);
  document.getElementById('offline-ok').addEventListener('click', () => ui.closeModal());
} else if (!loaded) {
  ui.showModal(`
    <h3>🌿 Willkommen am Block</h3>
    <p>Du bist neu auf der Straße. So läuft der Hase:</p>
    <ol>
      <li><b>Einkauf:</b> Erst Ware besorgen - ohne Stoff kein Geschäft.</li>
      <li><b>Dealen:</b> Kundschaft kommt zu Fuß, mit dem Rad oder im Auto. Antippen zum Verkaufen.</li>
      <li><b>Wachsen:</b> Neue Sorten freischalten, Homies anheuern, Bunker ausbauen.</li>
      <li><b>Aufpassen:</b> Jeder Deal macht Hitze. Zu viel davon gibt eine Razzia.</li>
    </ol>
    <div class="modal-actions">
      <button class="btn go" id="intro-ok">Los geht's</button>
    </div>`);
  document.getElementById('intro-ok').addEventListener('click', () => {
    ui.closeModal();
    ui.openTab('buy');
  });
}

// --- Eingabe --------------------------------------------------------------
function pointerPos(evt) {
  const rect = canvas.getBoundingClientRect();
  return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

canvas.addEventListener('pointerdown', (evt) => {
  evt.preventDefault();
  const { x, y } = pointerPos(evt);
  const customer = scene.hit(x, y);
  if (customer && customer.phase === 'waiting') {
    game.serve(customer, true);
    if (navigator.vibrate) navigator.vibrate(12);
  } else {
    scene.burst(x, y, 'rgba(255,255,255,0.5)');
  }
}, { passive: false });

// --- Schleife -------------------------------------------------------------
let last = performance.now();
let saveTimer = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  game.tick(dt);
  scene.update(dt);
  scene.draw();
  ui.update(dt);

  saveTimer += dt;
  if (saveTimer > 10) {
    saveTimer = 0;
    game.save();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- Fenster / Lebenszyklus ----------------------------------------------
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => scene.resize(), 150);
});
window.addEventListener('orientationchange', () => setTimeout(() => scene.resize(), 250));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.save();
  else last = performance.now();
});
window.addEventListener('pagehide', () => game.save());

// Doppeltipp-Zoom auf dem Handy unterbinden.
document.addEventListener('gesturestart', (e) => e.preventDefault());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline egal */ });
  });
}

// Für die Konsole, praktisch beim Nachjustieren.
window.dds = { game, scene, ui };
