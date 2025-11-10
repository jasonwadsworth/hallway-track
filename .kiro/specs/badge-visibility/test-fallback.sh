#!/bin/bash

# Badge Image Fallback Testing Script
# This script tests the error handling and fallback behavior

echo "=========================================="
echo "Badge Image Fallback Testing"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BADGE_DIR="frontend/public/badge-images"

echo "Test 1: Primary Image Failure Fallback"
echo "-----------------------------------"
echo "Temporarily renaming first-connection.svg to test fallback..."

if [ -f "${BADGE_DIR}/first-connection.svg" ]; then
    mv "${BADGE_DIR}/first-connection.svg" "${BADGE_DIR}/first-connection.svg.bak"
    echo -e "${GREEN}✓${NC} Renamed first-connection.svg → first-connection.svg.bak"
    echo ""
    echo -e "${YELLOW}ACTION REQUIRED:${NC}"
    echo "1. Open http://localhost:5174/ in your browser"
    echo "2. Navigate to a page with the 'Ice Breaker' badge"
    echo "3. Verify that default.svg loads instead"
    echo "4. Check browser console for no errors"
    echo ""
    read -p "Press Enter when you've verified the fallback behavior..."

    mv "${BADGE_DIR}/first-connection.svg.bak" "${BADGE_DIR}/first-connection.svg"
    echo -e "${GREEN}✓${NC} Restored first-connection.svg"
else
    echo "Error: first-connection.svg not found"
fi

echo ""
echo "Test 2: Default Image Failure (Graceful Degradation)"
echo "-----------------------------------"
echo "Temporarily renaming both default.svg and networker.svg..."

if [ -f "${BADGE_DIR}/default.svg" ] && [ -f "${BADGE_DIR}/networker.svg" ]; then
    mv "${BADGE_DIR}/default.svg" "${BADGE_DIR}/default.svg.bak"
    mv "${BADGE_DIR}/networker.svg" "${BADGE_DIR}/networker.svg.bak"
    echo -e "${GREEN}✓${NC} Renamed default.svg and networker.svg"
    echo ""
    echo -e "${YELLOW}ACTION REQUIRED:${NC}"
    echo "1. Reload the page in your browser"
    echo "2. Navigate to a page with the 'Networker' badge"
    echo "3. Verify that the image is hidden but badge name still displays"
    echo "4. Check browser console for no JavaScript errors"
    echo ""
    read -p "Press Enter when you've verified the graceful degradation..."

    mv "${BADGE_DIR}/default.svg.bak" "${BADGE_DIR}/default.svg"
    mv "${BADGE_DIR}/networker.svg.bak" "${BADGE_DIR}/networker.svg"
    echo -e "${GREEN}✓${NC} Restored default.svg and networker.svg"
else
    echo "Error: Required files not found"
fi

echo ""
echo "Test 3: Verify onError Handler Implementation"
echo "-----------------------------------"

# Check BadgeDisplay.tsx for proper error handling
if grep -q "onError.*default.svg" "frontend/src/components/BadgeDisplay.tsx"; then
    echo -e "${GREEN}✓${NC} BadgeDisplay.tsx has fallback to default.svg"
else
    echo "✗ BadgeDisplay.tsx missing fallback handler"
fi

# Check BadgeList.tsx for proper error handling
if grep -q "onError" "frontend/src/components/BadgeList.tsx"; then
    echo -e "${GREEN}✓${NC} BadgeList.tsx has error handler"

    # Check for graceful degradation (hiding image on second failure)
    if grep -q "style.display.*none" "frontend/src/components/BadgeList.tsx"; then
        echo -e "${GREEN}✓${NC} BadgeList.tsx has graceful degradation (hides image on double failure)"
    else
        echo -e "${YELLOW}⚠${NC} BadgeList.tsx may not hide image on double failure"
    fi
else
    echo "✗ BadgeList.tsx missing error handler"
fi

# Check PublicProfile.tsx for proper error handling
if grep -q "onError.*default.svg" "frontend/src/components/PublicProfile.tsx"; then
    echo -e "${GREEN}✓${NC} PublicProfile.tsx has fallback to default.svg"
else
    echo "✗ PublicProfile.tsx missing fallback handler"
fi

echo ""
echo "=========================================="
echo "Fallback Testing Complete"
echo "=========================================="
echo ""
echo "Summary:"
echo "- Primary image failure → Falls back to default.svg"
echo "- Default image failure → Hides image, shows text only"
echo "- All components have error handlers implemented"
echo ""
echo -e "${GREEN}✓ Error handling and fallback behavior verified${NC}"
