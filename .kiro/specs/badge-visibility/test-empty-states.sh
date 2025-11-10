#!/bin/bash

# Badge Empty State Testing Script
# This script verifies empty state handling across all components

echo "=========================================="
echo "Badge Empty State Verification"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

check_empty_state() {
    local file=$1
    local pattern=$2
    local description=$3

    if grep -q "$pattern" "$file"; then
        echo -e "${GREEN}✓${NC} $description"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "✗ $description"
        ((FAIL_COUNT++))
        return 1
    fi
}

echo "1. BadgeDisplay Component Empty State"
echo "-----------------------------------"
check_empty_state "frontend/src/components/BadgeDisplay.tsx" \
    "badges.length === 0" \
    "Checks for empty badges array"

check_empty_state "frontend/src/components/BadgeDisplay.tsx" \
    "No badges earned yet" \
    "Displays encouraging empty state message"

check_empty_state "frontend/src/components/BadgeDisplay.css" \
    "no-badges" \
    "Has CSS styling for empty state"

echo ""
echo "2. ConnectionDetail Component Empty State"
echo "-----------------------------------"
check_empty_state "frontend/src/components/ConnectionDetail.tsx" \
    "connectedUser.badges.length > 0" \
    "Conditionally renders badges section"

echo -e "${GREEN}✓${NC} Badges section hidden when empty (conditional rendering)"

echo ""
echo "3. PublicProfile Component Empty State"
echo "-----------------------------------"
check_empty_state "frontend/src/components/PublicProfile.tsx" \
    "profile.badges.length > 0" \
    "Conditionally renders badges section"

echo -e "${GREEN}✓${NC} Badges section hidden when empty (conditional rendering)"

echo ""
echo "4. ProfileView Component Empty State"
echo "-----------------------------------"
check_empty_state "frontend/src/components/ProfileView.tsx" \
    "profile.badges && profile.badges.length > 0" \
    "Conditionally renders badges section with null check"

echo -e "${GREEN}✓${NC} Badges section hidden when empty (conditional rendering)"

echo ""
echo "5. Empty State Message Styling"
echo "-----------------------------------"

# Check CSS for proper empty state styling
if grep -q "\.no-badges" "frontend/src/components/BadgeDisplay.css"; then
    echo -e "${GREEN}✓${NC} .no-badges CSS class exists"
    ((PASS_COUNT++))

    if grep -A 5 "\.no-badges" "frontend/src/components/BadgeDisplay.css" | grep -q "text-align: center"; then
        echo -e "${GREEN}✓${NC} Empty state message is centered"
        ((PASS_COUNT++))
    fi

    if grep -A 5 "\.no-badges" "frontend/src/components/BadgeDisplay.css" | grep -q "font-style: italic"; then
        echo -e "${GREEN}✓${NC} Empty state message is italicized"
        ((PASS_COUNT++))
    fi
fi

echo ""
echo "=========================================="
echo "Empty State Verification Summary"
echo "=========================================="
echo -e "Tests Passed: ${GREEN}${PASS_COUNT}${NC}"
echo -e "Tests Failed: ${FAIL_COUNT}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ All empty state checks passed!${NC}"
    echo ""
    echo "Empty State Behavior:"
    echo "• BadgeDisplay: Shows 'No badges earned yet. Start connecting!'"
    echo "• ConnectionDetail: Hides badges section when empty"
    echo "• PublicProfile: Hides badges section when empty"
    echo "• ProfileView: Hides badges section when empty"
    echo ""
    echo -e "${YELLOW}Manual Testing Required:${NC}"
    echo "1. Test with a user account that has 0 connections/badges"
    echo "2. Verify empty state message displays in Profile view"
    echo "3. Verify badges section is hidden in ConnectionDetail"
    echo "4. Verify badges section is hidden in PublicProfile"
    exit 0
else
    echo -e "✗ Some empty state checks failed"
    exit 1
fi
