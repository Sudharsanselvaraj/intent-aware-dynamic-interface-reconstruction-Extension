document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const modeButtons = document.querySelectorAll('.mode-btn');
  const compareBtn = document.getElementById('compareBtn');
  const sidebarBtn = document.getElementById('sidebarBtn');
  const customBtn = document.getElementById('customBtn');
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
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }
  
  async function loadState() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_STATE'
      });
      
      if (response) {
        isEnabled = response.enabled !== false;
        activeMode = response.mode || 'focus';
        updateUI();
      }
      
      const prefs = await chrome.runtime.sendMessage({
        type: 'GET_PREFERENCES'
      });
      
      if (prefs) {
        autoSuggestToggle.checked = prefs.autoSuggest !== false;
        intentInferenceToggle.checked = prefs.intentInference !== false;
        showNotificationsToggle.checked = prefs.showNotifications !== false;
      }
    } catch (e) {
      console.error('Failed to load state:', e);
    }
  }
  
  function setupEventListeners() {
    toggleBtn.addEventListener('click', toggleLayer);
    
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => selectMode(btn.dataset.mode));
    });
    
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
    try {
      isEnabled = !isEnabled;
      
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_LAYER'
      });
      
      updateUI();
    } catch (e) {
      console.error('Failed to toggle layer:', e);
    }
  }
  
  async function selectMode(mode) {
    try {
      activeMode = mode;
      
      await chrome.runtime.sendMessage({
        type: 'SET_MODE',
        mode: mode,
        rules: getModeRules(mode)
      });
      
      updateUI();
    } catch (e) {
      console.error('Failed to set mode:', e);
    }
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
  
  function openHelp() {
    const url = 'https://github.com/reality-layer/docs';
    chrome.tabs.create({ url });
  }
});