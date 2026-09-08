# 🌿 Drug Dealer Simulator

Ein Incremental Game im Graffiti-Look für's Handy. Du stehst als Straßendealer an
deiner Ecke: Kundschaft kommt **zu Fuß**, **mit dem Fahrrad** oder **im Auto**
vorbei und will Cannabis. Aber erst mal musst du selbst einkaufen — ohne Ware
kein Deal.

Die App ist eine installierbare **PWA**: kein Store, kein Build, läuft offline.
Auf dem Handy einfach im Browser öffnen und „Zum Startbildschirm hinzufügen".

## Spielen

```bash
npm start          # startet auf http://localhost:4173
```

Der Server nennt beim Start auch die WLAN-Adresse — die auf dem Handy öffnen,
und das Spiel läuft im Vollbild wie eine App.

Es reicht auch jeder andere statische Webserver; nötig ist nur, dass die Dateien
über `http://` ausgeliefert werden (ES-Module und der Service Worker laufen nicht
über `file://`).

## So läuft das Geschäft

1. **Einkauf** — Beim Großhändler Gramm kaufen. Startkapital: 60 €.
2. **Dealen** — Kundschaft antippen, solange sie wartet. Jeder Kunde will eine
   bestimmte Sorte in einer bestimmten Menge; die Sprechblase zeigt beides, der
   Balken darunter die Geduld. Selbst getippte Deals bringen 10 % mehr.
3. **Kundentypen** — Fußgänger nehmen 1–4 g, Radfahrer 4–12 g, Autos 12–40 g.
   Je dicker der Kunde, desto mehr Trinkgeld — und desto mehr Aufsehen.
4. **Sorten** — 12 Stück, von Bahnhofs-Gras bis Godfather OG. Je hochwertiger,
   desto lieber wird danach gefragt und desto fetter die Marge.
5. **Upgrades** — Bessere Ecke (mehr Andrang), Homies (verkaufen automatisch,
   auch offline), Waage, Kontakt, Bunker, Späher, Zweithandy, Mundpropaganda
   und der Dauerauftrag für automatischen Nachschub.
6. **Hitze** — Jeder Deal fällt auf, große Deals besonders. Bei 100 % gibt's eine
   Razzia: ein Viertel der Kasse und die Hälfte der Ware sind weg. Späher posten
   hilft — wer das ignoriert, verliert im Test rund zwei Drittel seines Umsatzes.
7. **Stadt wechseln** — Ab 250.000 € Umsatz pro Stadt kannst du umziehen: alles
   auf Anfang, dafür dauerhaft Ruf-Punkte mit +4 % Verkaufspreis pro Punkt.

Gespeichert wird automatisch im Browser (`localStorage`). Waren Homies angeheuert,
verkaufen sie auch weiter, während die App zu ist — maximal 8 Stunden.

## Aufbau

```
index.html            Grundgerüst: HUD, Canvas, Panels, Tabbar
css/style.css         Graffiti-Look, mobile first
js/config.js          Sorten, Kundentypen, Upgrades, Balance-Zahlen
js/game.js            Spielregeln: Wirtschaft, Kunden, Hitze, Speichern, Offline
js/scene.js           Canvas-Szene: Wand mit Tags, Dealer, Kundschaft, Effekte
js/ui.js              HUD, Panels, Toasts, Dialoge
js/main.js            Startpunkt, Eingabe, Spielschleife
sw.js                 Service Worker fürs Offline-Spielen
manifest.webmanifest  PWA-Manifest
tools/serve.mjs       kleiner Entwicklungsserver
tools/make-icons.mjs  erzeugt die App-Icons (npm run icons)
tools/smoke-test.mjs  Browsertest der Spielschleife (npm test)
```

Alles ist Vanilla JS ohne Framework und ohne Build-Schritt. Die einzige
Abhängigkeit ist Playwright — und die braucht nur der Test.

## Test

```bash
npm install        # nur fürs Testen nötig
npm test
```

Der Test startet das Spiel in einem echten Chromium, kauft Ware ein, verkauft per
Tipp an einen Kunden, kauft Upgrades und eine neue Sorte, prüft die Homies und
lädt den Spielstand neu.

## Hinweis

Reine Fiktion und ein Spiel mit Zahlen — keine Anleitung für irgendwas.
