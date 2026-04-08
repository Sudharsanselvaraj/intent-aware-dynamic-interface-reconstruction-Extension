const DarkPatternDetector = {
  patterns: {
    countdown: [
      /countdown/i,
      /ends?\s*(soon|shortly|in\s+\d+)/i,
      /limited\s*(time|offer|deal)/i,
      /only\s*\d+\s*(left|remaining|hours?|days?)/i,
      /urgency/i,
      /expires?\s*(soon|in\s+\d+)/i
    ],
    
    fakeScarcity: [
      /only\s*\d+\s*(item|left|in\s+stock)/i,
      /low\s*stock/i,
      /selling\s*fast/i,
      /selling\s*out/i,
      /\d+\s*people\s*(are|have)\s*(viewing|seen|bought)/i,
      /\d+\s*(order|purchase)i?ng?\s*(now|today)/i,
      /in\s*\d+\s*(cart|bag)/i
    ],
    
    hiddenCosts: [
      /\$/,
      /total/i,
      /fees?/i,
      /shipping(?!\s+free)/i,
      /handling/i,
      /processing/i,
      /service\s*charge/i,
      /additional/,
      /mandatory/
    ],
    
    manipulativeCTA: [
      /act\s*now/i,
      /don.?t\s*miss/i,
      /last\s*chance/i,
      /free\s*gift/i,
      /no\s*credit\s*card\s*required/i,
      /no\s*payment\s*now/i,
      /just\s*\d+[\.,]/,
      /only\s*\d+/,
      /special\s*offer/i
    ],
    
    preChecked: [
      'input[type="checkbox"][checked]',
      'input[type="radio"][checked]',
      '[aria-checked="true"]'
    ],
    
    misleadingButtons: [
      /close/i,
      /cancel/i,
      /no\s*thanks?/i,
      /skip/i,
      /remind\s*me/i,
      /later/i,
      /maybe/i
    ],
    
    darkNavigation: [
      /unsubscribe/i,
      /manage\s*subscription/i,
      /email\s*preferences/i,
      /communication\s*settings/i
    ]
  },
  
  detectedPatterns: [],
  
  initialize() {
    this.scan();
  },
  
  scan() {
    this.detectedPatterns = [];
    
    this.scanCountdownTimers();
    this.scanScarcityIndicators();
    this.scanHiddenCosts();
    this.scanManipulativeCTAs();
    this.scanPreCheckedBoxes();
    this.scanMisleadingButtons();
    this.scanUnsubscribeLinks();
    
    this.highlightDetectedPatterns();
    
    return this.detectedPatterns;
  },
  
  scanCountdownTimers() {
    const elements = document.querySelectorAll('*');
    
    elements.forEach(el => {
      const text = el.textContent || '';
      const styles = window.getComputedStyle(el);
      
      if (this.patterns.countdown.some(p => p.test(text))) {
        const timer = this.createDetection('countdown', {
          element: el,
          text: text.substring(0, 100),
          severity: 'high'
        });
        
        if (!this.isDuplicate(timer)) {
          this.detectedPatterns.push(timer);
        }
      }
      
      if (el.className && /timer|countdown|clock/i.test(el.className)) {
        this.detectedPatterns.push(this.createDetection('countdown', {
          element: el,
          type: 'class',
          severity: 'high'
        }));
      }
    });
  },
  
  scanScarcityIndicators() {
    const elements = document.querySelectorAll('*');
    
    elements.forEach(el => {
      const text = el.textContent || '';
      
      if (this.patterns.fakeScarcity.some(p => p.test(text))) {
        const scarcity = this.createDetection('fakeScarcity', {
          element: el,
          text: text.substring(0, 100),
          severity: 'high'
        });
        
        if (!this.isDuplicate(scarcity)) {
          this.detectedPatterns.push(scarcity);
        }
      }
    });
  },
  
  scanHiddenCosts() {
    const priceElements = document.querySelectorAll('[class*="price"], [class*="total"], [class*="cost"], [class*="fee"]');
    
    priceElements.forEach(el => {
      const text = el.textContent || '';
      const rect = el.getBoundingClientRect();
      
      if (rect.width > 0 && rect.height > 0) {
        const hiddenCost = this.createDetection('hiddenCosts', {
          element: el,
          text: text.substring(0, 100),
          severity: 'medium',
          flag: this.checkIfHidden(el)
        });
        
        if (!this.isDuplicate(hiddenCost)) {
          this.detectedPatterns.push(hiddenCost);
        }
      }
    });
  },
  
  scanManipulativeCTAs() {
    const buttons = document.querySelectorAll('button, a, input[type="submit"], [role="button"]');
    
    buttons.forEach(btn => {
      const text = btn.textContent || '';
      
      if (this.patterns.manipulativeCTA.some(p => p.test(text))) {
        const cta = this.createDetection('manipulativeCTA', {
          element: btn,
          text: text.substring(0, 100),
          severity: 'medium'
        });
        
        if (!this.isDuplicate(cta)) {
          this.detectedPatterns.push(cta);
        }
      }
    });
  },
  
  scanPreCheckedBoxes() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    
    checkboxes.forEach(box => {
      if (box.checked) {
        const label = this.findLabel(box);
        
        const preChecked = this.createDetection('preChecked', {
          element: box,
          label: label,
          value: box.value,
          severity: 'medium'
        });
        
        if (!this.isDuplicate(preChecked)) {
          this.detectedPatterns.push(preChecked);
        }
      }
    });
  },
  
  scanMisleadingButtons() {
    const closeButtons = document.querySelectorAll('button, a, [role="button"]');
    
    closeButtons.forEach(btn => {
      const text = btn.textContent || '';
      const rect = btn.getBoundingClientRect();
      const styles = window.getComputedStyle(btn);
      
      if (this.patterns.misleadingButtons.some(p => p.test(text))) {
        const size = rect.width < 50 || rect.height < 30;
        const position = rect.top < 100;
        
        if (size || position) {
          const misleading = this.createDetection('misleadingButtons', {
            element: btn,
            text: text,
            severity: 'high',
            reason: size ? 'small' : 'position'
          });
          
          if (!this.isDuplicate(misleading)) {
            this.detectedPatterns.push(misleading);
          }
        }
      }
    });
  },
  
  scanUnsubscribeLinks() {
    const links = document.querySelectorAll('a');
    
    links.forEach(link => {
      const text = link.textContent || '';
      const href = link.href || '';
      
      if (this.patterns.darkNavigation.some(p => p.test(text) || p.test(href))) {
        const unsubscribe = document.createElement('div');
        unsubscribe.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;';
        document.body.appendChild(unsubscribe);
        
        const isHidden = this.checkIfHidden(link);
        
        const darkNav = this.createDetection('darkNavigation', {
          element: link,
          text: text.length > 20 ? text.substring(0, 20) + '...' : text,
          severity: 'low',
          hidden: isHidden
        });
        
        if (!this.isDuplicate(darkNav)) {
          this.detectedPatterns.push(darkNav);
        }
      }
    });
  },
  
  createDetection(type, data) {
    return {
      type,
      ...data,
      timestamp: Date.now()
    };
  },
  
  findLabel(input) {
    const id = input.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent;
    }
    const parent = input.closest('label');
    if (parent) return parent.textContent;
    return '';
  },
  
  checkIfHidden(el) {
    const styles = window.getComputedStyle(el);
    return styles.display === 'none' ||
           styles.visibility === 'hidden' ||
           styles.opacity === '0' ||
           parseFloat(styles.opacity) < 0.1;
  },
  
  isDuplicate(pattern) {
    return this.detectedPatterns.some(p => 
      p.type === pattern.type && 
      p.text === pattern.text
    );
  },
  
  highlightDetectedPatterns() {
    this.detectedPatterns.forEach(pattern => {
      if (pattern.element && pattern.element instanceof HTMLElement) {
        pattern.element.classList.add('rl-dark-pattern-detected');
        pattern.element.setAttribute('data-rl-dark-pattern', pattern.type);
      }
    });
  },
  
  getReport() {
    return {
      totalDetected: this.detectedPatterns.length,
      patterns: this.detectedPatterns.reduce((acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1;
        return acc;
      }, {}),
      severity: {
        high: this.detectedPatterns.filter(p => p.severity === 'high').length,
        medium: this.detectedPatterns.filter(p => p.severity === 'medium').length,
        low: this.detectedPatterns.filter(p => p.severity === 'low').length
      }
    };
  },
  
  neutralize(patternType) {
    const patterns = this.detectedPatterns.filter(p => p.type === patternType);
    
    patterns.forEach(pattern => {
      if (pattern.element && pattern.element instanceof HTMLElement) {
        if (patternType === 'preChecked') {
          pattern.element.checked = false;
          pattern.element.removeAttribute('checked');
        } else if (patternType === 'countdown' || patternType === 'fakeScarcity') {
          pattern.element.style.visibility = 'hidden';
          pattern.element.style.display = 'none';
        } else if (patternType === 'manipulativeCTA') {
          pattern.element.style.opacity = '0.3';
          pattern.element.style.pointerEvents = 'none';
        } else if (patternType === 'darkNavigation') {
          pattern.element.style.visibility = 'visible';
          pattern.element.style.position = 'relative';
        }
      }
    });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => DarkPatternDetector.initialize());
} else {
  DarkPatternDetector.initialize();
}

window.DarkPatternDetector = DarkPatternDetector;