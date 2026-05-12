# Design System — Dumb Decision TTRPG Website
**Richtung: Arcane Codex** — Dark Academia × Modern Web

---

## Farbpalette

| Token         | Hex       | Verwendung                              |
|---------------|-----------|------------------------------------------|
| `--bg`        | `#0C0904` | Haupthintergrund (warmes Schwarz)        |
| `--bg2`       | `#110D07` | Karten, Sektionen, elevated Elemente     |
| `--parch`     | `#9B7F5A` | Primärer Akzent (Pergament, Logo-Farbe)  |
| `--parch-lt`  | `#C4A07A` | Heller Pergament-Ton, Hover-States       |
| `--gold`      | `#C9922A` | Sekundärer Akzent, CTAs, Ornamente       |
| `--text`      | `#E2D8C8` | Fließtext (helles Pergament)             |
| `--dim`       | `#7A6A56` | Sekundärtext, Platzhalter, Labels        |
| `--border`    | `rgba(155,127,90,0.18)` | Rahmen, Divider              |

## Typografie

| Einsatz       | Font              | Gewicht / Stil                    |
|---------------|-------------------|-----------------------------------|
| Überschriften | EB Garamond       | 400 (Regular), 400 Italic         |
| Subheadings   | EB Garamond       | 500 / 600                         |
| Navigation    | Inter             | 400 (300 Spacing, uppercase)      |
| Fließtext     | Inter             | 300                               |
| Labels/Eyebrows | Inter           | 300, spaced, uppercase            |

**Schriftgrößen:**
- Display (Hero h1): clamp(3.5rem, 9vw, 7rem)
- H2: clamp(2rem, 4vw, 2.8rem)
- H3: 1.25–1.4rem
- Body: 0.9–0.95rem
- Labels/Caps: 0.68–0.72rem, letter-spacing: 0.2–0.35em

## Formelemente

- **Buttons:** Rahmen-Stil (border: 1px solid), kein Radius, transparenter Hintergrund mit hover-fill
- **Karten:** 1px solid border, var(--bg2) Background, kein Border-Radius, hover: border-color aufhellen
- **Ornamente:** horizontale Linien + Glyph (✦), Gold-Farbe
- **Scroll-Indicator:** 1px vertikale Linie, Gradient nach unten

## Abstände & Layout

- **Nav-Padding:** 1.75rem 5rem
- **Section-Padding:** 6–8rem 5rem
- **Max-Width Content:** 1100px, margin: 0 auto
- **Grid-Gap (Cards):** 2px (fast nahtlos)
- **Grain-Overlay:** 3.5% opacity, fixed, z-index 9999

## Effekte

- **Grain Texture:** SVG fractalNoise Overlay, opacity 3.5%, fixed
- **Radial Glow:** rgba(155,127,90,0.07) ellipse, centered im Hero
- **Logo Shadow:** drop-shadow(0 0 50px rgba(155,127,90,0.25))
- **Scroll Line:** 1px gradient nach unten (var(--parch) → transparent)

## Logo-Verwendung

- **Auf dunklem Hintergrund:** `logo-color.png` (Braun/Pergament auf Schwarz) — bevorzugt
- **Alternativ:** `logo-white.png` (Weiß transparent) für Bereich ohne Hintergrundkontrast
- **Logo-Größe im Hero:** 160–180px

## Seitenstruktur

1. **Landing** — Hero (Logo + Eyebrow + H1 + CTA) → Ornament → Intro-Grid → World-Teaser → Footer
2. **Über Uns** — Geschichte, Team (Spieler + Rolle), Systeme, Project Mysteria Vision
3. **Caerathis** — Welt-Beschreibung, statisch, atmosphärisch
4. **Kontakt** — Formular + E-Mail-Anzeige + Discord-Link

## Ton & Stimme

- Warm, einladend, etwas literarisch — nicht akademisch-trocken
- EB Garamond Italic für Zitate und Intro-Sätze
- Eyebrows in Caps und Spacing für Orientierung
- Kein generischer Marketing-Jargon

---

*Letzte Änderung: 2026-05-12 — Richtung Arcane Codex bestätigt*
