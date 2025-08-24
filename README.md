# Piksel Orders - Užsakymų valdymas

Modernus web interface'as reklamų užsakymų valdymui su PocketBase integracija ir Supabase papildomų duomenų valdymu.

## ✨ Funkcionalumas

- **Užsakymų valdymas** - peržiūra, redagavimas, naujų kūrimas
- **Paieška ir filtravimas** - pagal klientą, agentūrą, datą, statusą
- **Komentarai ir priminimai** - kiekvienam užsakymui
- **Failų valdymas** - screenshot'ų ir dokumentų pridėjimas
- **Kolekcijų kūrimas** - custom kolekcijų kūrimas pagal kriterijus
- **Modernus dizainas** - responsive, dark/light mode
- **Real-time atnaujinimai** - duomenų sinchronizacija

## 🚀 Pradžia

### Reikalavimai

- Node.js 18+ 
- npm arba yarn
- Supabase paskyra (komentarams, priminimams, failams)

### Įdiegimas

1. **Klonuokite projektą:**
```bash
git clone <repository-url>
cd piksel-orders-app
```

2. **Įdėkite priklausomybes:**
```bash
npm install
```

3. **Sukurkite .env.local failą:**
```bash
# PocketBase Configuration
NEXT_PUBLIC_POCKETBASE_URL=https://get.piksel.lt

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## 🚀 Kaip paleisti:

**Produkcijoje (rekomenduojama):**
```
https://piksel-orders-app-46le.vercel.app
```

**Lokaliai (development):**
Sukurkite `.env.local` failą:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

Paleiskite projektą:
```bash
npm run dev
```

Atidarykite naršyklę:
```
http://localhost:3000
```

## 🏗️ Supabase duomenų bazės struktūra

Sukurkite šias lenteles Supabase:

### comments
```sql
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### reminders
```sql
CREATE TABLE reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### file_attachments
```sql
CREATE TABLE file_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Storage bucket
Sukurkite `files` storage bucket failų saugojimui.

## 🔧 Konfigūracija

### PocketBase
- URL: `https://get.piksel.lt`
- Kolekcija: `orders`
- Reikalingi laukai: client, agency, invoice_id, approved, viaduct, from, to, media_received, final_price, invoice_sent, updated

### Supabase
- Sukurkite naują projektą
- Įdėkite URL ir anon key į .env.local
- Sukurkite lenteles (žr. aukščiau)
- Sukurkite storage bucket

## 📱 Naudojimas

### Pagrindinis puslapis
- Užsakymų sąrašas su paieška ir filtravimu
- Naujo užsakymo pridėjimas
- Užsakymo detalių peržiūra

### Užsakymo detalės
- **Detalės** - pagrindinė informacija
- **Komentarai** - komentarų pridėjimas ir peržiūra
- **Priminimai** - priminimų kūrimas ir valdymas
- **Failai** - failų įkėlimas ir valdymas

### Kolekcijų kūrimas
- Dinamiškai kuriamos kolekcijos pagal mėnesį ir statusą
- Custom kolekcijų kūrimas pagal poreikius

## 🎨 Dizainas

- **Modernus UI** - Tailwind CSS su custom komponentais
- **Responsive** - veikia visuose įrenginiuose
- **Dark/Light mode** - automatinis perjungimas
- **Piksel brand'as** - su logotipu ir spalvomis

## 🎨 Favicon ir ikonos

Sistema turi raudoną kvadratą su baltais taškeliais favicon:

### 📁 Favicon failai:
- `public/favicon.svg` - SVG favicon (32x32)
- `public/favicon-32x32.png` - PNG favicon (32x32)
- `public/favicon-16x16.png` - PNG favicon (16x16)
- `public/favicon.ico` - ICO favicon
- `public/apple-touch-icon.png` - Apple Touch Icon (180x180)
- `public/manifest.json` - Web App Manifest

### 🔧 Kaip sugeneruoti tikrus PNG/ICO failus:

1. **SVG į PNG konvertavimas:**
   - Eikite į https://convertio.co/svg-png/
   - Įkelkite `public/favicon.svg`
   - Nustatykite dydį: 32x32, 16x16, 180x180
   - Parsisiųskite PNG failus

2. **SVG į ICO konvertavimas:**
   - Eikite į https://convertio.co/svg-ico/
   - Įkelkite `public/favicon.svg`
   - Parsisiųskite ICO failą

3. **Pakeiskite placeholder failus:**
   - `public/favicon-32x32.png`
   - `public/favicon-16x16.png`
   - `public/favicon.ico`
   - `public/apple-touch-icon.png`

### 🎯 Favicon dizainas:
- **Raudonas kvadratas** (#dc2626)
- **5 balti taškeliai** kampuose ir centre
- **32x32 pikseliai** SVG formatas
- **Piksel brand'o** atpažinimo elementas

## 🔄 Real-time atnaujinimai

- **Polling** - duomenų atnaujinimas kas 30 sekundžių
- **Supabase real-time** - komentarų ir priminimų atnaujinimas
- **PocketBase sinchronizacija** - užsakymų duomenų atnaujinimas

## 🚀 Deployment

### Vercel (rekomenduojama)
1. Pridėkite projektą į Vercel
2. Įdėkite aplinkos kintamuosius
3. Deploy

### Kiti platformos
- Netlify
- Railway
- DigitalOcean App Platform

## 📝 Licencija

Šis projektas yra sukurtas Piksel kompanijai.

## 🤝 Palaikymas

Jei turite klausimų ar problemų:
1. Patikrinkite console klaidas
2. Patikrinkite .env.local konfigūraciją
3. Patikrinkite Supabase lentelių struktūrą
4. Susisiekite su kūrėju

---

**Sukurta su ❤️ Next.js, TypeScript ir Tailwind CSS**
