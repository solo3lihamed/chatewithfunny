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
        } else if (data.type === 'incoming_call') {
            handleIncomingCall(data);
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

function initiateCall(userId) {
    if (typeof startCall === 'function') {
        // Create call UI
        showCallUI('Calling...');

        // Initiate call via API
        fetch(`/call/initiate/${userId || otherUserId}/`, {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
            .then(response => response.json())
            .then(data => {
                currentCallId = data.call_id;

                // Notify the other user via WebSocket
                if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
                    chatSocket.send(JSON.stringify({
                        'type': 'incoming_call',
                        'call_id': data.call_id,
                        'caller_username': data.caller_username // Assuming backend sends this
                    }));
                }

                // Start the call
                startCall(data.call_id);
            })
            .catch(error => {
                console.error('Error initiating call:', error);
                hideCallUI();
                alert('Failed to initiate call');
            });
    } else {
        alert('📞 Voice call feature is ready! Make sure call.js is loaded.');
    }
}

function handleIncomingCall(data) {
    // Show incoming call UI
    const callUI = document.createElement('div');
    callUI.id = 'incoming-call-ui';
    callUI.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #00d9a3 0%, #00b894 100%);
        padding: 2rem;
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        z-index: 9999;
        text-align: center;
        min-width: 300px;
        animation: popIn 0.3s ease;
    `;

    callUI.innerHTML = `
        <div style="color: white;">
            <div style="font-size: 3rem; margin-bottom: 1rem; animation: bounce 1s ease infinite;">📞</div>
            <h3 style="margin: 0 0 0.5rem 0;">${data.caller_username}</h3>
            <p style="margin: 0 0 1.5rem 0; opacity: 0.9;">is calling you...</p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button onclick="acceptCall(${data.call_id})" class="btn btn-success" style="flex: 1;">
                    ✅ Accept
                </button>
                <button onclick="rejectCall(${data.call_id})" class="btn btn-danger" style="flex: 1;">
                    ❌ Reject
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(callUI);

    // Play ringing sound (optional)
    // const audio = new Audio('/static/chat/sounds/ringtone.mp3');
    // audio.loop = true;
    // audio.play();
}

function acceptCall(callId) {
    // Remove incoming call UI
    const incomingCallUI = document.getElementById('incoming-call-ui');
    if (incomingCallUI) {
        incomingCallUI.remove();
    }

    // Start the call
    if (typeof startCall === 'function') {
        showCallUI('Connecting...');
        startCall(callId);
    }
}

function rejectCall(callId) {
    // Remove incoming call UI
    const incomingCallUI = document.getElementById('incoming-call-ui');
    if (incomingCallUI) {
        incomingCallUI.remove();
    }

    // Optionally notify the caller
    alert('Call rejected');
}

function showCallUI(status) {
    let callUI = document.getElementById('call-ui');
    if (!callUI) {
        callUI = document.createElement('div');
        callUI.id = 'call-ui';
        callUI.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 2rem;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            z-index: 9999;
            text-align: center;
            min-width: 300px;
        `;
        document.body.appendChild(callUI);
    }

    callUI.innerHTML = `
        <div style="color: white;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">📞</div>
            <h3 style="margin: 0 0 1rem 0;">${status}</h3>
            <button onclick="endCall()" class="btn btn-danger" style="margin-top: 1rem;">
                End Call
            </button>
        </div>
    `;
    callUI.style.display = 'block';
}

function hideCallUI() {
    const callUI = document.getElementById('call-ui');
    if (callUI) {
        callUI.style.display = 'none';
    }


    const incomingCallUI = document.getElementById('incoming-call-ui');
    if (incomingCallUI) {
        incomingCallUI.remove();
    }
}
