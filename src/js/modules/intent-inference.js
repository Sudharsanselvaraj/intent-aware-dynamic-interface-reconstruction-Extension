const IntentInference = {
  behavioralSignals: {
    scrollBehavior: 0,
    hoverPatterns: {},
    timeOnSections: {},
    clickPatterns: [],
    pastVisits: []
  },
  
  sessionStart: Date.now(),
  thresholds: {
    reading: { scrollRange: [0.1, 0.3], time: 30000 },
    skimming: { scrollRange: [0.8, 1.0], time: 5000 },
    filling: { hoverFields: 3, clicks: 5 },
    shopping: { hoverProducts: 3, time: 20000 }
  },
  
  initialize() {
    this.setupScrollTracker();
    this.setupHoverTracker();
    this.setupClickTracker();
    this.loadPastBehavior();
  },
  
  setupScrollTracker() {
    let lastScrollY = 0;
    let scrollTicks = [];
    
    window.addEventListener('scroll', () => {
      const now = Date.now();
      const currentY = window.scrollY;
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      
      if (maxY <= 0) return;
      
      const scrollPosition = currentY / maxY;
      const timeSinceStart = now - this.sessionStart;
      
      scrollTicks.push({
        position: scrollPosition,
        time: timeSinceStart
      });
      
      if (scrollTicks.length > 100) {
        scrollTicks = scrollTicks.slice(-100);
      }
      
      this.updateScrollBehavior(scrollTicks);
    }, { passive: true });
  },
  
  updateScrollBehavior(ticks) {
    if (ticks.length < 2) return;
    
    const positions = ticks.map(t => t.position);
    const range = Math.max(...positions) - Math.min(...positions);
    
    this.behavioralSignals.scrollBehavior = range;
    
    const firstHalf = ticks.slice(0, Math.floor(ticks.length / 2));
    const secondHalf = ticks.slice(Math.floor(ticks.length / 2));
    
    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const firstAvg = firstHalf.reduce((a, b) => a + b.position, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b.position, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg + 0.2) {
        this.behavioralSignals.direction = 'down';
      } else if (firstAvg > secondAvg + 0.2) {
        this.behavioralSignals.direction = 'up';
      }
    }
  },
  
  setupHoverTracker() {
    document.addEventListener('mouseover', (e) => {
      const target = e.target;
      
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
        this.behavioralSignals.hoverPatterns.formFields = 
          (this.behavioralSignals.hoverPatterns.formFields || 0) + 1;
      }
      
      if (target.closest('[class*="product"], [class*="item"], [class*="card"]')) {
        this.behavioralSignals.hoverPatterns.products = 
          (this.behavioralSignals.hoverPatterns.products || 0) + 1;
      }
      
      if (target.tagName === 'A') {
        this.behavioralSignals.hoverPatterns.links = 
          (this.behavioralSignals.hoverPatterns.links || 0) + 1;
      }
    }, { passive: true });
  },
  
  setupClickTracker() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      
      this.behavioralSignals.clickPatterns.push({
        element: target.tagName,
        time: Date.now() - this.sessionStart
      });
      
      if (this.behavioralSignals.clickPatterns.length > 50) {
        this.behavioralSignals.clickPatterns = this.behavioralSignals.clickPatterns.slice(-50);
      }
    }, { passive: true });
  },
  
  async loadPastBehavior() {
    try {
      const result = await chrome.storage.local.get(['behavioralHistory']);
      if (result.behavioralHistory) {
        this.behavioralSignals.pastVisits = result.behavioralHistory;
      }
    } catch (e) {
      console.error('[IntentInference] Failed to load past behavior:', e);
    }
  },
  
  async infer() {
    const signals = this.getSignals();
    
    const timeOnPage = Date.now() - this.sessionStart;
    
    if (signals.scrollBehavior < this.thresholds.reading.scrollRange[1] && 
        timeOnPage > this.thresholds.reading.time) {
      return {
        intent: 'reading',
        confidence: 0.85,
        suggestedMode: 'focus'
      };
    }
    
    if (signals.scrollBehavior > this.thresholds.skimming.scrollRange[0] && 
        timeOnPage < this.thresholds.skimming.time) {
      return {
        intent: 'skimming',
        confidence: 0.7,
        suggestedMode: 'focus'
      };
    }
    
    if (signals.hoverPatterns.formFields >= this.thresholds.filling.hoverFields) {
      return {
        intent: 'filling',
        confidence: 0.75,
        suggestedMode: 'job'
      };
    }
    
    if (signals.hoverPatterns.products >= this.thresholds.shopping.hoverProducts && 
        timeOnPage > this.thresholds.shopping.time) {
      return {
        intent: 'shopping',
        confidence: 0.7,
        suggestedMode: 'checkout'
      };
    }
    
    if (signals.hoverPatterns.links > 10) {
      return {
        intent: 'researching',
        confidence: 0.6,
        suggestedMode: 'research'
      };
    }
    
    return {
      intent: 'unknown',
      confidence: 0,
      suggestedMode: 'focus'
    };
  },
  
  getSignals() {
    return {
      scrollBehavior: this.behavioralSignals.scrollBehavior,
      hoverPatterns: { ...this.behavioralSignals.hoverPatterns },
      clickCount: this.behavioralSignals.clickPatterns.length,
      timeOnPage: Date.now() - this.sessionStart,
      pastVisits: this.behavioralSignals.pastVisits,
      direction: this.behavioralSignals.direction
    };
  },
  
  async saveBehavior() {
    try {
      const result = await chrome.storage.local.get(['behavioralHistory']);
      const history = result.behavioralHistory || [];
      
      history.push({
        url: window.location.href,
        signals: this.getSignals(),
        timestamp: Date.now()
      });
      
      if (history.length > 100) {
        history = history.slice(-100);
      }
      
      await chrome.storage.local.set({ behavioralHistory: history });
    } catch (e) {
      console.error('[IntentInference] Failed to save behavior:', e);
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => IntentInference.initialize());
} else {
  IntentInference.initialize();
}

window.IntentInference = IntentInference;