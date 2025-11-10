#!/bin/bash

# Badge Visibility Implementation Verification Script
# This script performs automated checks on the badge visibility implementation

echo "=========================================="
echo "Badge Visibility Implementation Verification"
echo "=========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0

# Function to check if a file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} File exists: $1"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "${RED}✗${NC} File missing: $1"
        ((FAIL_COUNT++))
        return 1
    fi
}

# Function to check if a string exists in a file
check_string_in_file() {
    if grep -q "$2" "$1"; then
        echo -e "${GREEN}✓${NC} Found '$2' in $1"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "${RED}✗${NC} Missing '$2' in $1"
        ((FAIL_COUNT++))
        return 1
    fi
}

echo "1. Checking Badge Image Assets..."
echo "-----------------------------------"
check_file "frontend/public/badge-images/first-connection.svg"
check_file "frontend/public/badge-images/networker.svg"
check_file "frontend/public/badge-images/socialite.svg"
check_file "frontend/public/badge-images/connector.svg"
check_file "frontend/public/badge-images/legend.svg"
check_file "frontend/public/badge-images/default.svg"
echo ""

echo "2. Checking Infrastructure Assets..."
echo "-----------------------------------"
echo -e "${YELLOW}⊘${NC} Skipping infrastructure assets (not needed for testing)"
echo ""

echo "3. Checking BadgeDisplay Component..."
echo "-----------------------------------"
check_file "frontend/src/components/BadgeDisplay.tsx"
check_string_in_file "frontend/src/components/BadgeDisplay.tsx" "getBadgeImageUrl"
check_string_in_file "frontend/src/components/BadgeDisplay.tsx" "badge-icon-image"
check_string_in_file "frontend/src/components/BadgeDisplay.tsx" "onError"
check_string_in_file "frontend/src/components/BadgeDisplay.tsx" "default.svg"
echo ""

echo "4. Checking BadgeList Component..."
echo "-----------------------------------"
check_file "frontend/src/components/BadgeList.tsx"
check_string_in_file "frontend/src/components/BadgeList.tsx" "getBadgeImageUrl"
check_string_in_file "frontend/src/components/BadgeList.tsx" "badge-icon-image"
check_string_in_file "frontend/src/components/BadgeList.tsx" "onError"
echo ""

echo "5. Checking ConnectionDetail Component..."
echo "-----------------------------------"
check_file "frontend/src/components/ConnectionDetail.tsx"
check_string_in_file "frontend/src/components/ConnectionDetail.tsx" "BadgeDisplay"
check_string_in_file "frontend/src/components/ConnectionDetail.tsx" "Badges"
check_string_in_file "frontend/src/components/ConnectionDetail.tsx" "connectedUser.badges"
echo ""

echo "6. Checking PublicProfile Component..."
echo "-----------------------------------"
check_file "frontend/src/components/PublicProfile.tsx"
check_string_in_file "frontend/src/components/PublicProfile.tsx" "getBadgeImageUrl"
check_string_in_file "frontend/src/components/PublicProfile.tsx" "badge-icon-image"
check_string_in_file "frontend/src/components/PublicProfile.tsx" "badges-section"
echo ""

echo "7. Checking ProfileView Component..."
echo "-----------------------------------"
check_file "frontend/src/components/ProfileView.tsx"
check_string_in_file "frontend/src/components/ProfileView.tsx" "BadgeDisplay"
check_string_in_file "frontend/src/components/ProfileView.tsx" "profile-badges"
echo ""

echo "8. Checking CSS Styling..."
echo "-----------------------------------"
check_file "frontend/src/components/BadgeDisplay.css"
check_string_in_file "frontend/src/components/BadgeDisplay.css" "badge-icon-image"
check_string_in_file "frontend/src/components/BadgeDisplay.css" "width: 48px"
check_string_in_file "frontend/src/components/BadgeDisplay.css" "height: 48px"
check_string_in_file "frontend/src/components/BadgeDisplay.css" "object-fit: contain"
check_string_in_file "frontend/src/components/BadgeDisplay.css" "grayscale(100%)"
echo ""

echo "9. Checking SVG File Validity..."
echo "-----------------------------------"
for badge in first-connection networker socialite connector legend default; do
    if [ -f "frontend/public/badge-images/${badge}.svg" ]; then
        if grep -q "<svg" "frontend/public/badge-images/${badge}.svg"; then
            echo -e "${GREEN}✓${NC} Valid SVG: ${badge}.svg"
            ((PASS_COUNT++))
        else
            echo -e "${RED}✗${NC} Invalid SVG: ${badge}.svg"
            ((FAIL_COUNT++))
        fi
    fi
done
echo ""

echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo -e "Tests Passed: ${GREEN}${PASS_COUNT}${NC}"
echo -e "Tests Failed: ${RED}${FAIL_COUNT}${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Next Steps:"
    echo "1. Start the dev server: cd frontend && npm run dev"
    echo "2. Open http://localhost:5174/ in your browser"
    echo "3. Complete the manual testing checklist in MANUAL_TEST_CHECKLIST.md"
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please review the errors above.${NC}"
    exit 1
fi
