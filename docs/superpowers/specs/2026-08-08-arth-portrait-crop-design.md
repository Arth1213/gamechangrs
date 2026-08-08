# Arth portrait crop design

## Goal

Tighten the homepage portrait presentation without altering the supplied image file.

## Scope

Modify only `public/arth/styles.css`. Keep the hero markup, portrait asset path, dark theme, rounded portrait frame, and responsive layout unchanged.

## Crop treatment

Apply a CSS scale to `.portrait-frame img` and keep it clipped by the existing frame. Position the scaled image slightly toward Arth so the white vertical strip at the left and the clothes/hanger area at the right are outside the frame. Preserve Arth’s face, sunglasses, phone, and upper body as the visual focus.

Use a `transform` on the image rather than editing or replacing `arth-headshot-20260808.png`.

## Responsive behavior

The same crop rule applies at every viewport size. The portrait frame retains its current aspect ratio.

## Verification

Keep the existing portrait-asset test green. Run the profile test suite, full test suite, Vite build, and `git diff --check`.
