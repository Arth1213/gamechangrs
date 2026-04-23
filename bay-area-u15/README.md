# Bay Area U15 Bundle Integration

This folder vendors the transferred Bay Area U15 Cricket Performance Intelligence bundle into the main GameChangrs repo without changing the existing Vite app structure.

## Why it lives here

The transferred worker scaffold uses CommonJS (`require(...)`), while the main GameChangrs app uses an ESM Vite setup. Keeping the bundle in its own folder with its own `package.json` avoids breaking either runtime.

## What is included

- planning and blueprint docs
- schema SQL
- config files
- worker scaffold under `apps/worker`
- worker-local `package.json`

## Run from the project root

Use the helper scripts added to the main repo:

```bash
npm run bay-u15:discover
npm run bay-u15:inventory
npm run bay-u15:run
```

## Run directly inside the bundle

```bash
cd bay-area-u15
npm run worker:discover
npm run worker:inventory
npm run worker:run
```

## Important paths

- worker entry: `bay-area-u15/apps/worker/src/index.js`
- league config: `bay-area-u15/config/leagues.yaml`
- weights config: `bay-area-u15/config/weights.yaml`
- generated exports: `bay-area-u15/storage/exports`

## Notes

- Generated exports are ignored by git.
- The main GameChangrs frontend is unchanged by this integration.
- If you want, the next step can be wiring this worker output into the existing analytics UI and/or Supabase pipeline.
