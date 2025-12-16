from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.db.models import Q, Max
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from .models import CustomUser, FriendRequest, Friendship, Conversation, Message, MessageAttachment, VoiceCall
from .forms import UserRegistrationForm, UserLoginForm, ProfileUpdateForm, MessageForm


def register(request):
    """User registration view"""
    if request.user.is_authenticated:
        return redirect('chat_list')
    
    if request.method == 'POST':
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, 'Welcome! Your account has been created.')
            return redirect('chat_list')
    else:
        form = UserRegistrationForm()
    
    return render(request, 'chat/register.html', {'form': form})


def login_view(request):
    """User login view"""
    if request.user.is_authenticated:
        return redirect('chat_list')
    
    if request.method == 'POST':
        form = UserLoginForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(username=username, password=password)
            if user is not None:
                login(request, user)
                messages.success(request, f'Welcome back, {username}!')
                return redirect('chat_list')
    else:
        form = UserLoginForm()
    
    return render(request, 'chat/login.html', {'form': form})


@login_required
def logout_view(request):
    """User logout view"""
    logout(request)
    messages.info(request, 'You have been logged out.')
    return redirect('login')


@login_required
def profile(request):
    """User profile view"""
    if request.method == 'POST':
        form = ProfileUpdateForm(request.POST, request.FILES, instance=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Your profile has been updated!')
            return redirect('profile')
    else:
        form = ProfileUpdateForm(instance=request.user)
    
    return render(request, 'chat/profile.html', {'form': form})


@login_required
def search_users(request):
    """Search for users to add as friends"""
    query = request.GET.get('q', '')
    users = []
    
    if query:
        # Search for users excluding current user and existing friends
        friends = Friendship.get_friends(request.user)
        friend_ids = [friend.id for friend in friends]
        
        users = CustomUser.objects.filter(
            Q(username__icontains=query) | Q(email__icontains=query)
        ).exclude(id=request.user.id).exclude(id__in=friend_ids)[:10]
    
    return render(request, 'chat/search_users.html', {'users': users, 'query': query})


@login_required
@require_POST
def send_friend_request(request, user_id):
    """Send a friend request"""
    receiver = get_object_or_404(CustomUser, id=user_id)
    
    # Check if already friends
    if Friendship.are_friends(request.user, receiver):
        messages.warning(request, 'You are already friends with this user.')
        return redirect('friends_list')
    
    # Check if request already exists
    existing_request = FriendRequest.objects.filter(
        Q(sender=request.user, receiver=receiver) | Q(sender=receiver, receiver=request.user)
    ).first()
    
    if existing_request:
        messages.warning(request, 'A friend request already exists.')
    else:
        FriendRequest.objects.create(sender=request.user, receiver=receiver)
        messages.success(request, f'Friend request sent to {receiver.username}!')
    
    return redirect('search_users')


@login_required
@require_POST
def accept_friend_request(request, request_id):
    """Accept a friend request"""
    friend_request = get_object_or_404(FriendRequest, id=request_id, receiver=request.user)
    
    # Update request status
    friend_request.status = 'accepted'
    friend_request.save()
    
    # Create friendship
    Friendship.objects.create(user1=friend_request.sender, user2=request.user)
    
    messages.success(request, f'You are now friends with {friend_request.sender.username}!')
    return redirect('friends_list')


@login_required
@require_POST
def reject_friend_request(request, request_id):
    """Reject a friend request"""
    friend_request = get_object_or_404(FriendRequest, id=request_id, receiver=request.user)
    friend_request.status = 'rejected'
    friend_request.save()
    
    messages.info(request, 'Friend request rejected.')
    return redirect('friends_list')


@login_required
def friends_list(request):
    """View all friends and pending requests"""
    friends = Friendship.get_friends(request.user)
    pending_requests = FriendRequest.objects.filter(receiver=request.user, status='pending')
    sent_requests = FriendRequest.objects.filter(sender=request.user, status='pending')
    
    return render(request, 'chat/friends_list.html', {
        'friends': friends,
        'pending_requests': pending_requests,
        'sent_requests': sent_requests
    })


@login_required
def chat_list(request):
    """View all conversations"""
    conversations = Conversation.objects.filter(participants=request.user).annotate(
        last_message_time=Max('messages__created_at')
    ).order_by('-last_message_time')
    
    conversation_data = []
    for conv in conversations:
        other_user = conv.get_other_participant(request.user)
        last_message = conv.get_last_message()
        unread_count = conv.messages.filter(is_read=False).exclude(sender=request.user).count()
        
        conversation_data.append({
            'conversation': conv,
            'other_user': other_user,
            'last_message': last_message,
            'unread_count': unread_count
        })
    
    return render(request, 'chat/chat_list.html', {'conversation_data': conversation_data})


@login_required
def chat_room(request, conversation_id):
    """Individual chat room"""
    conversation = get_object_or_404(Conversation, id=conversation_id, participants=request.user)
    other_user = conversation.get_other_participant(request.user)
    messages_list = conversation.messages.all()
    
    # Mark messages as read
    conversation.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)
    
    return render(request, 'chat/chat_room.html', {
        'conversation': conversation,
        'other_user': other_user,
        'messages': messages_list
    })


@login_required
def start_conversation(request, user_id):
    """Start a new conversation with a user"""
    other_user = get_object_or_404(CustomUser, id=user_id)
    
    # Check if conversation already exists
    existing_conversation = Conversation.objects.filter(
        participants=request.user
    ).filter(participants=other_user).first()
    
    if existing_conversation:
        return redirect('chat_room', conversation_id=existing_conversation.id)
    
    # Create new conversation
    conversation = Conversation.objects.create()
    conversation.participants.add(request.user, other_user)
    
    return redirect('chat_room', conversation_id=conversation.id)


@login_required
@require_POST
def upload_media(request):
    """Handle media uploads"""
    if 'file' not in request.FILES:
        return JsonResponse({'error': 'No file provided'}, status=400)
    
    file = request.FILES['file']
    conversation_id = request.POST.get('conversation_id')
    
    conversation = get_object_or_404(Conversation, id=conversation_id, participants=request.user)
    
    # Create message with attachment
    message = Message.objects.create(
        conversation=conversation,
        sender=request.user,
        content=f'Sent a file: {file.name}'
    )
    
    # Determine attachment type
    content_type = file.content_type
    if content_type.startswith('image'):
        attachment_type = 'image'
    elif content_type.startswith('video'):
        attachment_type = 'video'
    elif content_type.startswith('audio'):
        attachment_type = 'audio'
    else:
        attachment_type = 'file'
    
    attachment = MessageAttachment.objects.create(
        message=message,
        file=file,
        attachment_type=attachment_type
    )
    
    return JsonResponse({
        'success': True,
        'message_id': message.id,
        'attachment_url': attachment.file.url
    })


@login_required
def initiate_call(request, user_id):
    """Initiate a voice call"""
    receiver = get_object_or_404(CustomUser, id=user_id)
    
    # Create call record
    call = VoiceCall.objects.create(
        caller=request.user,
        receiver=receiver,
        status='initiated'
    )
    
    return JsonResponse({
        'call_id': call.id,
        'receiver': receiver.username
    })
