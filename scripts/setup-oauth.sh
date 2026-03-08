#!/bin/bash
# Create and configure GitHub OAuth App
# This script helps you set up GitHub OAuth credentials

echo "🔐 GitHub OAuth App Setup"
echo "========================="
echo ""

echo "This script will guide you through creating a GitHub OAuth App."
echo ""
echo "📋 You'll need to:"
echo "   1. Create an OAuth App on GitHub"
echo "   2. Get the Client ID and Client Secret"
echo "   3. Add them to your environment variables"
echo ""

read -p "Press Enter to continue..."
echo ""

# Determine environment
echo "Which environment are you setting up?"
echo "  1) Local development"
echo "  2) Production (Vercel)"
read -p "Enter choice (1 or 2): " ENV_CHOICE

if [[ $ENV_CHOICE == "1" ]]; then
    CALLBACK_URL="http://localhost:3001/auth/callback"
    HOMEPAGE_URL="http://localhost:5173"
    ENV_FILE="backend/.env"
elif [[ $ENV_CHOICE == "2" ]]; then
    read -p "Enter your production domain (e.g., your-app.vercel.app): " PROD_DOMAIN
    CALLBACK_URL="https://$PROD_DOMAIN/auth/callback"
    HOMEPAGE_URL="https://$PROD_DOMAIN"
    ENV_FILE=".env.production"
else
    echo "Invalid choice"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 GitHub OAuth App Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Go to: https://github.com/settings/developers"
echo ""
echo "2. Click 'New OAuth App'"
echo ""
echo "3. Fill in the form with these values:"
echo ""
echo "   Application name: SuperCrew Kanban"
echo "   Homepage URL:     $HOMEPAGE_URL"
echo "   Callback URL:     $CALLBACK_URL"
echo ""
echo "4. Click 'Register application'"
echo ""
echo "5. Copy the Client ID and generate a Client Secret"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Press Enter when you have your Client ID and Secret ready..."
echo ""

# Get credentials
read -p "Enter GitHub Client ID: " CLIENT_ID
read -sp "Enter GitHub Client Secret: " CLIENT_SECRET
echo ""

# Update .env file
if [[ $ENV_CHOICE == "1" ]]; then
    # Update backend/.env for local
    if [ -f "$ENV_FILE" ]; then
        # Replace existing values
        sed -i.bak "s|GITHUB_CLIENT_ID=.*|GITHUB_CLIENT_ID=$CLIENT_ID|" "$ENV_FILE"
        sed -i.bak "s|GITHUB_CLIENT_SECRET=.*|GITHUB_CLIENT_SECRET=$CLIENT_SECRET|" "$ENV_FILE"
        rm "$ENV_FILE.bak"
    else
        echo "Error: $ENV_FILE not found"
        exit 1
    fi

    echo ""
    echo "✅ Updated $ENV_FILE"
    echo ""
    echo "You can now start the development server with:"
    echo "  ./scripts/dev.sh"

elif [[ $ENV_CHOICE == "2" ]]; then
    # Update .env.production
    if [ -f "$ENV_FILE" ]; then
        sed -i.bak "s|GITHUB_CLIENT_ID=.*|GITHUB_CLIENT_ID=$CLIENT_ID|" "$ENV_FILE"
        sed -i.bak "s|GITHUB_CLIENT_SECRET=.*|GITHUB_CLIENT_SECRET=$CLIENT_SECRET|" "$ENV_FILE"
        sed -i.bak "s|FRONTEND_URL=.*|FRONTEND_URL=https://$PROD_DOMAIN|" "$ENV_FILE"
        sed -i.bak "s|BACKEND_URL=.*|BACKEND_URL=https://$PROD_DOMAIN|" "$ENV_FILE"
        rm "$ENV_FILE.bak"
    fi

    echo ""
    echo "✅ Updated $ENV_FILE"
    echo ""
    echo "Next steps:"
    echo "  1. Add these to Vercel:"
    echo "     vercel env add GITHUB_CLIENT_ID production"
    echo "     vercel env add GITHUB_CLIENT_SECRET production"
    echo ""
    echo "  2. Or add them manually in Vercel Dashboard:"
    echo "     https://vercel.com/dashboard → Settings → Environment Variables"
fi

echo ""
