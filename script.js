
        // In-memory storage (since localStorage/sessionStorage not available in iframe)
        const storage = {
            data: {},
            getItem(key) {
                return this.data[key] || null;
            },
            setItem(key, value) {
                this.data[key] = value;
            }
        };

        // State management
        let conversations = JSON.parse(storage.getItem('chatConversations') || '[]');
        let currentConversationId = null;
        let selectedBot = null;

        // Check if Poe Embed API is available
        const isPoeAvailable = typeof window.Poe !== 'undefined';

        // Initialize
        function init() {
            renderConversationsList();
            setupEventListeners();

            // Auto-select first conversation if exists
            if (conversations.length > 0) {
                selectConversation(conversations[0].id);
            }
        }

        // Event listeners
        function setupEventListeners() {
            document.getElementById('new-chat-btn').addEventListener('click', openNewChatModal);
            document.getElementById('modal-close').addEventListener('click', closeModal);
            document.getElementById('cancel-btn').addEventListener('click', closeModal);
            document.getElementById('create-btn').addEventListener('click', createConversation);

            // Bot selection
            document.querySelectorAll('.bot-option').forEach(option => {
                option.addEventListener('click', function() {
                    document.querySelectorAll('.bot-option').forEach(o => o.classList.remove('selected'));
                    this.classList.add('selected');
                    selectedBot = this.dataset.bot;
                });
            });

            // Close modal on outside click
            document.getElementById('new-chat-modal').addEventListener('click', function(e) {
                if (e.target === this) closeModal();
            });
        }

        // Modal functions
        function openNewChatModal() {
            document.getElementById('new-chat-modal').classList.add('active');
            document.getElementById('conversation-name').value = '';
            document.querySelectorAll('.bot-option').forEach(o => o.classList.remove('selected'));
            selectedBot = null;
        }

        function closeModal() {
            document.getElementById('new-chat-modal').classList.remove('active');
        }

        function showCustomModal(title, message, onConfirm) {
            const modalHtml = `
                <div class="modal active" id="custom-modal" style="z-index: 1001;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>${title}</h2>
                        </div>
                        <div class="modal-body">
                            <p style="font-size: 1.6rem; line-height: 1.6;">${message}</p>
                        </div>
                        <div class="modal-footer">
                            <button class="modal-btn secondary" onclick="document.getElementById('custom-modal').remove()">Non</button>
                            <button class="modal-btn primary" id="confirm-action">Oui</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            document.getElementById('confirm-action').addEventListener('click', function() {
                document.getElementById('custom-modal').remove();
                if (onConfirm) onConfirm();
            });
        }

        // Create conversation
        function createConversation() {
            const name = document.getElementById('conversation-name').value.trim();

            if (!name) {
                showCustomModal('Erreur', 'Veuillez entrer un nom pour la conversation.', null);
                return;
            }

            if (!selectedBot) {
                showCustomModal('Erreur', 'Veuillez sélectionner un bot IA.', null);
                return;
            }

            const conversation = {
                id: Date.now(),
                name: name,
                bot: selectedBot,
                messages: [],
                createdAt: new Date().toISOString(),
                lastMessage: 'Nouvelle conversation'
            };

            conversations.unshift(conversation);
            saveConversations();
            renderConversationsList();
            selectConversation(conversation.id);
            closeModal();
        }

        // Render conversations list
        function renderConversationsList() {
            const list = document.getElementById('conversations-list');

            if (conversations.length === 0) {
                list.innerHTML = `
                    <div class="empty-state">
                        <i class='bx bx-message-square-dots'></i>
                        <p>Aucune conversation.<br>Créez-en une pour commencer !</p>
                    </div>
                `;
                return;
            }

            list.innerHTML = conversations.map(conv => {
                const time = new Date(conv.createdAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                return `
                    <div class="conversation-item ${conv.id === currentConversationId ? 'active' : ''}"
                         data-id="${conv.id}">
                        <h3>
                            <i class='bx bx-message-dots'></i>
                            ${conv.name}
                        </h3>
                        <p>${conv.lastMessage}</p>
                        <div class="time">${time} • ${conv.bot}</div>
                    </div>
                `;
            }).join('');

            // Add click listeners
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.addEventListener('click', function() {
                    selectConversation(parseInt(this.dataset.id));
                });
            });
        }

        // Select conversation
        function selectConversation(id) {
            currentConversationId = id;
            const conversation = conversations.find(c => c.id === id);

            if (!conversation) return;

            renderChatArea(conversation);
            renderConversationsList();
        }

        // Render chat area
        function renderChatArea(conversation) {
            const chatArea = document.getElementById('chat-area');

            chatArea.innerHTML = `
                <div class="chat-header">
                    <div class="chat-header-info">
                        <h2>
                            <i class='bx bx-bot'></i>
                            ${conversation.name}
                        </h2>
                        <p>Bot: ${conversation.bot}</p>
                    </div>
                    <div class="chat-actions">
                        <button class="action-btn" onclick="clearConversation()" title="Effacer les messages">
                            <i class='bx bx-trash'></i>
                        </button>
                        <button class="action-btn" onclick="deleteConversation()" title="Supprimer la conversation">
                            <i class='bx bx-x'></i>
                        </button>
                    </div>
                </div>

                <div class="messages-container" id="messages-container">
                    ${conversation.messages.length === 0 ? `
                        <div class="welcome-screen">
                            <i class='bx bx-chat'></i>
                            <h2>Commencez la conversation</h2>
                            <p>Envoyez un message à ${conversation.bot} pour démarrer.</p>
                        </div>
                    ` : ''}
                </div>

                <div class="input-area">
                    <div class="input-wrapper">
                        <div class="input-container">
                            <textarea id="message-input" placeholder="Écrivez votre message..." rows="1"></textarea>
                        </div>
                        <button class="send-btn" id="send-btn">
                            <i class='bx bx-send'></i>
                        </button>
                    </div>
                </div>
            `;

            // Render existing messages
            if (conversation.messages.length > 0) {
                renderMessages(conversation.messages);
            }

            setupChatListeners();
            autoResizeTextarea();
        }

        // Setup chat listeners
        function setupChatListeners() {
            const input = document.getElementById('message-input');
            const sendBtn = document.getElementById('send-btn');

            sendBtn.addEventListener('click', sendMessage);
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }

        // Auto-resize textarea
        function autoResizeTextarea() {
            const textarea = document.getElementById('message-input');
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 150) + 'px';
            });
        }

        // Send message
        async function sendMessage() {
            const input = document.getElementById('message-input');
            const message = input.value.trim();

            if (!message) return;

            const conversation = conversations.find(c => c.id === currentConversationId);
            if (!conversation) return;

            // Add user message
            const userMessage = {
                id: Date.now(),
                sender: 'user',
                content: message,
                timestamp: new Date().toISOString()
            };

            conversation.messages.push(userMessage);
            conversation.lastMessage = message;
            input.value = '';
            input.style.height = 'auto';

            saveConversations();
            renderMessages(conversation.messages);
            scrollToBottom();

            // Show typing indicator
            showTypingIndicator();

            // Send to Poe bot if available
            if (isPoeAvailable) {
                try {
                    const botMention = `@${conversation.bot}`;
                    const fullMessage = `${botMention} ${message}`;

                    // Register handler for this conversation
                    const handlerId = `chat-${currentConversationId}`;

                    window.Poe.registerHandler(handlerId, (result) => {
                        const msg = result.responses[0];

                        if (msg.status === 'error') {
                            removeTypingIndicator();
                            const errorMessage = {
                                id: Date.now(),
                                sender: conversation.bot,
                                content: `Erreur: ${msg.statusText || 'Une erreur est survenue'}`,
                                timestamp: new Date().toISOString()
                            };
                            conversation.messages.push(errorMessage);
                            saveConversations();
                            renderMessages(conversation.messages);
                        } else if (msg.status === 'incomplete') {
                            updateTypingIndicator(msg.content);
                        } else if (msg.status === 'complete') {
                            removeTypingIndicator();

                            const botMessage = {
                                id: Date.now(),
                                sender: conversation.bot,
                                content: msg.content,
                                timestamp: new Date().toISOString(),
                                attachments: msg.attachments
                            };

                            conversation.messages.push(botMessage);
                            conversation.lastMessage = msg.content.substring(0, 50) + '...';
                            saveConversations();
                            renderMessages(conversation.messages);
                            renderConversationsList();
                            scrollToBottom();
                        }
                    });

                    await window.Poe.sendUserMessage(fullMessage, {
                        handler: handlerId,
                        stream: true,
                        openChat: false
                    });

                } catch (error) {
                    console.error('Poe API Error:', error);
                    removeTypingIndicator();

                    const errorMessage = {
                        id: Date.now(),
                        sender: conversation.bot,
                        content: `Erreur: ${error.message || 'Impossible de communiquer avec le bot'}`,
                        timestamp: new Date().toISOString()
                    };
                    conversation.messages.push(errorMessage);
                    saveConversations();
                    renderMessages(conversation.messages);
                }
            } else {
                // Simulate bot response (demo mode)
                setTimeout(() => {
                    removeTypingIndicator();

                    const botMessage = {
                        id: Date.now() + 1,
                        sender: conversation.bot,
                        content: `Ceci est une réponse de démonstration de ${conversation.bot}. Pour utiliser les vrais bots IA, cette application doit être lancée sur la plateforme Poe.`,
                        timestamp: new Date().toISOString()
                    };

                    conversation.messages.push(botMessage);
                    conversation.lastMessage = botMessage.content.substring(0, 50) + '...';
                    saveConversations();
                    renderMessages(conversation.messages);
                    renderConversationsList();
                    scrollToBottom();
                }, 2000);
            }
        }

        // Render messages
        function renderMessages(messages) {
            const container = document.getElementById('messages-container');
            const welcomeScreen = container.querySelector('.welcome-screen');
            if (welcomeScreen) welcomeScreen.remove();

            const messagesHtml = messages.map(msg => {
                const time = new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const isUser = msg.sender === 'user';
                const avatar = isUser ? '<i class="bx bx-user"></i>' : '<i class="bx bx-bot"></i>';

                let attachmentsHtml = '';
                if (msg.attachments && msg.attachments.length > 0) {
                    attachmentsHtml = `
                        <div class="message-attachments">
                            ${msg.attachments.map(att => {
                                if (att.isInline && att.mimeType.startsWith('image/')) {
                                    return `<img src="${att.url}" alt="${att.name}" style="max-width: 100%; border-radius: 0.8rem; margin-top: 0.5rem;">`;
                                } else {
                                    return `<div class="attachment"><i class='bx bx-paperclip'></i> ${att.name}</div>`;
                                }
                            }).join('')}
                        </div>
                    `;
                }

                return `
                    <div class="message ${isUser ? 'user' : ''}">
                        <div class="message-avatar">${avatar}</div>
                        <div class="message-content">
                            <div class="message-header">
                                <span class="message-sender">${isUser ? 'Vous' : msg.sender}</span>
                                <span class="message-time">${time}</span>
                            </div>
                            <div class="message-bubble">${msg.content}</div>
                            ${attachmentsHtml}
                        </div>
                    </div>
                `;
            }).join('');

            // Only update if content changed
            const currentHtml = container.innerHTML;
            const newHtml = messagesHtml || '';
            if (!currentHtml.includes(newHtml)) {
                container.innerHTML = messagesHtml;
            }
        }

        // Typing indicator functions
        function showTypingIndicator() {
            const container = document.getElementById('messages-container');
            const conversation = conversations.find(c => c.id === currentConversationId);

            const typingHtml = `
                <div class="message typing-message" id="typing-indicator">
                    <div class="message-avatar"><i class='bx bx-bot'></i></div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-sender">${conversation.bot}</span>
                        </div>
                        <div class="message-bubble loading">
                            <div class="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', typingHtml);
            scrollToBottom();
        }

        function updateTypingIndicator(content) {
            const indicator = document.getElementById('typing-indicator');
            if (indicator) {
                const bubble = indicator.querySelector('.message-bubble');
                bubble.innerHTML = content;
                bubble.classList.remove('loading');
                scrollToBottom();
            }
        }

        function removeTypingIndicator() {
            const indicator = document.getElementById('typing-indicator');
            if (indicator) indicator.remove();
        }

        // Scroll to bottom
        function scrollToBottom() {
            const container = document.getElementById('messages-container');
            if (container) {
                setTimeout(() => {
                    container.scrollTop = container.scrollHeight;
                }, 100);
            }
        }

        // Clear conversation
        function clearConversation() {
            showCustomModal(
                'Confirmer',
                'Êtes-vous sûr de vouloir effacer tous les messages de cette conversation ?',
                () => {
                    const conversation = conversations.find(c => c.id === currentConversationId);
                    if (conversation) {
                        conversation.messages = [];
                        conversation.lastMessage = 'Nouvelle conversation';
                        saveConversations();
                        selectConversation(currentConversationId);
                        renderConversationsList();
                    }
                }
            );
        }

        // Delete conversation
        function deleteConversation() {
            showCustomModal(
                'Confirmer',
                'Êtes-vous sûr de vouloir supprimer cette conversation ? Cette action est irréversible.',
                () => {
                    conversations = conversations.filter(c => c.id !== currentConversationId);
                    saveConversations();
                    renderConversationsList();

                    if (conversations.length > 0) {
                        selectConversation(conversations[0].id);
                    } else {
                        document.getElementById('chat-area').innerHTML = `
                            <div class="welcome-screen">
                                <i class='bx bx-message-square-detail'></i>
                                <h2>Bienvenue sur <span style="color: var(--main-color);">ChatHub</span></h2>
                                <p>Sélectionnez une conversation ou créez-en une nouvelle pour commencer à discuter avec des bots IA intelligents.</p>
                            </div>
                        `;
                        currentConversationId = null;
                    }
                }
            );
        }

        // Save conversations
        function saveConversations() {
            storage.setItem('chatConversations', JSON.stringify(conversations));
        }

        // Initialize app
        init();
