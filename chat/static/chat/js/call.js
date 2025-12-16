// WebRTC Voice Call Implementation
let localStream = null;
let peerConnection = null;
let callSocket = null;
let currentCallId = null;

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function initiateCall(userId) {
    // Create call record
    fetch(`/call/initiate/${userId}/`, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
        .then(response => response.json())
        .then(data => {
            currentCallId = data.call_id;
            startCall(data.call_id);
        })
        .catch(error => {
            console.error('Error initiating call:', error);
            alert('Failed to initiate call');
        });
}

function startCall(callId) {
    // Get user media
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
            localStream = stream;

            // Update UI
            if (typeof showCallUI === 'function') {
                showCallUI('Connecting...');
            }

            // Connect to call WebSocket
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/call/${callId}/`;

            callSocket = new WebSocket(wsUrl);

            callSocket.onopen = function (e) {
                console.log('Call WebSocket connected');
                if (typeof showCallUI === 'function') {
                    showCallUI('Call in progress...');
                }
                createPeerConnection();
                makeOffer();
            };

            callSocket.onmessage = function (e) {
                const data = JSON.parse(e.data);
                handleSignalingMessage(data);
            };

            callSocket.onclose = function (e) {
                console.log('Call WebSocket disconnected');
                endCall();
            };

            callSocket.onerror = function (e) {
                console.error('Call WebSocket error:', e);
                if (typeof hideCallUI === 'function') {
                    hideCallUI();
                }
                alert('Call connection error');
            };
        })
        .catch(error => {
            console.error('Error accessing media devices:', error);
            if (typeof hideCallUI === 'function') {
                hideCallUI();
            }
            alert('Could not access microphone. Please check permissions.');
        });
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);

    // Add local stream to peer connection
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // Handle incoming stream
    peerConnection.ontrack = function (event) {
        const remoteAudio = document.createElement('audio');
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.autoplay = true;
        document.body.appendChild(remoteAudio);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = function (event) {
        if (event.candidate && callSocket && callSocket.readyState === WebSocket.OPEN) {
            callSocket.send(JSON.stringify({
                'type': 'ice_candidate',
                'candidate': event.candidate
            }));
        }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = function (event) {
        console.log('Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'disconnected' ||
            peerConnection.connectionState === 'failed') {
            endCall();
        }
    };
}

function makeOffer() {
    peerConnection.createOffer()
        .then(offer => {
            return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
            if (callSocket && callSocket.readyState === WebSocket.OPEN) {
                callSocket.send(JSON.stringify({
                    'type': 'offer',
                    'offer': peerConnection.localDescription
                }));
            }
        })
        .catch(error => {
            console.error('Error creating offer:', error);
        });
}

function handleSignalingMessage(data) {
    switch (data.type) {
        case 'offer':
            handleOffer(data.offer);
            break;
        case 'answer':
            handleAnswer(data.answer);
            break;
        case 'ice_candidate':
            handleIceCandidate(data.candidate);
            break;
    }
}

function handleOffer(offer) {
    if (!peerConnection) {
        createPeerConnection();
    }

    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => {
            return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        })
        .then(stream => {
            localStream = stream;
            stream.getTracks().forEach(track => {
                peerConnection.addTrack(track, stream);
            });
            return peerConnection.createAnswer();
        })
        .then(answer => {
            return peerConnection.setLocalDescription(answer);
        })
        .then(() => {
            if (callSocket && callSocket.readyState === WebSocket.OPEN) {
                callSocket.send(JSON.stringify({
                    'type': 'answer',
                    'answer': peerConnection.localDescription
                }));
            }
        })
        .catch(error => {
            console.error('Error handling offer:', error);
        });
}

function handleAnswer(answer) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
        .catch(error => {
            console.error('Error handling answer:', error);
        });
}

function handleIceCandidate(candidate) {
    if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(error => {
                console.error('Error adding ICE candidate:', error);
            });
    }
}

function endCall() {
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // Close peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    // Close WebSocket
    if (callSocket) {
        callSocket.close();
        callSocket = null;
    }

    // Remove remote audio elements
    document.querySelectorAll('audio').forEach(audio => audio.remove());

    // Hide call UI
    if (typeof hideCallUI === 'function') {
        hideCallUI();
    }

    console.log('Call ended');
}
