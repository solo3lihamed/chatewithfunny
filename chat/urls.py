from django.urls import path
from . import views

urlpatterns = [
    # Authentication
    path('register/', views.register, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('profile/', views.profile, name='profile'),
    
    # Friends
    path('search/', views.search_users, name='search_users'),
    path('friends/', views.friends_list, name='friends_list'),
    path('friend-request/send/<int:user_id>/', views.send_friend_request, name='send_friend_request'),
    path('friend-request/accept/<int:request_id>/', views.accept_friend_request, name='accept_friend_request'),
    path('friend-request/reject/<int:request_id>/', views.reject_friend_request, name='reject_friend_request'),
    
    # Chat
    path('', views.chat_list, name='chat_list'),
    path('chat/<int:conversation_id>/', views.chat_room, name='chat_room'),
    path('chat/start/<int:user_id>/', views.start_conversation, name='start_conversation'),
    path('upload/', views.upload_media, name='upload_media'),
    
    # Calls
    path('call/initiate/<int:user_id>/', views.initiate_call, name='initiate_call'),
]
