const GeminiIntentDetector = {
  apiKey: 'AIzaSyBOQbWKpQPmS2Z2Q7FQvH4Y6R8T3U1V0W',
  model: 'gemini-1.5-flash',
  lastDetection: 0,
  debounceMs: 3000,
  currentMode: null,
  
  async initialize() {
    const stored = await chrome.storage.local.get(['geminiApiKey']);
    if (stored.geminiApiKey) {
      this.apiKey = stored.geminiApiKey;
    }
  },
  
  async setApiKey(apiKey) {
    this.apiKey = apiKey;
    await chrome.storage.local.set({ geminiApiKey: apiKey });
  },
  
  hasApiKey() {
    return !!this.apiKey;
  },
  
  async detectIntent(pageData) {
    if (!this.apiKey) {
      return this.fallbackDetection(pageData);
    }
    
    const now = Date.now();
    if (now - this.lastDetection < this.debounceMs) {
      return { mode: this.currentMode, confidence: 0, source: 'debounced' };
    }
    this.lastDetection = now;
    
    try {
      const result = await this.callGeminiAPI(pageData);
      this.currentMode = result.mode;
      return result;
    } catch (e) {
      console.error('[Gemini] API call failed:', e);
      return this.fallbackDetection(pageData);
    }
  },
  
  async callGeminiAPI(pageData) {
    const { url, title, textContent } = pageData;
    
    const prompt = `You are an intent detection system for a browser extension that transforms web interfaces.
    
Analyze this webpage and determine the user's primary intent.
Return a JSON object with this exact format:
{
  "mode": "learning" | "focus" | "job" | "research" | "checkout" | "accessibility",
  "confidence": 0.0 to 1.0,
  "reason": "brief explanation in 1 sentence"
}

Page URL: ${url}
Page Title: ${title}

Analyze the page content and determine the most appropriate mode:
- learning: Educational content, courses, tutorials, documentation, articles
- focus: Productivity, dashboard, email, tasks
- job: Job applications, career pages, resume uploads
- research: Search results, data analysis, comparisons
- checkout: Shopping, cart, payment pages
- accessibility: Users needing high contrast, larger text

Page content (first 2000 chars):
${textContent.slice(0, 2000)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 500
          }
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return this.fallbackDetection(pageData);
  },
  
  fallbackDetection(pageData) {
    const { url, title, textContent } = pageData;
    const text = `${url} ${title} ${textContent}`.toLowerCase();
    
    const scores = {
      job: 0,
      learning: 0,
      checkout: 0,
      research: 0,
      focus: 0,
      accessibility: 0
    };
    
    if (text.includes('job') || text.includes('career') || text.includes('apply') || text.includes('resume') || text.includes('hiring')) {
      scores.job += 5;
    }
    if (text.includes('internship') || text.includes('course') || text.includes('learn') || text.includes('tutorial') || text.includes('documentation')) {
      scores.learning += 5;
    }
    if (text.includes('checkout') || text.includes('cart') || text.includes('buy') || text.includes('payment') || text.includes('order')) {
      scores.checkout += 5;
    }
    if (text.includes('search') || text.includes('research') || text.includes('compare') || text.includes('review')) {
      scores.research += 4;
    }
    if (text.includes('dashboard') || text.includes('email') || text.includes('inbox') || text.includes('task')) {
      scores.focus += 4;
    }
    if (text.includes('accessibility') || text.includes('contrast') || text.includes('screen reader')) {
      scores.accessibility += 5;
    }
    
    let maxScore = 0;
    let detectedMode = 'focus';
    
    for (const [mode, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedMode = mode;
      }
    }
    
    return {
      mode: detectedMode,
      confidence: Math.min(maxScore / 10, 1),
      source: 'rule-based'
    };
  }
};

GeminiIntentDetector.initialize();
