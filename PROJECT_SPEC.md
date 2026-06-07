# Project Spec: My Senior High School Memory Album

## 1. Product Goal

Create an interactive high-school memory album website where photos feel like collectible keepsakes. The experience should feel cozy, nostalgic, emotional, and personal, as if the user is opening a handmade scrapbook filled with senior-year memories.

## 2. Target Feeling

The website should feel like:

- Afternoon sunlight through classroom windows
- Old paper, handwritten notes, and scrapbook layers
- Film photos and memory cards collected over time
- Flowers, tape, soft shadows, and warm paper texture
- A quiet emotional album rather than a loud visual demo

The design should avoid cyberpunk, harsh neon, fireworks, overly futuristic effects, or busy particle-heavy visuals.

## 3. Core Interaction Model

### Card Pool

The main screen displays a horizontal pool of collectible cards. Cards slide from side to side in a continuous, calm motion.

Expected behavior:

- Cards move horizontally by default.
- The card pool should feel smooth and gentle.
- Multiple cards are visible at once.
- Cards may have slight tilt, depth, and paper-like shadows.
- Cards should look collectible before the photo is revealed.

### Drag Left or Right

The user can drag horizontally to refresh or cycle the visible card pool.

Expected behavior:

- Dragging left moves the pool forward.
- Dragging right moves the pool backward.
- Releasing the drag lets the pool settle naturally.
- The motion should feel soft and physical, not abrupt.

### Hover Card

When the user hovers a card:

- The overall card movement slows down.
- The hovered card slightly enlarges.
- The hovered card may lift subtly above nearby cards.
- The effect should feel like attention and curiosity, not a dramatic zoom.

### Drag Up to Reveal

Dragging upward on a card flips it and reveals the photo.

Expected behavior:

- The card responds to upward drag distance.
- After passing a reveal threshold, the card flips open.
- The front collectible-card design transitions to the photo side.
- The action should feel like turning over a memory card.

### Opened Photo State

When a card opens:

- The opened card enlarges into a focused photo view.
- The rest of the album becomes blurred and dimmed.
- The opened photo remains warm, clear, and emotionally centered.
- Like and comment buttons appear at the bottom-right corner of the opened photo.
- Closing the opened card returns the user to the card pool.

## 4. Future Hand Gesture Control

Hand gestures will eventually map to the same actions:

- Horizontal hand movement maps to dragging left or right.
- Hover-like hand focus maps to slowing and enlarging a card.
- Upward hand movement maps to flipping and revealing a card.
- A future gesture may close the opened photo or switch cards.

Gesture support should be treated as an input layer, not as a separate experience. Mouse, touch, and hand gestures should control the same underlying album actions.

## 5. Main Interface Areas

### Album Stage

The full-screen area that contains the background, card pool, decorative scrapbook details, and opened photo state.

### Card Pool

The moving horizontal row or layered stream of collectible cards.

### Collectible Card

Each card has two conceptual sides:

- Front side: scrapbook-style collectible design, possibly with a title, label, number, date, or decorative frame.
- Back/photo side: the revealed memory photo.

### Focus Overlay

The blurred and dimmed background state shown when a card is opened.

### Photo Action Buttons

Like and comment buttons placed in the bottom-right corner of the opened photo.

## 6. Suggested Photo Data Model

Each memory can later use structured data like:

- `id`
- `title`
- `date`
- `location`
- `image`
- `caption`
- `tags`
- `cardColor`
- `likes`
- `comments`

The first version can use local static data. A backend is not required for the first milestone.

## 7. Visual System

Recommended visual ingredients:

- Warm ivory, honey gold, faded rose, soft brown, muted green
- Paper grain and subtle vignette
- Polaroid frames and rounded photo corners
- Film strip borders
- Pressed flower decorations
- Tape pieces and handwritten label areas
- Soft shadows and layered scrapbook depth

Typography should feel personal and readable. A combination of a clean serif or sans-serif with a handwritten accent font can work well.

## 8. Responsive Behavior

The album should work on:

- Desktop mouse interaction
- Laptop trackpad interaction
- Mobile touch interaction
- Future camera-based gesture interaction

On smaller screens, fewer cards should be visible at once, and the opened photo should fit comfortably without covering essential action buttons.

## 9. Accessibility And Usability

The first implementation should consider:

- Keyboard-accessible card opening and closing
- Clear focus states
- Buttons with accessible labels
- Reduced-motion support
- Image alt text for each memory photo
- Touch-friendly hit areas for like and comment buttons

## 10. First Milestone Acceptance Criteria

The first working version should be considered successful when:

- A warm scrapbook-style album page loads.
- A horizontal pool of cards moves smoothly.
- Dragging left or right cycles the cards.
- Hovering a card slows motion and enlarges it slightly.
- Dragging upward flips and opens a card.
- The opened card enlarges and blurs the background.
- Like and comment buttons appear in the bottom-right corner of the opened photo.
- The implementation remains visually soft, nostalgic, and emotionally warm.

## 11. Non-Goals For The First Version

These are intentionally deferred:

- Real user accounts
- Persistent likes and comments
- Backend storage
- Full gesture recognition
- Photo upload system
- Admin dashboard
- Complex social features
