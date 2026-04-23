/**
 * LAWYERS.JS - Lawyer listing page logic
 * Handles displaying lawyers, filtering, searching, and sending requests
 */

// Store selected lawyer for request
let selectedLawyer = null;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    // Redirect to login if not authenticated
    window.location.href = './index.html';
    return;
  }

  // If lawyer, redirect to lawyer dashboard
  if (currentUser.role === 'lawyer') {
    window.location.href = './lawyer-dashboard.html';
    return;
  }

  // Display user info
  displayUserInfo(currentUser);

  // Load and display lawyers
  displayLawyers();

  // Setup event listeners
  setupEventListeners();
});

/**
 * Display current user information
 */
function displayUserInfo(user) {
  document.getElementById('user-section').style.display = 'flex';
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-role').textContent = `Logged in as ${user.role}`;
  document.getElementById('user-role-badge').textContent = user.role;
}

/**
 * Display all lawyers in the grid
 */
function displayLawyers(filter = {}) {
  const container = document.getElementById('lawyers-container');
  const emptyState = document.getElementById('empty-state');

  container.innerHTML = '';

  let lawyers = getAllLawyers();

  // Apply filters
  if (filter.specialization) {
    lawyers = lawyers.filter(l =>
      l.specialization.toLowerCase().includes(filter.specialization.toLowerCase())
    );
  }

  if (filter.search) {
    lawyers = lawyers.filter(l =>
      l.name.toLowerCase().includes(filter.search.toLowerCase())
    );
  }

  // Show empty state if no lawyers
  if (lawyers.length === 0) {
    emptyState.style.display = 'block';
    container.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  container.style.display = 'grid';

  // Render lawyer cards
  lawyers.forEach(lawyer => {
    const card = createLawyerCard(lawyer);
    container.appendChild(card);
  });
}

/**
 * Create a lawyer card element
 */
function createLawyerCard(lawyer) {
  const card = document.createElement('div');
  card.className = 'lawyer-card';

  const avatarColor = getAvatarColor(lawyer.id);
  const initials = getInitials(lawyer.name);

  card.innerHTML = `
    <div class="lawyer-header">
      <div class="lawyer-avatar" style="background-color: ${avatarColor};">
        ${initials}
      </div>
      <h3>${escapeHtml(lawyer.name)}</h3>
      <p class="text-muted">${escapeHtml(lawyer.specialization)}</p>
    </div>

    <div class="lawyer-body">
      <div class="lawyer-detail">
        <span class="detail-label">Experience</span>
        <span class="detail-value">${escapeHtml(lawyer.experience)}</span>
      </div>

      <div class="lawyer-detail">
        <span class="detail-label">Rating</span>
        <span class="detail-value rating">
          ⭐ ${lawyer.rating}
        </span>
      </div>

      <div class="lawyer-detail">
        <span class="detail-label">Email</span>
        <span class="detail-value text-sm">${escapeHtml(lawyer.email)}</span>
      </div>

      <div class="lawyer-detail">
        <span class="detail-label">Phone</span>
        <span class="detail-value">${escapeHtml(lawyer.phone)}</span>
      </div>
    </div>

    <div class="lawyer-footer">
      <button class="btn btn-outline" onclick="viewLawyerProfile('${lawyer.id}')">
        View Profile
      </button>
      <button class="btn btn-primary" onclick="openRequestModal('${lawyer.id}')">
        Request
      </button>
    </div>
  `;

  return card;
}

/**
 * Setup event listeners for filters and search
 */
function setupEventListeners() {
  // Logout button
  document.getElementById('logout-btn').addEventListener('click', () => {
    logoutUser();
    window.location.href = './index.html';
  });

  // Filters
  document.getElementById('filters').style.display = 'block';

  const specializationFilter = document.getElementById('specialization-filter');
  const searchInput = document.getElementById('search-input');

  // Apply filters on change
  specializationFilter.addEventListener('change', applyFilters);
  searchInput.addEventListener('input', applyFilters);

  // Request form submission
  document.getElementById('request-form').addEventListener('submit', handleRequestSubmit);
}

/**
 * Apply filters and reload lawyers
 */
function applyFilters() {
  const specialization = document.getElementById('specialization-filter').value;
  const search = document.getElementById('search-input').value;

  displayLawyers({
    specialization,
    search
  });
}

/**
 * Open request modal for selected lawyer
 */
function openRequestModal(lawyerId) {
  const lawyer = getLawyerById(lawyerId);

  if (!lawyer) {
    showAlert('Lawyer not found', 'error');
    return;
  }

  selectedLawyer = lawyer;

  document.getElementById('modal-lawyer-name').textContent = `Request for ${lawyer.name}`;
  document.getElementById('request-description').value = '';
  document.getElementById('request-priority').value = 'normal';

  document.getElementById('request-modal').classList.add('active');
}

/**
 * Close request modal
 */
function closeRequestModal() {
  document.getElementById('request-modal').classList.remove('active');
  selectedLawyer = null;
}

/**
 * Handle request form submission
 */
function handleRequestSubmit(e) {
  e.preventDefault();

  if (!selectedLawyer) {
    showAlert('No lawyer selected', 'error');
    return;
  }

  const currentUser = getCurrentUser();
  const description = document.getElementById('request-description').value;
  const priority = document.getElementById('request-priority').value;

  if (!description.trim()) {
    showAlert('Please provide a description of your case', 'warning');
    return;
  }

  try {
    // Create the request
    const request = createRequest(
      currentUser.id,
      selectedLawyer.id,
      `[${priority.toUpperCase()}] ${description}`
    );

    showAlert(
      `Request sent to ${selectedLawyer.name} successfully!`,
      'success'
    );

    // Reset form and close modal
    setTimeout(() => {
      closeRequestModal();
      document.getElementById('request-form').reset();
    }, 1500);
  } catch (error) {
    showAlert(`Error: ${error.message}`, 'error');
    console.error('Request error:', error);
  }
}

/**
 * View lawyer profile (can be expanded with more details)
 */
function viewLawyerProfile(lawyerId) {
  const lawyer = getLawyerById(lawyerId);

  if (!lawyer) {
    showAlert('Lawyer not found', 'error');
    return;
  }

  // For now, just highlight the card with more details
  showAlert(
    `Lawyer: ${lawyer.name}\n\nSpecialization: ${lawyer.specialization}\nExperience: ${lawyer.experience}\nRating: ${lawyer.rating}/5\nEmail: ${lawyer.email}\nPhone: ${lawyer.phone}`,
    'info'
  );
}

/**
 * Show alert message
 */
function showAlert(message, type = 'info') {
  const container = document.getElementById('alert-container');

  const alertId = `alert-${Date.now()}`;
  const alertDiv = document.createElement('div');
  alertDiv.id = alertId;
  alertDiv.className = `alert alert-${type}`;

  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  alertDiv.innerHTML = `
    <span style="font-weight: bold; font-size: 1.25rem;">${iconMap[type]}</span>
    <div>
      <strong>${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
      <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
    </div>
    <button onclick="document.getElementById('${alertId}').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; padding: 0; color: inherit;">×</button>
  `;

  container.appendChild(alertDiv);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    const element = document.getElementById(alertId);
    if (element) {
      element.style.transition = 'opacity 0.3s ease-out';
      element.style.opacity = '0';
      setTimeout(() => element.remove(), 300);
    }
  }, 5000);
}

/**
 * Get initials from name
 */
function getInitials(name) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

/**
 * Get consistent color for avatar based on ID
 */
function getAvatarColor(id) {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#6366f1'  // indigo
  ];

  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
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
  const modal = document.getElementById('request-modal');
  if (e.target === modal) {
    closeRequestModal();
  }
});
