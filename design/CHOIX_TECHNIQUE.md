# DiasporaConnect — Choix techniques pour la finale

**Hackathon :** MIABE 2026 · Phase 3 (Finale)
**Date du document :** 7 mai 2026
**Date de la finale :** 16 mai 2026 (J+9)
**Équipe :** DiasporaConnect — Bénin

---

## 1. Résumé exécutif

Pour la finale, nous livrons un **MVP complet** composé de :

1. Une **application web responsive** servie comme **PWA installable** (Progressive Web App).
2. Un **backend Node.js** orchestrant les transactions Stellar, l'off-ramp Mobile Money et le stockage utilisateur.
3. Un **smart contract Soroban** (langage Rust de Stellar) gérant l'escrow des transferts.
4. Une intégration **Mobile Money via partenaire d'agrégation** (sandbox pour la démo, production cible : Cinetpay, Onafriq ou Bitnob).

**Pas d'app mobile native distincte.** La PWA couvre les 100 % des cas d'usage présentés au jury, est installable en 2 clics sur iOS et Android, et nous permet d'aller en finale avec **un seul code-base** au lieu de trois (web + iOS + Android). Détail au §3.

---

## 2. Stack recommandée

### 2.1 Frontend — application web / PWA

| Couche | Choix | Justification |
|---|---|---|
| Framework | **Next.js 16 (App Router)** | SSR pour le SEO du vitrine + rendu instantané du dashboard ; déjà en place dans la base de code Phase 2. |
| Langage | **TypeScript 5.6** | Sécurité de typage sur les montants, taux et adresses Stellar. |
| Styling | **Tailwind CSS v4** | Itération rapide en hackathon. |
| UI primitives | **Radix UI + shadcn/ui** | Accessibilité native (clavier, ARIA), déjà installé. |
| State | **Zustand** + **React Query** | Zustand pour wallet/auth, React Query pour les transactions et synchro on-chain. |
| Forms | **react-hook-form + zod** | Validation montants / numéros MoMo côté client. |
| Animations | **framer-motion** | Transitions de pages, micro-interactions du wizard d'envoi. |
| Hosting | **Vercel** (frontend) | Déploiement immédiat, edge cache, SSL, prévisualisations PR. |
| PWA | **next-pwa** + **Workbox** | Installable iOS/Android, service worker, offline-first sur les écrans solde et reçus. |

### 2.2 Backend — orchestration et off-ramp

| Couche | Choix | Justification |
|---|---|---|
| Runtime | **Node.js 22 LTS** | Maturité de l'écosystème Stellar SDK, async/await natif. |
| Framework | **Hono** ou **Fastify** | Latence faible, idiomatique TypeScript. (Plus moderne et plus performant qu'Express utilisé en Phase 2.) |
| Base de données | **PostgreSQL 16** (Supabase) | Stockage utilisateurs, KYC light, mappings téléphone↔adresse Stellar, historique enrichi. Supabase nous offre auth + DB + edge functions en une plateforme. |
| ORM | **Drizzle ORM** | Déjà en place. Léger et type-safe. |
| Auth | **Supabase Auth** (magic link + OTP SMS) | Pas de phrase secrète à gérer pour des utilisateurs non-crypto. |
| Files queue | **Inngest** ou **BullMQ + Redis** | Pour le polling Stellar et la coordination off-ramp Mobile Money (jobs asynchrones avec retry). |
| Hébergement | **Railway** ou **Fly.io** | Déploiement Docker, scaling horizontal, PostgreSQL managée. |
| Observabilité | **Sentry** + **Better Stack** | Monitoring d'erreurs et logs centralisés. Indispensable pour un service financier. |

### 2.3 Blockchain — Stellar / Soroban

| Composant | Choix | Justification |
|---|---|---|
| Réseau | **Stellar (Mainnet pour la démo finale, Testnet pendant le dev)** | Décision déjà actée par l'équipe (cf. document `Stellar_choix.docx`). Frais 0,00001 XLM/tx, finalité 4–5 secondes, focus historique sur les remittances. |
| Stablecoin | **USDC** (issued by Circle on Stellar) | Référence USD reconnue, peg stable, intégrée par les anchors africains. |
| Smart contract | **Soroban (Rust)** | Le langage Soroban remplace le contrat Solidity actuel (`contracts/DiasporaConnect.sol`) qui n'est **pas exécutable sur Stellar**. À refaire en Rust. (Voir §6 sur la dette technique.) |
| Anchor (USDC ↔ XOF) | **Cowrie** (sandbox) ou **Tempo Money** | Anchors Stellar opérant déjà sur le corridor Afrique de l'Ouest. |
| SDK frontend | **`@stellar/stellar-sdk`** | Officiel, supporte Soroban. |
| Custody | **Custodial v1** (clé serveur) → **Passkey/MPC v2** | En MVP, l'utilisateur ne gère pas sa clé : nous la stockons côté serveur en HSM logiciel (KMS Supabase). En v2, migration vers Passkeys WebAuthn pour la non-custody. |

### 2.4 Off-ramp Mobile Money (Bénin)

| Option | Modèle | Forces | Faiblesses |
|---|---|---|---|
| **Cinetpay** ⭐ | Agrégateur Côte d'Ivoire/Bénin | API REST simple, sandbox public, MTN MoMo + Moov + Celtiis Cash. | Frais ~1,5 % à compresser. |
| Onafriq (ex MFS Africa) | Agrégateur panafricain | Couverture Bénin officielle, partenariats bancaires | Onboarding partenaire long, KYC entreprise. |
| Bitnob | Crypto + MoMo | Native USDT/USDC ↔ MoMo, 1 API, Nigeria/Ghana/Bénin. | Couverture Bénin moins documentée que Nigeria. |
| Yellow Card | OTC stablecoin | Liquidité USDC profonde | Pas d'API directe MoMo Bénin. |

> **Pour la finale :** nous présenterons l'intégration **Cinetpay en sandbox** pour la démo live (un compte test crédite réellement un wallet MTN MoMo de test). Le pitch mentionne Onafriq/Bitnob en partenaire de production v1.

### 2.5 Notifications

- **Twilio Verify** ou **Firebase OTP** pour l'OTP destinataire au Bénin.
- **WhatsApp Cloud API** pour notifier la diaspora et le destinataire (channel le plus utilisé en Afrique francophone).
- **Web Push** (PWA installée) pour le suivi du transfert en temps réel.

---

## 3. Web vs mobile : pourquoi PWA et pas natif

### 3.1 Le contexte du hackathon

- **9 jours pour livrer le MVP de la finale.** Construire deux apps natives (iOS Swift + Android Kotlin) en plus du backend est mathématiquement impossible.
- Le jury évalue **la démo live et l'impact**, pas le label « app store ». Une PWA installée à l'écran d'accueil rend exactement la même promesse à l'utilisateur — icône, plein écran, push, accès hors ligne.
- Le cadre de référence MIABE Phase 2 a **déjà demandé une « démonstration live de l'application mobile »** : nous l'avions livrée en mode responsive. Continuons sur cette base solide.

### 3.2 Le contexte des utilisateurs

| Diaspora (expéditeur) | Bénin (destinataire) |
|---|---|
| Smartphones modernes (iPhone, Android haut/milieu de gamme). | Smartphones d'entrée de gamme courants : Tecno, Itel, Infinix sous Android Go. |
| Réseau 4G/5G stable. | 3G dominante hors Cotonou ; latences variables. |
| Habitudes : applications téléchargées sur stores. | Habitudes : navigateur Chrome / Opera Mini, parfois Facebook/WhatsApp comme « hub ». |
| Capacité à installer une PWA : **immédiate**. | Capacité à installer une PWA : **immédiate** sur Chrome Android, sans passer par le Play Store (contrainte de bande passante et de quota stockage). |

> Une PWA est en fait **plus adaptée au Bénin qu'une app native :** pas de téléchargement de 50 Mo via réseau saturé, pas de mise à jour manquée, pas de friction Play Store.

### 3.3 Recommandation

**Une seule PWA bilingue, deux interfaces selon le rôle (expéditeur / destinataire).**

- Bundle JS optimisé < 200 Ko (audit Lighthouse > 90).
- Service worker précachant le shell, les transactions, les soldes.
- Installable via la prompt « Ajouter à l'écran d'accueil » (ou bouton custom).
- En **post-finale**, si traction : enrobage **Capacitor** pour soumettre la même base de code au Play Store sans tout recoder. Soumission App Store en v1.5.

---

## 4. Architecture cible

```
                                    ┌─────────────────────────┐
                                    │   Stellar Mainnet        │
                                    │  ┌────────────────────┐  │
                                    │  │  Soroban Contract  │  │
                                    │  │   DC-Escrow.rs     │  │
                                    │  └─────────┬──────────┘  │
                                    │  ┌─────────▼──────────┐  │
                                    │  │ USDC ↔ XOF anchor  │  │
                                    │  │     (Cowrie)       │  │
                                    │  └────────────────────┘  │
                                    └────▲────────────┬───────┘
                                         │            │ (off-ramp call)
                                  Tx submit         ┌─▼──────────────────┐
                                         │          │ Cinetpay / Bitnob  │
   ┌──────────────────┐                  │          │  Mobile Money API  │
   │  PWA Next.js     │   API REST       │          └──────────┬─────────┘
   │  (Vercel)        ├──────────────────┘                     │
   │                  │                                        │
   │  Diaspora & Bénin│                                        ▼
   └────────┬─────────┘                                ┌───────────────┐
            │                                          │  MTN MoMo     │
            │                                          │  Moov Money   │
            ▼                                          │  Celtiis Cash │
   ┌──────────────────┐         ┌──────────────────┐  └───────────────┘
   │ Backend Hono     │  pg     │ PostgreSQL       │
   │ (Railway / Fly)  ├────────►│ (Supabase)       │
   │                  │         └──────────────────┘
   │  - Auth          │         ┌──────────────────┐
   │  - Tx orchestrat │  jobs   │ BullMQ + Redis   │
   │  - KMS (custody) ├────────►│ (Upstash)        │
   │  - Webhooks      │         └──────────────────┘
   └──────────────────┘
```

**Flux d'un transfert (200 €) :**

1. PWA → backend : `POST /transfer` avec montant + destinataire.
2. Backend : prélève EUR via Stripe Connect → achète 216 USDC sur SDEX.
3. Backend signe la transaction Soroban (`contract.send_money(beneficiary, 216 USDC)`).
4. Smart contract bloque les fonds, émet `TransferSent` event.
5. Webhook Horizon (Stellar) → backend confirme le ledger.
6. Backend appelle anchor Cowrie → conversion 216 USDC → 131 100 XOF.
7. Backend appelle Cinetpay → crédit Moov Money de Edwige (+229 96 14 88 02).
8. Webhook Cinetpay → backend marque la transaction « completed », notifie l'utilisateur (Push + WhatsApp).
9. Hash Stellar et référence Cinetpay enregistrés en DB pour la vue « Détail transaction ».

**Latence cible bout-en-bout : 30 secondes.**

---

## 5. Sécurité et conformité

| Sujet | Approche |
|---|---|
| Custody des clés | KMS chiffré (Supabase Vault) ; clés déchiffrées en mémoire le temps de signer la tx. **Pas de clé exposée au navigateur en v1.** |
| KYC | Niveau 1 (lite) à l'inscription : email + téléphone + selfie. Niveau 2 pour transferts > 1 000 € : pièce d'identité (intégration Veriff ou SumSub). |
| Limites | 1 000 €/tx, 5 000 €/mois en v1 (limites BCEAO sur les transferts). |
| RGPD | Hébergement EU (Vercel Frankfurt + Supabase EU). Page de droit à l'oubli. |
| Audit du contrat | Audit léger interne avant la finale ; audit externe (CertiK, Hacken) post-financement. |
| Anti-fraude | Blocage géo (IP du destinataire ≠ Bénin déclenche 2FA), seuils dynamiques, blacklist d'adresses. |
| Réversibilité | Le smart contract conserve un délai de 24 h durant lequel l'expéditeur peut révoquer si le destinataire n'a pas confirmé l'OTP — protection contre l'erreur de saisie. |

---

## 6. Dette technique à résorber avant la finale

Issues identifiées dans le code Phase 2 (`/diasporat-connect`) :

1. **Contrat Solidity à remplacer.** `contracts/DiasporaConnect.sol` est en Solidity (EVM) — incompatible avec Stellar. **À réécrire en Rust/Soroban**. (Tâche J1–J3, voir plan.)
2. **Mock blockchain à brancher au réseau réel.** `src/lib/mockBlockchain.ts` simule les transactions. Il faut basculer sur `@stellar/stellar-sdk` connecté au Testnet, puis Mainnet le jour J.
3. **Auth contextuelle inadaptée pour le KYC.** `src/contexts/AuthContext.tsx` stocke utilisateur dans localStorage — à remplacer par Supabase Auth.
4. **Off-ramp absent.** Aucune intégration Cinetpay/Onafriq encore — c'est le chantier J4–J6.
5. **Pas de notifications push.** Service worker absent, pas de Workbox configuré.
6. **Pas de tests end-to-end.** Au minimum, un test Playwright du parcours complet pour la démo live.

---

## 7. Référence rapide pour la présentation

**Slide « Architecture technique finale » (1 minute du pitch) :**

> Notre stack repose sur trois piliers. Côté utilisateur : une PWA installable construite avec Next.js 16, déployée sur Vercel — un seul code-base pour la diaspora et le Bénin, qui s'installe en 2 clics sans passer par les stores. Côté blockchain : Stellar Mainnet avec un smart contract Soroban en Rust qui bloque les fonds en USDC et les libère au destinataire, pour un coût réseau de 0,00001 XLM par transfert et une finalité en 4 secondes. Côté off-ramp : intégration Cinetpay qui dépose les XOF directement sur MTN MoMo, Moov Money ou Celtiis Cash. Bout-en-bout, un transfert de 200 € arrive sur le téléphone d'Edwige à Porto-Novo en moins de 30 secondes, pour 0,40 € de frais — contre 17,68 € chez Western Union.

---

## 8. Estimation des coûts opérationnels

| Poste | Coût/mois (MVP) | Notes |
|---|---|---|
| Vercel Pro | $20 | Frontend |
| Railway Hobby | $20 | Backend |
| Supabase Pro | $25 | Auth + DB + Vault |
| Upstash Redis | $10 | Queues |
| Sentry | $26 | Error monitoring |
| Twilio (OTP) | $30 | ~1 000 OTP/mois |
| Stellar fees | ~$1 | Pour 100k transferts ! |
| Anchor margin | 0,1–0,3 % du volume | Coût variable |
| **Total fixe** | **≈ $130/mois** | Couvre jusqu'à ~10 000 utilisateurs actifs |

À comparer aux ~70 millions USD que nous redistribuons annuellement aux familles béninoises sur 500 M$ de volume corridor.

---

## 9. Ce qui n'est PAS dans le périmètre du MVP

À écarter explicitement pour tenir les 9 jours :

- ❌ Mode non-custodial (Passkeys WebAuthn) — v2.
- ❌ App native iOS/Android sur les stores — v1.5 via Capacitor.
- ❌ Multi-devises (CDF, NGN, GHS) — v2, le Bénin est notre corridor de référence.
- ❌ DeFi yield sur les soldes en attente — v2.
- ❌ Cards Visa virtuelles pour la diaspora — v3.
- ❌ Audit externe du smart contract — post-financement.

Ces choix protègent la qualité de la démo. Les mentionner explicitement dans le pitch montre au jury que **nous savons cadrer un MVP**.
