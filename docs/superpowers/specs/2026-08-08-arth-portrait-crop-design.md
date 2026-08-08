# Arth portrait crop design

## Goal

Tighten the homepage portrait presentation without altering the supplied image file.

## Scope

Modify the homepage source and production HTML copies, `public/arth/styles.css`, and add supplied badge image assets. Keep the hero structure, portrait asset path, dark theme, rounded portrait frame, and responsive layout unchanged.

## Crop treatment

Apply a CSS scale to `.portrait-frame img` and keep it clipped by the existing frame. Position the scaled image slightly toward Arth so the white vertical strip at the left and the clothes/hanger area at the right are outside the frame. Preserve Arth’s face, sunglasses, phone, and upper body as the visual focus.

Use a `transform` on the image rather than editing or replacing `arth-headshot-20260808.png`.

## Responsive behavior

The same crop rule applies at every viewport size. The portrait frame retains its current aspect ratio.

## Program and venture marks

Use the supplied Wharton shield and Berkeley blue-gold `B` mark as small icons beside the existing signal-card labels. Do not use generic W/B badges, recreate any institutional wordmark, or add a second text label. Use the existing Game-Changrs hex-ball mark beside the Game-Changrs signal card.

Keep the textual signal-card labels as the accessible names. Give decorative icon images empty `alt` attributes so they do not repeat the visible labels for screen-reader users.

## Verification

Keep the existing portrait-asset test green. Add assertions for the three signal mark assets and their placement. Run the profile test suite, full test suite, Vite build, and `git diff --check`.
