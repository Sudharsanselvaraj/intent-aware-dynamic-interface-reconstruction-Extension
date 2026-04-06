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
    switch (message.type) {
      case 'ANALYZE_PAGE':
        return await this.analyzePage(sender.tab.id, message.url);
      
      case 'GET_MODE':
        return this.activeModes.get(sender.tab.id) || 'focus';
      
      case 'SET_MODE':
        return await this.setMode(sender.tab.id, message.mode, message.rules);
      
      case 'GET_ANALYSIS':
        return this.pageAnalysisCache.get(sender.tab.id);
      
      case 'TOGGLE_LAYER':
        return await this.toggleLayer(sender.tab.id);
      
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
        
      default:
        return { error: 'Unknown message type' };
    }
  },
  
  async analyzePage(tabId, url) {
    try {
      const analysis = {
        url,
        timestamp: Date.now(),
        pageType: this.classifyPage(url, document?.title),
        forms: [],
        elements: {
          headings: [],
          buttons: [],
          inputs: [],
          links: []
        }
      };
      
      this.pageAnalysisCache.set(tabId, analysis);
      
      await chrome.tabs.sendMessage(tabId, {
        type: 'PAGE_ANALYSIS_COMPLETE',
        analysis
      });
      
      if (this.preferences.autoSuggest) {
        const suggestedMode = this.suggestMode(analysis);
        await chrome.tabs.sendMessage(tabId, {
          type: 'MODE_SUGGESTION',
          mode: suggestedMode,
          reason: this.getSuggestionReason(analysis)
        });
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
    
    await chrome.tabs.sendMessage(tabId, {
      type: 'APPLY_MODE',
      mode,
      rules
    });
    
    return { success: true, mode };
  },
  
  async toggleLayer(tabId) {
    const current = this.activeModes.get(tabId);
    if (current) {
      this.activeModes.delete(tabId);
      await chrome.tabs.sendMessage(tabId, { type: 'DISABLE_LAYER' });
      return { enabled: false };
    }
    return { enabled: true };
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