document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const intentButtons = document.querySelectorAll('.intent-btn');
  const currentIntentIcon = document.getElementById('currentIntentIcon');
  const currentIntentName = document.getElementById('currentIntentName');
  const currentIntentDesc = document.getElementById('currentIntentDesc');
  
  let isEnabled = true;
  let currentIntent = 'reading';
  let currentTab = null;
  
  const intentIcons = {
    'reading': '📖',
    'filling-form': '📝',
    'applying': '💼',
    'shopping': '🛒',
    'researching': '🔬',
    'skimming': '⚡'
  };
  
  const intentDescriptions = {
    'reading': 'Slow scroll detected',
    'filling-form': 'Form interaction detected',
    'applying': 'Job application page',
    'shopping': 'Shopping intent detected',
    'researching': 'Multiple section dwells',
    'skimming': 'Fast scroll velocity'
  };
  
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
        isEnabled = response.isActive !== false;
        currentIntent = response.intent || 'reading';
        updateUI();
      }
    } catch (e) {
      console.log('Morphic not loaded yet');
    }
  }
  
  function setupEventListeners() {
    toggleBtn.addEventListener('click', toggleMorphic);
    
    intentButtons.forEach(btn => {
      btn.addEventListener('click', () => setIntent(btn.dataset.intent));
    });
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
    
    currentIntentIcon.textContent = intentIcons[currentIntent] || '📖';
    currentIntentName.textContent = currentIntent.charAt(0).toUpperCase() + currentIntent.slice(1).replace('-', ' ');
    currentIntentDesc.textContent = intentDescriptions[currentIntent] || '';
    
    intentButtons.forEach(btn => {
      if (btn.dataset.intent === currentIntent && isEnabled) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
  
  async function toggleMorphic() {
    isEnabled = !isEnabled;
    
    if (!currentTab?.id) {
      updateUI();
      return;
    }
    
    try {
      await chrome.tabs.sendMessage(currentTab.id, {
        type: isEnabled ? 'ACTIVATE' : 'DEACTIVATE'
      });
    } catch (e) {}
    
    updateUI();
  }
  
  async function setIntent(intent) {
    currentIntent = intent;
    
    if (!currentTab?.id) {
      updateUI();
      return;
    }
    
    try {
      await chrome.tabs.sendMessage(currentTab.id, {
        type: 'SET_INTENT',
        intent: intent
      });
    } catch (e) {}
    
    updateUI();
  }
});
