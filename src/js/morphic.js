const MorphicEngine = {
  elements: new Map(),
  originalStyles: new Map(),
  currentIntent: 'reading',
  isActive: false,
  pageState: new Map(),
  cookieDismissed: false,
  
  async initialize() {
    this.createBaseContainer();
    this.classifyPageElements();
    this.setupBehavioralTracking();
    this.detectIntent();
    this.applyCurrentIntent();
    this.dismissCookieBanners();
  },
  
  createBaseContainer() {
    if (document.getElementById('morphic-container')) return;
    const container = document.createElement('div');
    container.id = 'morphic-container';
    container.setAttribute('data-morphic', 'active');
    document.body.appendChild(container);
  },
  
  classifyPageElements() {
    const allElements = document.querySelectorAll('*');
    const roles = [
      { name: 'form-field', selector: 'input, select, textarea, label' },
      { name: 'ad', selector: '[class*="ad-"], [class*="advertisement"], [id*="ad-"], [class*="sponsor"]' },
      { name: 'hero', selector: 'header, [role="banner"], nav, [role="navigation"]' },
      { name: 'price', selector: '[class*="price"], [class*="cost"], [class*="amount"]' },
      { name: 'cta', selector: 'button, [role="button"], a[href*="buy"], a[href*="purchase"], a[href*="checkout"]' },
      { name: 'content', selector: 'main, article, [role="main"], .content, .post, .article' },
      { name: 'navigation', selector: 'aside, [role="complementary"], .sidebar' },
      { name: 'popup', selector: '.modal, .popup, .overlay, [role="dialog"]' },
      { name: 'cookie', selector: '[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"]' },
      { name: 'heading', selector: 'h1, h2, h3, h4, h5, h6' },
      { name: 'paragraph', selector: 'p, li, td' },
      { name: 'image', selector: 'img, picture, video' },
      { name: 'form', selector: 'form' },
      { name: 'timer', selector: '[class*="timer"], [class*="countdown"], [class*="expires"]' },
      { name: 'social', selector: '[class*="social"], [class*="share"]' }
    ];
    
    allElements.forEach(el => {
      if (el.id === 'morphic-container' || el.closest('#morphic-container')) return;
      
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'meta', 'link'].includes(tag)) return;
      
      const rect = el.getBoundingClientRect();
      if (rect.width < 5 || rect.height < 5) return;
      
      let assignedRole = null;
      let priority = 0;
      
      for (const role of roles) {
        if (el.matches(role.selector)) {
          assignedRole = role.name;
          priority = this.getRolePriority(role.name);
          break;
        }
      }
      
      if (!assignedRole) {
        const text = el.innerText?.toLowerCase() || '';
        if (text.match(/\$|price|cost| rupees/i)) {
          assignedRole = 'price';
          priority = 8;
        } else if (text.match(/buy now|add to cart|checkout/i)) {
          assignedRole = 'cta';
          priority = 7;
        } else if (text.match(/accept|agree|got it|okay|close/i) && el.tagName === 'BUTTON') {
          assignedRole = 'cookie-accept';
          priority = 10;
        }
      }
      
      if (assignedRole) {
        this.elements.set(el, {
          role: assignedRole,
          priority,
          originalDisplay: el.style.display,
          originalOpacity: el.style.opacity,
          originalVisibility: el.style.visibility
        });
      }
    });
  },
  
  getRolePriority(role) {
    const priorities = {
      'form-field': 8,
      'cta': 7,
      'content': 6,
      'price': 5,
      'cookie-accept': 10,
      'cookie': 9,
      'popup': 9,
      'ad': 1,
      'hero': 2,
      'navigation': 2,
      'timer': 4,
      'heading': 5,
      'paragraph': 4,
      'image': 3,
      'social': 1
    };
    return priorities[role] || 0;
  },
  
  setupBehavioralTracking() {
    this.scrollStartTime = Date.now();
    this.scrollPositions = [];
    this.dwellMap = new Map();
    this.formInteractions = 0;
    this.lastScrollTime = Date.now();
    this.lastScrollPosition = window.scrollY;
    
    window.addEventListener('scroll', () => {
      const now = Date.now();
      const deltaTime = now - this.lastScrollTime;
      const deltaPosition = Math.abs(window.scrollY - this.lastScrollPosition);
      
      this.scrollPositions.push({
        time: now,
        velocity: deltaPosition / (deltaTime || 1) * 1000,
        position: window.scrollY
      });
      
      if (this.scrollPositions.length > 50) {
        this.scrollPositions.shift();
      }
      
      this.lastScrollTime = now;
      this.lastScrollPosition = window.scrollY;
    });
    
    document.addEventListener('focusin', (e) => {
      if (e.target.matches('input, select, textarea')) {
        this.formInteractions++;
      }
    });
    
    document.addEventListener('mouseover', (e) => {
      const now = Date.now();
      const target = e.target;
      const lastDwell = this.dwellMap.get(target);
      if (lastDwell && now - lastDwell > 1500) {
        this.dwellMap.set(target, now);
      }
    });
  },
  
  detectIntent() {
    const hasForm = Array.from(this.elements.values()).some(e => e.role === 'form-field');
    const hasPrice = Array.from(this.elements.values()).some(e => e.role === 'price');
    const hasCTA = Array.from(this.elements.values()).some(e => e.role === 'cta');
    
    const scrollVelocity = this.calculateScrollVelocity();
    const sessionDuration = Date.now() - this.scrollStartTime;
    const pageHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollProgress = pageHeight > 0 ? window.scrollY / pageHeight : 0;
    
    const url = window.location.href.toLowerCase();
    const text = document.body.innerText.toLowerCase();
    
    if (hasForm && this.formInteractions > 0) {
      if (url.includes('job') || url.includes('career') || text.includes('apply')) {
        this.currentIntent = 'applying';
      } else {
        this.currentIntent = 'filling-form';
      }
    } else if (hasPrice && (hasCTA || url.includes('cart') || url.includes('checkout') || url.includes('buy'))) {
      this.currentIntent = 'shopping';
    } else if (scrollVelocity > 500 && sessionDuration < 5000) {
      this.currentIntent = 'skimming';
    } else if (scrollVelocity < 50 && sessionDuration > 30000 && scrollProgress < 0.3) {
      this.currentIntent = 'reading';
    } else if (this.dwellMap.size > 5 && scrollProgress > 0.2) {
      this.currentIntent = 'researching';
    } else {
      this.currentIntent = 'reading';
    }
    
    console.log('[Morphic] Detected intent:', this.currentIntent, {
      scrollVelocity,
      sessionDuration,
      scrollProgress,
      formInteractions: this.formInteractions
    });
  },
  
  calculateScrollVelocity() {
    if (this.scrollPositions.length < 2) return 0;
    
    const recent = this.scrollPositions.slice(-10);
    let totalVelocity = 0;
    let count = 0;
    
    for (let i = 1; i < recent.length; i++) {
      totalVelocity += recent[i].velocity;
      count++;
    }
    
    return count > 0 ? totalVelocity / count : 0;
  },
  
  applyCurrentIntent() {
    const configs = {
      'filling-form': {
        dim: ['hero', 'navigation', 'ad', 'social', 'popup'],
        highlight: ['form-field'],
        hide: ['ad', 'popup'],
        pulse: ['form-field']
      },
      'applying': {
        dim: ['hero', 'navigation', 'ad', 'social'],
        highlight: ['form-field', 'content'],
        hide: ['ad', 'popup'],
        pulse: ['form-field']
      },
      'shopping': {
        dim: ['hero', 'navigation', 'social'],
        highlight: ['price', 'cta', 'content'],
        hide: ['ad', 'popup', 'social']
      },
      'reading': {
        dim: ['hero', 'navigation', 'ad', 'cta', 'social', 'popup'],
        highlight: ['content', 'heading', 'paragraph'],
        hide: ['ad', 'popup', 'social', 'timer']
      },
      'researching': {
        dim: ['hero', 'navigation', 'ad', 'social'],
        highlight: ['content', 'price', 'heading'],
        hide: ['popup', 'ad']
      },
      'skimming': {
        dim: ['hero', 'navigation', 'content', 'paragraph', 'ad'],
        highlight: ['heading', 'cta'],
        hide: ['ad', 'popup', 'navigation', 'social', 'timer']
      }
    };
    
    const config = configs[this.currentIntent] || configs['reading'];
    
    for (const [el, data] of this.elements) {
      if (!document.body.contains(el)) continue;
      
      const role = data.role;
      
      if (config.hide?.includes(role)) {
        this.storeOriginalStyle(el, 'display', 'none');
      } else if (config.dim?.includes(role)) {
        this.storeOriginalStyle(el, 'opacity', '0.3');
      } else if (config.highlight?.includes(role)) {
        this.storeOriginalStyle(el, 'outline', '2px solid #6366f1');
      }
    }
    
    if (config.pulse) {
      this.pulseElements(config.pulse);
    }
  },
  
  storeOriginalStyle(el, property, value) {
    const key = `${property}-${el.tagName}`;
    if (!this.originalStyles.has(el)) {
      this.originalStyles.set(el, {});
    }
    const styles = this.originalStyles.get(el);
    if (styles[property] === undefined) {
      styles[property] = el.style[property] || '';
    }
    el.style[property] = value;
  },
  
  pulseElements(roles) {
    roles.forEach(role => {
      for (const [el, data] of this.elements) {
        if (data.role === role && el.matches('[required]')) {
          el.classList.add('morphic-pulse');
        }
      }
    });
    
    if (!document.getElementById('morphic-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'morphic-pulse-style';
      style.textContent = `
        .morphic-pulse {
          animation: morphic-pulse-animation 1.5s ease-in-out infinite;
        }
        @keyframes morphic-pulse-animation {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); }
        }
      `;
      document.head.appendChild(style);
    }
  },
  
  dismissCookieBanners() {
    if (this.cookieDismissed) return;
    
    const acceptButtons = document.querySelectorAll(
      'button:contains("Accept"), button:contains("Agree"), button:contains("Got it"), button:contains("Okay"), ' +
      'button:contains("Accept all"), button:contains("I agree"), [class*="accept"], [id*="accept"], ' +
      'button[class*="cookie"], button[id*="cookie"], button[class*="consent"], [role="button"]:contains("Accept")'
    );
    
    acceptButtons.forEach(btn => {
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.top > 0) {
        btn.click();
        this.cookieDismissed = true;
        console.log('[Morphic] Cookie banner dismissed');
      }
    });
  },
  
  restoreOriginalState() {
    for (const [el, styles] of this.originalStyles) {
      if (!document.body.contains(el)) continue;
      
      for (const [property, value] of Object.entries(styles)) {
        el.style[property] = value;
      }
    }
    
    document.querySelectorAll('.morphic-pulse').forEach(el => {
      el.classList.remove('morphic-pulse');
    });
    
    this.originalStyles.clear();
    this.elements.clear();
    this.currentIntent = 'reading';
  },
  
  deactivate() {
    this.restoreOriginalState();
    this.isActive = false;
    
    const container = document.getElementById('morphic-container');
    if (container) {
      container.setAttribute('data-morphic', 'inactive');
    }
  },
  
  activate() {
    this.isActive = true;
    this.classifyPageElements();
    this.detectIntent();
    this.applyCurrentIntent();
    this.dismissCookieBanners();
    
    const container = document.getElementById('morphic-container');
    if (container) {
      container.setAttribute('data-morphic', 'active');
    }
  },
  
  reapply() {
    this.restoreOriginalState();
    this.classifyPageElements();
    this.detectIntent();
    this.applyCurrentIntent();
  }
};

const MorphicMessageHandler = {
  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'ACTIVATE':
        MorphicEngine.activate();
        return { success: true, intent: MorphicEngine.currentIntent };
      
      case 'DEACTIVATE':
        MorphicEngine.deactivate();
        return { success: true };
      
      case 'GET_INTENT':
        return { intent: MorphicEngine.currentIntent };
      
      case 'SET_INTENT':
        MorphicEngine.currentIntent = message.intent;
        MorphicEngine.applyCurrentIntent();
        return { success: true };
      
      case 'GET_STATE':
        return {
          isActive: MorphicEngine.isActive,
          intent: MorphicEngine.currentIntent
        };
      
      case 'REAPPLY':
        MorphicEngine.reapply();
        return { success: true };
      
      default:
        return { error: 'Unknown message type' };
    }
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const response = MorphicMessageHandler.handleMessage(message, sender, sendResponse);
  if (sendResponse) sendResponse(response);
  return true;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MorphicEngine.initialize());
} else {
  MorphicEngine.initialize();
}

window.MorphicEngine = MorphicEngine;
