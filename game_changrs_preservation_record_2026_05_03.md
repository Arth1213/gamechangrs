# Game-Changrs Preservation Record

Date: 2026-05-03

Owner: Arth Arun

Primary Google / SSO account: `helloarth09@gmail.com`

## 1. Google Root Account

Account email:
- `helloarth09@gmail.com`

Password manager entry name:
- Skipped by user

Recovery phone:
- Skipped by user

Recovery email:
- Skipped by user

2FA method:
- Skipped by user

Authenticator app used:
- Skipped by user

Authenticator app installed on device(s):
- Skipped by user

Backup codes generated:
- Skipped by user

Where backup codes are stored:
- Skipped by user

Second trusted device:
- Skipped by user

Notes:
- User chose to skip Google root account preservation details during this walkthrough.

Services tied to this Google account:
- GitHub: Skipped by user
- Supabase: Skipped by user
- Render: Skipped by user
- Lovable: Skipped by user
- Google Cloud Console: Skipped by user
- OpenAI: Skipped by user
- IONOS: Skipped by user

## 2. GitHub

GitHub username:
- `Arth1213`

GitHub email:
- `helloarth09@gmail.com`

Repo URL:
- `https://github.com/Arth1213/gamechangrs`

Default branch:
- `main`

Restore branch:
- `backup/2026_05-03-Game-Changrs-Restore-Point`

Restore tag:
- `2026_05-03-Game-Changrs-Restore-Point`

Latest restore commit:
- `60f8044`

Login method:
- Google SSO

2FA enabled:
- No

2FA method:
- Not enabled

Recovery codes stored:
- No

Where recovery codes are stored:
- Not applicable because 2FA is not enabled

Git push method:
- HTTPS

If SSH:
- private key path: Not used
- key label in GitHub: None
- passphrase stored: Not applicable
- passphrase location: Not applicable

If HTTPS token/PAT:
- token name: No fine-grained tokens or classic personal access tokens visible
- scopes: Not applicable
- storage location: Not applicable

Notes:
- User reported no SSH, no GPG, and no visible GitHub personal access tokens in settings.

## 3. Supabase Main App Project

Project name:
- Not visible in current Supabase account session

Project ref:
- `snlutvotzeijzqdwlank`

Dashboard URL:
- Not visible in any currently accessible Supabase org/project list

Login method:
- GitHub SSO

Org / owner:
- `helloarth09@gmail.com` account does not currently show this project in the visible project list

CLI access works:
- No

Auth providers enabled:
- Google: No
- Email: Yes
- Other: None

Storage buckets used:
- None visible

Edge functions used:
- Not visible / not verified because the project is not accessible

Preserved values or source of truth:
- `SUPABASE_URL`: Not visible / not verified because the project is not accessible
- `SUPABASE_ANON_KEY`: Not visible / not verified because the project is not accessible
- `SUPABASE_SERVICE_ROLE_KEY`: Not visible / not verified because the project is not accessible
- DB password source: Not visible / not verified because the project is not accessible

Custom auth redirect URLs:
- Not visible / not verified because the project is not accessible

Notes:
- Screenshot review and `supabase projects list` output both confirmed that project ref `snlutvotzeijzqdwlank` is not visible in any currently accessible Supabase org/project list.

## 4. Supabase Analytics Project

Project name:
- `game-changrs-cricket-analytics`

Project ref:
- `azgebbtasywunltdhdby`

Dashboard URL:
- `https://supabase.com/dashboard/project/azgebbtasywunltdhdby`

Login method:
- Google SSO

Org / owner:
- `Arth1213's Org`

CLI access works:
- Yes

Database connection source:
- both

Database password source:
- Supabase Connect screen

Preserved values or source of truth:
- `SUPABASE_URL`: Supabase Connect screen
- `SUPABASE_ANON_KEY`: Supabase Connect screen
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Project Settings -> API
- `DATABASE_URL`: Supabase Connect screen - Direct connection
- `DATABASE_SSL_MODE`: `require`

Known functions:
- `analytics-player-report-chat`

Other deployed functions:
- none

Storage buckets used:
- None visible

Notes:
- Dashboard screenshot confirmed status Healthy, region East US (Ohio), and environment/branch shown as `main`. No additional notes.

## 5. Render

Render account email:
- `helloarth09@gmail.com`

Login method:
- GitHub SSO

2FA enabled:
- No

Service name:
- `gamechangrs-cricket-api`

Service URL:
- `https://gamechangrs-cricket-api.onrender.com`

Connected repo:
- `Arth1213/gamechangrs`

Branch deployed:
- `main`

Root directory:
- `bay-area-u15`

Build command:
- `npm install`

Start command:
- `npm run api:start`

Env vars preserved or source of truth:
- `DATABASE_URL`: Render environment page
- `DATABASE_SSL_MODE`: `require`
- `SUPABASE_URL`: not set in Render
- `SUPABASE_ANON_KEY`: not set in Render
- `PORT`: `10000`
- `OPENAI_API_KEY`: Render environment page
- `OPENAI_MODEL`: not set in Render
- `LOVABLE_API_KEY`: not set in Render
- `CORS_ALLOW_ORIGIN`: not set in Render
- `SUPABASE_AUTH_TIMEOUT_MS`: not set in Render

Notes:
- Render environment screenshot confirmed `DATABASE_SSL_MODE=require`, `PORT=10000`, and presence of `DATABASE_URL` and `OPENAI_API_KEY`. Only four env vars are set in Render: `DATABASE_SSL_MODE`, `DATABASE_URL`, `OPENAI_API_KEY`, `PORT`.

## 6. Lovable

Lovable account email:
- `helloarth09@gmail.com`

Login method:
- Google SSO

2FA enabled:
- No

Project name:
- `Game Changer Hub`

Project URL inside Lovable:
- `https://lovable.dev/projects/e14399ba-fbf2-42cf-bf82-4c38048ee762`

Linked GitHub repo:
- `Arth1213/gamechangrs`

Publish branch:
- `main`

Custom domain configured:
- Yes

If yes, domain:
- `game-changrs.com`

Env vars or secrets configured in Lovable:
- none visible

Publish URL:
- `https://gamechangrs.lovable.app`

Notes:
- Domain screenshot confirmed `game-changrs.com` is live on Lovable, while `www.game-changrs.com` is not connected. Git settings screenshot confirmed repository `Arth1213/gamechangrs`, branch `main`, and connected status.

## 7. Google OAuth Project

Google Cloud project name:
- Not sure

Google Cloud project ID:
- Not sure

OAuth client name:
- Not found / not verified

OAuth client ID:
- Not found / not verified

OAuth client secret stored:
- Not found / not verified

OAuth client secret location:
- Not found / not verified

Authorized JavaScript origins:
- Not found / not verified

Authorized redirect URIs:
- Not found / not verified

Consent screen app name:
- Not found / not verified

Support email:
- `helloarth09@gmail.com`

Publishing status:
- Not found / not verified

Notes:
- Google Cloud Console is accessible, but no visible project or OAuth credential could be confidently tied to Game-Changrs auth during this walkthrough. User chose to skip Google OAuth fallback identification.

## 8. OpenAI / Lovable API Keys

OpenAI account email:
- `helloarth09@gmail.com`

OpenAI key label/name:
- `game-changrs-api`

OpenAI key stored in:
- Render environment page

OpenAI key source of truth:
- OpenAI dashboard API keys page

Lovable API key label/name:
- Not visible

Lovable API key stored in:
- Not visible

Lovable API key source of truth:
- Not visible

Notes:
- OpenAI key source of truth was confirmed in the OpenAI dashboard. No Lovable-specific API key was visible in current Lovable account or project settings during the walkthrough.

## 9. Domain / DNS

Domain:
- `game-changrs.com`

Registrar:
- `IONOS`

DNS provider:
- `IONOS`

Login method:
- email-password

Account owner email:
- `helloarth09@gmail.com`

Nameservers:
- `ns1028.ui-dns.com`
- `ns1068.ui-dns.org`
- `ns1077.ui-dns.de`
- `ns1052.ui-dns.biz`

Auto-renew enabled:
- Yes

Expiration / renewal date:
- `12/03/2026`

Important DNS records:
- apex/root A or CNAME: `A @ -> 185.158.133.1`
- `www`: no `www` DNS record configured
- TXT verification records: `_lovable -> lovable_verify=c97b25e563f69103d9e397e319e4be8b0b03974ff751cd4ecf241b687c9c12e7`; `@ -> v=spf1 include:_spf-us.ionos.com ~all`; `_dmarc -> v=DMARC1; p=none;`; `resend._domainkey -> p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCxCcNIxQj7AKuCQw3gDkBzDLwmQglMkVt3gsLbCw1WauY24BrBdDRNLCGY6jU8iGoNunUr3YZe9OVeqtAK+G4OYQ/jZsd5BhAfSG6WzHDWiVYnvjPAPcNmGkluu2pDVx4TXpIhONTHrBJq9F6z/fEa/opfuEQLplRJ/XNqjrjykQIDAQAB`; `send -> v=spf1 include:amazonses.com ~all`
- MX records: `@ -> mx00.ionos.com`; `@ -> mx01.ionos.com`; `send -> feedback-smtp.us-east-1.amazonses.com`
- other: `CNAME _domainconnect -> _domainconnect.ionos.com`; `CNAME s1-ionos._domainkey -> s1.dkim.ionos.com`; `CNAME s2-ionos._domainkey -> s2.dkim.ionos.com`; `CNAME s42582890._domainkey -> s42582890.dkim.ionos.com`; `CNAME autodiscover -> adsredir.ionos.info`

Notes:
- DNS record TTL noted by user as 1 hour. DNSSEC is active.

## 10. Local Backup Locations

Primary OneDrive backup folder:
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503`

Main restore tarball:
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point.tar.gz`

Restore folder:
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point`

Root env direct copy:
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/root.env.restore-copy`

Ops env direct copy:
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/bay-area-u15.env.restore-copy`

Raw ops env exact copy:
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/raw-secret-files/bay-area-u15/.env`

Offline git bundle:
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/gamechangrs-2026_05-03-restore.bundle`

GitHub source archive:
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/gamechangrs-github-source-2026_05_03.tar.gz`

Worktree archive:
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/gamechangrs-worktree-2026_05_03.tar.gz`

Checksum file:
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/SHA256SUMS.txt`

Notes:
- OneDrive backup folder and archive set were created on 2026-05-03.

## 11. Restore Anchors

GitHub restore branch:
- `backup/2026_05-03-Game-Changrs-Restore-Point`

GitHub restore tag:
- `2026_05-03-Game-Changrs-Restore-Point`

GitHub restore commit:
- `60f8044`

Notes:
- Restore anchor points to the GitHub backup branch/tag created for the 2026-05-03 checkpoint.
