# Plan 9 jours — sprint vers la finale MIABE 2026

**Aujourd'hui :** mercredi 7 mai 2026
**Finale :** vendredi 16 mai 2026 (Cotonou)
**Jours restants :** 9 (dont 2 week-end)

---

## Principes de ce sprint

1. **Une démo live qui marche bout-en-bout > beaucoup de fonctionnalités à moitié.** Un seul corridor (Paris → Porto-Novo), une seule paire (€ → XOF), un seul opérateur testé (Moov Money) — mais ça marche et c'est filmé.
2. **On ne touche plus la palette de design ni les flux après J6.** Les jours 7–9 sont consacrés à la répétition du pitch, à la correction des bugs et au tournage de la vidéo de pitch.
3. **Toujours avoir un fallback démo.** Si la connexion Wi-Fi du jury est mauvaise, on doit pouvoir basculer sur un mode démo enregistré en 30 secondes.

---

## Calendrier

### Jeudi 8 mai — J1 · Smart contract Soroban (Rust)

**Owner :** lead blockchain
**Livrable :** `contracts-soroban/dc_escrow.rs` déployé sur Stellar Testnet.

- [ ] Réécrire le contrat Solidity en Rust/Soroban : `init`, `send_money(beneficiary, amount, memo)`, `confirm_receipt()`, `refund_after_timeout()`.
- [ ] Déployer sur Testnet via `soroban contract deploy`.
- [ ] Documenter l'adresse du contrat et l'ABI.
- [ ] Tester un appel `send_money` depuis stellar-cli.

### Vendredi 9 mai — J2 · Backend orchestration v1

**Owner :** lead backend
**Livrable :** API Hono qui crée une tx Soroban depuis une requête HTTP.

- [ ] Setup projet Hono + Drizzle + Supabase.
- [ ] Endpoint `POST /transfers` qui : valide le payload, crée une row DB, signe et envoie une tx Soroban, renvoie le hash.
- [ ] KMS minimaliste : clés serveur stockées dans Supabase Vault.
- [ ] Endpoint `GET /transfers/:id` pour le suivi.
- [ ] Webhook Horizon pour mise à jour des statuts (polling toutes les 5 s en fallback).

### Samedi 10 mai — J3 · Brancher la PWA au backend réel

**Owner :** lead frontend
**Livrable :** Le wizard d'envoi (écran 03) crée une vraie tx Stellar Testnet.

- [ ] Remplacer `mockBlockchain.ts` par un client API qui parle au backend Hono.
- [ ] Brancher React Query sur les endpoints `/transfers`.
- [ ] Implémenter les écrans 02 (dashboard expéditeur) et 03 (envoi) à partir des maquettes finales.
- [ ] Stripe Connect en sandbox pour le débit EUR (mode démo : on autorise 5 € de carte test, on simule le reste).
- [ ] Tests manuels du flow expéditeur.

### Dimanche 11 mai — J4 · Wallet destinataire + Cinetpay sandbox

**Owner :** binôme front+back
**Livrable :** Edwige reçoit réellement des XOF de test sur un compte Moov Money sandbox.

- [ ] Implémenter écrans 05 (wallet) et 06 (retrait) à partir des maquettes.
- [ ] Setup compte Cinetpay sandbox + clés API.
- [ ] Endpoint `POST /withdrawals` qui appelle Cinetpay et renvoie un identifiant de paiement.
- [ ] Webhook Cinetpay → mise à jour DB.
- [ ] Premier test bout-en-bout : depuis le navigateur diaspora, envoi de 200 € → Edwige voit son solde XOF augmenter → elle retire sur Moov sandbox.

### Lundi 12 mai — J5 · Confirmation & détail (preuves blockchain)

**Owner :** lead frontend
**Livrable :** L'écran de confirmation montre le hash réel et le timeline mis à jour live.

- [ ] Implémenter écran 04 (confirmation post-envoi) et 07 (détail transaction).
- [ ] Polling React Query pour le timeline en temps réel.
- [ ] Génération PDF du reçu (côté serveur, `@react-pdf/renderer`).
- [ ] QR code → URL stellar.expert publique.
- [ ] Lien partageable WhatsApp avec aperçu Open Graph.

### Mardi 13 mai — J6 · Onboarding, KYC light, PWA shell

**Owner :** lead frontend + design
**Livrable :** Inscription, login OTP, PWA installable.

- [ ] Implémenter écran 01 (onboarding/login) avec Supabase Auth.
- [ ] OTP SMS via Twilio Verify.
- [ ] KYC light : email vérifié + téléphone vérifié + nom légal.
- [ ] Service worker + manifest + icônes 192/512 → PWA installable.
- [ ] Lighthouse audit > 90 sur Performance, PWA, Accessibility.
- [ ] **Gel des fonctionnalités** à 23h59.

### Mercredi 14 mai — J7 · Hardening + données de démo

**Owner :** toute l'équipe
**Livrable :** Compte de démo prêt pour le jury, mode offline-fallback.

- [ ] Créer 4 comptes de démo (2 expéditeurs, 2 destinataires) avec historique pré-rempli.
- [ ] Mode « démo » : un toggle qui simule le réseau si l'API échoue (pour la sécurité du pitch live).
- [ ] Tests Playwright du parcours complet.
- [ ] Migration **Testnet → Mainnet** (avec un capital Stellar minimum pour les frais).
- [ ] Bouchons MoMo : si Cinetpay sandbox tombe le jour J, basculement sur un mock qui finit la tx avec succès en 5 s.

### Jeudi 15 mai — J8 · Documentation et vidéo de pitch

**Owner :** product owner
**Livrable :** Tous les fichiers de la Phase 3 sont prêts pour Drive.

- [ ] Documentation technique PDF (à partir de ce document).
- [ ] Guide utilisateur PDF (8 pages, captures + texte court).
- [ ] Vidéo de pitch 10 min : 1 prise, screencast + voix off, structure exacte de la grille MIABE.
- [ ] Soumission Phase 3 sur Drive ET 4hacks.
- [ ] Test du lien public Drive en navigation privée.

### Vendredi 16 mai — J9 · Finale Cotonou

**Owner :** présentateur
**Livrable :** Pitch live de 7 minutes selon la grille phase 3 :

| Section | Durée | Slide / écran |
|---|---|---|
| 1. Rappel du projet et parcours | 30 s | Slide 1 (impact corridor) |
| 2. Démonstration live du MVP complet | 2 min 30 | Démo navigateur (envoi + retrait MoMo) |
| 3. Architecture technique finale | 1 min | Slide architecture (§4 du choix technique) |
| 4. Impact et données chiffrées | 1 min | Slide chiffres (€70–100M restitués/an) |
| 5. Plan de déploiement réaliste | 1 min | Slide roadmap (v1 corridor BJ → v2 multi-pays) |
| 6. Conclusion et vision | 1 min | Slide vision (ODD 1, 8, 10) |

**Plan B au cas où :**

- Pas de Wi-Fi → vidéo enregistrée la veille (J8) en backup.
- Cinetpay sandbox tombe → mode démo activé.
- Stellar congestion → utiliser le hash d'un transfert effectué la veille.

---

## Distribution du travail

| Rôle | Personne | J1 | J2 | J3 | J4 | J5 | J6 | J7 | J8 |
|---|---|---|---|---|---|---|---|---|---|
| Lead blockchain | XX | 🔥 | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ |
| Lead backend | XX | | 🔥 | ◯ | 🔥 | ◯ | ◯ | ◯ | ◯ |
| Lead frontend | XX | | | 🔥 | ◯ | 🔥 | 🔥 | ◯ | ◯ |
| Design / produit | XX | | | | ◯ | ◯ | 🔥 | 🔥 | 🔥 |
| Pitch / contenu | XX | | | | | | | ◯ | 🔥 |

🔥 = lead du jour · ◯ = en support

---

## Liste de courses (avant J1)

À régler **avant ce soir** :

- [ ] Comptes Cinetpay et Stripe Connect créés (si pas déjà fait).
- [ ] Clé API Twilio Verify.
- [ ] Compte Vercel Pro et Railway/Fly.
- [ ] Domaine `diasporaconnect.app` et SSL.
- [ ] Compte Stellar Mainnet financé avec ~5 XLM (≈ 0,5 €).
- [ ] WhatsApp Business pour la notification destinataire.
- [ ] Numéros MoMo de test (un par opérateur) chargés.
