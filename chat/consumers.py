import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone


class ChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time chat messaging"""
    
    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'
        self.user = self.scope['user']
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Set user as online
        await self.set_user_online(True)
        
        # Notify others that user is online
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_status',
                'user_id': self.user.id,
                'username': self.user.username,
                'is_online': True
            }
        )
    
    async def disconnect(self, close_code):
        # Set user as offline
        await self.set_user_online(False)
        
        # Notify others that user is offline
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_status',
                'user_id': self.user.id,
                'username': self.user.username,
                'is_online': False
            }
        )
        
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')
        
        if message_type == 'chat_message':
            message_content = data['message']
            
            # Save message to database
            message = await self.save_message(message_content)
            
            # Send message to room group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message_content,
                    'message_id': message.id,
                    'sender_id': self.user.id,
                    'sender_username': self.user.username,
                    'timestamp': message.created_at.isoformat()
                }
            )
        
        elif message_type == 'typing':
            # Broadcast typing indicator
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'typing_indicator',
                    'user_id': self.user.id,
                    'username': self.user.username,
                    'is_typing': data.get('is_typing', False)
                }
            )
        
        elif message_type == 'read_receipt':
            # Mark message as read
            message_id = data.get('message_id')
            await self.mark_message_read(message_id)
            
            # Notify sender
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'read_receipt',
                    'message_id': message_id,
                    'reader_id': self.user.id
                }
            )
        
        elif message_type == 'incoming_call':
            # Notify about incoming call
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'incoming_call_notification',
                    'call_id': data.get('call_id'),
                    'caller_id': self.user.id,
                    'caller_username': self.user.username
                }
            )
    
    async def chat_message(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'message_id': event['message_id'],
            'sender_id': event['sender_id'],
            'sender_username': event['sender_username'],
            'timestamp': event['timestamp']
        }))
    
    async def typing_indicator(self, event):
        # Don't send typing indicator to the user who is typing
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'username': event['username'],
                'is_typing': event['is_typing']
            }))
    
    async def user_status(self, event):
        # Send user status update
        await self.send(text_data=json.dumps({
            'type': 'user_status',
            'user_id': event['user_id'],
            'username': event['username'],
            'is_online': event['is_online']
        }))
    
    async def read_receipt(self, event):
        # Send read receipt
        await self.send(text_data=json.dumps({
            'type': 'read_receipt',
            'message_id': event['message_id'],
            'reader_id': event['reader_id']
        }))
    
    async def incoming_call_notification(self, event):
        # Send incoming call notification
        if event['caller_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'incoming_call',
                'call_id': event['call_id'],
                'caller_id': event['caller_id'],
                'caller_username': event['caller_username']
            }))
    
    @database_sync_to_async
    def save_message(self, content):
        from .models import Message, Conversation
        conversation = Conversation.objects.get(id=self.conversation_id)
        message = Message.objects.create(
            conversation=conversation,
            sender=self.user,
            content=content
        )
        return message
    
    @database_sync_to_async
    def mark_message_read(self, message_id):
        from .models import Message
        try:
            message = Message.objects.get(id=message_id)
            message.is_read = True
            message.read_at = timezone.now()
            message.save()
        except Message.DoesNotExist:
            pass
    
    @database_sync_to_async
    def set_user_online(self, is_online):
        from .models import CustomUser
        user = CustomUser.objects.get(id=self.user.id)
        user.is_online = is_online
        user.save()


class CallConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for WebRTC voice call signaling"""
    
    async def connect(self):
        self.call_id = self.scope['url_route']['kwargs']['call_id']
        self.room_group_name = f'call_{self.call_id}'
        self.user = self.scope['user']
        
        # Join call group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
    
    async def disconnect(self, close_code):
        # Leave call group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        data = json.loads(text_data)
        signal_type = data.get('type')
        
        # Forward WebRTC signaling messages
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'webrtc_signal',
                'signal_type': signal_type,
                'data': data,
                'sender_id': self.user.id
            }
        )
    
    async def webrtc_signal(self, event):
        # Don't send signal back to sender
        if event['sender_id'] != self.user.id:
            await self.send(text_data=json.dumps(event['data']))
