#!/bin/bash

# FunnyChat - Start Script

echo "🎉 Starting FunnyChat Application..."
echo ""

# Check if superuser exists, if not prompt to create one
echo "📝 Checking for superuser..."
python manage.py shell -c "from chat.models import CustomUser; exit(0 if CustomUser.objects.filter(is_superuser=True).exists() else 1)" 2>/dev/null

if [ $? -ne 0 ]; then
    echo "⚠️  No superuser found. Creating one now..."
    python manage.py createsuperuser
fi

echo ""
echo "🚀 Starting Daphne server..."
echo "📱 Access the app at: http://localhost:8000"
echo "🛑 Press Ctrl+C to stop the server"
echo ""

daphne -b 0.0.0.0 -p 8000 core.asgi:application
