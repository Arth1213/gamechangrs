# Arth Wharton Moneyball Profile Update Design

## Objective

Add a completed Wharton Moneyball Experience to Arth's local profile and make every supplied supporting artifact accessible from the profile archive. The update remains local; publication is performed manually by the user through Lovable.

## Verified Source Material

- Wharton Global Youth Program certificate for Arth Arun, completing the San Francisco, CA: Moneyball Experience on July 31, 2026.
- A 17-page final presentation, *What Drives NBA Offense More? Shot Creation vs. Shot Making*, credited to Arth Arun and four teammates.
- The editable PPTX version of that presentation.
- One Wharton program photo.

## Experience Design

The main `/arth/` page gains a Journey item describing completion of the program and the team's NBA offense analysis. It links to a focused `moneyball.html` detail page.

The Archive gains a Wharton Moneyball card. The existing Academics page also gains a Featured Program card so the experience is discoverable in the academic archive without reorganizing the current navigation.

`moneyball.html` follows the existing Berkeley M.E.T. detail-page pattern. It presents a concise program summary and an artifact gallery with the certificate, program photo, presentation PDF, and PPTX download. It does not claim a selection outcome, award, faculty relationship, or methodology beyond what the supplied assets establish.

## Local Readiness Criteria

- `/arth/`, `/arth/academics.html`, and `/arth/moneyball.html` render through the profile runtime.
- All four Moneyball artifact paths resolve from `public/arth/Arth-Accomp/Moneyball/`.
- `npm run build` completes successfully.
- No deployment command is run.
