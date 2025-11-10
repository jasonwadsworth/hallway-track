# Badge Visibility Manual Testing Checklist

**Test Date:** _____________
**Tester:** _____________
**Dev Server:** http://localhost:5174/

## Pre-Test Setup

- [x] Development server running on http://localhost:5174/
- [x] All badge images exist in `frontend/public/badge-images/`
- [x] No TypeScript/linting errors in badge components
- [x] Badge images verified:
  - first-connection.svg ✓
  - networker.svg ✓
  - socialite.svg ✓
  - connector.svg ✓
  - legend.svg ✓
  - default.svg ✓

---

## Task 7.1: Test Badge Display in All Components

### ConnectionDetail View
**Path:** `/connections/:id`

- [ ] Navigate to a connection detail page
- [ ] Verify "Badges" section appears when connection has badges
- [ ] Verify badge images render correctly (not emojis)
- [ ] Verify badge images are 48x48px
- [ ] Verify badge names are prominently displayed
- [ ] Verify badge descriptions appear as secondary text
- [ ] Verify badge earned dates display correctly
- [ ] Verify section does NOT appear when connection has no badges

**Notes:**
```
_____________________________________________
_____________________________________________
```

---

### PublicProfile View
**Path:** `/profile/:userId`

- [ ] Navigate to a public profile page
- [ ] Verify "Badges" section appears when user has badges
- [ ] Verify badge images render correctly (not emojis)
- [ ] Verify badge images use proper sizing
- [ ] Verify badge names are prominently displayed
- [ ] Verify badge descriptions appear
- [ ] Verify no hardcoded trophy emoji (🏆) appears
- [ ] Verify badges are visible without authentication

**Notes:**
```
_____________________________________________
_____________________________________________
```

---

### Profile View (ProfileView Component)
**Path:** `/profile` (Profile tab)

- [ ] Navigate to Profile tab
- [ ] Verify "Earned Badges" section appears when user has badges
- [ ] Verify badge images render correctly (not emojis)
- [ ] Verify badge images are properly sized
- [ ] Verify badge names are prominently displayed
- [ ] Verify badge descriptions appear
- [ ] Verify badge earned dates display
- [ ] Verify badge threshold information shows
- [ ] Verify "No badges earned yet" message when no badges

**Notes:**
```
_____________________________________________
_____________________________________________
```

---

### Dashboard View
**Path:** `/` or `/dashboard`

- [ ] Navigate to Dashboard
- [ ] Verify "Badge Progress" section appears
- [ ] Verify BadgeProgress component renders correctly
- [ ] Verify badge images display in progress widget
- [ ] Verify badge names are visible
- [ ] Verify progress indicators work correctly

**Notes:**
```
_____________________________________________
_____________________________________________
```

---

### BadgeList Component
**Path:** Used in BadgeProgress component

- [ ] Verify all 5 badges display in the list
- [ ] Verify earned badges show in color
- [ ] Verify locked badges show with grayscale filter
- [ ] Verify locked badges have reduced opacity (0.5)
- [ ] Verify badge images render correctly
- [ ] Verify "X more to unlock" text appears for locked badges
- [ ] Verify earned date appears for earned badges
- [ ] Verify badge threshold information displays

**Notes:**
```
_____________________________________________
_____________________________________________
```

---

## Task 7.2: Test Error Handling and Fallback Behavior

### Image Fallback Testing

**Test 1: Primary Image Failure**
- [ ] Temporarily rename a badge image file (e.g., `first-connection.svg` → `first-connection.svg.bak`)
- [ ] Reload page with that badge
- [ ] Verify `default.svg` loads as fallback
- [ ] Verify no broken image icon appears
- [ ] Restore original filename

**Test 2: Default Image Failure**
- [ ] Temporarily rename `default.svg` → `default.svg.bak`
- [ ] Temporarily rename a badge image (e.g., `networker.svg` → `networker.svg.bak`)
- [ ] Reload page with that badge
- [ ] Verify graceful degradation (image hidden, text remains)
- [ ] Verify badge name still displays prominently
- [ ] Restore both filenames

**Test 3: Network Failure Simulation**
- [ ] Open browser DevTools → Network tab
- [ ] Set throttling to "Offline"
- [ ] Reload page
- [ ] Verify fallback behavior activates
- [ ] Verify no JavaScript errors in console
- [ ] Restore network connection

**Notes:**
```
_____________________________________________
_____________________________________________
```

---

## Task 7.3: Test Empty State Handling

### ConnectionDetail Empty State
- [ ] Find or create a connection with a user who has 0 badges
- [ ] Navigate to that connection's detail page
- [ ] Verify "Badges" section does NOT appear
- [ ] Verify no error messages appear
- [ ] Verify page layout remains intact

### PublicProfile Empty State
- [ ] Navigate to a public profile of user with 0 badges
- [ ] Verify "Badges" section does NOT appear
- [ ] Verify no error messages appear
- [ ] Verify page layout remains intact

### Profile View Empty State
- [ ] Test with account that has 0 connections/badges
- [ ] Navigate to Profile tab
- [ ] Verify "No badges earned yet. Start connecting!" message displays
- [ ] Verify message is styled appropriately (italic, centered)
- [ ] Verify no broken images or errors

**Notes:**
```
_____________________________________________
_____________________________________________
```

---

## Task 7.4: Test Responsive Design

### Mobile Viewport (320px - 480px)

**Test at 320px width:**
- [ ] Open DevTools → Toggle device toolbar
- [ ] Set viewport to 320px width
- [ ] Test ConnectionDetail badge display
- [ ] Test PublicProfile badge display
- [ ] Test Profile badge display
- [ ] Test Dashboard badge display
- [ ] Verify badge images scale appropriately
- [ ] Verify badge images maintain aspect ratio
- [ ] Verify badge grid adjusts to single column
- [ ] Verify text remains readable
- [ ] Verify no horizontal scrolling

**Test at 480px width:**
- [ ] Set viewport to 480px width
- [ ] Repeat all badge display tests
- [ ] Verify badge grid layout adjusts appropriately
- [ ] Verify images maintain proper sizing

**Notes:**
```
_____________________________________________
_____________________________________________
```

---

### Tablet Viewport (768px - 1024px)

**Test at 768px width:**
- [ ] Set viewport to 768px width
- [ ] Test all badge displays
- [ ] Verify badge grid shows 2-3 columns
- [ ] Verify badge images scale appropriately
- [ ] Verify spacing and padding are appropriate

**Test at 1024px width:**
- [ ] Set viewport to 1024px width
- [ ] Repeat all badge display tests
- [ ] Verify badge grid layout is optimal
- [ ] Verify images maintain aspect ratio

**Notes:**
```
_____________________________________________
_____________________________________________
```

---

### Desktop Viewport (1200px+)

**Test at 1200px width:**
- [ ] Set viewport to 1200px width
- [ ] Test all badge displays
- [ ] Verify badge grid shows multiple columns
- [ ] Verify badge images are properly sized (48x48px)
- [ ] Verify layout is visually balanced

**Test at 1920px width:**
- [ ] Set viewport to 1920px width
- [ ] Repeat all badge display tests
- [ ] Verify badge grid doesn't become too wide
- [ ] Verify images maintain quality at larger sizes

**Notes:**
```
_____________________________________________
_____________________________________________
```

---

## Additional Verification

### Cross-Browser Testing (Optional)
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

### Accessibility Testing
- [ ] All badge images have proper alt text
- [ ] Badge names are readable by screen readers
- [ ] Color contrast meets WCAG AA standards
- [ ] Keyboard navigation works properly

### Performance Testing
- [ ] Badge images load quickly
- [ ] No layout shift when images load
- [ ] Images are cached properly on subsequent loads
- [ ] No console errors or warnings

---

## Summary

**Total Tests Passed:** _____ / _____
**Critical Issues Found:** _____
**Minor Issues Found:** _____

**Overall Status:** [ ] PASS [ ] FAIL [ ] NEEDS REVIEW

**Critical Issues:**
```
_____________________________________________
_____________________________________________
```

**Recommendations:**
```
_____________________________________________
_____________________________________________
```

---

## Sign-Off

**Tester Signature:** _____________
**Date:** _____________
**Approved for Production:** [ ] YES [ ] NO
