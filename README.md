# Morphic — Live Page Reconstruction Engine

> **Not CSS tricks. Actual DOM reconstruction.**

## What Makes This Novel

Every other "UI customizer" extension does one of two things:
1. Applies CSS classes to hide/show elements
2. Injects a UI overlay on top of the page

**Morphic does neither.** It:

1. **Semantically classifies every element** using a role system (form-field, ad, hero, price, cta, etc.)
2. **Infers your actual intent** from real behavioral signals — scroll velocity, dwell time, form interactions, click patterns
3. **Surgically reconstructs the visible page** by hiding noise and surfacing only what matters for your intent
4. **Auto-dismisses cookie banners** (actually clicks the accept button, doesn't just hide it)
5. **Pulses required form fields** in filling mode so you never miss a mandatory input
6. **Updates in real time** as your intent changes

## Architecture

```
┌─────────────────────────────────────────┐
│  IntentEngine (behavioral analysis)     │
│  - scroll velocity (not just position)  │
│  - dwell map (1.5s threshold)           │
│  - form interaction count               │
│  - page content heuristics             │
└────────────────┬────────────────────────┘
                 │ intent signal
                 ▼
┌─────────────────────────────────────────┐
│  SemanticExtractor (DOM classification) │
│  - 15 semantic roles                    │
│  - priority scoring                     │
│  - visibility detection                 │
└────────────────┬────────────────────────┘
                 │ classified elements
                 ▼
┌─────────────────────────────────────────┐
│  Reconstructor (live DOM mutation)       │
│  - per-intent hide/dim/highlight config  │
│  - original styles preserved + restored   │
│  - auto cookie banner dismissal          │
│  - required field pulse animation        │
│  - non-destructive (page JS intact)     │
└─────────────────────────────────────────┘
```

## Intents

| Intent | Trigger Signals | What Happens |
|--------|----------------|--------------|
| `filling-form` | Form detected + you touched a field | All non-form elements dimmed, required fields pulse |
| `applying` | Form + job keywords in page | Same as form but keeps content (job description) visible |
| `shopping` | Prices + cart language detected | Products, prices, buy buttons surfaced; nav/content dimmed |
| `reading` | Slow scroll + long dwell + no form | Pure content view, all ads/nav/CTAs removed |
| `researching` | Medium scroll + many element dwells | Key data points highlighted, noise removed |
| `skimming` | Fast scroll velocity + short session | Only H1s and CTAs, everything else collapsed |

## Installation

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this folder

## Files

```
extension/
├── manifest.json
├── src/
│   ├── js/
│   │   ├── morphic.js      ← The entire engine (content script)
│   │   ├── background.js   ← Badge updates
│   │   └── popup.js        ← Control panel
│   ├── css/
│   │   └── morphic.css     ← Minimal base styles
│   └── html/
│       └── popup.html      ← Control panel UI
```

## Key Features

### 1. Semantic Element Classification
Classifies every visible element into 15 semantic roles:
- form-field, ad, hero, price, cta, content, navigation
- popup, cookie, heading, paragraph, image, form, timer, social

### 2. Behavioral Intent Detection
- **Scroll velocity** - not just position, but how fast you're scrolling
- **Dwell map** - tracks how long you hover over elements (1.5s threshold)
- **Form interactions** - counts focus events on form fields
- **Page heuristics** - analyzes URL and text content for intent signals

### 3. Live DOM Reconstruction
- Stores original styles before modification
- Applies per-intent configurations (dim, hide, highlight, pulse)
- Restores original state on deactivation
- Non-destructive - page JavaScript remains intact

### 4. Cookie Banner Auto-Dismissal
Actually clicks accept buttons, doesn't just hide them.

### 5. Required Field Pulsing
In filling mode, required form fields pulse to draw attention.

## License

ISC
