#!/bin/bash
# Deployment script for supercrew-kanban
# Creates Turso production database and configures Vercel

set -e  # Exit on error

echo "🚀 SuperCrew Kanban - Production Deployment Setup"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# Step 1: Check prerequisites
# ============================================================================

echo "📋 Step 1: Checking prerequisites..."

if ! command -v turso &> /dev/null; then
    echo -e "${RED}❌ Turso CLI not found${NC}"
    echo "   Install with: brew install turso"
    exit 1
fi

if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found (optional)${NC}"
    echo "   Install with: npm install -g vercel"
    VERCEL_CLI=false
else
    VERCEL_CLI=true
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}"
echo ""

# ============================================================================
# Step 2: Turso authentication
# ============================================================================

echo "📋 Step 2: Turso authentication..."

if ! turso auth api-tokens list &> /dev/null; then
    echo "Please login to Turso:"
    turso auth login
else
    echo -e "${GREEN}✓ Already logged in to Turso${NC}"
fi
echo ""

# ============================================================================
# Step 3: Database configuration
# ============================================================================

echo "📋 Step 3: Database configuration..."

read -p "Enter database name [supercrew-kanban]: " DB_NAME
DB_NAME=${DB_NAME:-supercrew-kanban}

read -p "Enter database location [iad]: " DB_LOCATION
DB_LOCATION=${DB_LOCATION:-iad}

echo ""
echo "Available locations:"
echo "  - iad (US East, Virginia)"
echo "  - ord (US Central, Chicago)"
echo "  - lax (US West, Los Angeles)"
echo "  - ams (Europe, Amsterdam)"
echo "  - gru (South America, São Paulo)"
echo "  - nrt (Asia, Tokyo)"
echo "  - syd (Australia, Sydney)"
echo ""

# ============================================================================
# Step 4: Create database
# ============================================================================

echo "📋 Step 4: Creating Turso database..."

if turso db show "$DB_NAME" &> /dev/null; then
    echo -e "${YELLOW}⚠️  Database '$DB_NAME' already exists${NC}"
    read -p "Do you want to use the existing database? (y/n): " USE_EXISTING

    if [[ $USE_EXISTING != "y" ]]; then
        echo "Exiting. Please choose a different database name."
        exit 1
    fi
else
    echo "Creating database: $DB_NAME (location: $DB_LOCATION)"
    turso db create "$DB_NAME" --location "$DB_LOCATION"
    echo -e "${GREEN}✓ Database created${NC}"
fi
echo ""

# ============================================================================
# Step 5: Apply schema
# ============================================================================

echo "📋 Step 5: Applying database schema..."

if [ ! -f "backend/schema.sql" ]; then
    echo -e "${RED}❌ schema.sql not found in backend/schema.sql${NC}"
    exit 1
fi

turso db shell "$DB_NAME" < backend/schema.sql
echo -e "${GREEN}✓ Schema applied${NC}"
echo ""

# ============================================================================
# Step 6: Get connection details
# ============================================================================

echo "📋 Step 6: Getting database connection details..."

DB_URL=$(turso db show "$DB_NAME" --url)
DB_TOKEN=$(turso db tokens create "$DB_NAME")

echo ""
echo "Database connection details:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}TURSO_DATABASE_URL${NC}=$DB_URL"
echo -e "${GREEN}TURSO_AUTH_TOKEN${NC}=$DB_TOKEN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# Step 7: Configure Vercel
# ============================================================================

echo "📋 Step 7: Configuring Vercel..."

if [ "$VERCEL_CLI" = true ]; then
    read -p "Do you want to configure Vercel environment variables now? (y/n): " CONFIGURE_VERCEL

    if [[ $CONFIGURE_VERCEL == "y" ]]; then
        echo "Setting Vercel environment variables..."

        vercel env add TURSO_DATABASE_URL production <<< "$DB_URL"
        vercel env add TURSO_AUTH_TOKEN production <<< "$DB_TOKEN"

        # Also set for preview and development if needed
        read -p "Set for preview environments too? (y/n): " SET_PREVIEW
        if [[ $SET_PREVIEW == "y" ]]; then
            vercel env add TURSO_DATABASE_URL preview <<< "$DB_URL"
            vercel env add TURSO_AUTH_TOKEN preview <<< "$DB_TOKEN"
        fi

        echo -e "${GREEN}✓ Vercel configured${NC}"
    else
        echo "Skipping Vercel configuration."
        echo "You can add these manually in Vercel Dashboard:"
        echo "https://vercel.com/dashboard → Settings → Environment Variables"
    fi
else
    echo "Vercel CLI not installed. Add these manually in Vercel Dashboard:"
    echo "https://vercel.com/dashboard → Settings → Environment Variables"
fi
echo ""

# ============================================================================
# Step 8: Create .env.production
# ============================================================================

echo "📋 Step 8: Creating .env.production file..."

cat > .env.production << EOF
# Production Environment Variables
# Generated on $(date)

# Turso Database
TURSO_DATABASE_URL=$DB_URL
TURSO_AUTH_TOKEN=$DB_TOKEN

# GitHub OAuth (update with your production values)
GITHUB_CLIENT_ID=your_production_client_id
GITHUB_CLIENT_SECRET=your_production_client_secret

# URLs (update with your domain)
FRONTEND_URL=https://your-domain.vercel.app
BACKEND_URL=https://your-domain.vercel.app

# Cron secret (generate a random string)
CRON_SECRET=$(openssl rand -hex 32)

# GitHub token for validation worker
GITHUB_TOKEN=ghp_your_github_personal_access_token

# Optional settings
VALIDATION_BATCH_SIZE=10
EOF

echo -e "${GREEN}✓ Created .env.production${NC}"
echo ""

# ============================================================================
# Step 9: Summary and next steps
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Update .env.production with your actual values:"
echo "   - GITHUB_CLIENT_ID"
echo "   - GITHUB_CLIENT_SECRET"
echo "   - FRONTEND_URL"
echo "   - BACKEND_URL"
echo "   - GITHUB_TOKEN (for validation worker)"
echo ""
echo "2. Add remaining environment variables to Vercel:"
echo "   vercel env add GITHUB_CLIENT_ID production"
echo "   vercel env add GITHUB_CLIENT_SECRET production"
echo "   vercel env add CRON_SECRET production"
echo "   vercel env add GITHUB_TOKEN production"
echo ""
echo "3. Deploy to Vercel:"
echo "   git push origin main"
echo "   # or"
echo "   vercel --prod"
echo ""
echo "4. Test the deployment:"
echo "   curl https://your-domain.vercel.app/health"
echo ""
echo "📚 Documentation:"
echo "   - Turso Dashboard: https://turso.tech/app"
echo "   - Vercel Dashboard: https://vercel.com/dashboard"
echo ""
