# AI Invoice Processor

Upload an invoice and AI reads the vendor, dates, line items, and totals. Then the app checks it the way an accounts payable clerk would: does the math add up, has this bill already been paid, and does it need a manager's approval?

**Live demo:** https://jacobjohnson-ai.github.io/ai-invoice-processor/ (four sample invoices, or drop in your own PDF or image)

## What it checks

| Check | Example | Result |
|---|---|---|
| Line math | 6 × $95.00 billed as $620.00 | Needs review |
| Subtotal and total | Line items don't add up to the subtotal, or subtotal + tax ≠ total | Needs review |
| Missing fields | No vendor, invoice number, date, or total | Needs review |
| Duplicates | Same vendor and invoice number, or same vendor, date, and total. Vendor names are compared without "Inc", "LLC", punctuation, or capitals | Possible duplicate |
| Approval limit | Total of $5,000 or more | Needs approval |
| Due dates | Past due, or due within 7 days | Flagged |

Each flag comes with a plain-English reason, for example *"Looks like a duplicate of BOS-19977 from Brightline Office Supply, which was already paid."*

## How it works

1. The browser sends the file to a **Cloudflare Worker**.
2. The Worker sends it to **Google Gemini** with a strict output format (structured JSON), and tells it to copy numbers exactly as printed, without fixing the math. That way the app catches the vendor's mistakes instead of the AI hiding them.
3. The Worker runs the checks in `worker/review.js` (plain code, not AI), compares against saved invoices in **Supabase**, and saves the result.
4. The page shows the extracted fields, the flags, and Approve / Mark paid / Reject buttons. The list can be filtered and exported to CSV.

## Privacy and security

- Visitors only see the demo history plus their own uploads. Uploads are never listed for anyone else (row-level security in Postgres).
- Files are not stored. Only the extracted fields are saved.
- Visitors can only approve or reject their own uploads, not the shared demo history.
- The Gemini key and the database's secret key live in Cloudflare settings, never in the page.
- Uploads are limited per visitor (4 per minute, 25 per day) to stay inside Gemini's free tier.

## Stack

- **Frontend:** React 19 + TypeScript, built with Vite
- **API:** Cloudflare Workers
- **AI:** Google Gemini (document understanding with structured output)
- **Database:** Supabase (Postgres, row-level security)
- **Deploy:** GitHub Actions runs the tests, type-checks, builds, and publishes to GitHub Pages on every push. Cloudflare deploys the Worker from this repo.

Everything runs on free tiers.

## Project layout

```
worker/
  review.js       the checks (math, duplicates, approval limit, due dates)
  worker.js       upload endpoint, Gemini call, database writes, rate limits
test/
  review.test.mjs   9 tests for the checks
  worker.test.mjs   4 tests for the Worker, with Gemini and the database mocked
sql/01_invoices.sql invoices table, security policies, demo history
samples/            the four sample invoices (fictional companies)
web/                the React app
```

## Run it locally

```
npm test              # run the tests
cd web && npm install && npm run dev
```
