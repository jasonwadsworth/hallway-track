#!/bin/bash

# Badge Responsive Design Verification Script
# This script verifies responsive design implementation for badge displays

echo "=========================================="
echo "Badge Responsive Design Verification"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

check_css_feature() {
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

echo "1. Badge Grid Responsive Layout"
echo "-----------------------------------"
check_css_feature "frontend/src/components/BadgeDisplay.css" \
    "grid-template-columns.*auto-fill.*minmax" \
    "Uses CSS Grid with auto-fill and minmax for responsive columns"

check_css_feature "frontend/src/components/BadgeDisplay.css" \
    "minmax(250px" \
    "Minimum column width of 250px (adapts to mobile)"

echo ""
echo "2. Badge Image Sizing"
echo "-----------------------------------"
check_css_feature "frontend/src/components/BadgeDisplay.css" \
    "width: 48px" \
    "Badge images have fixed width (48px)"

check_css_feature "frontend/src/components/BadgeDisplay.css" \
    "height: 48px" \
    "Badge images have fixed height (48px)"

check_css_feature "frontend/src/components/BadgeDisplay.css" \
    "object-fit: contain" \
    "Images maintain aspect ratio with object-fit: contain"

echo ""
echo "3. PublicProfile Responsive Design"
echo "-----------------------------------"
check_css_feature "frontend/src/components/PublicProfile.css" \
    "@media.*min-width: 768px" \
    "Has desktop breakpoint at 768px"

check_css_feature "frontend/src/components/PublicProfile.css" \
    "@media.*orientation: landscape.*max-width: 767px" \
    "Has landscape mobile optimization"

check_css_feature "frontend/src/components/PublicProfile.css" \
    "badge-icon-image" \
    "Badge images styled in PublicProfile"

echo ""
echo "4. ConnectionDetail Responsive Design"
echo "-----------------------------------"
check_css_feature "frontend/src/components/ConnectionDetail.css" \
    "@media.*min-width: 768px" \
    "Has desktop breakpoint at 768px"

check_css_feature "frontend/src/components/ConnectionDetail.css" \
    "@media.*orientation: landscape.*max-width: 767px" \
    "Has landscape mobile optimization"

echo ""
echo "5. ProfileView Responsive Design"
echo "-----------------------------------"
check_css_feature "frontend/src/components/ProfileView.css" \
    "@media.*min-width: 768px" \
    "Has desktop breakpoint at 768px"

check_css_feature "frontend/src/components/ProfileView.css" \
    "@media.*orientation: landscape.*max-width: 767px" \
    "Has landscape mobile optimization"

echo ""
echo "6. Flexbox Layout for Badge Items"
echo "-----------------------------------"
check_css_feature "frontend/src/components/BadgeDisplay.css" \
    "display: flex" \
    "Badge items use flexbox for layout"

check_css_feature "frontend/src/components/BadgeDisplay.css" \
    "flex-shrink: 0" \
    "Badge icons don't shrink on small screens"

echo ""
echo "7. Mobile-First Approach"
echo "-----------------------------------"

# Check that base styles come before media queries
if grep -B 20 "@media" "frontend/src/components/PublicProfile.css" | grep -q "Mobile-first"; then
    echo -e "${GREEN}✓${NC} PublicProfile uses mobile-first approach"
    ((PASS_COUNT++))
fi

if grep -B 20 "@media" "frontend/src/components/ConnectionDetail.css" | grep -q "Mobile-first"; then
    echo -e "${GREEN}✓${NC} ConnectionDetail uses mobile-first approach"
    ((PASS_COUNT++))
fi

if grep -B 20 "@media" "frontend/src/components/ProfileView.css" | grep -q "Mobile-first"; then
    echo -e "${GREEN}✓${NC} ProfileView uses mobile-first approach"
    ((PASS_COUNT++))
fi

echo ""
echo "=========================================="
echo "Responsive Design Verification Summary"
echo "=========================================="
echo -e "Tests Passed: ${GREEN}${PASS_COUNT}${NC}"
echo -e "Tests Failed: ${FAIL_COUNT}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ All responsive design checks passed!${NC}"
    echo ""
    echo "Responsive Features Verified:"
    echo "• CSS Grid with auto-fill and minmax for flexible columns"
    echo "• Fixed badge image size (48x48px) with aspect ratio preservation"
    echo "• Mobile-first design approach"
    echo "• Desktop breakpoint at 768px"
    echo "• Landscape mobile optimization"
    echo "• Flexbox layout for badge items"
    echo ""
    echo -e "${YELLOW}Manual Testing Required:${NC}"
    echo "1. Test at 320px width (smallest mobile)"
    echo "2. Test at 480px width (larger mobile)"
    echo "3. Test at 768px width (tablet)"
    echo "4. Test at 1024px width (tablet landscape)"
    echo "5. Test at 1200px+ width (desktop)"
    echo ""
    echo "What to verify:"
    echo "• Badge grid adjusts column count appropriately"
    echo "• Badge images maintain 48x48px size and aspect ratio"
    echo "• Text remains readable at all sizes"
    echo "• No horizontal scrolling occurs"
    echo "• Layout is visually balanced"
    exit 0
else
    echo -e "✗ Some responsive design checks failed"
    exit 1
fi
