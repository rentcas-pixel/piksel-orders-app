# 🔒 Piksel Orders - Backup Informacija

## 📅 Backup sukurtas: 2025-08-24 17:02

## 📁 Backup failai:

### 1. **ZIP Backup** (91.8 KB)
- **Failas**: `piksel-orders-backup-20250824-170105.zip`
- **Dydis**: 91.8 KB
- **Formatas**: ZIP
- **Išskirti**: node_modules, .git, .next

### 2. **TAR.GZ Backup** (110.3 MB)
- **Failas**: `piksel-orders-backup-20250824-170122.tar.gz`
- **Dydis**: 110.3 MB
- **Formatas**: TAR.GZ su gzip suspaudimu
- **Išskirti**: node_modules, .git, .next

### 3. **TAR.GZ Backup 2** (110.3 MB)
- **Failas**: `piksel-orders-backup-20250824-170151.tar.gz`
- **Dydis**: 110.3 MB
- **Formatas**: TAR.GZ su gzip suspaudimu

### 4. **Failų sąrašas** (791 B)
- **Failas**: `piksel-orders-files-list-20250824-170223.txt`
- **Dydis**: 791 B
- **Turinys**: Visų failų sąrašas (išskyrus node_modules, .git, .next)

## 🚀 Kaip atkurti projektą:

### **ZIP atkūrimas:**
```bash
unzip piksel-orders-backup-20250824-170105.zip
cd piksel-orders-app
npm install
```

### **TAR.GZ atkūrimas:**
```bash
tar -xzf piksel-orders-backup-20250824-170122.tar.gz
cd piksel-orders-app
npm install
```

## 📋 Kas įtraukta į backup:

- ✅ **Visi source failai** (src/)
- ✅ **Konfigūracijos failai** (package.json, tsconfig.json, etc.)
- ✅ **Public failai** (favicon, manifest, etc.)
- ✅ **README ir dokumentacija**
- ✅ **Supabase setup failai**

## ❌ Kas išskirta iš backup:

- ❌ **node_modules/** - npm paketai (galima atkurti su `npm install`)
- ❌ **.git/** - Git istorija (galima atkurti su `git clone`)
- ❌ **.next/** - Next.js build failai (galima atkurti su `npm run build`)

## 🔧 Atkūrimo komandos:

```bash
# 1. Išskleisti backup
unzip piksel-orders-backup-20250824-170105.zip

# 2. Eiti į projektą
cd piksel-orders-app

# 3. Įdiegti dependencies
npm install

# 4. Paleisti development server
npm run dev

# 5. Arba sukurti production build
npm run build
```

## 📍 Backup failų vieta:
```
piksel-pocket/
├── piksel-orders-backup-20250824-170105.zip
├── piksel-orders-backup-20250824-170122.tar.gz
├── piksel-orders-backup-20250824-170151.tar.gz
├── piksel-orders-files-list-20250824-170223.txt
└── piksel-orders-app/
    └── BACKUP-INFO.md (šis failas)
```

---
**Backup sukurtas automatiškai** - saugokite šiuos failus saugioje vietoje! 🔒
