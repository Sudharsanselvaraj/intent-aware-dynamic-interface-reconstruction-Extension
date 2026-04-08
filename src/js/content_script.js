(function() {
  'use strict';
  
  const RealityLayerContent = {
    currentMode: null,
    activeRules: [],
    isEnabled: true,
    domObserver: null,
    overlayContainer: null,
    sidebarVisible: false,
    sidebarElement: null,
    
    initialize() {
      this.createOverlayContainer();
      this.setupMessageListener();
      this.setupMutationObserver();
      this.scanAndAnalyze();
      console.log('[Reality Layer] Content script initialized');
    },
    
    createOverlayContainer() {
      if (this.overlayContainer) return;
      
      this.overlayContainer = document.createElement('div');
      this.overlayContainer.id = 'reality-layer-container';
      this.overlayContainer.setAttribute('data-rl-version', '1.0.0');
      document.body.appendChild(this.overlayContainer);
    },
    
    setupMessageListener() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        return this.handleMessage(message);
      });
    },
    
    handleMessage(message) {
      switch (message.type) {
        case 'APPLY_MODE':
          this.applyMode(message.mode, message.rules);
          return { success: true };
        
        case 'DISABLE_LAYER':
          this.disableLayer();
          return { success: true };
        
        case 'GET_STATE':
          return {
            mode: this.currentMode,
            enabled: this.isEnabled,
            rules: this.activeRules
          };
        
        case 'GET_PAGE_TITLE':
          return { title: document.title };
        
        case 'TOGGLE_VISIBILITY':
          this.toggleElementVisibility(message.selector, message.hidden);
          return { success: true };
        
        case 'UPDATE_STYLE':
          this.applyStyleRules(message.rules);
          return { success: true };
        
        case 'TOGGLE_SIDEBAR':
          this.toggleSidebar();
          return { success: true };
        
        default:
          return { error: 'Unknown message type' };
      }
    },
    
    setupMutationObserver() {
      this.domObserver = new MutationObserver((mutations) => {
        this.handleDOMChanges(mutations);
      });
      
      this.domObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
    },
    
    handleDOMChanges(mutations) {
      if (!this.isEnabled || !this.currentMode) return;
      
      const hasSignificantChange = mutations.some(m => {
        return m.type === 'childList' && 
               (m.addedNodes.length > 0 || m.removedNodes.length > 0);
      });
      
      if (hasSignificantChange) {
        this.debounce(() => {
          this.reapplyTransformations();
        }, 100)();
      }
    },
    
    debounce(fn, delay) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
      };
    },
    
    scanAndAnalyze() {
      const pageScanner = new PageScanner();
      const analysis = pageScanner.scan(document.body);
      
      chrome.runtime.sendMessage({
        type: 'PAGE_SCANNED',
        analysis
      });
    },
    
    async applyMode(mode, rules) {
      this.currentMode = mode;
      this.activeRules = rules || ModeSystem.getRulesForMode(mode);
      
      const transformer = new UITransformer();
      transformer.applyTransformations(this.activeRules);
      
      this.showModeIndicator(mode);
    },
    
    reapplyTransformations() {
      if (!this.currentMode) return;
      
      const transformer = new UITransformer();
      transformer.clearTransformations();
      transformer.applyTransformations(this.activeRules);
    },
    
    disableLayer() {
      this.isEnabled = false;
      this.currentMode = null;
      
      const transformer = new UITransformer();
      transformer.clearTransformations();
      
      this.hideModeIndicator();
    },
    
    showModeIndicator(mode) {
      let indicator = document.getElementById('reality-layer-indicator');
      
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'reality-layer-indicator';
        indicator.innerHTML = `
          <span class="rl-indicator-icon">◈</span>
          <span class="rl-indicator-text"></span>
          <button class="rl-indicator-close">×</button>
        `;
        document.body.appendChild(indicator);
        
        indicator.querySelector('.rl-indicator-close').addEventListener('click', () => {
          this.disableLayer();
        });
      }
      
      indicator.querySelector('.rl-indicator-text').textContent = 
        ModeSystem.getModeName(mode);
      indicator.className = `rl-mode-${mode}`;
      indicator.style.display = 'flex';
    },
    
    hideModeIndicator() {
      const indicator = document.getElementById('reality-layer-indicator');
      if (indicator) {
        indicator.style.display = 'none';
      }
    },
    
    toggleElementVisibility(selector, hidden) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.setAttribute('data-rl-hidden', hidden);
        el.style.setProperty('display', hidden ? 'none' : '');
      });
    },
    
    applyStyleRules(rules) {
      const style = document.createElement('style');
      style.id = 'reality-layer-custom-styles';
      style.textContent = rules.join('\n');
      document.head.appendChild(style);
    },
    
    createSidebar() {
      if (this.sidebarElement) return;
      
      this.sidebarElement = document.createElement('div');
      this.sidebarElement.id = 'reality-layer-sidebar';
      this.sidebarElement.innerHTML = `
        <div class="rl-sidebar-header">
          <span class="rl-sidebar-title">Reality Layer</span>
          <button class="rl-sidebar-close">×</button>
        </div>
        <div class="rl-sidebar-content">
          <div class="rl-sidebar-section">
            <h4>Active Mode</h4>
            <p>${this.currentMode || 'None'}</p>
          </div>
          <div class="rl-sidebar-section">
            <h4>Detected Patterns</h4>
            <div id="rl-pattern-count">Scanning...</div>
          </div>
        </div>
      `;
      
      this.sidebarElement.querySelector('.rl-sidebar-close').addEventListener('click', () => {
        this.toggleSidebar();
      });
      
      document.body.appendChild(this.sidebarElement);
    },
    
    toggleSidebar() {
      this.sidebarVisible = !this.sidebarVisible;
      
      if (this.sidebarVisible) {
        this.createSidebar();
        this.sidebarElement.classList.add('rl-sidebar-visible');
      } else if (this.sidebarElement) {
        this.sidebarElement.classList.remove('rl-sidebar-visible');
      }
    }
  };
  
  class PageScanner {
    scan(root) {
      return {
        forms: this.extractForms(root),
        headings: this.extractHeadings(root),
        buttons: this.extractButtons(root),
        links: this.extractLinks(root),
        inputs: this.extractInputs(root),
        mainContent: this.findMainContent(root),
        sidebar: this.findSidebar(root)
      };
    }
    
    extractForms(root) {
      const forms = root.querySelectorAll('form');
      return Array.from(forms).map(form => ({
        action: form.action,
        method: form.method,
        fields: this.extractFormFields(form)
      }));
    }
    
    extractFormFields(form) {
      const inputs = form.querySelectorAll('input, select, textarea');
      return Array.from(inputs).map(input => ({
        name: input.name,
        type: input.type,
        required: input.required,
        label: this.findLabel(input)
      }));
    }
    
    findLabel(input) {
      const id = input.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) return label.textContent;
      }
      const parent = input.closest('label');
      if (parent) return parent.textContent;
      return '';
    }
    
    extractHeadings(root) {
      const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(headings).map(h => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent
      }));
    }
    
    extractButtons(root) {
      const buttons = root.querySelectorAll('button, input[type="submit"], a[role="button"]');
      return Array.from(buttons).map(btn => ({
        text: btn.textContent,
        type: btn.tagName
      }));
    }
    
    extractLinks(root) {
      const links = root.querySelectorAll('a[href]');
      return Array.from(links).map(link => ({
        href: link.href,
        text: link.textContent
      }));
    }
    
    extractInputs(root) {
      const inputs = root.querySelectorAll('input, select, textarea');
      return Array.from(inputs).map(input => ({
        name: input.name,
        type: input.type,
        id: input.id
      }));
    }
    
    findMainContent(root) {
      return root.querySelector('main, [role="main"], .main, #main, article, .content');
    }
    
    findSidebar(root) {
      return root.querySelector('aside, [role="complementary"], .sidebar, #sidebar');
    }
  }
  
  const ModeSystem = {
    modes: {
      focus: {
        name: 'Focus Mode',
        rules: [
          { selector: '[role="banner"], header, nav, .sidebar, aside, [role="navigation"]', action: 'hide' },
          { selector: '.ad, .ads, .advertisement, [class*="sponsor"]', action: 'hide' },
          { selector: '.popup, .modal, .overlay:not(#reality-layer-container)', action: 'hide' },
          { selector: '[role="complementary"], [aria-label*="sidebar"]', action: 'hide' }
        ]
      },
      job: {
        name: 'Job Application Mode',
        rules: [
          { selector: 'form input:not([required]), form select:not([required])', action: 'dim' },
          { selector: 'form input[required], form select[required]', action: 'highlight' },
          { selector: '[type="submit"]', action: 'highlight' }
        ]
      },
      learning: {
        name: 'Learning Mode',
        rules: [
          { selector: 'p, li, td', action: 'addTooltip' },
          { selector: 'h1, h2, h3, h4', action: 'highlight' }
        ]
      },
      research: {
        name: 'Research Mode',
        rules: [
          { selector: 'main, article, .content', action: 'extractable' },
          { selector: 'a[href]', action: 'trackable' }
        ]
      },
      checkout: {
        name: 'Checkout Mode',
        rules: [
          { selector: '.price, [class*="price"]', action: 'highlight' },
          { selector: '[class*="timer"], [class*="countdown"]', action: 'flag' },
          { selector: '[class*="fee"], [class*="shipping"]:not([class*="free"])', action: 'highlight' }
        ]
      },
      accessibility: {
        name: 'Accessibility Mode',
        rules: [
          { selector: 'body', action: 'style', property: 'filter', value: 'contrast(1.5)' },
          { selector: 'body', action: 'style', property: 'font-size', value: '120%' }
        ]
      }
    },
    
    getRulesForMode(mode) {
      return this.modes[mode]?.rules || [];
    },
    
    getModeName(mode) {
      return this.modes[mode]?.name || mode;
    }
  };
  
  class UITransformer {
    constructor() {
      this.appliedRules = [];
      this.styleElement = null;
    }
    
    applyTransformations(rules) {
      this.createStyleElement();
      
      rules.forEach(rule => {
        this.applyRule(rule);
      });
    }
    
    createStyleElement() {
      if (this.styleElement) return;
      
      this.styleElement = document.createElement('style');
      this.styleElement.id = 'reality-layer-transformations';
      document.head.appendChild(this.styleElement);
    }
    
    applyRule(rule) {
      switch (rule.action) {
        case 'hide':
          this.hideElements(rule.selector);
          break;
        case 'dim':
          this.dimElements(rule.selector);
          break;
        case 'highlight':
          this.highlightElements(rule.selector);
          break;
        case 'style':
          this.styleElements(rule.selector, rule.property, rule.value);
          break;
        case 'addTooltip':
          this.addTooltips(rule.selector);
          break;
        case 'extractable':
        case 'trackable':
          this.markElements(rule.selector, rule.action);
          break;
        case 'flag':
          this.flagElements(rule.selector);
          break;
      }
      
      this.appliedRules.push(rule);
    }
    
    hideElements(selector) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.setAttribute('data-rl-original-display', el.style.display || '');
        el.style.display = 'none';
      });
    }
    
    dimElements(selector) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.classList.add('rl-dimmed');
      });
    }
    
    highlightElements(selector) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.classList.add('rl-highlighted');
      });
    }
    
    styleElements(selector, property, value) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.style.setProperty(property, value);
      });
    }
    
    addTooltips(selector) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.classList.add('rl-tooltip-enabled');
      });
    }
    
    markElements(selector, action) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.setAttribute(`data-rl-${action}`, 'true');
      });
    }
    
    flagElements(selector) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.classList.add('rl-flagged');
        el.setAttribute('data-rl-suspicious', 'true');
      });
    }
    
    clearTransformations() {
      if (this.styleElement) {
        this.styleElement.remove();
        this.styleElement = null;
      }
      
      document.querySelectorAll('[data-rl-original-display]').forEach(el => {
        el.style.display = el.getAttribute('data-rl-original-display');
        el.removeAttribute('data-rl-original-display');
      });
      
      document.querySelectorAll('.rl-dimmed, .rl-highlighted, .rl-flagged, .rl-tooltip-enabled').forEach(el => {
        el.classList.remove('rl-dimmed', 'rl-highlighted', 'rl-flagged', 'rl-tooltip-enabled');
      });
      
      this.appliedRules = [];
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RealityLayerContent.initialize());
  } else {
    RealityLayerContent.initialize();
  }
  
  window.RealityLayerContent = RealityLayerContent;
})();