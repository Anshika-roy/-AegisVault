# AegisVault - Lawyer-Client Connection PWA

A Progressive Web App (PWA) built with HTML, CSS, and JavaScript that connects clients with professional lawyers. The app works offline and can be installed on any device like a native app.

## 📋 Features

### Core Features
✅ **User Roles**: Clients and Lawyers with separate dashboards  
✅ **Lawyer Directory**: Browse and filter lawyers by specialization  
✅ **Request System**: Clients can send requests to lawyers  
✅ **Status Management**: Accept/Reject/Complete requests  
✅ **Real-time Chat**: Direct messaging between clients and lawyers  
✅ **Notifications**: Get alerts for new requests and messages  
✅ **Statistics Dashboard**: Track requests and activity  

### PWA Features
✅ **Offline Support**: Works without internet connection  
✅ **Installable**: Install like a native app on mobile/desktop  
✅ **Fast Loading**: Service worker caching for quick access  
✅ **Responsive Design**: Works on all devices  
✅ **App Shortcuts**: Quick access to common actions  
✅ **Push Notifications**: Browser notifications for updates  

## 📁 File Structure

```
evidence app/
├── index-pwa.html              # Main landing page (use this instead of React index.html)
├── lawyers.html                # Lawyer directory page
├── client-dashboard.html       # Client dashboard
├── lawyer-dashboard.html       # Lawyer dashboard
├── app.js                      # Core data management & utilities
├── app.css                     # Global styles & design system
├── lawyers.js                  # Lawyer listing logic
├── dashboard.js                # Client dashboard logic
├── chat.js                     # Chat functionality
├── service-worker.js           # PWA offline support
├── manifest.json               # PWA configuration
├── README.md                   # This file
└── [Old files remain untouched]
    ├── AegisVault_1.jsx
    ├── firebase-config.js
    ├── login.html/js
    ├── register.html/js
    └── supabase-config.js
```

## 🚀 Getting Started

### 1. **Replace the Main Index**
Since we're building a PWA, use `index-pwa.html` as your new landing page:
```bash
# Option A: Use index-pwa.html as the new index
# Option B: Copy contents of index-pwa.html to index.html
```

### 2. **Add PWA Support**
All PWA files are already created:
- `manifest.json` - App configuration
- `service-worker.js` - Offline caching
- `app.css` - Design system
- `app.js` - Data management

### 3. **Test the App**
```bash
# Start a local server
python -3 -m http.server 5500 --bind 127.0.0.1

# OR use the task in VS Code:
# Terminal → Run Task → "Start local web server (5500)"
```

Open: `http://localhost:5500/index-pwa.html`

### 4. **Install the PWA**
- Open in browser
- Look for install button or address bar prompt
- Click "Install" to add to home screen

## 🔑 Key Components

### 1. **App.js** - Core Data Management
Handles all data operations using localStorage:

```javascript
// User Management
registerUser(name, email, role)    // Create new user
loginUser(email)                   // Login
getCurrentUser()                   // Get current logged-in user
logoutUser()                       // Logout

// Lawyer Management
getAllLawyers()                    // Get all lawyers
getLawyerById(id)                  // Get specific lawyer
getLawyersBySpecialization(spec)   // Filter by specialization

// Request Management
createRequest(clientId, lawyerId, description)
getUserRequests(userId, userRole)
updateRequestStatus(requestId, status)

// Messaging
sendMessage(senderId, receiverId, requestId, text)
getConversation(user1Id, user2Id, requestId)
getUnreadMessageCount(userId)

// Notifications
createNotification(userId, title)
getUserNotifications(userId)
markNotificationAsRead(notificationId)

// PWA
registerServiceWorker()            // Register service worker
```

### 2. **Authentication Flow**

```
Landing Page (index-pwa.html)
├── Login Form
│   └── Email → loginUser() → Dashboard
└── Register Form
    ├── Name, Email, Role
    └── registerUser() + loginUser() → Dashboard

Client Dashboard (client-dashboard.html)
├── View Requests
├── Send Messages
└── View Notifications

Lawyer Dashboard (lawyer-dashboard.html)
├── View Pending Requests
├── Accept/Reject Requests
└── Chat with Clients
```

### 3. **Request Lifecycle**

```
Client Browser          →  Lawyer Browser
   ↓
View Lawyers (lawyers.html)
   ↓
Send Request
   ↓
Request Created (status: "pending")
   ├─→ Notification sent to Lawyer
   ↓
Lawyer Dashboard
   ↓
Accept/Reject Request
   ├─→ Notification sent to Client
   ↓
If Accepted:
   ├─→ Both can chat
   ├─→ Exchange messages
   ├─→ Update status when done
```

## 💾 Data Structure

### User Object
```javascript
{
  id: "1691234567890-x7k9q2",
  name: "John Doe",
  email: "john@example.com",
  role: "client" | "lawyer",
  createdAt: "2024-01-01T10:00:00Z"
}
```

### Lawyer Object
```javascript
{
  id: "unique-id",
  name: "Sarah Johnson",
  specialization: "Corporate Law",
  email: "sarah@law.com",
  phone: "+1-555-0101",
  rating: 4.8,
  experience: "15 years"
}
```

### Request Object
```javascript
{
  requestId: "unique-id",
  clientId: "client-id",
  lawyerId: "lawyer-id",
  status: "pending" | "accepted" | "rejected" | "completed",
  description: "Case details here",
  createdAt: "2024-01-01T10:00:00Z",
  updatedAt: "2024-01-01T11:00:00Z"
}
```

### Message Object
```javascript
{
  messageId: "unique-id",
  senderId: "user-id",
  receiverId: "user-id",
  requestId: "request-id",
  text: "Message content",
  timestamp: "2024-01-01T10:00:00Z",
  read: false
}
```

## 📱 Using the App

### For Clients

1. **Sign Up** - Create account as "Client"
2. **Find Lawyers** - Browse lawyers by specialization
3. **Send Request** - Click request button on lawyer card
4. **Wait for Response** - Check dashboard for updates
5. **Chat** - Once accepted, chat with lawyer
6. **Complete** - Mark case as completed

### For Lawyers

1. **Sign Up** - Create account as "Lawyer"
2. **View Dashboard** - See pending requests
3. **Review Requests** - Check client details
4. **Accept/Reject** - Make decisions on requests
5. **Chat** - Communicate with accepted clients
6. **Manage Cases** - Update status and complete cases

## 🛠️ Customization

### Add More Lawyers
Edit `app.js`, find `initializeSampleLawyers()` function:

```javascript
function initializeSampleLawyers() {
  const sampleLawyers = [
    {
      id: generateUniqueId(),
      name: "Your Name",
      specialization: "Your Specialization",
      email: "your@email.com",
      rating: 4.8,
      experience: "X years",
      phone: "+1-XXX-XXXX"
    }
    // Add more lawyers...
  ];
}
```

### Change Colors
Edit `app.css`, update CSS variables:

```css
:root {
  --primary-color: #1e40af;      /* Change this */
  --primary-light: #3b82f6;
  --secondary-color: #10b981;
  /* ... more colors ... */
}
```

### Add New Features
- Create new HTML file
- Include app.js and app.css
- Use provided functions for data management
- Follow existing patterns

## 🔒 Security Notes

⚠️ **Current Implementation:**
- Uses localStorage (not encrypted)
- No backend server
- Demo only - for production use:
  - Add Firebase/Supabase backend
  - Implement authentication
  - Encrypt sensitive data
  - Add rate limiting

## 📊 Testing Checklist

- [ ] Can create client account
- [ ] Can create lawyer account
- [ ] Client can view lawyers
- [ ] Client can send request
- [ ] Lawyer receives notification
- [ ] Lawyer can accept/reject
- [ ] Client receives notification
- [ ] Both can chat after accept
- [ ] App works offline
- [ ] Can install PWA
- [ ] Notifications work

## 🐛 Common Issues

### Problem: Service Worker not registering
**Solution**: Service worker requires HTTPS or localhost. Test on `localhost:5500`

### Problem: Data lost after refresh
**Solution**: Check browser's localStorage is enabled. Storage limit is ~5-10MB

### Problem: Chat not updating
**Solution**: Messages update when page loads. For real-time, add polling with `setInterval()`

### Problem: Can't install PWA
**Solution**: 
- Use HTTPS or localhost
- Check manifest.json is valid
- Wait 2-3 seconds after first visit
- Try in Chrome/Edge first

## 🚀 Deployment

### Deploy to GitHub Pages
```bash
git add .
git commit -m "Add PWA features"
git push origin main
```

### Deploy to Netlify
```bash
# Connect GitHub repo to Netlify
# Auto-deploys on push
```

### Deploy to Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init
firebase deploy
```

## 📚 Additional Features to Add

### Phase 2
- [ ] Video consultation booking
- [ ] Case file uploads
- [ ] Payment integration
- [ ] Reviews & ratings
- [ ] Advanced search filters
- [ ] Email notifications

### Phase 3
- [ ] Admin dashboard
- [ ] Lawyer verification
- [ ] KYC (Know Your Client)
- [ ] Legal document templates
- [ ] Calendar integration
- [ ] Video call integration

## 📖 Code Examples

### Register User
```javascript
try {
  const user = registerUser("John Doe", "john@email.com", "client");
  loginUser("john@email.com");
  window.location.href = "./lawyers.html";
} catch (error) {
  alert(error.message);
}
```

### Create Request
```javascript
const currentUser = getCurrentUser();
const request = createRequest(
  currentUser.id,
  lawyerId,
  "Please help with contract review"
);
```

### Send Message
```javascript
const message = sendMessage(
  senderId,
  receiverId,
  requestId,
  "What's your availability?"
);
```

### Get Conversations
```javascript
const messages = getConversation(clientId, lawyerId, requestId);
messages.forEach(msg => {
  console.log(msg.text, msg.timestamp);
});
```

## 🤝 Contributing

To add features:
1. Update data structures in `app.js`
2. Add UI in HTML files
3. Add logic in corresponding JS files
4. Test thoroughly
5. Update this README

## 📝 License

This is a demo/educational project. Feel free to use for learning.

## 💡 Notes for Integration

### With Existing React App (AegisVault_1.jsx)
You can run both:
- React app: `index.html` → React
- PWA app: `index-pwa.html` → Pure JS/HTML

Or integrate PWA features into React:
```jsx
import './app.css';
import './app.js';

function App() {
  // Use functions from app.js
  const user = window.getCurrentUser();
  // ...
}
```

### With Firebase/Supabase
The PWA currently uses localStorage. To use Firebase:

1. Replace localStorage calls with Firestore
2. Update in `app.js` functions
3. Keep same function signatures
4. Rest of app stays the same

Example:
```javascript
// Current
const users = getAllUsers();

// With Firebase
async function getAllUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs.map(doc => doc.data());
}
```

## 🎯 Quick Links

- **Landing**: `index-pwa.html`
- **Find Lawyers**: `lawyers.html`
- **Client Dashboard**: `client-dashboard.html`
- **Lawyer Dashboard**: `lawyer-dashboard.html`
- **API Reference**: `app.js` comments

---

**Built with ❤️ using HTML, CSS, JavaScript**
**Progressive Web App • Offline-First • PWA Installable**
