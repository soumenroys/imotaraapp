# Imotara — Release Commands (Public v1)

Use this as the single “do these in order” sheet for a release candidate.

---

## A) Web (imotaraapp)

### 1) Clean install (optional)
- rm -rf node_modules .next
- npm install

### 2) Local smoke
- npm run dev
- Open Settings → Donations
- Confirm: buttons disabled until checkout ready
- Confirm: cancel/failure messages are neutral

### 3) API sanity
- npm run donation:check

### 4) Production build
- npm run build

### 5) Deploy (Vercel)
- git status (clean)
- git add -A
- git commit -m "rc: ready for public v1"
- git push

---

## B) Mobile (imotara-mobile)

### 1) Clean install (optional)
- rm -rf node_modules
- npm install

### 2) Local smoke
- npm start (or expo start)
- Settings → Donations
- Confirm: double-tap blocked
- Confirm: success message says webhook confirms receipt

### 3) EAS build
- eas build -p ios --profile production
- eas build -p android --profile production

### 4) Submit
- eas submit -p ios --profile production
- eas submit -p android --profile production

---

## C) Final Checklist
- Fill `RELEASE_GO_NO_GO.md` in both repos
- Decision must be GO before public release
