/**
 * CHAT.JS - Chat functionality
 * Handles real-time messaging between clients and lawyers
 */

/**
 * Send a chat message (alternative wrapper)
 */
function sendChatMessageWrapper(senderId, receiverId, requestId, text) {
  try {
    if (!text || !text.trim()) {
      throw new Error('Message cannot be empty');
    }

    const message = sendMessage(senderId, receiverId, requestId, text);
    return message;
  } catch (error) {
    console.error('Chat error:', error);
    throw error;
  }
}

/**
 * Get chat history between two users
 */
function getChatHistory(user1Id, user2Id, requestId = '') {
  return getConversation(user1Id, user2Id, requestId);
}

/**
 * Get unread messages for a user
 */
function getUserUnreadMessages(userId) {
  const messages = getAllMessages();
  return messages.filter(m => m.receiverId === userId && !m.read);
}

/**
 * Mark all messages in a conversation as read
 */
function markConversationAsRead(user1Id, user2Id) {
  const messages = getAllMessages();
  const conversationMessages = messages.filter(m =>
    ((m.senderId === user1Id && m.receiverId === user2Id) ||
     (m.senderId === user2Id && m.receiverId === user1Id))
  );

  conversationMessages.forEach(msg => {
    if (!msg.read && msg.receiverId === user1Id) {
      markMessageAsRead(msg.messageId);
    }
  });

  return conversationMessages.length;
}

/**
 * Delete a message (future feature)
 */
function deleteMessage(messageId) {
  const messages = getAllMessages();
  const filteredMessages = messages.filter(m => m.messageId !== messageId);
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(filteredMessages));
  return true;
}

/**
 * Search messages by content
 */
function searchMessages(userId, searchTerm) {
  const messages = getAllMessages();
  return messages.filter(m =>
    (m.senderId === userId || m.receiverId === userId) &&
    m.text.toLowerCase().includes(searchTerm.toLowerCase())
  );
}

/**
 * Get message statistics
 */
function getMessageStats(userId) {
  const messages = getAllMessages().filter(m =>
    m.senderId === userId || m.receiverId === userId
  );

  return {
    totalMessages: messages.length,
    sentMessages: messages.filter(m => m.senderId === userId).length,
    receivedMessages: messages.filter(m => m.receiverId === userId).length,
    unreadMessages: messages.filter(m => m.receiverId === userId && !m.read).length
  };
}

/**
 * Initialize chat UI listeners
 */
function initializeChatUI() {
  const messageInput = document.getElementById('message-input');
  
  if (messageInput) {
    // Send message on Enter key
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }
}

/**
 * Format message timestamp
 */
function formatMessageTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return date.toLocaleDateString();
}

/**
 * Render a single message element
 */
function renderMessage(message, currentUserId) {
  const isSent = message.senderId === currentUserId;
  const messageDiv = document.createElement('div');
  messageDiv.className = isSent ? 'message sent' : 'message';

  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'message-bubble';
  bubbleDiv.textContent = message.text;

  const timeDiv = document.createElement('div');
  timeDiv.className = 'message-time';
  timeDiv.textContent = formatMessageTime(message.timestamp);

  messageDiv.appendChild(bubbleDiv);
  messageDiv.appendChild(timeDiv);

  return messageDiv;
}

/**
 * Auto-refresh chat every 3 seconds (for polling-based approach)
 */
let chatRefreshInterval = null;

function startChatAutoRefresh(loadFunction, interval = 3000) {
  if (chatRefreshInterval) {
    clearInterval(chatRefreshInterval);
  }

  chatRefreshInterval = setInterval(() => {
    loadFunction();
  }, interval);
}

function stopChatAutoRefresh() {
  if (chatRefreshInterval) {
    clearInterval(chatRefreshInterval);
    chatRefreshInterval = null;
  }
}

/**
 * Notify user of new message (if they're in the conversation)
 */
function notifyNewMessage(senderId, senderName, messageText) {
  // Browser notification API
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('New Message from ' + senderName, {
      body: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231e40af" width="100" height="100" rx="20"/><text x="50" y="55" text-anchor="middle" font-size="50" font-weight="bold" fill="white" font-family="Arial">AV</text></svg>'
    });
  }
}

/**
 * Request notification permission
 */
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// Initialize chat UI when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeChatUI);
} else {
  initializeChatUI();
}

// Request notification permission on load
requestNotificationPermission();

// Export chat functions if using modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sendChatMessageWrapper,
    getChatHistory,
    getUserUnreadMessages,
    markConversationAsRead,
    deleteMessage,
    searchMessages,
    getMessageStats,
    formatMessageTime,
    renderMessage,
    startChatAutoRefresh,
    stopChatAutoRefresh,
    notifyNewMessage,
    requestNotificationPermission
  };
}
