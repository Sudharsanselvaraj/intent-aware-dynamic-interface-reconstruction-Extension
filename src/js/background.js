const RealityLayer = {
  activeModes: new Map(),
  pageAnalysisCache: new Map(),
  
  async initialize() {
    await this.loadStoredState();
    this.setupEventListeners();
    console.log('[Reality Layer] Initialized');
  },
  
  async loadStoredState() {
    try {
      const result = await chrome.storage.sync.get(['modes', 'preferences', 'customModes']);
      this.userModes = result.modes || {};
      this.preferences = result.preferences || {
        autoSuggest: true,
        showNotifications: true,
        intentInference: true
      };
    } catch (e) {
      console.error('[Reality Layer] Failed to load state:', e);
    }
  },
  
  setupEventListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender).then(sendResponse);
      return true;
    });
    
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.analyzePage(tabId, tab.url);
      }
    });
  },
  
  async handleMessage(message, sender) {
    const tabId = message.tabId || sender.tab?.id;
    
    switch (message.type) {
      case 'SET_MODE':
        return await this.setMode(tabId, message.mode, message.rules);
      
      case 'GET_ANALYSIS':
        return this.pageAnalysisCache.get(tabId);
      
      case 'TOGGLE_LAYER':
        return await this.toggleLayer(tabId);
      
      case 'GET_PREFERENCES':
        return this.preferences;
      
      case 'SET_PREFERENCES':
        return await this.setPreferences(message.preferences);
        
      case 'INFER_INTENT':
        return await this.inferIntent(message.behavioralSignals);
        
      case 'GET_MEMORY_GRAPH':
        return await this.getMemoryGraph(message.url);
        
      case 'SAVE_TO_GRAPH':
        return await this.saveToGraph(message.data);
        
      case 'TOGGLE_SIDEBAR':
        return await this.toggleSidebar(tabId);
        
      case 'TOGGLE_COMPARE':
        return { success: true };
        
      case 'PAGE_SCANNED':
        console.log('[Reality Layer] Page scanned:', message.analysis);
        return { success: true };
        
      default:
        return { error: 'Unknown message type' };
    }
  },
  
  async analyzePage(tabId, url) {
    try {
      console.log('[Reality Layer] Analyzing page:', tabId, url);
      
      let pageTitle = '';
      try {
        const response = await this.sendMessageWithRetry(tabId, { type: 'GET_PAGE_TITLE' }, 3);
        pageTitle = response?.title || '';
      } catch (e) {
        console.log('[Reality Layer] Content script not ready');
      }
      
      const analysis = {
        url,
        timestamp: Date.now(),
        pageType: this.classifyPage(url, pageTitle),
        forms: [],
        elements: {
          headings: [],
          buttons: [],
          inputs: [],
          links: []
        }
      };
      
      this.pageAnalysisCache.set(tabId, analysis);
      
      try {
        await this.sendMessageWithRetry(tabId, {
          type: 'PAGE_ANALYSIS_COMPLETE',
          analysis
        }, 3);
      } catch (e) {
        console.log('[Reality Layer] Could not send analysis to content script');
      }
      
      if (this.preferences.autoSuggest) {
        const suggestedMode = this.suggestMode(analysis);
        try {
          await this.sendMessageWithRetry(tabId, {
            type: 'MODE_SUGGESTION',
            mode: suggestedMode,
            reason: this.getSuggestionReason(analysis)
          }, 3);
        } catch (e) {
          console.log('[Reality Layer] Could not send mode suggestion');
        }
      }
      
      return analysis;
    } catch (e) {
      console.error('[Reality Layer] Page analysis failed:', e);
      return null;
    }
  },
  
  classifyPage(url, title) {
    const urlLower = url.toLowerCase();
    const titleLower = (title || '').toLowerCase();
    
    if (urlLower.includes('job') || urlLower.includes('career') || urlLower.includes('apply')) {
      return 'job';
    }
    if (urlLower.includes('checkout') || urlLower.includes('cart') || urlLower.includes('buy')) {
      return 'checkout';
    }
    if (urlLower.includes('learn') || urlLower.includes('doc') || urlLower.includes('article')) {
      return 'learning';
    }
    if (urlLower.includes('research') || urlLower.includes('search')) {
      return 'research';
    }
    
    return 'focus';
  },
  
  suggestMode(analysis) {
    const pageType = analysis.pageType;
    const modeMap = {
      job: 'job',
      checkout: 'checkout',
      learning: 'learning',
      research: 'research',
      focus: 'focus'
    };
    return modeMap[pageType] || 'focus';
  },
  
  getSuggestionReason(analysis) {
    return `Detected ${analysis.pageType} page content`;
  },
  
  async setMode(tabId, mode, rules) {
    this.activeModes.set(tabId, { mode, rules, timestamp: Date.now() });
    
    try {
      await this.sendMessageWithRetry(tabId, {
        type: 'APPLY_MODE',
        mode,
        rules
      }, 3);
    } catch (e) {
      console.log('[Reality Layer] Content script not ready after retries');
    }
    
    return { success: true, mode };
  },
  
  async sendMessageWithRetry(tabId, message, retries = 3, delay = 300) {
    for (let i = 0; i < retries; i++) {
      try {
        return await chrome.tabs.sendMessage(tabId, message);
      } catch (e) {
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw new Error('Failed after retries');
  },
  
  async toggleLayer(tabId) {
    const current = this.activeModes.get(tabId);
    if (current) {
      this.activeModes.delete(tabId);
      try {
        await this.sendMessageWithRetry(tabId, { type: 'DISABLE_LAYER' }, 3);
      } catch (e) {}
      return { enabled: false };
    }
    await this.setMode(tabId, 'focus', []);
    return { enabled: true };
  },
  
  async toggleSidebar(tabId) {
    try {
      await this.sendMessageWithRetry(tabId, { type: 'TOGGLE_SIDEBAR' }, 3);
    } catch (e) {}
    return { success: true };
  },
  
  async setPreferences(prefs) {
    this.preferences = { ...this.preferences, ...prefs };
    await chrome.storage.sync.set({ preferences: this.preferences });
    return this.preferences;
  },
  
  async inferIntent(signals) {
    if (!this.preferences.intentInference) {
      return { intent: 'unknown', confidence: 0 };
    }
    
    const intent = this.classifyIntent(signals);
    return {
      intent: intent.type,
      confidence: intent.confidence,
      suggestedMode: intent.suggestedMode
    };
  },
  
  classifyIntent(signals) {
    const { scrollBehavior, hoverPatterns, timeOnPage, pastVisits } = signals;
    
    if (scrollBehavior < 0.2 && timeOnPage > 30000) {
      return { type: 'reading', confidence: 0.8, suggestedMode: 'focus' };
    }
    if (hoverPatterns?.formFields) {
      return { type: 'filling', confidence: 0.7, suggestedMode: 'job' };
    }
    if (hoverPatterns?.products) {
      return { type: 'shopping', confidence: 0.7, suggestedMode: 'checkout' };
    }
    
    return { type: 'unknown', confidence: 0, suggestedMode: 'focus' };
  },
  
  async getMemoryGraph(url) {
    try {
      const db = await this.openIndexedDB();
      const tx = db.transaction('memory', 'readonly');
      const store = tx.objectStore('memory');
      const request = store.get(url);
      
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  },
  
  async saveToGraph(data) {
    try {
      const db = await this.openIndexedDB();
      const tx = db.transaction('memory', 'readwrite');
      const store = tx.objectStore('memory');
      store.put(data);
      
      return new Promise((resolve) => {
        tx.oncomplete = () => resolve({ success: true });
        tx.onerror = () => resolve({ success: false });
      });
    } catch (e) {
      return { success: false };
    }
  },
  
  openIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('RealityLayer', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('memory')) {
          db.createObjectStore('memory', { keyPath: 'url' });
        }
      };
    });
  }
};

RealityLayer.initialize();