# Application de presence - Commission Administrative

Application web locale de prise de presence pour la Commission Administrative (CA) de l'association : 9 sections, 3 membres CA par section (27 membres au total), et 3 activites hebdomadaires (personnalisables).

Toutes les donnees (sections, membres, activites, utilisateurs, presences) sont stockees dans un unique fichier Excel local : `data/attendance.xlsx`. Ce fichier est cree automatiquement au premier demarrage.

## Installation

```bash
npm install
npm start
```

L'application est accessible sur http://localhost:3000

## Comptes crees par defaut

| Role | Identifiant | Mot de passe |
|---|---|---|
| Super administrateur | `admin` | `admin123` |
| Referent Section 1 | `section1` | `section123` |
| Referent Section 2 | `section2` | `section123` |
| ... | `section3` a `section9` | `section123` |

**Important : changez ces mots de passe des la premiere connexion** via le Back-Office (`Utilisateurs` > `Reinitialiser mot de passe`), accessible uniquement au super administrateur.

## Fonctionnement

### Compte "referent de section" (9 comptes)
- Saisit la presence des 3 membres CA de sa section, pour une date et une activite donnees.
- Consulte l'historique des presences de sa propre section.
- N'a pas acces au Back-Office.

### Compte super administrateur
Seul ce compte voit le **Back-Office (BO)** :
- **Tableau de bord** : indicateurs cles (nombre de sections, membres, activites, taux de presence global) et taux par section / par activite.
- **Rapport detaille** : filtrage par section, activite, membre et periode, avec detail ligne par ligne de chaque saisie, et **export Excel** du rapport filtre.
- **Gestion des sections** : ajout / suppression.
- **Gestion des membres CA** : ajout / modification / suppression, affectation a une section.
- **Gestion des activites** : definition des 3 (ou plus) activites hebdomadaires (nom, jour, heure), activation/desactivation.
- **Gestion des utilisateurs** : creation de comptes (referent de section ou super admin), reinitialisation de mot de passe, suppression.
- **Export du fichier Excel brut** : telechargement direct de `data/attendance.xlsx`.

## Structure des donnees (fichier Excel)

Le fichier `data/attendance.xlsx` contient 5 feuilles :
- `Sections` : id, nom
- `Membres` : id, sectionId, nom
- `Activites` : id, nom, jour, heure, actif
- `Utilisateurs` : id, username, passwordHash, role, sectionId, nomAffichage
- `Presences` : id, date, activiteId, membreId, present, remarque, saisiPar, saisiLe

Le fichier est mis a jour a chaque saisie ou modification depuis l'application. Il peut aussi etre ouvert directement dans Excel/LibreOffice pour consultation (fermez-le avant toute nouvelle saisie dans l'application pour eviter les conflits d'ecriture).

## Sauvegarde

Le fichier `data/attendance.xlsx` est exclu du depot Git (`.gitignore`) car il contient les donnees reelles de l'association et les mots de passe hashes des utilisateurs. Pensez a le sauvegarder regulierement (copie du fichier).
