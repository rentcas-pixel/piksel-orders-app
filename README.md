This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## El. pašto AI agentas (Paštas tab)

### 1. Supabase migracija

Paleiskite SQL iš `supabase/migrations/20260630_email_agent.sql` Supabase SQL Editor.

### 2. Aplinkos kintamieji

Nukopijuokite `.env.example` į `.env.local` ir užpildykite:

- `EMAIL_PASSWORD` — el. pašto dėžutės slaptažodis (`renatas@piksel.lt`)
- `OPENAI_API_KEY` — AI analizei

Numatyti serveriai: `mail.piksel.lt` (IMAP 993 SSL, SMTP 465 SSL).

### 3. Naudojimas

1. Atidarykite skirtuką **Paštas**
2. Paspauskite **Sinchronizuoti** — nuskaitomi neskaityti laiškai per paskutines 24 val.
3. AI suskirsto į kategorijas ir sugeneruoja santrauką / juodraštį
4. Atsakymą galite redaguoti ir **išsiųsti tik po patvirtinimo**

Laiškai niekada nesiunčiami automatiškai. Laiškai nepažymimi kaip skaityti (Spark nesikeičia).

