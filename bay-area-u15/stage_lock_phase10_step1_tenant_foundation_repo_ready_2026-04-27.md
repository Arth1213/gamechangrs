# Stage Lock: Phase 10 Step 1 Repo-Ready

Date: 2026-04-27  
Slice: tenant foundation for entity-owned cricket series management

## 1. What Step 1 Achieved

Step 1 established the repo-side data foundation for turning cricket analytics into a multi-tenant Game-Changrs product.

This slice adds:

- entity ownership for cricket series
- entity admin membership structure
- series-level viewer access grants
- entity-level subscription scaffolding
- helper permission functions for later API and frontend enforcement
- a tracked Phase 10 rollout plan inside the repo

This slice does **not** yet change the working public Render analytics behavior.

## 2. Exact Files Changed

- `supabase/migrations/20260427104500_phase10_entity_series_foundation.sql`
- `bay-area-u15/phase10_entity_series_management_plan_2026-04-27.md`
- `bay-area-u15/stage_lock_phase10_step1_tenant_foundation_repo_ready_2026-04-27.md`

## 3. Exact Local Verification Run

Schema and repo inspection:

```bash
git -C /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo status --short
sed -n '1,320p' /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/supabase/migrations/20260427104500_phase10_entity_series_foundation.sql
```

Repo structure and current landing zones:

```bash
find /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15/apps/api/src -maxdepth 2 -type f | sort
find /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15/apps/worker/src -maxdepth 3 -type f | sort
find /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/src -maxdepth 2 -type f | sort
```

## 4. What Was Intentionally Left Unchanged

- no root frontend route behavior changed
- no Render API route behavior changed
- no worker behavior changed
- no report payload shape changed
- no public analytics/report access policy changed yet
- no Lovable or Render deployment settings changed yet

## 5. Database Apply Status

Status: repo-ready only

This migration was added to the repo but was **not** applied to the target Supabase project in this slice.

Reason:

- applying a new production data model and RLS layer should be done as an intentional deployment step, not silently during the first repo-side foundation slice

## 6. Assumptions

- the current live analytics dataset is still the single Bay Area USAC Hub series already verified in Phase 9
- at repo-ready time, the migration assumed the current Supabase project contained the existing `profiles`, `user_roles`, and `has_role` foundation; later live inspection disproved that assumption and is recorded in `bay-area-u15/stage_lock_phase10_step1_live_apply_complete_2026-04-27.md`
- current Render analytics requests still run server-side against the analytics database and should remain behaviorally unchanged until Step 2

## 7. Known Gaps After Step 1

- the Render cricket API does not yet verify Supabase auth tokens
- admin routes are not yet restricted by entity ownership
- the root Game-Changrs app does not yet expose entity admin screens
- worker jobs are not yet driven by database-backed admin job controls
- no invitation flow exists yet for entity-managed viewers

## 8. Exact Next Step

Phase 10 Step 2 should implement the Render API auth boundary:

- resolve the authenticated Supabase user from bearer tokens
- recognize platform admin vs entity admin
- lock down admin routes first
- keep the public player report/search flow unchanged until the access policy is intentionally switched
