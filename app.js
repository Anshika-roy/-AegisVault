/**
 * APP.JS - Core data management and utilities for AegisVault PWA
 * Handles localStorage operations, unique ID generation, and data structure management
 */

// =============================================================================
// STORAGE KEYS
// =============================================================================
const STORAGE_KEYS = {
  USERS: 'aegis_users',
  CURRENT_USER: 'aegis_current_user',
  LAWYERS: 'aegis_lawyers',
  REQUESTS: 'aegis_requests',
  MESSAGES: 'aegis_messages',
  NOTIFICATIONS: 'aegis_notifications'
};

// =============================================================================
// UNIQUE ID GENERATOR
// =============================================================================
/**
 * Generate a unique ID using timestamp + random string
 * Format: timestamp-randomstring (e.g., 1691234567890-x7k9q2)
 */
function generateUniqueId() {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomString}`;
}

/**
 * Generate UUID v4 (alternative method)
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// =============================================================================
// USER MANAGEMENT
// =============================================================================

/**
 * Initialize sample lawyers in the system
 */
function initializeSampleLawyers() {
  const existingLawyers = getAllLawyers();
  if (existingLawyers.length > 0) {
    return; // Already initialized
  }

  const sampleLawyers = [
    {
      id: generateUniqueId(),
      name: 'Sarah Johnson',
      specialization: 'Corporate Law',
      email: 'sarah@law.com',
      rating: 4.8,
      experience: '15 years',
      phone: '+1-555-0101'
    },
    {
      id: generateUniqueId(),
      name: 'Michael Chen',
      specialization: 'Criminal Defense',
      email: 'michael@law.com',
      rating: 4.9,
      experience: '12 years',
      phone: '+1-555-0102'
    },
    {
      id: generateUniqueId(),
      name: 'Emily Rodriguez',
      specialization: 'Family Law',
      email: 'emily@law.com',
      rating: 4.7,
      experience: '10 years',
      phone: '+1-555-0103'
    },
    {
      id: generateUniqueId(),
      name: 'James Wilson',
      specialization: 'Intellectual Property',
      email: 'james@law.com',
      rating: 4.6,
      experience: '18 years',
      phone: '+1-555-0104'
    },
    {
      id: generateUniqueId(),
      name: 'Lisa Anderson',
      specialization: 'Real Estate Law',
      email: 'lisa@law.com',
      rating: 4.8,
      experience: '14 years',
      phone: '+1-555-0105'
    }
  ];

  localStorage.setItem(STORAGE_KEYS.LAWYERS, JSON.stringify(sampleLawyers));
}

/**
 * Register a new user (client or lawyer)
 */
function registerUser(name, email, role) {
  if (!name || !email || !role) {
    throw new Error('Name, email, and role are required');
  }

  if (role !== 'client' && role !== 'lawyer') {
    throw new Error('Role must be "client" or "lawyer"');
  }

  const userId = generateUniqueId();
  const user = {
    id: userId,
    name,
    email,
    role,
    createdAt: new Date().toISOString()
  };

  const users = getAllUsers();
  
  // Check if email already exists
  if (users.some(u => u.email === email)) {
    throw new Error('Email already registered');
  }

  users.push(user);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

  return user;
}

/**
 * Login user
 */
function loginUser(email) {
  const users = getAllUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    throw new Error('User not found');
  }

  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  return user;
}

/**
 * Get current logged-in user
 */
function getCurrentUser() {
  const userStr = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Logout current user
 */
function logoutUser() {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
}

/**
 * Get all users
 */
function getAllUsers() {
  const usersStr = localStorage.getItem(STORAGE_KEYS.USERS);
  return usersStr ? JSON.parse(usersStr) : [];
}

/**
 * Get user by ID
 */
function getUserById(userId) {
  const users = getAllUsers();
  return users.find(u => u.id === userId);
}

// =============================================================================
// LAWYER MANAGEMENT
// =============================================================================

/**
 * Get all lawyers
 */
function getAllLawyers() {
  const lawyersStr = localStorage.getItem(STORAGE_KEYS.LAWYERS);
  return lawyersStr ? JSON.parse(lawyersStr) : [];
}

/**
 * Get lawyer by ID
 */
function getLawyerById(lawyerId) {
  const lawyers = getAllLawyers();
  return lawyers.find(l => l.id === lawyerId);
}

/**
 * Get lawyers by specialization
 */
function getLawyersBySpecialization(specialization) {
  const lawyers = getAllLawyers();
  return lawyers.filter(l => 
    l.specialization.toLowerCase().includes(specialization.toLowerCase())
  );
}

/**
 * Add a new lawyer (admin function)
 */
function addLawyer(name, specialization, email, phone, experience) {
  const lawyer = {
    id: generateUniqueId(),
    name,
    specialization,
    email,
    phone,
    experience,
    rating: 4.5,
    createdAt: new Date().toISOString()
  };

  const lawyers = getAllLawyers();
  lawyers.push(lawyer);
  localStorage.setItem(STORAGE_KEYS.LAWYERS, JSON.stringify(lawyers));

  return lawyer;
}

// =============================================================================
// REQUEST MANAGEMENT
// =============================================================================

/**
 * Create a new request from client to lawyer
 */
function createRequest(clientId, lawyerId, description = '') {
  if (!clientId || !lawyerId) {
    throw new Error('clientId and lawyerId are required');
  }

  const request = {
    requestId: generateUniqueId(),
    clientId,
    lawyerId,
    status: 'pending', // pending, accepted, rejected, completed
    description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const requests = getAllRequests();
  requests.push(request);
  localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));

  // Create a notification for the lawyer
  createNotification(
    lawyerId,
    `New request from ${getUserById(clientId)?.name || 'Client'}`,
    `request_${request.requestId}`
  );

  return request;
}

/**
 * Get all requests
 */
function getAllRequests() {
  const requestsStr = localStorage.getItem(STORAGE_KEYS.REQUESTS);
  return requestsStr ? JSON.parse(requestsStr) : [];
}

/**
 * Get request by ID
 */
function getRequestById(requestId) {
  const requests = getAllRequests();
  return requests.find(r => r.requestId === requestId);
}

/**
 * Get requests for a specific user (client or lawyer)
 */
function getUserRequests(userId, userRole) {
  const requests = getAllRequests();
  
  if (userRole === 'client') {
    return requests.filter(r => r.clientId === userId);
  } else if (userRole === 'lawyer') {
    return requests.filter(r => r.lawyerId === userId);
  }
  
  return [];
}

/**
 * Update request status
 */
function updateRequestStatus(requestId, newStatus) {
  const validStatuses = ['pending', 'accepted', 'rejected', 'completed'];
  
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const requests = getAllRequests();
  const request = requests.find(r => r.requestId === requestId);

  if (!request) {
    throw new Error('Request not found');
  }

  request.status = newStatus;
  request.updatedAt = new Date().toISOString();

  localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));

  // Create notification for client
  const statusMessage = newStatus === 'accepted' ? 'accepted' : 'rejected';
  const lawyer = getLawyerById(request.lawyerId);
  createNotification(
    request.clientId,
    `Your request to ${lawyer?.name || 'lawyer'} has been ${statusMessage}`,
    `request_${requestId}`
  );

  return request;
}

// =============================================================================
// MESSAGING / CHAT MANAGEMENT
// =============================================================================

/**
 * Send a message
 */
function sendMessage(senderId, receiverId, requestId, messageText) {
  if (!senderId || !receiverId || !messageText) {
    throw new Error('senderId, receiverId, and messageText are required');
  }

  const message = {
    messageId: generateUniqueId(),
    senderId,
    receiverId,
    requestId,
    text: messageText,
    timestamp: new Date().toISOString(),
    read: false
  };

  const messages = getAllMessages();
  messages.push(message);
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));

  // Create notification for receiver
  const senderUser = getUserById(senderId);
  createNotification(
    receiverId,
    `New message from ${senderUser?.name || 'User'}`,
    `message_${message.messageId}`
  );

  return message;
}

/**
 * Get all messages
 */
function getAllMessages() {
  const messagesStr = localStorage.getItem(STORAGE_KEYS.MESSAGES);
  return messagesStr ? JSON.parse(messagesStr) : [];
}

/**
 * Get messages for a conversation
 */
function getConversation(userId1, userId2, requestId) {
  const messages = getAllMessages();
  return messages.filter(m => 
    ((m.senderId === userId1 && m.receiverId === userId2) ||
     (m.senderId === userId2 && m.receiverId === userId1)) &&
    m.requestId === requestId
  ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/**
 * Mark message as read
 */
function markMessageAsRead(messageId) {
  const messages = getAllMessages();
  const message = messages.find(m => m.messageId === messageId);

  if (message) {
    message.read = true;
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
  }

  return message;
}

/**
 * Get unread message count for a user
 */
function getUnreadMessageCount(userId) {
  const messages = getAllMessages();
  return messages.filter(m => m.receiverId === userId && !m.read).length;
}

// =============================================================================
// NOTIFICATION MANAGEMENT
// =============================================================================

/**
 * Create a notification
 */
function createNotification(userId, title, relatedId = '') {
  const notification = {
    notificationId: generateUniqueId(),
    userId,
    title,
    relatedId,
    read: false,
    timestamp: new Date().toISOString()
  };

  const notifications = getAllNotifications();
  notifications.push(notification);
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));

  return notification;
}

/**
 * Get all notifications
 */
function getAllNotifications() {
  const notificationsStr = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
  return notificationsStr ? JSON.parse(notificationsStr) : [];
}

/**
 * Get notifications for a user
 */
function getUserNotifications(userId) {
  const notifications = getAllNotifications();
  return notifications
    .filter(n => n.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Get unread notification count
 */
function getUnreadNotificationCount(userId) {
  const notifications = getUserNotifications(userId);
  return notifications.filter(n => !n.read).length;
}

/**
 * Mark notification as read
 */
function markNotificationAsRead(notificationId) {
  const notifications = getAllNotifications();
  const notification = notifications.find(n => n.notificationId === notificationId);

  if (notification) {
    notification.read = true;
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }

  return notification;
}

/**
 * Mark all notifications as read for a user
 */
function markAllNotificationsAsRead(userId) {
  const notifications = getAllNotifications();
  const userNotifications = notifications.filter(n => n.userId === userId);
  
  userNotifications.forEach(n => n.read = true);
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));

  return userNotifications;
}

// =============================================================================
// PWA SERVICE WORKER REGISTRATION
// =============================================================================

/**
 * Register the service worker
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error);
        });
    });
  }
}

/**
 * Check if app is installable (PWA)
 */
function isInstallable() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

/**
 * Request app installation
 */
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Show install button in UI
  showInstallButton();
});

function showInstallButton() {
  const installBtn = document.getElementById('install-button');
  if (installBtn) {
    installBtn.style.display = 'block';
    installBtn.addEventListener('click', installApp);
  }
}

function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      deferredPrompt = null;
    });
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    initializeSampleLawyers();
  });
} else {
  registerServiceWorker();
  initializeSampleLawyers();
}

// Export for use in other scripts (if using modules)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateUniqueId,
    generateUUID,
    registerUser,
    loginUser,
    getCurrentUser,
    logoutUser,
    getAllUsers,
    getUserById,
    getAllLawyers,
    getLawyerById,
    getLawyersBySpecialization,
    addLawyer,
    createRequest,
    getAllRequests,
    getRequestById,
    getUserRequests,
    updateRequestStatus,
    sendMessage,
    getAllMessages,
    getConversation,
    markMessageAsRead,
    getUnreadMessageCount,
    createNotification,
    getAllNotifications,
    getUserNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    registerServiceWorker,
    isInstallable,
    installApp
  };
}
