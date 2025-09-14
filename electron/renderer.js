const { ipcRenderer } = require('electron');

let config = {};

// DOM elements
const elements = {
  startAgent: document.getElementById('startAgent'),
  stopAgent: document.getElementById('stopAgent'),
  saveConfig: document.getElementById('saveConfig'),
  saveSecrets: document.getElementById('saveSecrets'),
  saveUser: document.getElementById('saveUser'),
  loadEnvSecrets: document.getElementById('loadEnvSecrets'),
  clearOutput: document.getElementById('clearOutput'),
  scrollToBottom: document.getElementById('scrollToBottom'),
  status: document.getElementById('status'),
  output: document.getElementById('output'),
  pageTitle: document.getElementById('pageTitle'),

  // Agent list management
  agentList: document.getElementById('agentList'),
  addNewAgent: document.getElementById('addNewAgent'),
  backToList: document.getElementById('backToList'),
  saveAgentConfig: document.getElementById('saveAgentConfig'),
  editAgentName: document.getElementById('editAgentName'),
  editingAgentTitle: document.getElementById('editingAgentTitle'),
  agentListView: document.getElementById('agent-list-view'),
  agentEditView: document.getElementById('agent-edit-view'),

  // Profile selection for running assistant
  runProfileSelect: document.getElementById('runProfileSelect'),

  // API Keys
  openaiApiKey: document.getElementById('openaiApiKey'),
  deepgramApiKey: document.getElementById('deepgramApiKey'),
  cartesiaApiKey: document.getElementById('cartesiaApiKey'),
  aciApiKey: document.getElementById('aciApiKey'),

  // System prompt
  systemPrompt: document.getElementById('systemPrompt'),

  // User context
  userName: document.getElementById('userName'),
  userPreferences: document.getElementById('userPreferences'),
  additionalInfo: document.getElementById('additionalInfo'),

  // MCP servers
  mcpServers: document.getElementById('mcpServers'),
  addMcpServer: document.getElementById('addMcpServer')
};

// Tab management
const tabs = {
  'assistant': { title: 'Assistant', element: document.getElementById('assistant-tab') },
  'configurations': { title: 'Configurations', element: document.getElementById('configurations-tab') },
  'secrets': { title: 'API Secrets', element: document.getElementById('secrets-tab') },
  'user': { title: 'User Settings', element: document.getElementById('user-tab') }
};

function switchTab(tabName) {
  // Remove active class from all nav items and tab contents
  document.querySelectorAll('.nav-item a').forEach(link => link.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));

  // Add active class to clicked nav item and corresponding tab
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  tabs[tabName].element.classList.add('active');

  // Update page title
  elements.pageTitle.textContent = tabs[tabName].title;
}

// Load configuration on startup
async function loadConfig() {
  try {
    config = await ipcRenderer.invoke('get-config');
    populateUI();
  } catch (error) {
    showStatus('Failed to load configuration', 'error');
  }
}

// Populate UI with current config
function populateUI() {
  // API Keys
  elements.openaiApiKey.value = config.secrets?.openaiApiKey || '';
  elements.deepgramApiKey.value = config.secrets?.deepgramApiKey || '';
  elements.cartesiaApiKey.value = config.secrets?.cartesiaApiKey || '';
  elements.aciApiKey.value = config.secrets?.aciApiKey || '';

  // System prompt
  elements.systemPrompt.value = config.systemPrompt || '';

  // User context
  elements.userName.value = config.userContext?.name || '';
  elements.userPreferences.value = config.userContext?.preferences || '';
  elements.additionalInfo.value = config.userContext?.additionalInfo || '';

  // MCP servers
  renderMcpServers();

  // Agent management
  renderAgentList();
  populateRunProfileSelect();
}

// Agent list management
function renderAgentList() {
  const profiles = config.agentProfiles || {};
  elements.agentList.innerHTML = '';

  const profileNames = Object.keys(profiles);

  if (profileNames.length === 0) {
    elements.agentList.innerHTML = `
      <div class="agent-list-empty">
        <h4>No agents configured</h4>
        <p>Click "Add New Agent" to create your first agent configuration</p>
      </div>
    `;
    return;
  }

  profileNames.forEach(profileName => {
    const profile = profiles[profileName];
    const card = document.createElement('div');
    card.className = 'agent-card';

    const promptPreview = profile.systemPrompt
      ? profile.systemPrompt.substring(0, 100) + (profile.systemPrompt.length > 100 ? '...' : '')
      : 'No system prompt configured';

    const mcpCount = profile.mcpServers ? profile.mcpServers.length : 0;

    card.innerHTML = `
      <h4>${profileName.charAt(0).toUpperCase() + profileName.slice(1)}</h4>
      <p>${promptPreview}</p>
      <p><small>${mcpCount} MCP server${mcpCount !== 1 ? 's' : ''} configured</small></p>
      <div class="agent-card-actions">
        <button class="secondary" onclick="editAgent('${profileName}')">Edit</button>
        ${profileName !== 'default' ? `<button class="danger" onclick="deleteAgent('${profileName}')">Delete</button>` : ''}
      </div>
    `;

    elements.agentList.appendChild(card);
  });
}

function populateRunProfileSelect() {
  const profiles = config.agentProfiles || { 'default': {} };
  elements.runProfileSelect.innerHTML = '';

  Object.keys(profiles).forEach(profileName => {
    const option = document.createElement('option');
    option.value = profileName;
    option.textContent = profileName.charAt(0).toUpperCase() + profileName.slice(1);
    elements.runProfileSelect.appendChild(option);
  });

  elements.runProfileSelect.value = config.currentAgentProfile || 'default';
}

// Agent editing functions
let currentEditingAgent = null;

function addNewAgent() {
  currentEditingAgent = null;
  elements.editAgentName.value = '';
  elements.systemPrompt.value = '';
  config.mcpServers = [];
  renderMcpServers();
  elements.editingAgentTitle.textContent = 'Add New Agent';
  showEditView();
}

function editAgent(profileName) {
  const profiles = config.agentProfiles || {};
  const profile = profiles[profileName];

  if (profile) {
    currentEditingAgent = profileName;
    elements.editAgentName.value = profileName;
    elements.systemPrompt.value = profile.systemPrompt || '';
    config.mcpServers = profile.mcpServers || [];
    renderMcpServers();
    elements.editingAgentTitle.textContent = `Editing: ${profileName}`;
    showEditView();
  }
}

async function deleteAgent(profileName) {
  if (profileName === 'default') {
    showStatus('Cannot delete default agent', 'error');
    return;
  }

  if (confirm(`Are you sure you want to delete the agent "${profileName}"?`)) {
    const profiles = { ...config.agentProfiles };
    delete profiles[profileName];

    const newConfig = { agentProfiles: profiles };
    await ipcRenderer.invoke('save-config', newConfig);
    config = { ...config, ...newConfig };

    renderAgentList();
    populateRunProfileSelect();
    showStatus(`Agent "${profileName}" deleted successfully`, 'success');
  }
}

async function saveAgentConfig() {
  const agentName = elements.editAgentName.value.trim();
  if (!agentName) {
    showStatus('Please enter an agent name', 'error');
    return;
  }

  const profileData = {
    systemPrompt: elements.systemPrompt.value,
    mcpServers: config.mcpServers || []
  };

  // If editing existing agent and name changed, delete old one
  if (currentEditingAgent && currentEditingAgent !== agentName) {
    const profiles = { ...config.agentProfiles };
    delete profiles[currentEditingAgent];
    config.agentProfiles = profiles;
  }

  const profiles = { ...(config.agentProfiles || {}), [agentName]: profileData };
  const newConfig = { agentProfiles: profiles };

  await ipcRenderer.invoke('save-config', newConfig);
  config = { ...config, ...newConfig };

  renderAgentList();
  populateRunProfileSelect();
  showListView();
  showStatus(`Agent "${agentName}" saved successfully!`, 'success');
}

function showListView() {
  elements.agentListView.style.display = 'block';
  elements.agentEditView.style.display = 'none';
}

function showEditView() {
  elements.agentListView.style.display = 'none';
  elements.agentEditView.style.display = 'block';
}

// Make functions available globally for onclick handlers
window.editAgent = editAgent;
window.deleteAgent = deleteAgent;

// Render MCP servers
function renderMcpServers() {
  elements.mcpServers.innerHTML = '';

  if (config.mcpServers) {
    config.mcpServers.forEach((server, index) => {
      const serverDiv = document.createElement('div');
      serverDiv.className = 'mcp-server';
      serverDiv.innerHTML = `
        <div class="form-group">
          <label>Server Name:</label>
          <input type="text" value="${server.name}" onchange="updateMcpServer(${index}, 'name', this.value)">
        </div>
        <div class="form-group">
          <label>Command:</label>
          <input type="text" value="${server.command}" onchange="updateMcpServer(${index}, 'command', this.value)">
        </div>
        <div class="form-group">
          <label>Arguments (JSON array):</label>
          <input type="text" value='${JSON.stringify(server.args)}' onchange="updateMcpServerArgs(${index}, this.value)">
        </div>
        <button class="danger" onclick="removeMcpServer(${index})">Remove</button>
      `;
      elements.mcpServers.appendChild(serverDiv);
    });
  }
}

// MCP server management
function updateMcpServer(index, field, value) {
  if (!config.mcpServers) config.mcpServers = [];
  config.mcpServers[index][field] = value;
}

function updateMcpServerArgs(index, value) {
  try {
    config.mcpServers[index].args = JSON.parse(value);
  } catch (e) {
    showStatus('Invalid JSON in MCP server arguments', 'error');
  }
}

function removeMcpServer(index) {
  config.mcpServers.splice(index, 1);
  renderMcpServers();
}

function addMcpServer() {
  if (!config.mcpServers) config.mcpServers = [];
  config.mcpServers.push({
    name: 'New MCP Server',
    command: '',
    args: []
  });
  renderMcpServers();
}

// Save configuration (for configurations tab)
async function saveConfig() {
  try {
    // Save the current configuration to the active agent profile
    const currentProfile = config.currentAgentProfile || 'default';
    const profileData = {
      systemPrompt: elements.systemPrompt.value,
      mcpServers: config.mcpServers || []
    };

    const profiles = { ...(config.agentProfiles || {}), [currentProfile]: profileData };
    const newConfig = {
      systemPrompt: elements.systemPrompt.value,
      mcpServers: config.mcpServers || [],
      agentProfiles: profiles,
      secrets: {
        openaiApiKey: elements.openaiApiKey.value,
        deepgramApiKey: elements.deepgramApiKey.value,
        cartesiaApiKey: elements.cartesiaApiKey.value,
        aciApiKey: elements.aciApiKey.value
      },
      userContext: {
        name: elements.userName.value,
        preferences: elements.userPreferences.value,
        additionalInfo: elements.additionalInfo.value
      }
    };

    await ipcRenderer.invoke('save-config', newConfig);
    config = { ...config, ...newConfig };
    showStatus(`Configuration saved to profile "${currentProfile}"!`, 'success');
  } catch (error) {
    showStatus('Failed to save configuration', 'error');
  }
}

// Save secrets only
async function saveSecrets() {
  try {
    const secretsConfig = {
      secrets: {
        openaiApiKey: elements.openaiApiKey.value,
        deepgramApiKey: elements.deepgramApiKey.value,
        cartesiaApiKey: elements.cartesiaApiKey.value,
        aciApiKey: elements.aciApiKey.value
      }
    };

    await ipcRenderer.invoke('save-config', secretsConfig);
    config = { ...config, ...secretsConfig };
    showStatus('Secrets saved successfully!', 'success');
  } catch (error) {
    showStatus('Failed to save secrets', 'error');
  }
}

// Save user settings only
async function saveUser() {
  try {
    const userConfig = {
      userContext: {
        name: elements.userName.value,
        preferences: elements.userPreferences.value,
        additionalInfo: elements.additionalInfo.value
      }
    };

    await ipcRenderer.invoke('save-config', userConfig);
    config = { ...config, ...userConfig };
    showStatus('User settings saved successfully!', 'success');
  } catch (error) {
    showStatus('Failed to save user settings', 'error');
  }
}

// Load secrets from .env file
async function loadEnvSecrets() {
  try {
    const result = await ipcRenderer.invoke('load-env-secrets');
    if (result.success) {
      elements.openaiApiKey.value = result.secrets.openaiApiKey || '';
      elements.deepgramApiKey.value = result.secrets.deepgramApiKey || '';
      elements.cartesiaApiKey.value = result.secrets.cartesiaApiKey || '';
      elements.aciApiKey.value = result.secrets.aciApiKey || '';
      showStatus('API secrets loaded from .env file', 'success');
    } else {
      showStatus(result.message, 'error');
    }
  } catch (error) {
    showStatus('Failed to load secrets from .env file', 'error');
  }
}

// Output control
function clearOutput() {
  elements.output.textContent = '';
}

function scrollToBottom() {
  elements.output.scrollTop = elements.output.scrollHeight;
}

// Agent control
async function startAgent() {
  try {
    const result = await ipcRenderer.invoke('start-agent');
    showStatus(result.message, result.success ? 'success' : 'error');
  } catch (error) {
    showStatus('Failed to start agent', 'error');
  }
}

async function stopAgent() {
  try {
    const result = await ipcRenderer.invoke('stop-agent');
    showStatus(result.message, result.success ? 'success' : 'error');
  } catch (error) {
    showStatus('Failed to stop agent', 'error');
  }
}

// Show status message
function showStatus(message, type) {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  elements.status.style.display = 'block';

  setTimeout(() => {
    elements.status.style.display = 'none';
  }, 5000);
}

// Event listeners
elements.startAgent.addEventListener('click', startAgent);
elements.stopAgent.addEventListener('click', stopAgent);
elements.saveSecrets.addEventListener('click', saveSecrets);
elements.saveUser.addEventListener('click', saveUser);
elements.loadEnvSecrets.addEventListener('click', loadEnvSecrets);
elements.clearOutput.addEventListener('click', clearOutput);
elements.scrollToBottom.addEventListener('click', scrollToBottom);
elements.addMcpServer.addEventListener('click', addMcpServer);

// Agent management listeners
elements.addNewAgent.addEventListener('click', addNewAgent);
elements.backToList.addEventListener('click', showListView);
elements.saveAgentConfig.addEventListener('click', saveAgentConfig);

// Tab navigation event listeners
document.querySelectorAll('[data-tab]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const tabName = e.target.getAttribute('data-tab');
    switchTab(tabName);
  });
});

// Python output listeners
ipcRenderer.on('python-output', (event, data) => {
  elements.output.textContent += data;
  elements.output.scrollTop = elements.output.scrollHeight;
});

ipcRenderer.on('python-error', (event, data) => {
  elements.output.textContent += `ERROR: ${data}`;
  elements.output.scrollTop = elements.output.scrollHeight;
});

// Make functions available globally for HTML onclick handlers
window.updateMcpServer = updateMcpServer;
window.updateMcpServerArgs = updateMcpServerArgs;
window.removeMcpServer = removeMcpServer;
window.addMcpServer = addMcpServer;

// Load config on startup
loadConfig();