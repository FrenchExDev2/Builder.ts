<p align="center">
  <img src="./icons/logo.png" alt="QuietCli logo" width="150px" />
</p>

# Builder — monorepo TypeScript

Ce monorepo sépare la bibliothèque, son vocabulaire métier, sa spécification et ses tests. Il répond à « pourquoi cette ligne existe ? » par des liens consultables vers les features, les requirements et les preuves disponibles.

Les quatre packages vivent sous `packages/`. Un seul workspace pnpm (`packages/*`), un catalogue d’outils commun et un seul `pnpm-lock.yaml` à la racine suivent la structure du monorepo Requirements.ts. Les dépendances internes utilisent `workspace:*`.

| Projet | Package npm | Rôle |
|---|---|---|
| [Builder.SharedKernel.ts](packages/Builder.SharedKernel.ts/) | `@frenchexdev2/builder-shared-kernel` | Identités stables et marquage |
| [Builder.ts](packages/Builder.ts/) | `@frenchexdev2/builder` | Runtime, générateur et exemples |
| [Builder.Requirements.ts](packages/Builder.Requirements.ts/) | `@frenchexdev2/builder-requirements` | Requirements, justifications, features et AC |
| [Builder.Tests.ts](packages/Builder.Tests.ts/) | `@frenchexdev2/builder-tests` | Régression, conformité, couverture et mutation |

## Développement local

PowerShell Core 7.6+, Node.js 22.22+ et pnpm 11.20.0. Les autres workspaces restent distincts. Les dépendances sont installées depuis npmjs.org ; voir [RELEASE.md](RELEASE.md) pour leur première publication et les tags de release :

```powershell
pnpm install --frozen-lockfile
pnpm build
./packages/Builder.Tests.ts/scripts/Invoke-Validation.ps1 -Phase Tests
./packages/Builder.Tests.ts/scripts/Invoke-Validation.ps1 -Phase Mutation
./packages/Builder.Tests.ts/scripts/Invoke-Validation.ps1 -Phase Linux
./packages/Builder.Tests.ts/scripts/Invoke-Validation.ps1 -Phase VSCode
```

Les lanceurs de validation démarrent un worker et une fenêtre de suivi visible ; ils retournent le dossier de résultats et la commande de réouverture. La fenêtre se ferme après sauvegarde de l’état terminal. Aucun test ne reste dans le package de bibliothèque.

La découverte des tests, la couverture et les mutations ciblent les sources des projets, hors de `node_modules`. La phase `Distribution` installe les archives npm et lance une fixture de consommation extérieure à `node_modules`, qui vérifie les exports publics compilés sans instrumenter les dépendances.

Les dépendances entre les quatre packages utilisent `workspace:*`. Les dépendances Result, CodeGenerationPipeline et Requirements utilisent des versions npm explicites, sans overrides vers des archives locales. La CI construit et teste sous Windows et Linux avant toute publication sur tag.

## Marquer et expliquer du code

```typescript
import { BuilderFeatures, ParticipatesIn } from '@frenchexdev2/builder-shared-kernel';

@ParticipatesIn(BuilderFeatures.Concurrency)
class SharedConstruction {
  execute() {
    // @rac-feature BUILDER-CONCURRENCY
    return this;
  }
}
```

Les méthodes peuvent également porter le décorateur standard. Pour un bloc, utiliser `// @rac-feature-begin FEATURE-ID` et `// @rac-feature-end FEATURE-ID`, avec fermeture dans l’ordre inverse des ouvertures imbriquées. Un marqueur simple s’applique à l’instruction AST suivante. Les chaînes et exemples contenant du texte ressemblant à un marqueur ne constituent pas une annotation.

Le fichier [.requirements.json](.requirements.json) déclare les racines de sources, la spécification et les preuves. Avec le CLI RaC construit :

```powershell
requirements trace explain packages/Builder.ts/src/abstract-builder.ts:50 --json
```

L’extension [Requirements.VsCode](../../../VsCode/FrenchExDev/Requirements.VsCode/) ajoute les commandes **Expliquer ce code**, **Marquer comme participant à une feature**, le survol, les CodeLens et la vue de navigation. L’indexation ne lance ni tests ni mutations.

## Interpréter les liens et les preuves

- Un requirement exprime le besoin et sa justification. Les exigences rétroconçues restent `Draft` : aucune approbation du métier n’est déduite du code.
- Une annotation déclare une participation ; elle ne démontre pas la correction ni la nécessité d’une ligne.
- Un test vérifie un AC. Une exécution réussie, la couverture observée et la détection de mutants sont des preuves distinctes.
- Les preuves sont associées à des versions, configurations et SHA-256. Une modification des entrées les rend périmées ; une absence de preuve reste explicite.
- L’analyse d’impact décrit les relations connues, sans prétendre reconstruire toutes les dépendances dynamiques.

Les identifiants de features sont définis uniquement dans le kernel métier. Les AC sont définis dans les classes de spécification ; le JSON distribué est dérivé de ces déclarations. Une dépréciation doit annoncer un remplacement lorsque disponible ; les références restantes produisent un diagnostic.

## Distribution

Les quatre packages sont préparés pour des publications distinctes, et l’extension pour un VSIX. Les archives doivent être vérifiées dans un consommateur isolé. La publication npm est effectuée par le workflow sur tag décrit dans [RELEASE.md](RELEASE.md). Les scripts de validation ne publient pas sur Marketplace. Voir les licences de chaque projet.

Voir le [bilan de validation du monorepo](VALIDATION.md) pour les campagnes, les artefacts et les limites d’attribution des mutations.
