/**
 * DASHBOARD.JS - Client dashboard logic
 * Handles displaying requests, messages, and notifications
 */

let currentUser = null;
let selectedRequest = null;
let selectedChatPartner = null;

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', () => {
  currentUser = getCurrentUser();

  if (!currentUser) {
    window.location.href = './index.html';
    return;
  }

  if (currentUser.role === 'lawyer') {
    window.location.href = './lawyer-dashboard.html';
    return;
  }

  initializeDashboard();
});

/**
 * Initialize the client dashboard
 */
function initializeDashboard() {
  document.getElementById('user-greeting').textContent = 
    `Welcome, ${currentUser.name}! Here's your activity.`;

  // Setup event listeners
  document.getElementById('logout-btn').addEventListener('click', () => {
    logoutUser();
    window.location.href = './index.html';
  });

  // Load dashboard data
  loadDashboardStats();
  loadClientRequests();
  loadClientMessages();
  loadClientNotifications();

  // Setup modal close handlers
  document.getElementById('chat-modal').addEventListener('click', (e) => {
    if (e.target.id === 'chat-modal') {
      closeChatModal();
    }
  });
}

/**
 * Load and display dashboard statistics
 */
function loadDashboardStats() {
  const requests = getUserRequests(currentUser.id, 'client');
  const messages = getAllMessages();
  const clientMessages = messages.filter(m => m.receiverId === currentUser.id && !m.read);

  document.getElementById('stat-requests').textContent = requests.length;
  document.getElementById('stat-accepted').textContent = 
    requests.filter(r => r.status === 'accepted').length;
  document.getElementById('stat-pending').textContent = 
    requests.filter(r => r.status === 'pending').length;
  document.getElementById('stat-messages').textContent = clientMessages.length;
}

/**
 * Load and display client requests
 */
function loadClientRequests() {
  const container = document.getElementById('requests-container');
  const requests = getUserRequests(currentUser.id, 'client')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  container.innerHTML = '';

  if (requests.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        <div style="font-size: 2rem; margin-bottom: var(--spacing-md);">📭</div>
        <p>You haven't sent any requests yet.</p>
        <a href="./lawyers.html" class="btn btn-primary">Find Lawyers</a>
      </div>
    `;
    return;
  }

  requests.forEach(request => {
    const lawyer = getLawyerById(request.lawyerId);
    const statusClass = `status-${request.status}`;

    const card = document.createElement('div');
    card.className = 'request-item';
    card.innerHTML = `
      <div class="request-header">
        <div>
          <h4 class="request-title">${lawyer?.name || 'Unknown Lawyer'}</h4>
          <p class="text-muted text-sm">${lawyer?.specialization || ''}</p>
        </div>
        <span class="request-status ${statusClass}">${request.status}</span>
      </div>

      <div class="request-meta">
        <span>📧 ${lawyer?.email || 'N/A'}</span>
        <span>📞 ${lawyer?.phone || 'N/A'}</span>
        <span>⏰ ${formatDate(request.createdAt)}</span>
      </div>

      <div class="request-description">
        ${escapeHtml(request.description)}
      </div>

      <div class="request-actions">
        ${request.status === 'accepted' ? `
          <button class="btn btn-primary" onclick="openClientChat('${request.lawyerId}', '${lawyer?.name}', '${request.requestId}')">
            💬 Chat with ${lawyer?.name.split(' ')[0]}
          </button>
        ` : ''}
        <button class="btn btn-outline" onclick="viewRequestDetails('${request.requestId}')">
          View Details
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

/**
 * Load and display client messages
 */
function loadClientMessages() {
  const container = document.getElementById('messages-list');
  const empty = document.getElementById('messages-empty');
  const allMessages = getAllMessages();
  const conversations = {};

  // Group messages by lawyer
  allMessages
    .filter(m => m.senderId === currentUser.id || m.receiverId === currentUser.id)
    .forEach(msg => {
      const otherId = msg.senderId === currentUser.id ? msg.receiverId : msg.senderId;
      if (!conversations[otherId]) {
        conversations[otherId] = [];
      }
      conversations[otherId].push(msg);
    });

  container.innerHTML = '';

  if (Object.keys(conversations).length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  Object.entries(conversations).forEach(([lawyerId, messages]) => {
    const lawyer = getLawyerById(lawyerId);
    const lastMessage = messages[messages.length - 1];
    const unreadCount = messages.filter(m => m.receiverId === currentUser.id && !m.read).length;

    const conversationDiv = document.createElement('div');
    conversationDiv.className = 'request-item';

    const preview = lastMessage.text.substring(0, 50) + (lastMessage.text.length > 50 ? '...' : '');
    const isSentByMe = lastMessage.senderId === currentUser.id;

    conversationDiv.innerHTML = `
      <div class="request-header">
        <div style="flex: 1;">
          <h4 class="request-title">${lawyer?.name || 'Unknown Lawyer'}</h4>
          <p class="text-muted text-sm">${isSentByMe ? 'You: ' : ''}${preview}</p>
        </div>
        ${unreadCount > 0 ? `<span class="badge badge-danger">${unreadCount} new</span>` : ''}
      </div>

      <button class="btn btn-primary btn-block" onclick="openClientChat('${lawyerId}', '${lawyer?.name}', '')">
        Continue Conversation
      </button>
    `;

    container.appendChild(conversationDiv);
  });
}

/**
 * Load and display client notifications
 */
function loadClientNotifications() {
  const container = document.getElementById('notifications-container');
  const empty = document.getElementById('notifications-empty');
  const notifications = getUserNotifications(currentUser.id);

  container.innerHTML = '';

  if (notifications.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  notifications.forEach(notification => {
    const div = document.createElement('div');
    div.className = `notification-item ${!notification.read ? 'notification-unread' : ''}`;
    div.innerHTML = `
      <div>
        <strong>${notification.title}</strong>
        <p class="text-muted text-sm">${formatDate(notification.timestamp)}</p>
      </div>
      ${!notification.read ? `
        <button onclick="markNotificationAsRead('${notification.notificationId}'); location.reload();" 
                class="btn btn-sm btn-outline">
          Mark as Read
        </button>
      ` : ''}
    `;

    container.appendChild(div);
  });
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Remove active from all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  document.getElementById(`${tabName}-tab`).classList.add('active');
  event.target.classList.add('active');
}

/**
 * Open chat modal for conversation with lawyer
 */
function openClientChat(lawyerId, lawyerName, requestId) {
  selectedChatPartner = {
    id: lawyerId,
    name: lawyerName,
    requestId
  };

  document.getElementById('chat-header').textContent = `Chat with ${lawyerName}`;
  loadClientChatMessages();
  document.getElementById('chat-modal').classList.add('active');
}

/**
 * Load messages in chat
 */
function loadClientChatMessages() {
  const container = document.getElementById('chat-messages');
  const messages = getConversation(currentUser.id, selectedChatPartner.id, selectedChatPartner.requestId || '');

  container.innerHTML = '';

  if (messages.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--gray-600); padding: var(--spacing-lg);">Say hello to start the conversation! 👋</div>';
  }

  messages.forEach(message => {
    const isSent = message.senderId === currentUser.id;
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.justifyContent = isSent ? 'flex-end' : 'flex-start';
    div.style.marginBottom = 'var(--spacing-md)';

    const bubble = document.createElement('div');
    bubble.style.background = isSent ? 'var(--primary-color)' : 'var(--gray-100)';
    bubble.style.color = isSent ? 'white' : 'var(--gray-900)';
    bubble.style.padding = 'var(--spacing-md)';
    bubble.style.borderRadius = 'var(--radius-lg)';
    bubble.style.maxWidth = '70%';
    bubble.style.wordWrap = 'break-word';

    const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    bubble.innerHTML = `
      <div>${escapeHtml(message.text)}</div>
      <div style="font-size: 0.75rem; margin-top: var(--spacing-xs); opacity: 0.7;">
        ${time}
      </div>
    `;

    div.appendChild(bubble);
    container.appendChild(div);

    // Mark as read
    if (!isSent && !message.read) {
      markMessageAsRead(message.messageId);
    }
  });

  // Scroll to bottom
  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 100);
}

/**
 * Send chat message
 */
function sendChatMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();

  if (!text) return;

  try {
    sendMessage(
      currentUser.id,
      selectedChatPartner.id,
      selectedChatPartner.requestId,
      text
    );

    input.value = '';
    loadClientChatMessages();
    loadClientMessages();
    loadDashboardStats();
  } catch (error) {
    alert(`Error sending message: ${error.message}`);
  }
}

/**
 * Close chat modal
 */
function closeChatModal() {
  document.getElementById('chat-modal').classList.remove('active');
  selectedChatPartner = null;
}

/**
 * View request details
 */
function viewRequestDetails(requestId) {
  const request = getRequestById(requestId);

  if (!request) {
    alert('Request not found');
    return;
  }

  const lawyer = getLawyerById(request.lawyerId);
  const statusEmoji = {
    pending: '⏳',
    accepted: '✅',
    rejected: '❌',
    completed: '🏁'
  };

  const details = `
${statusEmoji[request.status]} ${request.status.toUpperCase()}

Lawyer: ${lawyer?.name || 'Unknown'}
Specialization: ${lawyer?.specialization || 'N/A'}
Email: ${lawyer?.email || 'N/A'}
Phone: ${lawyer?.phone || 'N/A'}

Sent: ${formatDate(request.createdAt)}
Updated: ${formatDate(request.updatedAt)}

Description:
${request.description}
  `;

  alert(details);
}

/**
 * Format date to readable string
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('chat-modal');
  if (e.target === modal) {
    closeChatModal();
  }
});
