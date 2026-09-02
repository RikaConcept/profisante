# Caisse de la Palmeraie

Outil de suivi d'une plantation de palmiers gérée en commun : cotisations des
membres (au prorata de leur superficie), caisse et mouvements, salaire et
planning du manœuvre, appels de fonds exceptionnels. Pensé pour être ouvert
sur un téléphone depuis un lien WhatsApp, par le trésorier comme par les
membres.

## Ce que fait l'outil

| Onglet | Contenu |
|---|---|
| **Tableau de bord** | Solde en caisse, entrées/sorties du mois, arriérés, situation de chaque membre, avancement du manœuvre, équilibre cotisations / charges. |
| **Caisse** | Registre de tous les mouvements avec solde après chaque ligne, résumé mensuel, **rapport du mois prêt à coller dans WhatsApp**, export CSV. |
| **Membres** | Superficie, cotisation mensuelle, dû / payé / solde, détail mois par mois, encaissement en un clic. |
| **Manœuvre** | Salaire mensuel, paiement du mois, planning des tâches par semaine (prévue / faite / non faite), recopie du mois précédent. |
| **Appels de fonds** | Dépense exceptionnelle répartie automatiquement au prorata des superficies, suivi de qui a payé sa part. |
| **Payer** | Espace des membres : total à régler ce mois-ci, numéro Mobile Money et moyens acceptés, message WhatsApp prérempli pour prévenir le trésorier, tableau des charges en cours de tous. |
| **Réglages** | Taux par hectare, premier mois du suivi, solde de départ, sauvegarde / restauration JSON. |

### Règles de calcul

- **Cotisation mensuelle** d'un membre = superficie (ha) × taux par hectare,
  sauf si une cotisation fixe est renseignée pour lui.
- **Dû** = cotisation × nombre de mois depuis le début du suivi (mois en
  cours inclus) + sa part des appels de fonds.
- **Part d'un appel de fonds** = montant total × superficie du membre ÷
  superficie totale des membres actifs.
- **Solde d'un membre** = payé − dû (négatif : reste à payer).
- **Solde en caisse** = solde de départ + entrées − sorties.
- Le **rapport mensuel** regroupe les opérations par date ; le « mois
  concerné » d'un paiement sert uniquement à l'imputer sur la bonne mensualité
  du membre.

### Mode trésorier

La page s'ouvre en consultation : aucune commande de saisie. Le bouton
« Je suis le trésorier » demande un code (Réglages → Accès, `1234` au
départ) et affiche toutes les commandes : actions rapides du tableau de
bord (cotisation reçue, salaire du manœuvre, entretien de la plantation,
achat, frais), encaissements, planning. Ce code masque l'interface ; le
droit d'enregistrer réel est celui du partage de la page.

## Où vivent les données

Le build produit **un seul fichier HTML** (`dist/index.html`) qui contient
l'application et son état. Deux modes, détectés automatiquement :

- **Page partagée claude.ai (mode `artifact`)** — le fichier est publié comme
  artefact. Chaque enregistrement republie la page avec le nouvel état
  (capacité `artifact`) : tous ceux qui ont le lien voient la dernière
  version. Seules les personnes ayant le droit d'écriture sur l'artefact
  (le trésorier) peuvent enregistrer ; les autres sont automatiquement en
  consultation seule.
- **Hébergement classique ou fichier ouvert localement (mode `local`)** —
  l'état est conservé dans le `localStorage` du navigateur. Utile pour
  tester ; pour un usage partagé il faudrait brancher un stockage serveur
  (l'adaptateur est isolé dans `src/storage/index.ts`).

Dans les deux cas, **Réglages → Exporter une sauvegarde** produit un JSON
complet réimportable.

## Développement

```bash
npm install
npm run dev        # http://localhost:5173, mode local
npm run build      # typecheck + build + dist/index.html et dist/artifact.html
```

`dist/artifact.html` est la version « contenu seul » à donner à l'outil
Artifact de Claude ; `dist/index.html` est le document complet, hébergeable
n'importe où.

### Structure

```
src/
  types.ts            modèle de données (membres, manœuvres, tâches, appels, mouvements)
  data/seed.json      état de départ (voir « Données initiales »)
  lib/calc.ts         tous les calculs (situations, soldes, résumés mensuels)
  lib/report.ts       rapport WhatsApp et export CSV
  lib/format.ts       formats FCFA, mois, dates
  storage/index.ts    chargement / enregistrement (artifact ou localStorage)
  components/         pages et formulaires
scripts/build-artifact.mjs   post-traitement du build
```

## Données initiales

`src/data/seed.json` reprend les rapports de juin et juillet 2026
(cotisations de Papa, Willy, Constant, Couple Gragbo ; salaire de Mohamed
100 000 FCFA ; frais 1 000 FCFA). Le solde recalculé — **148 450 FCFA** —
correspond au rapport de juillet.

Hypothèses à corriger dans l'application (les superficies réelles n'étaient
pas connues) :

- taux de 25 000 FCFA par hectare et par mois ;
- Papa, Willy et Couple Gragbo : 2 ha ; Constant : 1 ha ;
- suivi des cotisations à partir de juin 2026 ;
- tâches de septembre 2026 données à titre d'exemple.
