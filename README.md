# Reality Layer

**Intent-Aware Dynamic Interface Reconstruction Extension**

> A Chrome Extension (MV3) that reconstructs web interfaces in real-time based on inferred user intent —
> suppressing dark patterns, highlighting critical elements, and adapting page structure to match the
> user's current task context. Runs entirely client-side. Zero data exfiltration.

[![Manifest Version](https://img.shields.io/badge/Manifest-v3-blue?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-yellow?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/License-ISC-green?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Chrome-4285F4?style=flat-square&logo=googlechrome)](https://chrome.google.com/webstore)
[![Storage](https://img.shields.io/badge/Storage-IndexedDB%20%2B%20chrome.storage-orange?style=flat-square)]()
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local-brightgreen?style=flat-square)]()

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Architecture](#2-system-architecture)
3. [Execution Contexts](#3-execution-contexts)
4. [Module Breakdown](#4-module-breakdown)
   - 4.1 [background.js — Service Worker](#41-backgroundjs--service-worker)
   - 4.2 [content_script.js — DOM Orchestrator](#42-content_scriptjs--dom-orchestrator)
   - 4.3 [intent-inference.js — Behavioral Signal Engine](#43-intent-inferencejs--behavioral-signal-engine)
   - 4.4 [dark-pattern-detector.js — Pattern Scanner](#44-dark-pattern-detectorjs--pattern-scanner)
   - 4.5 [memory-graph.js — Persistent Research Graph](#45-memory-graphjs--persistent-research-graph)
   - 4.6 [popup.js / popup.html — Control Panel](#46-popupjs--popuphtml--control-panel)
5. [Transformation Engine](#5-transformation-engine)
6. [Mode System](#6-mode-system)
7. [Dark Pattern Detection](#7-dark-pattern-detection)
8. [Intent Inference Pipeline](#8-intent-inference-pipeline)
9. [Memory Graph & IndexedDB Schema](#9-memory-graph--indexeddb-schema)
10. [Message Passing Protocol](#10-message-passing-protocol)
11. [Data Flow — End to End](#11-data-flow--end-to-end)
12. [State Management](#12-state-management)
13. [CSS Overlay System](#13-css-overlay-system)
14. [Storage Architecture](#14-storage-architecture)
15. [Permissions Model](#15-permissions-model)
16. [Project Structure](#16-project-structure)
17. [Installation](#17-installation)
18. [Usage Guide](#18-usage-guide)
19. [Configuration & Extending](#19-configuration--extending)
20. [Performance Considerations](#20-performance-considerations)
21. [Security & Privacy Model](#21-security--privacy-model)
22. [Tech Stack](#22-tech-stack)
23. [Known Limitations](#23-known-limitations)
24. [Roadmap](#24-roadmap)
25. [Contributing](#25-contributing)
26. [Author](#26-author)

---

## 1. Overview

Most browser extensions operate on a simple model: a user manually triggers an action, and the
extension executes it. Reality Layer inverts this. It continuously observes how a user interacts
with a page — their scroll velocity, hover targets, click cadence, time-on-section — and infers
*what they are trying to do*. It then silently reshapes the page to serve that goal.

The result is a personal UI layer that sits transparently between the user and every website:

```
  ┌──────────────────────────────────────────────┐
  │               What the user sees             │
  │                                              │
  │   [ Reconstructed, intent-aware interface ]  │
  │                                              │
  └──────────────────┬───────────────────────────┘
                     │  Reality Layer transforms
  ┌──────────────────▼───────────────────────────┐
  │               Original website               │
  │   [ Static, one-size-fits-all interface ]    │
  └──────────────────────────────────────────────┘
```

**Core capabilities:**

- **Intent Detection** — classifies user behavior into reading, skimming, form-filling, shopping, or
  researching in real time
- **DOM Reconstruction** — hides noise (ads, navbars, popups), highlights signal (required fields,
  prices, headings), dims irrelevant content
- **Dark Pattern Neutralization** — detects and optionally disarms 7 categories of manipulative UI
  patterns using regex + DOM inspection
- **Cross-Session Memory** — an IndexedDB-backed knowledge graph links research entities across
  visits and surfaces contradictions between sources
- **Zero Egress** — all computation and storage are local; no API calls, no telemetry

---

## 2. System Architecture

```
╔══════════════════════════════════════════════════════════════════════╗
║                          Chrome Browser                              ║
║                                                                      ║
║  ┌─────────────────────┐          ┌──────────────────────────────┐  ║
║  │      popup.html     │          │        background.js         │  ║
║  │      popup.js       │          │      (Service Worker)        │  ║
║  │                     │          │                              │  ║
║  │  ◈ Mode Selector    │─────────►│  ┌──────────────────────┐   │  ║
║  │  ◈ Toggle Layer     │  runtime │  │  activeModes Map     │   │  ║
║  │  ◈ Preferences      │  message │  │  pageAnalysisCache   │   │  ║
║  │  ◈ Custom Mode      │◄─────────│  │  preferences {}      │   │  ║
║  └─────────────────────┘          │  └──────────┬───────────┘   │  ║
║                                   │             │                │  ║
║                                   │    tabs.sendMessage          │  ║
║                                   │             │                │  ║
║                                   │    ┌────────▼───────────┐   │  ║
║                                   │    │   IndexedDB        │   │  ║
║                                   │    │  RealityLayer DB   │   │  ║
║                                   │    │  ├── entities      │   │  ║
║                                   │    │  ├── relationships │   │  ║
║                                   │    │  └── sessions      │   │  ║
║                                   │    └────────────────────┘   │  ║
║                                   └──────────────┬───────────────┘  ║
║                                                  │ tabs.sendMessage  ║
║  ┌───────────────────────────────────────────────▼──────────────┐  ║
║  │                    Web Page (every tab)                       │  ║
║  │                                                               │  ║
║  │  ┌─────────────────────────────────────────────────────────┐ │  ║
║  │  │               content_script.js                         │ │  ║
║  │  │  ┌────────────┐  ┌───────────────┐  ┌───────────────┐  │ │  ║
║  │  │  │PageScanner │  │  ModeSystem   │  │ UITransformer │  │ │  ║
║  │  │  └────────────┘  └───────────────┘  └───────────────┘  │ │  ║
║  │  │                    MutationObserver                      │ │  ║
║  │  └─────────────────────────────────────────────────────────┘ │  ║
║  │                                                               │  ║
║  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐  │  ║
║  │  │dark-pattern-     │  │intent-inference  │  │memory-     │  │  ║
║  │  │detector.js       │  │.js               │  │graph.js    │  │  ║
║  │  │                  │  │                  │  │            │  │  ║
║  │  │ Regex scanner    │  │ Scroll tracker   │  │ IndexedDB  │  │  ║
║  │  │ 7 pattern types  │  │ Hover tracker    │  │ CRUD ops   │  │  ║
║  │  │ Neutralizer      │  │ Click tracker    │  │ Graph ops  │  │  ║
║  │  └──────────────────┘  └──────────────────┘  └────────────┘  │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 3. Execution Contexts

Chrome extensions run code across multiple isolated contexts. Understanding which context a file runs
in is essential for understanding how communication works.

```
  Execution Context       File(s)                   Lifetime
  ──────────────────────────────────────────────────────────────────
  Service Worker          background.js             Spawned on demand,
                                                    terminated when idle
                                                    (MV3 constraint)

  Content Script          content_script.js         Lives as long as the
  (injected per tab)      modules/dark-pattern-     tab's page is open;
                          detector.js               re-injected on nav
                          modules/intent-
                          inference.js
                          modules/memory-graph.js

  Extension Page          popup.html / popup.js     Lives only while
  (popup context)                                   popup is open

  Extension Page          custom_mode.html          Lives as a Chrome
  (new tab)                                         tab
  ──────────────────────────────────────────────────────────────────
```

**Key MV3 constraint:** The service worker (`background.js`) is not persistent. It can be terminated
by Chrome at any time when idle. `activeModes` and `pageAnalysisCache` are in-memory Maps and are
lost on termination. Durable state must go to `chrome.storage` or `IndexedDB`.

---

## 4. Module Breakdown

### 4.1 `background.js` — Service Worker

The central routing and intelligence hub. All cross-context communication passes through here.

**Internal state:**

```
  RealityLayer object
  ├── activeModes       : Map<tabId → { mode, rules, timestamp }>
  ├── pageAnalysisCache : Map<tabId → PageAnalysis>
  ├── userModes         : {}        (loaded from chrome.storage.sync)
  └── preferences       : {
        autoSuggest: true,
        showNotifications: true,
        intentInference: true
      }
```

**Initialization sequence:**

```
  RealityLayer.initialize()
        │
        ├── loadStoredState()
        │       └── chrome.storage.sync.get(['modes','preferences','customModes'])
        │
        └── setupEventListeners()
                ├── chrome.runtime.onMessage  → handleMessage()
                └── chrome.tabs.onUpdated     → analyzePage() on status='complete'
```

**Page classification decision tree:**

```
  classifyPage(url, title)
         │
         ├── url includes "job" | "career" | "apply"      ──► "job"
         │
         ├── url includes "checkout" | "cart" | "buy"     ──► "checkout"
         │
         ├── url includes "learn" | "doc" | "article"     ──► "learning"
         │
         ├── url includes "research" | "search"           ──► "research"
         │
         └── default                                      ──► "focus"
```

**Message routing table:**

```
  Message Type          Handler                     Side Effects
  ─────────────────────────────────────────────────────────────────────
  ANALYZE_PAGE          analyzePage()               pageAnalysisCache.set
                                                    → MODE_SUGGESTION to tab
  GET_MODE              activeModes.get(tabId)      —
  SET_MODE              setMode()                   activeModes.set
                                                    → APPLY_MODE to tab
  GET_ANALYSIS          pageAnalysisCache.get        —
  TOGGLE_LAYER          toggleLayer()               activeModes.delete
                                                    → DISABLE_LAYER to tab
  GET_PREFERENCES       this.preferences            —
  SET_PREFERENCES       setPreferences()            chrome.storage.sync.set
  INFER_INTENT          classifyIntent(signals)     —
  GET_MEMORY_GRAPH      getMemoryGraph(url)         IndexedDB read
  SAVE_TO_GRAPH         saveToGraph(data)           IndexedDB write
  TOGGLE_SIDEBAR        toggleSidebar()             → TOGGLE_SIDEBAR to tab
  PAGE_SCANNED          console.log                 —
  TOGGLE_COMPARE        { success: true }           —
  ─────────────────────────────────────────────────────────────────────
```

---

### 4.2 `content_script.js` — DOM Orchestrator

Injected into every page at `document_end`. This is the only context with direct DOM access.
Contains four cooperating constructs:

**`RealityLayerContent` (singleton object)**

```
  RealityLayerContent
  ├── currentMode       : string | null
  ├── activeRules       : Rule[]
  ├── isEnabled         : boolean
  ├── domObserver       : MutationObserver
  ├── overlayContainer  : HTMLDivElement (#reality-layer-container)
  ├── sidebarVisible    : boolean
  └── sidebarElement    : HTMLDivElement | null
```

**Initialization sequence:**

```
  RealityLayerContent.initialize()
        │
        ├── createOverlayContainer()
        │       └── Appends <div id="reality-layer-container"> to body
        │
        ├── setupMessageListener()
        │       └── chrome.runtime.onMessage → handleMessage()
        │
        ├── setupMutationObserver()
        │       └── MutationObserver on document.body
        │             { childList:true, subtree:true, attributes:true, characterData:true }
        │
        └── scanAndAnalyze()
                └── PageScanner.scan(document.body) → PAGE_SCANNED → background
```

**`PageScanner` (class)**

Performs a structural read of the page on initialization:

```
  PageScanner.scan(root)
  └── returns {
        forms       : [{ action, method, fields:[{name,type,required,label}] }]
        headings    : [{ level, text }]
        buttons     : [{ text, type }]
        links       : [{ href, text }]
        inputs      : [{ name, type, id }]
        mainContent : Element | null   ← querySelector('main,[role="main"],.main,article')
        sidebar     : Element | null   ← querySelector('aside,[role="complementary"],.sidebar')
      }
```

**`ModeSystem` (object)**

Declarative registry mapping mode names to transformation rule sets:

```
  ModeSystem.modes
  ├── focus        → 4 rules  (hide headers, ads, popups, sidebars)
  ├── job          → 3 rules  (dim optional fields, highlight required, highlight submit)
  ├── learning     → 2 rules  (tooltip on p/li/td, highlight h1–h4)
  ├── research     → 2 rules  (extractable main/article, trackable links)
  ├── checkout     → 3 rules  (highlight prices, flag timers, highlight fees)
  └── accessibility→ 2 rules  (contrast filter on body, font-size 120%)
```

**`UITransformer` (class)**

Applies and reverses all DOM mutations:

```
  UITransformer
  ├── applyTransformations(rules)
  │       └── foreach rule → applyRule(rule)
  │
  ├── applyRule(rule)
  │       ├── "hide"        → hideElements()
  │       ├── "dim"         → dimElements()
  │       ├── "highlight"   → highlightElements()
  │       ├── "style"       → styleElements()
  │       ├── "addTooltip"  → addTooltips()
  │       ├── "flag"        → flagElements()
  │       └── "extractable" / "trackable" → markElements()
  │
  └── clearTransformations()
          ├── Remove <style id="reality-layer-transformations">
          ├── Restore data-rl-original-display on all hidden elements
          └── Remove .rl-dimmed, .rl-highlighted, .rl-flagged, .rl-tooltip-enabled
```

**MutationObserver debounce logic:**

```
  DOM mutation detected
        │
        └── mutations.some(m => m.type === 'childList'
                             && (m.addedNodes.length > 0
                              || m.removedNodes.length > 0))
                │
                └── YES → debounce(reapplyTransformations, 100ms)
```

---

### 4.3 `intent-inference.js` — Behavioral Signal Engine

Runs passively in the content script context. Attaches three passive event listeners and builds a
behavioral signal profile that is used to classify user intent.

**Signal collection:**

```
  Scroll Tracker
  ├── Event: window 'scroll' (passive)
  ├── Records: { position: scrollY/maxScrollY, time: elapsed }
  ├── Buffer: last 100 ticks (ring buffer via slice(-100))
  └── Computes: scrollBehavior = max(positions) - min(positions)
                direction = "up" | "down" based on first/second half averages

  Hover Tracker
  ├── Event: document 'mouseover' (passive)
  ├── formFields : target is INPUT | SELECT | TEXTAREA
  ├── products   : target.closest('[class*="product|item|card"]')
  └── links      : target.tagName === 'A'

  Click Tracker
  ├── Event: document 'click' (passive)
  ├── Records: { element: tagName, time: elapsed }
  └── Buffer: last 50 clicks
```

**Intent classification decision tree:**

```
  IntentInference.infer()
         │
         ├── scrollBehavior < 0.3 AND timeOnPage > 30,000ms
         │       └──► intent: "reading"     confidence: 0.85  mode: "focus"
         │
         ├── scrollBehavior > 0.8 AND timeOnPage < 5,000ms
         │       └──► intent: "skimming"    confidence: 0.70  mode: "focus"
         │
         ├── hoverPatterns.formFields >= 3
         │       └──► intent: "filling"     confidence: 0.75  mode: "job"
         │
         ├── hoverPatterns.products >= 3 AND timeOnPage > 20,000ms
         │       └──► intent: "shopping"    confidence: 0.70  mode: "checkout"
         │
         ├── hoverPatterns.links > 10
         │       └──► intent: "researching" confidence: 0.60  mode: "research"
         │
         └── default
                 └──► intent: "unknown"     confidence: 0.00  mode: "focus"
```

**Persistence:**

Behavioral history (last 100 visits) is persisted to `chrome.storage.local` as `behavioralHistory`:

```js
[
  {
    url: "https://example.com",
    signals: { scrollBehavior, hoverPatterns, clickCount, timeOnPage, direction },
    timestamp: 1712345678901
  },
  ...  // oldest entry evicted when length > 100
]
```

---

### 4.4 `dark-pattern-detector.js` — Pattern Scanner

Scans the entire DOM on `document_end`. Uses regex matching against text content and CSS class
names, plus structural DOM queries for attribute-based patterns.

**Pattern taxonomy:**

```
  DarkPatternDetector.patterns
  │
  ├── countdown         (severity: HIGH)
  │     Regex on element text:
  │     /countdown/i, /ends? (soon|in \d+)/i, /limited (time|offer)/i
  │     /only \d+ (left|hours?|days?)/i, /expires? soon/i
  │     Also: element.className matches /timer|countdown|clock/i
  │
  ├── fakeScarcity      (severity: HIGH)
  │     Regex on element text:
  │     /only \d+ (item|left|in stock)/i, /low stock/i
  │     /selling fast/i, /\d+ people (are|have) (viewing|bought)/i
  │     /in \d+ (cart|bag)/i
  │
  ├── hiddenCosts       (severity: MEDIUM)
  │     DOM query: [class*="price"], [class*="total"], [class*="cost"], [class*="fee"]
  │     Checks: getBoundingClientRect() is non-zero (element is visible)
  │     Flags elements where checkIfHidden() returns true
  │
  ├── manipulativeCTA   (severity: MEDIUM)
  │     Target: button, a, input[type="submit"], [role="button"]
  │     Regex on text: /act now/i, /don't miss/i, /last chance/i
  │     /free gift/i, /special offer/i, /just \d+[.,]/
  │
  ├── preChecked        (severity: MEDIUM)
  │     DOM query: input[type="checkbox"]
  │     Condition: box.checked === true
  │     Extra: locates associated label via label[for=id] or closest('label')
  │
  ├── misleadingButtons (severity: HIGH)
  │     Target: button, a, [role="button"]
  │     Regex on text: /close/i, /cancel/i, /no thanks?/i, /skip/i, /later/i
  │     Flags if: rect.width < 50 OR rect.height < 30 OR rect.top < 100
  │
  └── darkNavigation    (severity: LOW)
        Target: a[href]
        Regex on text or href: /unsubscribe/i, /manage subscription/i
        /email preferences/i, /communication settings/i
        Checks: checkIfHidden() — display:none, visibility:hidden, opacity < 0.1
```

**Scan pipeline:**

```
  DarkPatternDetector.scan()
        │
        ├── scanCountdownTimers()      → push to detectedPatterns[]
        ├── scanScarcityIndicators()   → push to detectedPatterns[]
        ├── scanHiddenCosts()          → push to detectedPatterns[]
        ├── scanManipulativeCTAs()     → push to detectedPatterns[]
        ├── scanPreCheckedBoxes()      → push to detectedPatterns[]
        ├── scanMisleadingButtons()    → push to detectedPatterns[]
        ├── scanUnsubscribeLinks()     → push to detectedPatterns[]
        │
        └── highlightDetectedPatterns()
                └── foreach pattern:
                      el.classList.add('rl-dark-pattern-detected')
                      el.setAttribute('data-rl-dark-pattern', pattern.type)
```

**Neutralize actions by type:**

```
  neutralize(patternType)
  ├── "preChecked"      → el.checked = false; el.removeAttribute('checked')
  ├── "countdown"       → el.style.visibility = 'hidden'; el.style.display = 'none'
  ├── "fakeScarcity"    → el.style.visibility = 'hidden'; el.style.display = 'none'
  ├── "manipulativeCTA" → el.style.opacity = '0.3'; el.style.pointerEvents = 'none'
  └── "darkNavigation"  → el.style.visibility = 'visible'; el.style.position = 'relative'
```

**Report output:**

```js
DarkPatternDetector.getReport()
// →
{
  totalDetected: 9,
  patterns: { countdown: 1, fakeScarcity: 3, manipulativeCTA: 2,
              preChecked: 1, misleadingButtons: 1, darkNavigation: 1 },
  severity: { high: 3, medium: 4, low: 1 }
}
```

---

### 4.5 `memory-graph.js` — Persistent Research Graph

An IndexedDB-backed entity-relationship graph that persists research context across browser sessions.

**Database schema:**

```
  IndexedDB: "RealityLayerMemory"  (version 1)
  │
  ├── Object Store: "entities"
  │     keyPath: "id"  (autoIncrement)
  │     Indexes:
  │       ├── "url"  → non-unique
  │       └── "type" → non-unique
  │     Record shape: {
  │       id, url, type, content, highlights[], notes[], tags[],
  │       createdAt, accessedAt
  │     }
  │
  ├── Object Store: "relationships"
  │     keyPath: "id"  (autoIncrement)
  │     Indexes:
  │       ├── "from" → non-unique  (source entity id)
  │       └── "to"   → non-unique  (target entity id)
  │     Record shape: { id, from, to, type, createdAt }
  │
  └── Object Store: "sessions"
        keyPath: "id"  (autoIncrement)
```

**Entity relationship diagram:**

```
  entities                       relationships
  ┌────────────────────┐         ┌──────────────────────┐
  │ id (PK)            │◄────────│ from (FK → entity)   │
  │ url                │         │ to   (FK → entity)   │
  │ type               │◄────────│ type: "related"       │
  │ content            │         │ createdAt            │
  │ highlights[]       │         └──────────────────────┘
  │ notes[]            │
  │ tags[]             │
  │ createdAt          │
  │ accessedAt         │
  └────────────────────┘
```

**Key operations:**

```
  saveResearch(data)
  ├── addEntity({ type:'research', url, title, content, highlights, notes, tags })
  ├── getEntitiesByType('research') → all prior research entities
  ├── filter: isRelatedTopic(prior.content, data.content)
  │       └── keyword intersection ≥ 3 words of length > 3
  └── addRelationship(newId, priorId, 'related') for each match

  findContradictions(topic)
  ├── getEntitiesByType('research')
  ├── filter by isRelatedTopic(entity.content, topic)
  ├── findRelatedEntities(entity.id)
  └── hasContradictingClaims(c1, c2)
          └── antonym pairs: [increase/decrease, better/worse,
                              higher/lower, positive/negative, true/false, yes/no]

  getContext(url)
  ├── getSimilarUrls(url) → filter by matching hostname
  └── returns last 5 entities sorted by createdAt DESC

  exportGraph()
  └── returns { entities: [...], relationships: [...] }
```

---

### 4.6 `popup.js` / `popup.html` — Control Panel

The user-facing control surface. Opens as a 320px-wide popup anchored to the extension icon.

**UI layout diagram:**

```
  ┌─────────────────────────────────┐
  │  ◈  Reality Layer               │  ← header (logo + title)
  ├─────────────────────────────────┤
  │  ● Active              [Disable]│  ← status bar + toggle button
  ├─────────────────────────────────┤
  │  MODES                          │
  │  ┌──────────┐  ┌──────────┐    │
  │  │ ◎ Focus  │  │ ◉ Job    │    │
  │  └──────────┘  └──────────┘    │
  │  ┌──────────┐  ┌──────────┐    │
  │  │ ⬡ Learn  │  │ ◎ Rsrch  │    │
  │  └──────────┘  └──────────┘    │
  │  ┌──────────┐  ┌──────────┐    │
  │  │ ◈ Checkout│ │ ◈ Access │    │
  │  └──────────┘  └──────────┘    │
  ├─────────────────────────────────┤
  │  [⇆  Compare Original        ]  │
  │  [☰  Research Sidebar        ]  │
  │  [✎  Custom Mode             ]  │
  ├─────────────────────────────────┤
  │  Auto-suggest modes   [ ●   ]   │
  │  Intent inference     [ ●   ]   │
  │  Show notifications   [ ●   ]   │
  ├─────────────────────────────────┤
  │       Help & Documentation      │  ← footer link
  └─────────────────────────────────┘
```

**Initialization flow:**

```
  DOMContentLoaded
       │
       ├── getCurrentTab()       → chrome.tabs.query({ active, currentWindow })
       ├── loadState()
       │       ├── GET_STATE    → content_script → { mode, enabled, rules }
       │       └── GET_PREFERENCES → background → { autoSuggest, intentInference, ... }
       └── setupEventListeners()
               ├── toggleBtn    → toggleLayer()       → TOGGLE_LAYER
               ├── modeButtons  → selectMode(mode)    → SET_MODE { mode, rules }
               ├── compareBtn   → TOGGLE_COMPARE
               ├── sidebarBtn   → TOGGLE_SIDEBAR
               ├── customBtn    → chrome.tabs.create({ url: custom_mode.html })
               └── pref toggles → SET_PREFERENCES { autoSuggest, intentInference, ... }
```

---

## 5. Transformation Engine

The `UITransformer` class applies reversible mutations to the live DOM. Every transformation is
keyed to data attributes or CSS classes so it can be cleanly reversed when the mode is disabled.

**Action implementation details:**

```
  Action         CSS Class / Attribute           Visual Effect
  ────────────────────────────────────────────────────────────────────────
  hide           data-rl-original-display        el.style.display = 'none'
                 (stores prior display value)    Restored on clearTransformations()

  dim            .rl-dimmed                      opacity: 0.4
                                                 opacity: 1 on :hover (CSS)

  highlight      .rl-highlighted                 2px solid #6366f1 outline
                                                 rgba(99,102,241,0.2) background
                                                 via ::after pseudo-element

  flag           .rl-flagged                     2px dashed #f59e0b outline
                 data-rl-suspicious="true"       ⚠ badge via ::before pseudo

  addTooltip     .rl-tooltip-enabled             cursor: help
                                                 CSS hover tooltip via data-tooltip attr

  extractable    data-rl-extractable="true"      2px solid #6366f1 left border

  trackable      data-rl-trackable="true"        2px solid #22c55e left border

  style          (inline style.setProperty)      Arbitrary CSS override
  ────────────────────────────────────────────────────────────────────────
```

**Cleanup — `clearTransformations()`:**

```
  1. styleElement?.remove()                    Remove injected <style> from <head>
  2. querySelectorAll('[data-rl-original-display]')
        └── el.style.display = stored value    Restore each hidden element
        └── el.removeAttribute(...)            Clean data attribute
  3. querySelectorAll('.rl-dimmed, .rl-highlighted, .rl-flagged, .rl-tooltip-enabled')
        └── el.classList.remove(...)           Strip all rl- classes
  4. appliedRules = []                         Reset rule tracker
```

---

## 6. Mode System

Six built-in modes. Each is a named array of `{ selector, action, property?, value? }` rules.

**Mode → selector → action mapping:**

```
  ┌─────────────────┬────────────────────────────────────────────────────┬────────────┐
  │ Mode            │ Selector                                           │ Action     │
  ├─────────────────┼────────────────────────────────────────────────────┼────────────┤
  │ focus           │ [role="banner"], header, nav, .sidebar, aside,     │ hide       │
  │                 │   [role="navigation"]                              │            │
  │                 │ .ad, .ads, .advertisement, [class*="sponsor"]      │ hide       │
  │                 │ .popup, .modal, .overlay (not #rl-container)       │ hide       │
  │                 │ [role="complementary"], [aria-label*="sidebar"]    │ hide       │
  ├─────────────────┼────────────────────────────────────────────────────┼────────────┤
  │ job             │ form input:not([required]), select:not([required]) │ dim        │
  │                 │ form input[required], select[required]             │ highlight  │
  │                 │ [type="submit"]                                    │ highlight  │
  ├─────────────────┼────────────────────────────────────────────────────┼────────────┤
  │ learning        │ p, li, td                                          │ addTooltip │
  │                 │ h1, h2, h3, h4                                     │ highlight  │
  ├─────────────────┼────────────────────────────────────────────────────┼────────────┤
  │ research        │ main, article, .content                            │ extractable│
  │                 │ a[href]                                            │ trackable  │
  ├─────────────────┼────────────────────────────────────────────────────┼────────────┤
  │ checkout        │ .price, [class*="price"]                           │ highlight  │
  │                 │ [class*="timer"], [class*="countdown"]             │ flag       │
  │                 │ [class*="fee"], [class*="shipping"]:not(.free)     │ highlight  │
  ├─────────────────┼────────────────────────────────────────────────────┼────────────┤
  │ accessibility   │ body                                               │ style      │
  │                 │   → filter: contrast(1.5)                          │            │
  │                 │ body                                               │ style      │
  │                 │   → font-size: 120%                                │            │
  └─────────────────┴────────────────────────────────────────────────────┴────────────┘
```

**Mode indicator color scheme:**

```
  Mode            Indicator border    Hex
  ─────────────────────────────────────────
  focus           indigo              #6366f1
  job             green               #22c55e
  learning        cyan                #06b6d4
  research        violet              #8b5cf6
  checkout        amber               #f59e0b
  accessibility   pink                #ec4899
```

---

## 7. Dark Pattern Detection

The scanner runs once at page load and can be re-run manually. Total regex pattern coverage: 40+
patterns across 7 categories.

**Detection coverage by category:**

```
  Category              Trigger                           Severity   Regex Count
  ─────────────────────────────────────────────────────────────────────────────
  countdown             text content + class name scan    HIGH       7 patterns
  fakeScarcity          text content                      HIGH       6 patterns
  hiddenCosts           class selector + visibility       MEDIUM     4 selectors
  manipulativeCTA       button/link text                  MEDIUM     9 patterns
  preChecked            DOM query on checked inputs       MEDIUM     structural
  misleadingButtons     text + size + position heuristic  HIGH       5 patterns
  darkNavigation        link text + href                  LOW        4 patterns
  ─────────────────────────────────────────────────────────────────────────────
```

**`checkIfHidden(el)` logic:**

```
  getComputedStyle(el)
  ├── display === 'none'            → true  (hidden)
  ├── visibility === 'hidden'       → true  (hidden)
  ├── opacity === '0'               → true  (hidden)
  ├── parseFloat(opacity) < 0.1    → true  (effectively invisible)
  └── else                         → false (visible)
```

---

## 8. Intent Inference Pipeline

The full pipeline from raw events to mode suggestion:

```
  ┌────────────────────────────────────────────────────────┐
  │  Raw Events (passive listeners, no performance impact) │
  │                                                        │
  │  window 'scroll'       → scrollTicks[]                │
  │  document 'mouseover'  → hoverPatterns{}              │
  │  document 'click'      → clickPatterns[]              │
  └──────────────────────┬─────────────────────────────────┘
                         │
                         ▼
  ┌────────────────────────────────────────────────────────┐
  │  Signal Aggregation                                    │
  │                                                        │
  │  scrollBehavior = max(pos) - min(pos)  // range [0,1] │
  │  direction = first-half avg vs second-half avg         │
  │  timeOnPage = Date.now() - sessionStart                │
  └──────────────────────┬─────────────────────────────────┘
                         │
                         ▼
  ┌────────────────────────────────────────────────────────┐
  │  Threshold Classification                              │
  │                                                        │
  │  scroll < 0.3 ∧ time > 30s   → reading    (85%)      │
  │  scroll > 0.8 ∧ time < 5s    → skimming   (70%)      │
  │  formHovers ≥ 3              → filling    (75%)      │
  │  productHovers ≥ 3 ∧ t>20s  → shopping   (70%)      │
  │  linkHovers > 10             → researching(60%)      │
  └──────────────────────┬─────────────────────────────────┘
                         │
                         ▼
  ┌────────────────────────────────────────────────────────┐
  │  Output: { intent, confidence, suggestedMode }        │
  │                                                        │
  │  → background.js.inferIntent()                        │
  │  → autoSuggest logic → MODE_SUGGESTION to content     │
  └────────────────────────────────────────────────────────┘
```

---

## 9. Memory Graph & IndexedDB Schema

**`saveResearch` — full execution path:**

```
  saveResearch({ content, highlights, notes, tags })
        │
        ├── addEntity({ type:'research', url, title, content, ... })
        │         └── IndexedDB: entities.add(entity) → returns new id
        │
        ├── getEntitiesByType('research')
        │         └── IndexedDB: entities.index('type').getAll('research')
        │
        ├── filter: isRelatedTopic(prior.content, data.content)
        │         └── Set intersection on lowercase words (len > 3)
        │             match threshold: |intersection| >= 3
        │
        └── addRelationship(newId, priorId, 'related') for each match
                  └── IndexedDB: relationships.add({ from, to, type, createdAt })
```

**Graph traversal — `findRelatedEntities`:**

```
  findRelatedEntities(entityId)
        │
        ├── relationships.index('from').getAll(entityId)
        │         → rels: [{ from, to, type }]
        │
        └── relatedIds = rels.map(r => r.to)
                  └── entities.get(id) for each relatedId
                            → returns Entity[]
```

**Contradiction detection — `hasContradictingClaims`:**

```
  Antonym pairs checked:
  ┌─────────────┬─────────────┐
  │ increase    │ decrease    │
  │ better      │ worse       │
  │ higher      │ lower       │
  │ positive    │ negative    │
  │ true        │ false       │
  │ yes         │ no          │
  └─────────────┴─────────────┘
  Match: content1 has pos AND content2 has neg (or vice versa)
```

---

## 10. Message Passing Protocol

All inter-context communication uses `chrome.runtime.sendMessage` (popup → background) and
`chrome.tabs.sendMessage` (background ↔ content script).

**Full message graph:**

```
  popup.js ──────────────────────────────────────► background.js
               SET_MODE { mode, rules }
               TOGGLE_LAYER
               GET_PREFERENCES
               SET_PREFERENCES { preferences }
               TOGGLE_COMPARE
               TOGGLE_SIDEBAR

  popup.js ──────────────────────────────────────► content_script.js
               GET_STATE → { mode, enabled, rules }

  background.js ─────────────────────────────────► content_script.js
               APPLY_MODE { mode, rules }
               DISABLE_LAYER
               MODE_SUGGESTION { mode, reason }
               PAGE_ANALYSIS_COMPLETE { analysis }
               TOGGLE_SIDEBAR

  content_script.js ─────────────────────────────► background.js
               PAGE_SCANNED { analysis }
               GET_PAGE_TITLE → { title }
               INFER_INTENT { behavioralSignals }
               GET_MEMORY_GRAPH { url }
               SAVE_TO_GRAPH { data }
```

---

## 11. Data Flow — End to End

```
  USER NAVIGATES TO A PAGE
           │
           ▼
  chrome.tabs.onUpdated fires (changeInfo.status === 'complete')
           │
           ▼
  background.analyzePage(tabId, url)
    ├── classifyPage(url, pageTitle)    → pageType
    ├── pageAnalysisCache.set(tabId)
    └── if autoSuggest:
          suggestMode(analysis) → MODE_SUGGESTION → content script
           │
           ▼
  content_script.js initializes (document_end)
    ├── createOverlayContainer()
    ├── DarkPatternDetector.initialize()   → scans DOM, flags 7 pattern types
    ├── IntentInference.initialize()       → attaches 3 passive event listeners
    ├── MemoryGraph.initialize()           → opens IndexedDB, loads stored memory
    └── PageScanner.scan() → chrome.runtime.sendMessage(PAGE_SCANNED)
           │
           ▼
  USER OPENS POPUP AND SELECTS MODE
           │
           ▼
  popup.js → chrome.runtime.sendMessage(SET_MODE { mode, rules })
           │
           ▼
  background.setMode(tabId, mode, rules)
    ├── activeModes.set(tabId, { mode, rules, timestamp })
    └── chrome.tabs.sendMessage(tabId, APPLY_MODE { mode, rules })
           │
           ▼
  content_script.applyMode(mode, rules)
    ├── UITransformer.applyTransformations(rules)
    │     └── foreach rule → applyRule() → DOM mutation
    └── showModeIndicator(mode) → ◈ badge appears bottom-right
           │
           ▼
  PAGE CONTENT CHANGES (SPA update, lazy load, real-time data)
           │
           ▼
  MutationObserver callback fires
    └── hasSignificantChange (childList adds/removes)?
          └── YES → debounce(100ms) → reapplyTransformations()
                                        ├── clearTransformations()
                                        └── applyTransformations(activeRules)
           │
           ▼
  USER DISABLES LAYER
           │
           ▼
  popup.js → TOGGLE_LAYER → background
           │
           ▼
  background.toggleLayer(tabId)
    ├── activeModes.delete(tabId)
    └── chrome.tabs.sendMessage(tabId, DISABLE_LAYER)
           │
           ▼
  content_script.disableLayer()
    ├── UITransformer.clearTransformations()  → page fully restored
    └── hideModeIndicator()                   → badge hidden
```

---

## 12. State Management

State is distributed across multiple storage layers with different lifetime and scope:

```
  Storage Layer              Key(s)                    Lifetime
  ────────────────────────────────────────────────────────────────────────
  In-memory (background)     activeModes               Until service worker terminates
                             pageAnalysisCache         Until service worker terminates

  chrome.storage.sync        modes                     Persists, syncs across devices
                             preferences               Persists, syncs across devices
                             customModes               Persists, syncs across devices

  chrome.storage.local       behavioralHistory         Persists, local only (max 100 entries)

  IndexedDB                  entities                  Persists indefinitely
  (RealityLayerMemory)       relationships             Persists indefinitely
                             sessions                  Persists indefinitely

  DOM attributes (ephemeral) data-rl-original-display  Per page load, cleared on disable
                             data-rl-dark-pattern      Per page load
                             data-rl-suspicious        Per page load
                             data-rl-extractable       Per page load
                             data-rl-trackable         Per page load
  ────────────────────────────────────────────────────────────────────────
```

---

## 13. CSS Overlay System

All extension UI elements are namespaced under `#reality-layer-*` and `.rl-*` to avoid collisions
with host page styles. Injected as a content script stylesheet via `manifest.json`.

**Design tokens (CSS custom properties):**

```css
:root {
  --rl-primary:       #6366f1;    /* indigo — primary actions, highlights    */
  --rl-primary-hover: #4f46e5;
  --rl-success:       #22c55e;    /* green  — job mode, trackable links      */
  --rl-warning:       #f59e0b;    /* amber  — checkout mode, flagged items   */
  --rl-danger:        #ef4444;    /* red    — close button hover             */
  --rl-bg:            #1e1e2e;    /* dark background                         */
  --rl-bg-light:      #2a2a3e;    /* elevated surface                        */
  --rl-text:          #ffffff;
  --rl-text-muted:    #a1a1aa;
  --rl-border:        #3f3f50;
  --rl-highlight:     rgba(99, 102, 241, 0.2);
  --rl-dim:           0.4;        /* opacity multiplier for dimmed elements  */
}
```

**Z-index strategy:**

```
  Host page content                z-index: auto / varies
  Host page modals/overlays        z-index: typically < 9999
  ─────────────────────────────────────────────────────────
  #reality-layer-container         z-index: 2147483646   (INT_MAX - 1)
  #reality-layer-indicator         z-index: 2147483647   (INT_MAX)
  #reality-layer-sidebar           z-index: 2147483647   (INT_MAX)
```

The container has `pointer-events: none` to never intercept user clicks unless explicitly needed.

**Sidebar slide animation:**

```
  Default state:    transform: translateX(100%)   (off-screen right)
  Visible state:    transform: translateX(0)      (slides in)
  Transition:       0.3s ease
  Class trigger:    .rl-sidebar-visible added by toggleSidebar()
```

---

## 14. Storage Architecture

```
  ┌───────────────────────────────────────────────────────────────────┐
  │                      Storage Architecture                         │
  │                                                                   │
  │  chrome.storage.sync (100KB quota, cross-device sync)            │
  │  ┌──────────────────────────────────────────────┐                │
  │  │ "modes"       : {}                           │                │
  │  │ "preferences" : { autoSuggest,               │                │
  │  │                   intentInference,           │                │
  │  │                   showNotifications }        │                │
  │  │ "customModes" : {}                           │                │
  │  └──────────────────────────────────────────────┘                │
  │                                                                   │
  │  chrome.storage.local (local only, larger quota)                 │
  │  ┌──────────────────────────────────────────────┐                │
  │  │ "behavioralHistory": [                       │                │
  │  │   { url, signals, timestamp },  // max 100   │                │
  │  │   ...                                        │                │
  │  │ ]                                            │                │
  │  └──────────────────────────────────────────────┘                │
  │                                                                   │
  │  IndexedDB "RealityLayerMemory" (no hard quota in extension ctx) │
  │  ┌──────────────────────────────────────────────┐                │
  │  │ entities store                               │                │
  │  │   idx: url (non-unique)                      │                │
  │  │   idx: type (non-unique)                     │                │
  │  │                                              │                │
  │  │ relationships store                          │                │
  │  │   idx: from (non-unique)                     │                │
  │  │   idx: to   (non-unique)                     │                │
  │  │                                              │                │
  │  │ sessions store                               │                │
  │  └──────────────────────────────────────────────┘                │
  └───────────────────────────────────────────────────────────────────┘
```

---

## 15. Permissions Model

**Declared in `manifest.json`:**

```json
{
  "permissions": ["storage", "activeTab", "scripting", "tabs"],
  "host_permissions": ["<all_urls>"]
}
```

**Justification:**

```
  Permission          Why it's needed
  ────────────────────────────────────────────────────────────────────
  storage             chrome.storage.sync/local for preferences and history
  activeTab           Read the current tab's URL for page classification
  scripting           Programmatic injection capability if needed
  tabs                Query active tab, send messages between contexts
  <all_urls>          Content scripts must run on all pages (host permission)
  ────────────────────────────────────────────────────────────────────
```

No `identity`, `webRequest`, `cookies`, or `nativeMessaging` permissions are declared.
No external network requests are made anywhere in the codebase.

---

## 16. Project Structure

```
intent-aware-dynamic-interface-reconstruction-Extension/
│
├── manifest.json                        MV3 manifest
│                                          permissions, content_scripts, icons, action
├── package.json                         Dev dependency: sharp (icon generation only)
├── package-lock.json
├── generate-icons.js                    Generates PNG icons from SVG via sharp
│
└── src/
    │
    ├── assets/
    │   ├── icon.svg                     Source SVG (◈ symbol)
    │   ├── icon-16.png                  Favicon / toolbar (small)
    │   ├── icon-32.png                  Toolbar standard
    │   ├── icon-48.png                  Extensions management page
    │   └── icon-128.png                 Chrome Web Store listing
    │
    ├── css/
    │   └── overlay.css                  All extension UI styles
    │                                      • #reality-layer-container (overlay anchor)
    │                                      • #reality-layer-indicator (mode badge)
    │                                      • #reality-layer-sidebar  (research panel)
    │                                      • .rl-highlighted, .rl-dimmed
    │                                      • .rl-flagged, .rl-tooltip-enabled
    │                                      • [data-rl-extractable], [data-rl-trackable]
    │                                      • @media light/dark mode overrides
    │
    ├── html/
    │   ├── popup.html                   320px popup — inline CSS + mode grid
    │   └── custom_mode.html             Custom mode builder (new tab page)
    │
    └── js/
        │
        ├── background.js                Service Worker
        │                                  • RealityLayer singleton
        │                                  • Message router (13 message types)
        │                                  • URL-based page classifier
        │                                  • Intent classifier (3 signal types)
        │                                  • IndexedDB manager (entities/relationships)
        │
        ├── content_script.js            DOM Orchestrator (IIFE)
        │                                  • RealityLayerContent singleton
        │                                  • PageScanner class
        │                                  • ModeSystem object (6 modes)
        │                                  • UITransformer class (8 action types)
        │                                  • MutationObserver (debounced 100ms)
        │
        ├── popup.js                     Popup Controller
        │                                  • Mode selection and state sync
        │                                  • Layer toggle
        │                                  • Preference management
        │                                  • Sidebar / compare / custom mode triggers
        │
        └── modules/
            │
            ├── dark-pattern-detector.js  DarkPatternDetector singleton
            │                               • 40+ regex patterns
            │                               • 7 scan methods
            │                               • highlightDetectedPatterns()
            │                               • neutralize(type)
            │                               • getReport()
            │
            ├── intent-inference.js       IntentInference singleton
            │                               • Scroll ring buffer (100 ticks)
            │                               • Hover counter (form/product/link)
            │                               • Click ring buffer (50 events)
            │                               • 5-tier threshold classifier
            │                               • chrome.storage.local persistence
            │
            └── memory-graph.js           MemoryGraph singleton
                                            • IndexedDB schema management
                                            • Entity CRUD (addEntity, getEntitiesByUrl/Type)
                                            • Relationship CRUD (addRelationship, findRelated)
                                            • saveResearch() with auto-linking
                                            • findContradictions() with antonym pairs
                                            • getContext() by domain
                                            • exportGraph()
```

---

## 17. Installation

**Prerequisites:** Google Chrome (any recent version). Node.js required only for icon regeneration.

**Step-by-step:**

```bash
# 1. Clone the repository
git clone https://github.com/Sudharsanselvaraj/Intent-Aware-Dynamic-Interface-Reconstruction-and-Transformation-Extension.git

# 2. Enter the project directory
cd Intent-Aware-Dynamic-Interface-Reconstruction-and-Transformation-Extension

# 3. (Optional) Regenerate icons after modifying icon.svg
npm install
node generate-icons.js
```

**Load in Chrome:**

```
  chrome://extensions
  │
  ├── Enable Developer mode (toggle, top-right corner)
  │
  ├── Click "Load unpacked"
  │
  └── Select the project root directory (folder containing manifest.json)
          │
          └── ◈ Reality Layer icon appears in Chrome toolbar
```

**Verify installation:**

- Click ◈ in toolbar → 320px popup opens with mode grid
- Navigate to any webpage → dark pattern scan runs automatically
- Select Focus mode → distracting elements disappear; ◈ badge appears bottom-right

---

## 18. Usage Guide

**Basic workflow:**

```
  Navigate to a webpage
        │
        ▼
  Click ◈ in the Chrome toolbar
        │
        ▼
  Select a mode (or accept auto-suggestion)
        │
        ▼
  Page reconstructs based on selected mode:

  Focus       → headers, navbars, ads, sidebars, popups hidden
  Job         → required form fields highlighted in indigo, optional dimmed
  Learning    → h1–h4 highlighted, p/li/td get hover tooltips
  Research    → article/main marked extractable, all links tracked
  Checkout    → prices highlighted, countdown timers flagged ⚠
  Accessibility → contrast boosted 1.5x, font size increased to 120%
        │
        ▼
  Mode indicator badge appears (bottom-right, color-coded)
        │
        ▼
  Click × on badge OR [Disable] in popup → page fully restored
```

**Research Sidebar (☰):**

```
  ┌──────────────────────────────┐
  │ Reality Layer             [×]│
  ├──────────────────────────────┤
  │ Active Mode                  │
  │  Research                    │
  ├──────────────────────────────┤
  │ Detected Patterns            │
  │  Scanning...                 │
  └──────────────────────────────┘
```

**Custom Mode Builder (✎):**

Opens `custom_mode.html` as a new Chrome tab. Define custom `selector → action` rule pairs and save
them as named modes to `chrome.storage.sync`.

---

## 19. Configuration & Extending

**Rule schema:**

```js
{
  selector: string,     // Valid CSS selector — any querySelectorAll() argument
  action:   string,     // "hide" | "dim" | "highlight" | "flag" |
                        // "addTooltip" | "style" | "extractable" | "trackable"
  property?: string,    // Required for action "style" — CSS property name
  value?:    string     // Required for action "style" — CSS property value
}
```

**Adding a new built-in mode — 4 steps:**

```
  Step 1: content_script.js → ModeSystem.modes
  ─────────────────────────────────────────────
  mymode: {
    name: 'My Mode',
    rules: [
      { selector: '.noisy', action: 'hide' },
      { selector: '.key', action: 'highlight' }
    ]
  }

  Step 2: popup.js → getModeRules()
  ──────────────────────────────────
  mymode: [
    { selector: '.noisy', action: 'hide' },
    { selector: '.key', action: 'highlight' }
  ]

  Step 3: popup.html → mode-grid
  ────────────────────────────────
  <button class="mode-btn" data-mode="mymode">
    <span class="mode-icon">◈</span>
    <span class="mode-name">My Mode</span>
  </button>

  Step 4: overlay.css → indicator color
  ────────────────────────────────────────
  .rl-mode-mymode { border-left: 3px solid #yourcolor; }
  .mode-btn[data-mode="mymode"] .mode-icon { color: #yourcolor; }
```

**Adding a new dark pattern category:**

```
  1. Add regex array to DarkPatternDetector.patterns.myPattern
  2. Add scanMyPattern() method following the createDetection() + isDuplicate() pattern
  3. Call scanMyPattern() inside scan()
  4. Add case in neutralize() for the new type
```

---

## 20. Performance Considerations

**Passive event listeners:** All three behavioral signal collectors (`scroll`, `mouseover`, `click`)
use `{ passive: true }`. This tells the browser the listener will never call `preventDefault()`,
allowing the browser to safely optimize scroll rendering without waiting for the listener to return.

**Ring buffers:** `scrollTicks` is capped at 100 entries; `clickPatterns` at 50. Memory usage is
bounded regardless of session duration.

**Debounced MutationObserver:** DOM re-application is debounced at 100ms. Prevents thrashing on
pages that make rapid DOM changes (real-time feeds, chat interfaces, dashboards).

**`readonly` IndexedDB transactions:** All read operations in `memory-graph.js` use `'readonly'`
transaction mode, allowing the browser to optimize concurrent access.

**No bundler, no transpiler:** Raw ES2022. Zero build step. Load time is minimal.

**Dark pattern scan scope:** `querySelectorAll('*')` iterates the entire DOM for `countdown` and
`fakeScarcity` scans. On very large pages (10,000+ nodes) this may take 200–500ms. Scoped subtree
queries are a planned optimization.

---

## 21. Security & Privacy Model

```
  Threat                              Mitigation
  ─────────────────────────────────────────────────────────────────────
  Host page script injection          Content scripts run in an isolated
                                      world; window.* exposure is intentional
                                      and limited to debugging handles

  Data exfiltration                   Zero outbound network requests in the
                                      entire codebase; no fetch(), XHR, or
                                      WebSocket calls anywhere

  Cross-origin data leakage           All storage is local (IndexedDB,
                                      chrome.storage); no cross-tab sharing

  Network traffic interception        No webRequest permission declared;
                                      extension cannot read/modify requests

  Persistent tracking / fingerprinting Behavioral history capped at 100 entries;
                                      no user identity fields stored; user can
                                      clear via chrome.storage API at any time

  Privilege escalation                No <all_urls> webRequest; no identity
                                      permission; no nativeMessaging
  ─────────────────────────────────────────────────────────────────────
```

MV3 enforces a strict Content Security Policy for service workers. No `eval()` or dynamically
constructed scripts are used anywhere in the extension.

---

## 22. Tech Stack

```
  Layer                    Technology / API
  ──────────────────────────────────────────────────────────────────
  Extension platform       Chrome Extensions API, Manifest Version 3
  Language                 Vanilla JavaScript ES2022 — no TypeScript,
                           no bundler, no transpiler
  DOM manipulation         Native DOM API, querySelectorAll, MutationObserver
  Styling                  CSS custom properties, ::before / ::after pseudo-elements
  Persistent storage       IndexedDB (entities, relationships), chrome.storage.sync/local
  Pattern detection        RegExp (40+ patterns, 7 categories)
  Icon generation          Node.js + sharp (dev dependency, not shipped)
  Inter-context comms      chrome.runtime.sendMessage, chrome.tabs.sendMessage
  ──────────────────────────────────────────────────────────────────
```

---

## 23. Known Limitations

**Service worker termination:** `activeModes` and `pageAnalysisCache` are in-memory Maps. Chrome
may terminate the service worker after 30s of inactivity (MV3 constraint), losing this state. The
content script retains its local mode state but loses sync with the background until the popup
is reopened.

**SPA soft navigation:** `chrome.tabs.onUpdated` with `status='complete'` does not fire on
`pushState`/`replaceState` navigations in single-page applications. URL-based page classification
is not re-run on soft navigation. MutationObserver handles DOM changes but cannot reclassify.

**Dark pattern scan performance:** `querySelectorAll('*')` on pages with 15,000+ nodes may take
200–500ms. No subtree scoping is applied in the current implementation.

**Regex false positives:** Text-based detection (especially `hiddenCosts` and `manipulativeCTA`)
can flag legitimate UI elements that happen to match patterns.

**No Firefox support:** Chrome-specific `chrome.*` APIs are used throughout. Firefox WebExtensions
compatibility would require a polyfill layer and MV2 manifest variant.

**`manifest_version: 3` idle termination:** Long-running sessions are unaffected because intent
inference runs entirely in the content script (persistent per page load), not in the service worker.

---

## 24. Roadmap

```
  Version   Feature                                               Status
  ─────────────────────────────────────────────────────────────────────────
  v1.1      Custom mode builder visual UI (CSS rule editor)       Planned
  v1.1      On-demand dark pattern re-scan button                 Planned
  v1.1      Sidebar: pattern breakdown + per-type neutralize btn  Planned
  v1.2      SPA soft navigation detection (History API hook)      Planned
  v1.2      Per-domain mode memory (auto-apply on revisit)        Planned
  v1.3      Memory graph visualization (D3.js force-directed)     Planned
  v1.3      Research export: Markdown / JSON / Obsidian vault     Planned
  v1.4      On-device intent model (TensorFlow.js / ONNX)        Research
  v1.4      Cross-site contradiction highlighting in sidebar      Research
  v2.0      Firefox MV2 compatibility layer                       Planned
  v2.0      Unit test suite (Jest + jsdom)                        Planned
  v2.0      GitHub Actions CI pipeline                            Planned
  v2.0      Chrome Web Store listing                              Planned
  ─────────────────────────────────────────────────────────────────────────
```

---

## 25. Contributing

```bash
# Fork and clone
git clone https://github.com/Sudharsanselvaraj/Intent-Aware-Dynamic-Interface-Reconstruction-and-Transformation-Extension.git
cd Intent-Aware-Dynamic-Interface-Reconstruction-and-Transformation-Extension

# Create a feature branch
git checkout -b feature/my-feature

# Make changes — no build step required
# Test by reloading the extension at chrome://extensions

# Submit a pull request against main
```

**Guidelines:**

- Follow the singleton/class pattern used in all existing modules
- All new code must run without a bundler — no ES module `import`/`export` in content scripts
  loaded via `manifest.json` content_scripts array
- New dark pattern categories need a scanner method AND a neutralizer case
- Test on at least 3 diverse real-world websites before submitting
- Keep `overlay.css` changes namespaced under `#reality-layer-*` or `.rl-*`

---

## 26. Author

**Sudharsan Selvaraj**

Pre-final year CSE, SRMIST Trichy · ML Engineer Intern · Agentic AI & LLM Systems

[![GitHub](https://img.shields.io/badge/GitHub-Sudharsanselvaraj-181717?style=flat-square&logo=github)](https://github.com/Sudharsanselvaraj)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-sudharsan--selvaraj-0A66C2?style=flat-square&logo=linkedin)](https://linkedin.com/in/sudharsan-selvaraj)

---

*Reality Layer — The web, reconstructed for you.*
