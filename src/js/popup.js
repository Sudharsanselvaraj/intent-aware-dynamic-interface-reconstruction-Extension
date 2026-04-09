document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const modeButtons = document.querySelectorAll('.mode-btn');
  const compareBtn = document.getElementById('compareBtn');
  const sidebarBtn = document.getElementById('sidebarBtn');
  const customBtn = document.getElementById('customBtn');
  const aiDetectBtn = document.getElementById('aiDetectBtn');
  const helpLink = document.getElementById('helpLink');
  
  const autoSuggestToggle = document.getElementById('autoSuggest');
  const intentInferenceToggle = document.getElementById('intentInference');
  const showNotificationsToggle = document.getElementById('showNotifications');
  
  let isEnabled = true;
  let activeMode = 'focus';
  let currentTab = null;
  
  init();
  
  async function init() {
    currentTab = await getCurrentTab();
    await loadState();
    setupEventListeners();
  }
  
  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }
  
  async function loadState() {
    if (!currentTab?.id) return;
    
    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        type: 'GET_STATE'
      });
      
      if (response) {
        isEnabled = response.enabled !== false;
        activeMode = response.mode || 'focus';
        updateUI();
      }
    } catch (e) {}
    
    try {
      const prefs = await chrome.runtime.sendMessage({
        type: 'GET_PREFERENCES'
      });
      
      if (prefs) {
        autoSuggestToggle.checked = prefs.autoSuggest !== false;
        intentInferenceToggle.checked = prefs.intentInference !== false;
        showNotificationsToggle.checked = prefs.showNotifications !== false;
      }
    } catch (e) {}
  }
  
  function setupEventListeners() {
    toggleBtn.addEventListener('click', toggleLayer);
    
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => selectMode(btn.dataset.mode));
    });
    
    aiDetectBtn.addEventListener('click', detectWithAI);
    compareBtn.addEventListener('click', toggleCompare);
    sidebarBtn.addEventListener('click', toggleSidebar);
    customBtn.addEventListener('click', openCustomModeBuilder);
    
    autoSuggestToggle.addEventListener('change', updatePreferences);
    intentInferenceToggle.addEventListener('change', updatePreferences);
    showNotificationsToggle.addEventListener('change', updatePreferences);
    
    helpLink.addEventListener('click', openHelp);
  }
  
  function updateUI() {
    if (isEnabled) {
      statusDot.classList.remove('disabled');
      statusText.textContent = 'Active';
      toggleBtn.textContent = 'Disable';
      toggleBtn.classList.remove('off');
    } else {
      statusDot.classList.add('disabled');
      statusText.textContent = 'Disabled';
      toggleBtn.textContent = 'Enable';
      toggleBtn.classList.add('off');
    }
    
    modeButtons.forEach(btn => {
      if (btn.dataset.mode === activeMode && isEnabled) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
  
  async function toggleLayer() {
    const newState = !isEnabled;
    isEnabled = newState;
    
    if (!currentTab?.id) {
      updateUI();
      return;
    }
    
    try {
      await chrome.tabs.sendMessage(currentTab.id, {
        type: newState ? 'APPLY_MODE' : 'DISABLE_LAYER',
        mode: newState ? 'focus' : null
      });
    } catch (e) {}
    
    try {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_LAYER',
        tabId: currentTab.id
      });
    } catch (e) {}
    
    updateUI();
  }
  
  async function selectMode(mode) {
    activeMode = mode;
    
    if (!currentTab?.id) {
      updateUI();
      return;
    }
    
    try {
      await chrome.tabs.sendMessage(currentTab.id, {
        type: 'APPLY_MODE',
        mode: mode,
        rules: getModeRules(mode)
      });
    } catch (e) {
      try {
        await chrome.runtime.sendMessage({
          type: 'SET_MODE',
          tabId: currentTab.id,
          mode: mode,
          rules: getModeRules(mode)
        });
      } catch (e2) {}
    }
    
    updateUI();
  }
  
  function getModeRules(mode) {
    const rules = {
      focus: [
        { selector: '[role="banner"], header, nav, .sidebar, aside', action: 'hide' },
        { selector: '.ad, .ads, .advertisement', action: 'hide' },
        { selector: '.popup, .modal', action: 'hide' }
      ],
      job: [
        { selector: 'form input:not([required]), form select:not([required])', action: 'dim' },
        { selector: 'form input[required], form select[required]', action: 'highlight' }
      ],
      learning: [
        { selector: 'p, li', action: 'addTooltip' },
        { selector: 'h1, h2, h3', action: 'highlight' }
      ],
      research: [
        { selector: 'main, article', action: 'extractable' }
      ],
      checkout: [
        { selector: '.price', action: 'highlight' },
        { selector: '[class*="timer"]', action: 'flag' }
      ],
      accessibility: [
        { selector: 'body', action: 'style', property: 'filter', value: 'contrast(1.5)' }
      ]
    };
    
    return rules[mode] || [];
  }
  
  async function toggleCompare() {
    try {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_COMPARE'
      });
    } catch (e) {
      console.error('Failed to toggle compare:', e);
    }
  }
  
  async function toggleSidebar() {
    try {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_SIDEBAR'
      });
    } catch (e) {
      console.error('Failed to toggle sidebar:', e);
    }
  }
  
  function openCustomModeBuilder() {
    const url = chrome.runtime.getURL('src/html/custom_mode.html');
    chrome.tabs.create({ url });
  }
  
  async function updatePreferences() {
    try {
      await chrome.runtime.sendMessage({
        type: 'SET_PREFERENCES',
        preferences: {
          autoSuggest: autoSuggestToggle.checked,
          intentInference: intentInferenceToggle.checked,
          showNotifications: showNotificationsToggle.checked
        }
      });
    } catch (e) {
      console.error('Failed to update preferences:', e);
    }
  }
  
  async function detectWithAI() {
    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        type: 'DETECT_INTENT'
      });
      if (response && response.mode) {
        await selectMode(response.mode);
      }
    } catch (e) {
      console.error('AI detection failed:', e);
    }
  }
  
  function openHelp() {
    const url = 'https://github.com/reality-layer/docs';
    chrome.tabs.create({ url });
  }
});