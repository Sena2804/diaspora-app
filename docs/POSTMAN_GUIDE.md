# Guide Postman — Tester le backend DiasporaConnect

Ce guide te fait tester le flow complet d'un transfert en 7 requêtes Postman.

---

## Pré-requis

1. **Le serveur dev tourne** :
   ```bash
   cd ~/Bureau/MiabeHackaton/diaspora-app
   npm run dev
   ```
   Tu dois voir « ✓ Ready in XXXms » et `Local: http://localhost:3000`.

2. **Désactiver la confirmation email** (sinon tu dois cliquer un lien dans ta boîte mail entre Sign up et Sign in). Dans Supabase Dashboard :
   - **Auth → Providers → Email**
   - Décoche **« Confirm email »**
   - Save

3. **Récupérer 2 valeurs depuis Supabase Dashboard → Settings → API** :
   - **Project URL** (ex : `https://ctaxobblvnzsgifrzpjh.supabase.co`)
   - **anon public key** (la longue clé `eyJ...` côté « anon »)

---

## Variables Postman à créer

Dans Postman, crée une **Environment** appelée `DiasporaConnect Local` avec :

| Variable | Valeur initiale |
|---|---|
| `SUPABASE_URL` | `https://ctaxobblvnzsgifrzpjh.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOi...` (la clé anon) |
| `APP_URL` | `http://localhost:3000` |
| `access_token` | *(vide, sera rempli automatiquement)* |
| `beneficiaire_id` | *(vide, sera rempli automatiquement)* |
| `transfert_id` | *(vide, sera rempli automatiquement)* |

Active cette environment en haut à droite de Postman.

---

## Étape 1 — Sign up (créer un utilisateur de test)

**Requête** :
- Méthode : `POST`
- URL : `{{SUPABASE_URL}}/auth/v1/signup`

**Headers** :
| Key | Value |
|---|---|
| `apikey` | `{{SUPABASE_ANON_KEY}}` |
| `Content-Type` | `application/json` |

**Body** (raw JSON) :
```json
{
  "email": "premicia.test@diasporaconnect.app",
  "password": "TestPass2026!"
}
```

**Réponse attendue (200)** :
```json
{
  "id": "uuid-xxxx",
  "email": "premicia.test@diasporaconnect.app",
  ...
  "access_token": "eyJhbGciOi...",
  ...
}
```

> ⚠️ Si tu vois `"signup is disabled"`, va dans Supabase Dashboard → Auth → Settings → User Signups → enable.
> ⚠️ Si tu vois un email de confirmation requise, c'est que tu n'as pas désactivé la confirmation à l'étape 2 du pré-requis.

---

## Étape 2 — Sign in (récupérer le token JWT)

**Requête** :
- Méthode : `POST`
- URL : `{{SUPABASE_URL}}/auth/v1/token?grant_type=password`

**Headers** :
| Key | Value |
|---|---|
| `apikey` | `{{SUPABASE_ANON_KEY}}` |
| `Content-Type` | `application/json` |

**Body** :
```json
{
  "email": "premicia.test@diasporaconnect.app",
  "password": "TestPass2026!"
}
```

**Onglet Tests (Postman)** — pour stocker auto le token :
```js
const data = pm.response.json();
pm.environment.set("access_token", data.access_token);
console.log("Token saved");
```

**Réponse attendue** :
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "user": { "id": "...", "email": "..." }
}
```

Le `Tests` script aura sauvegardé l'access_token dans la variable Postman.

---

## Étape 3 — Vérifier que mon profil a été créé automatiquement

Notre trigger SQL `handle_new_user` crée une ligne dans `profiles` dès qu'un user `auth.users` est créé.

**Requête** :
- Méthode : `GET`
- URL : `{{SUPABASE_URL}}/rest/v1/profiles?select=*`

**Headers** :
| Key | Value |
|---|---|
| `apikey` | `{{SUPABASE_ANON_KEY}}` |
| `Authorization` | `Bearer {{access_token}}` |

**Réponse attendue** : un tableau avec ta ligne profile (`role: 'expediteur'`).

---

## Étape 4 — Créer un bénéficiaire (notre API)

**Requête** :
- Méthode : `POST`
- URL : `{{APP_URL}}/api/beneficiaires`

**Headers** :
| Key | Value |
|---|---|
| `Authorization` | `Bearer {{access_token}}` |
| `Content-Type` | `application/json` |

**Body** :
```json
{
  "full_name": "Edwige MENSAH",
  "phone": "+22997123456",
  "operator": "moov",
  "country": "BJ"
}
```

**Onglet Tests** (pour stocker l'ID auto) :
```js
const data = pm.response.json();
pm.environment.set("beneficiaire_id", data.id);
console.log("Beneficiaire saved:", data.id);
```

**Réponse attendue (201)** :
```json
{
  "id": "uuid-xxxx",
  "full_name": "Edwige MENSAH",
  "phone": "+22997123456",
  "operator": "moov",
  "country": "BJ",
  "created_at": "2026-05-11T..."
}
```

---

## Étape 5 — Lister mes bénéficiaires

**Requête** :
- Méthode : `GET`
- URL : `{{APP_URL}}/api/beneficiaires`

**Headers** :
| Key | Value |
|---|---|
| `Authorization` | `Bearer {{access_token}}` |

**Réponse attendue** :
```json
{ "items": [ { "id": "...", "full_name": "Edwige MENSAH", ... } ] }
```

---

## Étape 6 — Créer un transfert (le cœur du test)

**Requête** :
- Méthode : `POST`
- URL : `{{APP_URL}}/api/transferts`

**Headers** :
| Key | Value |
|---|---|
| `Authorization` | `Bearer {{access_token}}` |
| `Content-Type` | `application/json` |

**Body** :
```json
{
  "beneficiaire_id": "{{beneficiaire_id}}",
  "amount_eur": 200
}
```

**Onglet Tests** :
```js
const data = pm.response.json();
pm.environment.set("transfert_id", data.id);
console.log("Transfert saved:", data.id);
```

**Réponse attendue (201)** :
```json
{
  "id": "uuid-xxxx",
  "amount_eur": 200,
  "amount_xof": 130928,
  "fee_eur": 0.40,
  "status": "pending",
  "created_at": "2026-05-11T...",
  "payment": {
    "destination": "GBUSNTA27ZEVHRPZB2IAPGSSFFPRR7WCYXTEPUPSWHLUTZH64WQCNTMY",
    "asset": "USDC",
    "amount": "200.0000000",
    "memo": "xxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

**Ce qui vient de se passer** :
- On a calculé : `fee_eur = 200 × 0.2% = 0.40 €` → `net_eur = 199.60 €` → `amount_xof = 199.60 × 655.957 = 130 928 XOF`
- La row a été créée en DB avec `status='pending'`
- Le bloc `payment` indique au frontend : "envoie 200 USDC à cette adresse, avec ce memo"

---

## Étape 7 — Lister mes transferts

**Requête** :
- Méthode : `GET`
- URL : `{{APP_URL}}/api/transferts?limit=5`

**Headers** :
| Key | Value |
|---|---|
| `Authorization` | `Bearer {{access_token}}` |

**Réponse attendue** :
```json
{
  "items": [
    {
      "id": "uuid-xxxx",
      "amount_eur": 200,
      "amount_xof": 130928,
      "status": "pending",
      ...
      "beneficiaire": { "id": "...", "full_name": "Edwige MENSAH", ... }
    }
  ]
}
```

---

## Comment vérifier qu'un test a échoué et pourquoi

| Code HTTP | Sens probable |
|---|---|
| `401 UNAUTHENTICATED` | Le `Authorization: Bearer {{access_token}}` est manquant ou expiré. Refais l'étape 2 pour rafraîchir le token. |
| `400 INVALID_INPUT` | Body JSON invalide (champ manquant, format incorrect). Le message d'erreur dit lequel. |
| `404 BENEFICIAIRE_NOT_FOUND` | L'ID du bénéficiaire n'existe pas OU n'appartient pas à l'utilisateur connecté (RLS). |
| `500 INSERT_FAILED` | Problème côté base de données. Regarde la console `npm run dev` pour le détail. |

---

## Bonus — Tester sans Postman, en ligne de commande

```bash
# Sign in
TOKEN=$(curl -s -X POST "https://ctaxobblvnzsgifrzpjh.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"premicia.test@diasporaconnect.app","password":"TestPass2026!"}' \
  | jq -r '.access_token')

# Liste les transferts
curl -s "http://localhost:3000/api/transferts" \
  -H "Authorization: Bearer $TOKEN" | jq
```
