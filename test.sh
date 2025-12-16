#!/bin/bash

# FunnyChat - Quick Test Script
# اختبار سريع لجميع المميزات

echo "🧪 Testing FunnyChat Features..."
echo ""

# Test 1: Check if all required files exist
echo "📁 Test 1: Checking files..."
files=(
    "chat/models.py"
    "chat/views.py"
    "chat/consumers.py"
    "chat/routing.py"
    "chat/static/chat/css/style.css"
    "chat/static/chat/js/chat.js"
    "chat/static/chat/js/call.js"
    "chat/templates/chat/base.html"
    "chat/templates/chat/chat_room.html"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file - MISSING!"
    fi
done

echo ""

# Test 2: Check database
echo "📊 Test 2: Checking database..."
python manage.py check --deploy 2>&1 | grep -q "System check identified no issues" && echo "  ✅ Database OK" || echo "  ⚠️  Check database configuration"

echo ""

# Test 3: Check static files
echo "🎨 Test 3: Checking static files..."
if [ -d "staticfiles" ]; then
    count=$(find staticfiles -type f | wc -l)
    echo "  ✅ Static files collected: $count files"
else
    echo "  ⚠️  Run: python manage.py collectstatic"
fi

echo ""

# Test 4: Check migrations
echo "🔄 Test 4: Checking migrations..."
python manage.py showmigrations chat 2>&1 | grep -q "\[X\]" && echo "  ✅ Migrations applied" || echo "  ⚠️  Run: python manage.py migrate"

echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All tests completed!"
echo ""
echo "🚀 To start the app:"
echo "   ./start.sh"
echo ""
echo "📱 Then open: http://localhost:8000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
