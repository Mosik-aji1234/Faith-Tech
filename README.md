# Faith Tech

Faith Tech is a clean React landing page for SolidWorks training.

## Run locally

1. Copy `.env.example` to `.env` if you want to wire payment, email, or storage.
2. Start the app with:

```powershell
npm run dev
```

This starts the Vite UI and the local API server together.

## API setup

- `PAYSTACK_SECRET_KEY` enables real Paystack checkout for the premium course.
- `PAYSTACK_PUBLIC_KEY` is optional for future inline checkout work.
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` send branded confirmation emails.
- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` store enrollments and learner profiles in Supabase.
- `SUPABASE_PUBLISHABLE_KEY` is kept for future client-side Supabase work.
- Supabase Auth uses an email + password flow for the learner login experience.
- Resend works best with a verified sender on the Faith Tech domain later on; your current Gmail sender is fine for testing if it is verified in Resend.

## Deploy

- Vercel uses `api/` routes plus `vercel.json`.
- Netlify uses `netlify/functions/` plus `netlify.toml`.
- If you only want the static site, the app still builds without backend keys.
