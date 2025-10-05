// Al-Quran Chat PWA - Enhanced Mobile Application

class QuranChatApp {
    constructor() {
        this.currentUser = null;
        this.currentView = 'surah-list';
        this.currentSurah = null;
        this.currentChatPartner = null;
        this.surahs = [];
        this.users = new Map();
        this.chats = new Map();
        this.messageListeners = new Map();
        this.deletedMessages = new Map(); // For undo functionality
        this.undoTimeouts = new Map();
        this.isOnline = navigator.onLine;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.longPressTimer = null;
        this.selectedMessage = null;
        this.confirmationCallback = null;
        
        // Use localStorage for persistent demo mode
        this.storageKey = 'quran-chat-data';
        this.userStorageKey = 'quran-chat-current-user';
        
        this.init();
    }

    async init() {
        try {
            // Set up event listeners first
            this.setupEventListeners();
            this.setupNetworkListeners();
            this.setupTouchListeners();
            
            // Load user data from localStorage
            this.loadUserData();
            
            // Initialize demo users if none exist
            this.initializeDemoUsers();
            
            // Register service worker for PWA
            this.registerServiceWorker();
            
            // Load Quran data
            await this.loadSurahs();
            
            // Check for persisted user login
            this.restoreUserSession();
            
            // Hide loading screen
            this.hideLoadingScreen();
            
        } catch (error) {
            console.error('App initialization failed:', error);
            this.showError('Failed to initialize app. Please refresh and try again.');
            this.hideLoadingScreen();
        }
    }

    loadUserData() {
        try {
            const savedData = localStorage.getItem(this.storageKey);
            if (savedData) {
                const data = JSON.parse(savedData);
                if (data.users) {
                    this.users = new Map(Object.entries(data.users));
                }
                if (data.chats) {
                    this.chats = new Map(Object.entries(data.chats));
                }
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    saveUserData() {
        try {
            const data = {
                users: Object.fromEntries(this.users),
                chats: Object.fromEntries(this.chats),
                timestamp: Date.now()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving user data:', error);
        }
    }

    restoreUserSession() {
        try {
            const savedUser = localStorage.getItem(this.userStorageKey);
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
                console.log('User session restored:', this.currentUser.username);
            }
        } catch (error) {
            console.error('Error restoring user session:', error);
        }
    }

    saveUserSession() {
        try {
            if (this.currentUser) {
                localStorage.setItem(this.userStorageKey, JSON.stringify(this.currentUser));
            }
        } catch (error) {
            console.error('Error saving user session:', error);
        }
    }

    initializeDemoUsers() {
        if (this.users.size === 0) {
            // Create demo users
            const demoUsers = [
                {
                    id: 'user1',
                    username: 'Ahmad_M',
                    email: 'ahmad@example.com',
                    displayName: 'Ahmad Muhammad',
                    createdAt: Date.now() - 86400000 // 1 day ago
                },
                {
                    id: 'user2',
                    username: 'Fatima_S',
                    email: 'fatima@example.com',
                    displayName: 'Fatima Saleh',
                    createdAt: Date.now() - 172800000 // 2 days ago
                },
                {
                    id: 'user3',
                    username: 'Ali_K',
                    email: 'ali@example.com',
                    displayName: 'Ali Khalil',
                    createdAt: Date.now() - 259200000 // 3 days ago
                }
            ];

            demoUsers.forEach(user => {
                this.users.set(user.id, user);
            });

            this.saveUserData();
        }
    }

    setupEventListeners() {
        // Header buttons
        document.getElementById('profile-btn').addEventListener('click', this.handleProfileClick.bind(this));
        document.getElementById('back-btn').addEventListener('click', this.handleBackClick.bind(this));
        
        // Search
        document.getElementById('surah-search').addEventListener('input', this.handleSurahSearch.bind(this));
        
        // Login/signup
        document.getElementById('signin-btn').addEventListener('click', this.handleSignIn.bind(this));
        document.getElementById('signup-btn').addEventListener('click', this.handleSignUp.bind(this));
        document.getElementById('google-signin-btn').addEventListener('click', this.handleGoogleSignIn.bind(this));
        
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', this.handleTabSwitch.bind(this));
        });
        
        // Chat functionality
        document.getElementById('new-chat-btn').addEventListener('click', this.handleNewChat.bind(this));
        document.getElementById('clear-all-chats-btn').addEventListener('click', this.handleClearAllChats.bind(this));
        document.getElementById('delete-chat-btn').addEventListener('click', this.handleDeleteCurrentChat.bind(this));
        document.getElementById('close-search-modal').addEventListener('click', this.hideUserSearchModal.bind(this));
        document.getElementById('send-btn').addEventListener('click', this.handleSendMessage.bind(this));
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });
        document.getElementById('user-search-input').addEventListener('input', this.handleUserSearch.bind(this));
        
        // Confirmation modal
        document.getElementById('confirmation-cancel').addEventListener('click', this.hideConfirmationModal.bind(this));
        document.getElementById('confirmation-confirm').addEventListener('click', this.handleConfirmationConfirm.bind(this));
        
        // Context menu
        document.getElementById('delete-message').addEventListener('click', this.handleDeleteMessage.bind(this));
        
        // Modal backdrop clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideAllModals();
            }
            if (!e.target.closest('.context-menu')) {
                this.hideContextMenu();
            }
        });
        
        // Enter key submissions
        ['signin-email', 'signin-password'].forEach(id => {
            document.getElementById(id).addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSignIn();
            });
        });
        
        ['signup-username', 'signup-email', 'signup-password', 'signup-confirm-password'].forEach(id => {
            document.getElementById(id).addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSignUp();
            });
        });
    }

    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showSuccess('Connection restored');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showError('No internet connection. Running in offline mode.');
        });
    }

    setupTouchListeners() {
        // Touch events for swipe and long press
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        
        // Prevent context menu on long press for custom handling
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.message')) {
                e.preventDefault();
            }
        });
    }

    handleTouchStart(e) {
        if (e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        
        const message = e.target.closest('.message');
        if (message) {
            this.longPressTimer = setTimeout(() => {
                this.handleMessageLongPress(message, touch.clientX, touch.clientY);
            }, 500);
        }
    }

    handleTouchMove(e) {
        if (!this.longPressTimer) return;
        
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - this.touchStartX);
        const deltaY = Math.abs(touch.clientY - this.touchStartY);
        
        // Cancel long press if finger moved too much
        if (deltaX > 10 || deltaY > 10) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    handleTouchEnd(e) {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        
        // Check for swipe to delete
        if (e.changedTouches.length === 1) {
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - this.touchStartX;
            const deltaY = touch.clientY - this.touchStartY;
            
            const message = e.target.closest('.message');
            if (message && Math.abs(deltaX) > 100 && Math.abs(deltaY) < 50) {
                if ((message.classList.contains('sent') && deltaX < 0) || 
                    (message.classList.contains('received') && deltaX > 0)) {
                    this.handleSwipeToDelete(message);
                }
            }
        }
    }

    handleMessageLongPress(messageElement, x, y) {
        this.selectedMessage = messageElement;
        this.showContextMenu(x, y);
        
        // Add visual feedback
        messageElement.classList.add('selected');
        setTimeout(() => {
            messageElement.classList.remove('selected');
        }, 200);
    }

    handleSwipeToDelete(messageElement) {
        const messageId = messageElement.dataset.messageId;
        if (messageId) {
            this.deleteMessage(messageId, messageElement);
        }
    }

    showContextMenu(x, y) {
        const contextMenu = document.getElementById('context-menu');
        contextMenu.style.left = Math.min(x, window.innerWidth - 160) + 'px';
        contextMenu.style.top = Math.min(y, window.innerHeight - 50) + 'px';
        contextMenu.classList.remove('hidden');
    }

    hideContextMenu() {
        document.getElementById('context-menu').classList.add('hidden');
        this.selectedMessage = null;
    }

    handleDeleteMessage() {
        if (this.selectedMessage) {
            const messageId = this.selectedMessage.dataset.messageId;
            if (messageId) {
                this.deleteMessage(messageId, this.selectedMessage);
            }
        }
        this.hideContextMenu();
    }

    deleteMessage(messageId, messageElement) {
        const chatId = this.getChatId(this.currentUser.id, this.currentChatPartner.id);
        const messages = this.chats.get(chatId)?.messages || [];
        
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
            // Store for undo
            const deletedMessage = messages[messageIndex];
            this.deletedMessages.set(messageId, {
                message: deletedMessage,
                chatId: chatId,
                index: messageIndex,
                element: messageElement
            });
            
            // Remove from chat
            messages.splice(messageIndex, 1);
            this.saveUserData();
            
            // Animate removal
            messageElement.classList.add('deleting');
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.remove();
                }
            }, 300);
            
            // Show undo option
            this.showUndoToast(messageId);
            
            this.renderMessages(messages);
        }
    }

    showUndoToast(messageId) {
        const toast = document.createElement('div');
        toast.className = 'toast toast--undo';
        toast.innerHTML = `
            <div class="toast-content">
                <span>Message deleted</span>
                <button class="btn btn--sm btn--outline" onclick="app.undoDeleteMessage('${messageId}')">Undo</button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Auto-remove after 5 seconds
        const timeout = setTimeout(() => {
            this.deletedMessages.delete(messageId);
            if (toast.parentNode) {
                toast.remove();
            }
        }, 5000);
        
        this.undoTimeouts.set(messageId, timeout);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
    }

    undoDeleteMessage(messageId) {
        const deletedData = this.deletedMessages.get(messageId);
        if (deletedData) {
            const { message, chatId, index } = deletedData;
            const chatData = this.chats.get(chatId);
            
            if (chatData) {
                // Restore message
                chatData.messages.splice(index, 0, message);
                this.saveUserData();
                this.renderMessages(chatData.messages);
            }
            
            // Clean up
            this.deletedMessages.delete(messageId);
            if (this.undoTimeouts.has(messageId)) {
                clearTimeout(this.undoTimeouts.get(messageId));
                this.undoTimeouts.delete(messageId);
            }
            
            // Remove undo toast
            document.querySelectorAll('.toast--undo').forEach(toast => toast.remove());
            
            this.showSuccess('Message restored');
        }
    }

    handleTabSwitch(e) {
        const tabName = e.target.dataset.tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        e.target.classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Clear error messages
        this.clearErrorMessages();
    }

    async handleSignIn() {
        const email = document.getElementById('signin-email').value.trim();
        const password = document.getElementById('signin-password').value.trim();
        const errorElement = document.getElementById('signin-error');
        
        if (!email || !password) {
            this.showError('Please fill in all fields', errorElement);
            return;
        }
        
        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address', errorElement);
            return;
        }
        
        try {
            this.showLoading();
            
            // Check if user exists in our demo system
            const existingUser = Array.from(this.users.values())
                .find(user => user.email === email);
            
            if (!existingUser) {
                this.showError('No account found with this email', errorElement);
                return;
            }
            
            // In a real app, you'd verify the password hash
            // For demo purposes, we'll accept any password
            
            this.currentUser = {
                id: existingUser.id,
                username: existingUser.username,
                email: existingUser.email,
                displayName: existingUser.displayName,
                loginTime: Date.now()
            };
            
            this.saveUserSession();
            this.hideAllModals();
            this.clearLoginForms();
            this.showSuccess(`Welcome back, ${this.currentUser.username}!`);
            
        } catch (error) {
            console.error('Sign-in error:', error);
            this.showError('Sign-in failed. Please try again.', errorElement);
        } finally {
            this.hideLoading();
        }
    }

    async handleSignUp() {
        const username = document.getElementById('signup-username').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value.trim();
        const confirmPassword = document.getElementById('signup-confirm-password').value.trim();
        const errorElement = document.getElementById('signup-error');
        
        // Validation
        if (!username || !email || !password || !confirmPassword) {
            this.showError('Please fill in all fields', errorElement);
            return;
        }
        
        if (username.length < 3) {
            this.showError('Username must be at least 3 characters long', errorElement);
            return;
        }
        
        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address', errorElement);
            return;
        }
        
        if (password.length < 6) {
            this.showError('Password must be at least 6 characters long', errorElement);
            return;
        }
        
        if (password !== confirmPassword) {
            this.showError('Passwords do not match', errorElement);
            return;
        }
        
        try {
            this.showLoading();
            
            // Check if username or email already exists
            const existingUser = Array.from(this.users.values())
                .find(user => user.username === username || user.email === email);
            
            if (existingUser) {
                if (existingUser.username === username) {
                    this.showError('Username already taken', errorElement);
                } else {
                    this.showError('Email already registered', errorElement);
                }
                return;
            }
            
            // Create new user
            const newUser = {
                id: 'user_' + Date.now(),
                username: username,
                email: email,
                displayName: username,
                createdAt: Date.now()
            };
            
            this.users.set(newUser.id, newUser);
            this.saveUserData();
            
            this.currentUser = {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                displayName: newUser.displayName,
                loginTime: Date.now()
            };
            
            this.saveUserSession();
            this.hideAllModals();
            this.clearLoginForms();
            this.showSuccess(`Welcome to Al-Quran Chat, ${this.currentUser.username}!`);
            
        } catch (error) {
            console.error('Sign-up error:', error);
            this.showError('Registration failed. Please try again.', errorElement);
        } finally {
            this.hideLoading();
        }
    }

    async handleGoogleSignIn() {
        try {
            this.showLoading();
            
            // Demo Google sign-in - create a demo user
            const demoGoogleUser = {
                id: 'google_user_' + Date.now(),
                username: 'Google_User',
                email: 'user@gmail.com',
                displayName: 'Google User',
                createdAt: Date.now(),
                provider: 'google'
            };
            
            // Check if this would create a duplicate
            const existingUser = Array.from(this.users.values())
                .find(user => user.email === demoGoogleUser.email);
            
            if (existingUser) {
                this.currentUser = {
                    id: existingUser.id,
                    username: existingUser.username,
                    email: existingUser.email,
                    displayName: existingUser.displayName,
                    loginTime: Date.now()
                };
            } else {
                this.users.set(demoGoogleUser.id, demoGoogleUser);
                this.saveUserData();
                this.currentUser = {
                    id: demoGoogleUser.id,
                    username: demoGoogleUser.username,
                    email: demoGoogleUser.email,
                    displayName: demoGoogleUser.displayName,
                    loginTime: Date.now()
                };
            }
            
            this.saveUserSession();
            this.hideAllModals();
            this.clearLoginForms();
            this.showSuccess(`Welcome, ${this.currentUser.displayName}!`);
            
        } catch (error) {
            console.error('Google sign-in error:', error);
            this.showError('Google sign-in failed. Please try email/password.');
        } finally {
            this.hideLoading();
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    clearLoginForms() {
        ['signin-email', 'signin-password', 'signup-username', 'signup-email', 
         'signup-password', 'signup-confirm-password'].forEach(id => {
            document.getElementById(id).value = '';
        });
        this.clearErrorMessages();
    }

    clearErrorMessages() {
        document.querySelectorAll('.error-message').forEach(el => {
            el.classList.add('hidden');
            el.textContent = '';
        });
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register(this.createServiceWorkerBlob())
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        }
    }

    createServiceWorkerBlob() {
        const swCode = `
            const CACHE_NAME = 'quran-chat-v2.0';
            const urlsToCache = [
                '/',
                '/index.html',
                '/style.css',
                '/app.js',
                'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@300;400;500;600&display=swap',
                'https://api.alquran.cloud/v1/surah'
            ];

            self.addEventListener('install', event => {
                event.waitUntil(
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            return cache.addAll(urlsToCache).catch(err => {
                                console.log('Cache failed for some resources:', err);
                                // Don't fail completely if some resources can't be cached
                            });
                        })
                );
                self.skipWaiting();
            });

            self.addEventListener('fetch', event => {
                event.respondWith(
                    caches.match(event.request)
                        .then(response => {
                            // Return cached version or fetch from network
                            return response || fetch(event.request).catch(() => {
                                // Return offline page or cached version if available
                                return caches.match('/index.html');
                            });
                        })
                );
            });
            
            self.addEventListener('activate', event => {
                event.waitUntil(
                    caches.keys().then(cacheNames => {
                        return Promise.all(
                            cacheNames.map(cacheName => {
                                if (cacheName !== CACHE_NAME) {
                                    return caches.delete(cacheName);
                                }
                            })
                        );
                    })
                );
            });
        `;
        
        const blob = new Blob([swCode], { type: 'application/javascript' });
        return URL.createObjectURL(blob);
    }

    async loadSurahs() {
        try {
            // Try to load from cache first
            const cached = localStorage.getItem('quran-surahs');
            if (cached) {
                try {
                    const cachedData = JSON.parse(cached);
                    if (Date.now() - cachedData.timestamp < 86400000) { // 24 hours
                        this.surahs = cachedData.surahs;
                        this.renderSurahList();
                        return;
                    }
                } catch (e) {
                    // Invalid cached data, proceed with network request
                }
            }
            
            if (!this.isOnline) {
                throw new Error('No internet connection and no cached data');
            }
            
            const response = await fetch('https://api.alquran.cloud/v1/surah');
            const data = await response.json();
            
            if (data.code === 200) {
                this.surahs = data.data;
                
                // Cache the data
                localStorage.setItem('quran-surahs', JSON.stringify({
                    surahs: this.surahs,
                    timestamp: Date.now()
                }));
                
                this.renderSurahList();
            } else {
                throw new Error('API returned error code: ' + data.code);
            }
        } catch (error) {
            console.error('Error loading surahs:', error);
            if (this.isOnline) {
                this.showError('Failed to load Quran data. Please check your connection and try again.');
            } else {
                this.showError('No internet connection. Some features may not be available.');
            }
            
            // Load fallback data if needed
            this.loadFallbackSurahs();
        }
    }

    loadFallbackSurahs() {
        // Basic fallback surah list for offline use
        this.surahs = [
            {
                number: 1,
                name: "سُورَةُ ٱلْفَاتِحَةِ",
                englishName: "Al-Faatiha",
                englishNameTranslation: "The Opening",
                numberOfAyahs: 7,
                revelationType: "Meccan"
            },
            {
                number: 2,
                name: "سُورَةُ البَقَرَةِ",
                englishName: "Al-Baqara",
                englishNameTranslation: "The Cow",
                numberOfAyahs: 286,
                revelationType: "Medinan"
            }
            // Add more basic entries as needed
        ];
        this.renderSurahList();
    }

    renderSurahList(filteredSurahs = null) {
        const container = document.getElementById('surah-list');
        const surahsToRender = filteredSurahs || this.surahs;
        
        if (surahsToRender.length === 0) {
            container.innerHTML = `
                <div class="text-center py-16">
                    <p style="color: var(--color-text-secondary);">No surahs available. Please check your connection.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = surahsToRender.map(surah => `
            <div class="surah-item" data-surah-number="${surah.number}" tabindex="0">
                <div class="surah-item-header">
                    <div class="surah-number">${surah.number}</div>
                    <span class="surah-revelation ${surah.revelationType.toLowerCase()}">${surah.revelationType}</span>
                </div>
                <h3 class="surah-name">${surah.englishName}</h3>
                <div class="surah-name-arabic">${surah.name}</div>
                <p class="surah-info">${surah.englishNameTranslation} • ${surah.numberOfAyahs} verses</p>
            </div>
        `).join('');
        
        // Add click and keyboard listeners
        container.querySelectorAll('.surah-item').forEach(item => {
            item.addEventListener('click', () => {
                const surahNumber = parseInt(item.dataset.surahNumber);
                this.loadSurahDetail(surahNumber);
            });
            
            item.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    const surahNumber = parseInt(item.dataset.surahNumber);
                    this.loadSurahDetail(surahNumber);
                }
            });
        });
    }

    async loadSurahDetail(surahNumber) {
        try {
            this.showLoading();
            
            // Check cache first
            const cacheKey = `surah-${surahNumber}`;
            const cached = localStorage.getItem(cacheKey);
            
            if (cached && this.isOnline) {
                try {
                    const cachedData = JSON.parse(cached);
                    if (Date.now() - cachedData.timestamp < 3600000) { // 1 hour
                        this.currentSurah = cachedData.data;
                        this.renderSurahDetail();
                        this.showView('surah-detail');
                        return;
                    }
                } catch (e) {
                    // Invalid cached data, proceed with network request
                }
            }
            
            if (!this.isOnline) {
                if (cached) {
                    const cachedData = JSON.parse(cached);
                    this.currentSurah = cachedData.data;
                    this.renderSurahDetail();
                    this.showView('surah-detail');
                    return;
                } else {
                    throw new Error('No internet connection and no cached surah data');
                }
            }
            
            // Load surah with English translation
            const [arabicResponse, translationResponse] = await Promise.all([
                fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}`),
                fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/en.asad`)
            ]);
            
            const arabicData = await arabicResponse.json();
            const translationData = await translationResponse.json();
            
            if (arabicData.code === 200 && translationData.code === 200) {
                this.currentSurah = {
                    arabic: arabicData.data,
                    translation: translationData.data
                };
                
                // Cache the data
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: this.currentSurah,
                    timestamp: Date.now()
                }));
                
                this.renderSurahDetail();
                this.showView('surah-detail');
            } else {
                throw new Error('Failed to load surah details from API');
            }
        } catch (error) {
            console.error('Error loading surah:', error);
            this.showError('Failed to load surah. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    renderSurahDetail() {
        const surah = this.currentSurah.arabic;
        const translation = this.currentSurah.translation;
        
        // Update header
        document.getElementById('surah-name').textContent = `${surah.number}. ${surah.englishName}`;
        document.getElementById('surah-info').textContent = `${surah.englishNameTranslation} • ${surah.revelationType} • ${surah.numberOfAyahs} verses`;
        
        // Render ayahs
        const container = document.getElementById('ayah-list');
        container.innerHTML = surah.ayahs.map((ayah, index) => {
            const translationAyah = translation.ayahs[index];
            const isSpecialAyah = surah.number === 78 && ayah.numberInSurah === 8;
            
            return `
                <div class="ayah-item ${isSpecialAyah ? 'special-ayah' : ''}" data-ayah-number="${ayah.numberInSurah}">
                    <div class="ayah-number">${ayah.numberInSurah}</div>
                    ${isSpecialAyah ? `
                        <button class="special-menu" title="Access Secret Chat" aria-label="Access Secret Chat">
                        </button>
                    ` : ''}
                    <div class="ayah-arabic">${ayah.text}</div>
                    <div class="ayah-translation">${translationAyah ? translationAyah.text : ''}</div>
                </div>
            `;
        }).join('');
        
        // Add special menu listener for 78:8
        const specialMenu = container.querySelector('.special-menu');
        if (specialMenu) {
            specialMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleSpecialChatAccess();
            });
        }
    }

    handleSpecialChatAccess() {
        if (!this.currentUser) {
            this.showLoginModal();
        } else {
            this.showChatList();
        }
    }

    async handleUserSearch() {
        const query = document.getElementById('user-search-input').value.trim();
        const resultsContainer = document.getElementById('user-search-results');
        
        if (!query) {
            resultsContainer.innerHTML = '';
            return;
        }
        
        try {
            // Search users
            const users = Array.from(this.users.values())
                .filter(user => 
                    user.id !== this.currentUser.id &&
                    user.username.toLowerCase().includes(query.toLowerCase())
                )
                .slice(0, 10);
            
            if (users.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="text-center py-16">
                        <p style="color: var(--color-text-secondary);">No users found</p>
                    </div>
                `;
                return;
            }
            
            resultsContainer.innerHTML = users.map(user => `
                <div class="user-search-item" data-user-id="${user.id}" tabindex="0">
                    <div class="flex items-center">
                        <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                        <div class="user-info">
                            <div class="user-name">${user.username}</div>
                            <div class="user-status">Member since ${new Date(user.createdAt).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <button class="btn btn--sm btn--primary">Start Chat</button>
                </div>
            `).join('');
            
            // Add click listeners
            resultsContainer.querySelectorAll('.user-search-item').forEach(item => {
                const button = item.querySelector('.btn');
                const clickHandler = () => {
                    const userId = item.dataset.userId;
                    const username = item.querySelector('.user-name').textContent;
                    this.startChat(userId, username);
                };
                
                button.addEventListener('click', clickHandler);
                item.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') clickHandler();
                });
            });
            
        } catch (error) {
            console.error('Error searching users:', error);
            this.showError('Search failed. Please try again.');
        }
    }

    async startChat(partnerId, partnerUsername) {
        this.currentChatPartner = { id: partnerId, username: partnerUsername };
        this.hideUserSearchModal();
        await this.showChatView();
    }

    async showChatView() {
        if (!this.currentChatPartner) return;
        
        document.getElementById('chat-partner-name').textContent = this.currentChatPartner.username;
        this.showView('chat');
        
        // Load and render messages
        await this.loadChatMessages();
    }

    async loadChatMessages() {
        const chatId = this.getChatId(this.currentUser.id, this.currentChatPartner.id);
        
        let chatData = this.chats.get(chatId);
        if (!chatData) {
            // Create new chat with demo messages
            chatData = {
                id: chatId,
                participants: [this.currentUser.id, this.currentChatPartner.id],
                messages: [
                    {
                        id: 'msg_' + Date.now() + '_1',
                        text: 'السلام عليكم (Peace be upon you)',
                        senderId: this.currentChatPartner.id,
                        timestamp: Date.now() - 300000,
                        type: 'received'
                    },
                    {
                        id: 'msg_' + Date.now() + '_2',
                        text: 'وعليكم السلام (And peace be upon you too)',
                        senderId: this.currentUser.id,
                        timestamp: Date.now() - 250000,
                        type: 'sent'
                    }
                ],
                lastMessage: 'وعليكم السلام (And peace be upon you too)',
                lastMessageTime: Date.now() - 250000,
                createdAt: Date.now()
            };
            
            this.chats.set(chatId, chatData);
            this.saveUserData();
        }
        
        this.renderMessages(chatData.messages);
    }

    renderMessages(messages) {
        const container = document.getElementById('messages');
        
        container.innerHTML = messages.map(message => {
            const isOwn = message.senderId === this.currentUser.id;
            const time = new Date(message.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            return `
                <div class="message ${isOwn ? 'sent' : 'received'}" 
                     data-message-id="${message.id}"
                     tabindex="0">
                    <div class="message-text">${this.escapeHtml(message.text)}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
        }).join('');
        
        // Scroll to bottom
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }

    async handleSendMessage() {
        const input = document.getElementById('message-input');
        const text = input.value.trim();
        
        if (!text || !this.currentChatPartner) return;
        
        try {
            const chatId = this.getChatId(this.currentUser.id, this.currentChatPartner.id);
            const chatData = this.chats.get(chatId);
            
            const newMessage = {
                id: 'msg_' + Date.now(),
                text: text,
                senderId: this.currentUser.id,
                timestamp: Date.now(),
                type: 'sent'
            };
            
            chatData.messages.push(newMessage);
            chatData.lastMessage = text;
            chatData.lastMessageTime = Date.now();
            
            this.saveUserData();
            this.renderMessages(chatData.messages);
            
            input.value = '';
            
            // Simulate partner response after delay
            setTimeout(() => {
                const responses = [
                    'جزاك الله خيراً (May Allah reward you with good)',
                    'بارك الله فيك (May Allah bless you)',
                    'Alhamdulillah (All praise is due to Allah)',
                    'SubhanAllah (Glory be to Allah)',
                    'أحسن الله إليك (May Allah be good to you)'
                ];
                
                const response = responses[Math.floor(Math.random() * responses.length)];
                const responseMessage = {
                    id: 'msg_' + Date.now(),
                    text: response,
                    senderId: this.currentChatPartner.id,
                    timestamp: Date.now(),
                    type: 'received'
                };
                
                chatData.messages.push(responseMessage);
                chatData.lastMessage = response;
                chatData.lastMessageTime = Date.now();
                
                this.saveUserData();
                this.renderMessages(chatData.messages);
            }, 1000 + Math.random() * 2000);
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Failed to send message. Please try again.');
        }
    }

    async showChatList() {
        if (!this.currentUser) {
            this.showLoginModal();
            return;
        }
        
        this.showView('chat-list');
        
        // Get all chats for current user
        const userChats = Array.from(this.chats.values())
            .filter(chat => chat.participants.includes(this.currentUser.id))
            .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
        
        this.renderChatList(userChats);
    }

    renderChatList(chats) {
        const container = document.getElementById('chat-list');
        
        if (chats.length === 0) {
            container.innerHTML = `
                <div class="text-center py-16">
                    <p style="color: var(--color-text-secondary);">No conversations yet. Start chatting with other users!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = chats.map(chat => {
            const partnerId = chat.participants.find(id => id !== this.currentUser.id);
            const partner = this.users.get(partnerId);
            const time = new Date(chat.lastMessageTime).toLocaleDateString();
            
            return `
                <div class="chat-item" 
                     data-partner-id="${partnerId}" 
                     data-partner-username="${partner ? partner.username : 'Unknown'}"
                     tabindex="0">
                    <div class="chat-item-header">
                        <div class="chat-username">${partner ? partner.username : 'Unknown User'}</div>
                        <div class="chat-time">${time}</div>
                    </div>
                    <div class="chat-preview">${this.escapeHtml(chat.lastMessage || '')}</div>
                </div>
            `;
        }).join('');
        
        // Add click listeners
        container.querySelectorAll('.chat-item').forEach(item => {
            const clickHandler = () => {
                this.currentChatPartner = {
                    id: item.dataset.partnerId,
                    username: item.dataset.partnerUsername
                };
                this.showChatView();
            };
            
            item.addEventListener('click', clickHandler);
            item.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') clickHandler();
            });
        });
    }

    handleClearAllChats() {
        this.showConfirmation(
            'Clear All Chats',
            'Are you sure you want to delete all your chat conversations? This action cannot be undone.',
            () => {
                // Clear all chats for current user
                const userChats = Array.from(this.chats.entries())
                    .filter(([chatId, chat]) => chat.participants.includes(this.currentUser.id));
                
                userChats.forEach(([chatId]) => {
                    this.chats.delete(chatId);
                });
                
                this.saveUserData();
                this.showChatList(); // Refresh the view
                this.showSuccess('All conversations cleared');
            }
        );
    }

    handleDeleteCurrentChat() {
        if (!this.currentChatPartner) return;
        
        this.showConfirmation(
            'Delete Conversation',
            `Are you sure you want to delete this conversation with ${this.currentChatPartner.username}? This action cannot be undone.`,
            () => {
                const chatId = this.getChatId(this.currentUser.id, this.currentChatPartner.id);
                this.chats.delete(chatId);
                this.saveUserData();
                this.showChatList();
                this.showSuccess('Conversation deleted');
            }
        );
    }

    getChatId(userId1, userId2) {
        return [userId1, userId2].sort().join('_');
    }

    // UI Helper Methods
    showView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.add('hidden');
        });
        
        // Show target view
        document.getElementById(`${viewName}-view`).classList.remove('hidden');
        
        // Update header
        const backBtn = document.getElementById('back-btn');
        const headerTitle = document.getElementById('header-title');
        
        switch (viewName) {
            case 'surah-list':
                headerTitle.textContent = 'Al-Quran';
                backBtn.classList.add('hidden');
                break;
            case 'surah-detail':
                headerTitle.textContent = 'Surah';
                backBtn.classList.remove('hidden');
                break;
            case 'chat-list':
                headerTitle.textContent = 'Messages';
                backBtn.classList.remove('hidden');
                break;
            case 'chat':
                headerTitle.textContent = 'Chat';
                backBtn.classList.remove('hidden');
                break;
        }
        
        this.currentView = viewName;
        
        // Update URL without reloading page
        if (history.pushState) {
            const newUrl = viewName === 'surah-list' ? '/' : `/${viewName}`;
            history.pushState({view: viewName}, '', newUrl);
        }
    }

    handleBackClick() {
        // Clear message listeners when leaving chat
        if (this.currentView === 'chat') {
            this.messageListeners.forEach(listener => clearInterval(listener));
            this.messageListeners.clear();
        }
        
        switch (this.currentView) {
            case 'surah-detail':
                this.showView('surah-list');
                break;
            case 'chat-list':
                this.showView('surah-list');
                break;
            case 'chat':
                this.showChatList();
                break;
            default:
                this.showView('surah-list');
        }
    }

    handleProfileClick() {
        if (!this.currentUser) {
            this.showLoginModal();
        } else {
            this.showChatList();
        }
    }

    handleNewChat() {
        this.showUserSearchModal();
    }

    handleSurahSearch() {
        const query = document.getElementById('surah-search').value.toLowerCase();
        const filtered = this.surahs.filter(surah => 
            surah.englishName.toLowerCase().includes(query) ||
            surah.englishNameTranslation.toLowerCase().includes(query) ||
            surah.number.toString().includes(query) ||
            surah.name.includes(query)
        );
        this.renderSurahList(filtered);
    }

    // Modal Methods
    showLoginModal() {
        document.getElementById('login-modal').classList.remove('hidden');
        // Focus on first input
        setTimeout(() => {
            document.getElementById('signin-email').focus();
        }, 100);
    }

    showUserSearchModal() {
        document.getElementById('user-search-modal').classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('user-search-input').focus();
        }, 100);
    }

    hideUserSearchModal() {
        document.getElementById('user-search-modal').classList.add('hidden');
        document.getElementById('user-search-input').value = '';
        document.getElementById('user-search-results').innerHTML = '';
    }

    showConfirmation(title, message, callback) {
        document.getElementById('confirmation-title').textContent = title;
        document.getElementById('confirmation-message').textContent = message;
        document.getElementById('confirmation-modal').classList.remove('hidden');
        this.confirmationCallback = callback;
    }

    hideConfirmationModal() {
        document.getElementById('confirmation-modal').classList.add('hidden');
        this.confirmationCallback = null;
    }

    handleConfirmationConfirm() {
        if (this.confirmationCallback) {
            this.confirmationCallback();
        }
        this.hideConfirmationModal();
    }

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
    }

    // Utility Methods
    showLoading() {
        document.getElementById('app').classList.add('loading');
    }

    hideLoading() {
        document.getElementById('app').classList.remove('loading');
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            document.getElementById('app').classList.remove('hidden');
        }, 300);
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message, element = null) {
        if (element) {
            element.textContent = message;
            element.classList.remove('hidden');
        } else {
            this.showToast(message, 'error');
        }
    }

    showToast(message, type) {
        const toastId = `${type}-toast`;
        const messageId = `${type}-message`;
        const toast = document.getElementById(toastId);
        const messageEl = document.getElementById(messageId);
        
        messageEl.textContent = message;
        toast.classList.remove('hidden');
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 4000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global app instance
let app;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app = new QuranChatApp();
});

// Handle browser back/forward buttons
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view && app) {
        app.showView(e.state.view);
    }
});

// PWA install functionality
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('PWA install prompt ready');
});

window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully');
    if (app) {
        app.showSuccess('App installed successfully!');
    }
});

// Handle online/offline status
window.addEventListener('online', () => {
    console.log('Connection restored');
});

window.addEventListener('offline', () => {
    console.log('Connection lost - running in offline mode');
});

// Prevent zoom on double-tap for iOS
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);

//fireBase

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDUVG8gbLBsPjdYhPgvoRCrYXWbC30hUec",
  authDomain: "qur-an-english.firebaseapp.com",
  projectId: "qur-an-english",
  storageBucket: "qur-an-english.firebasestorage.app",
  messagingSenderId: "125910037565",
  appId: "1:125910037565:web:6de69e2d40d836cddc2654",
  measurementId: "G-Q8G1WHQKM7"
};

// Initialize Firebase
const App = initializeApp(firebaseConfig);
const analytics = getAnalytics(App);