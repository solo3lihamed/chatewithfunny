// WebSocket chat functionality
let chatSocket = null;
let currentConversationId = null;
let currentUserId = null;

function initializeChat(conversationId, userId) {
    currentConversationId = conversationId;
    currentUserId = userId;

    // Determine WebSocket protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/chat/${conversationId}/`;

    chatSocket = new WebSocket(wsUrl);

    chatSocket.onopen = function (e) {
        console.log('Chat WebSocket connected');
    };

    chatSocket.onmessage = function (e) {
        const data = JSON.parse(e.data);

        if (data.type === 'chat_message') {
            displayMessage(data);
        } else if (data.type === 'typing') {
            showTypingIndicator(data.is_typing);
        } else if (data.type === 'user_status') {
            updateUserStatus(data.is_online);
        } else if (data.type === 'read_receipt') {
            markMessageAsRead(data.message_id);
        }
    };

    chatSocket.onclose = function (e) {
        console.log('Chat WebSocket disconnected');
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
            initializeChat(conversationId, userId);
        }, 3000);
    };

    chatSocket.onerror = function (e) {
        console.error('WebSocket error:', e);
    };

    // Scroll to bottom on load
    scrollToBottom();
}

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();

    if (message && chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(JSON.stringify({
            'type': 'chat_message',
            'message': message
        }));

        messageInput.value = '';
    }
}

function displayMessage(data) {
    const messagesContainer = document.getElementById('chat-messages');
    const isSent = data.sender_id === currentUserId;

    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message-wrapper ${isSent ? 'sent' : 'received'}`;

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    const messageBubble = document.createElement('div');
    messageBubble.className = `message-bubble ${isSent ? 'message-sent' : 'message-received'}`;
    messageBubble.textContent = data.message;

    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    const timestamp = new Date(data.timestamp);
    messageTime.textContent = timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    messageContent.appendChild(messageBubble);
    messageContent.appendChild(messageTime);
    messageWrapper.appendChild(messageContent);

    // Insert before typing indicator
    const typingIndicator = document.getElementById('typing-indicator');
    messagesContainer.insertBefore(messageWrapper, typingIndicator);

    scrollToBottom();
}

function sendTypingIndicator(isTyping) {
    if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(JSON.stringify({
            'type': 'typing',
            'is_typing': isTyping
        }));
    }
}

function showTypingIndicator(isTyping) {
    const typingIndicator = document.getElementById('typing-indicator');
    typingIndicator.style.display = isTyping ? 'block' : 'none';
    if (isTyping) {
        scrollToBottom();
    }
}

function updateUserStatus(isOnline) {
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.getElementById('user-status');

    if (statusIndicator) {
        statusIndicator.className = `status-indicator ${isOnline ? 'status-online' : 'status-offline'}`;
    }

    if (statusText) {
        statusText.textContent = isOnline ? 'Online' : 'Offline';
    }
}

function markMessageAsRead(messageId) {
    // Visual feedback that message was read
    console.log(`Message ${messageId} was read`);
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function uploadFile(file, conversationId) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversation_id', conversationId);

    // Get CSRF token from cookie
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    const csrfToken = getCookie('csrftoken');

    fetch('/upload/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken
        },
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('File uploaded successfully');
                // The message will be displayed via WebSocket
            } else {
                alert('Failed to upload file');
            }
        })
        .catch(error => {
            console.error('Upload error:', error);
            alert('Failed to upload file');
        });
}

function initiateCall() {
    // This will be implemented in call.js
    console.log('Initiating call...');
    alert('Voice call feature - WebRTC implementation in progress!');
}
