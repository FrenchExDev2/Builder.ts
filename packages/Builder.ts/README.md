<p align="center">
  <img src="../../icons/logo.png" alt="QuietCli logo" width="150px" />
</p>

# @frenchexdev2/builder

Package TypeScript ESM pour générer des builders fluides à partir de classes
annotées avec `@HasBuilder`. `BuildAsync()` retourne directement un
`Result<T, ValidationErrors>`, avec validations synchrones ou asynchrones.
Le package conserve également ses builders manuels avec références différées.

Cette adaptation reprend les mécanismes décrits dans
[Builder Pattern — Creational pattern](https://serard.dev/content/blog/builder-pattern.html#the-builder-pattern-a-comprehensive-guide-to-fluent-object-construction-in-net).
Elle utilise la monade du package compagnon `@frenchexdev2/result`.

## Installation locale

Prérequis : Node.js 22+, pnpm, TypeScript 5.9+. `Result.Ts` possède son propre
workspace ; le script de préparation lit son paquet dans
`../Result.Ts/packages/Result.Ts` et en crée une archive locale pour Builder.
Depuis la racine du monorepo Builder :

```powershell
./scripts/Prepare-LocalPackages.ps1
pnpm --filter '@frenchexdev2/builder...' -r run build
```

Les archives locales de Result et du pipeline sont sélectionnées par les
overrides du workspace Builder ; les liens `workspace:*` relient ses propres paquets. Pour un
consommateur distribué, fournir `@frenchexdev2/result` version `^0.1.0` comme
dépendance paire et `@frenchexdev2/ts-codegen-pipeline` version `^0.0.1` comme
dépendance de développement pour la génération. Aucun package n'est publié par
ces commandes. Le pipeline est un peer facultatif ; l'entrée runtime du builder
ne l'importe pas, et n'importe ni TypeScript ni ts-morph.

## Générer un builder avec HasBuilder

```typescript
import { HasBuilder } from '@frenchexdev2/builder';
import {
  success, validationError, validationFailure,
  type Result, type ValidationErrors,
} from '@frenchexdev2/result';

function validateUser(user: Readonly<User>): Result<void, ValidationErrors> {
  return user.email.includes('@')
    ? success()
    : validationFailure(validationError('Email invalide', ['email']));
}

@HasBuilder<User>({ name: 'UserBuilder', validators: [validateUser] })
export class User {
  constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly role = 'reader',
  ) {}
}
```

`name` est facultatif : `@HasBuilder<User>({ validators: [validateUser] })`
génère également `UserBuilder`. `@HasBuilder()` fonctionne sans règles métier.
Ce sont les décorateurs standard TypeScript ; ne pas activer
`experimentalDecorators` ni `emitDecoratorMetadata` pour ces classes.

### Utiliser le code généré

Pour une classe dans `src/user.ts`, importer son fichier compagnon :

```typescript
import { UserBuilder } from './generated/user/UserBuilder.generated.js';
import type { User } from './user.js';
import {
  success, validationError, validationFailure,
  type Result, type ValidationErrors,
} from '@frenchexdev2/result';

const result: Result<User, ValidationErrors> = await new UserBuilder()
  .withName('Stéphane')
  .withEmail('stephane@example.com')
  .withValidation(async user => user.name.trim()
    ? success()
    : validationFailure(validationError('Nom obligatoire', ['name'])))
  .BuildAsync();

if (result.isSuccess) console.log(result.value.name, result.value.role);
else console.error(result.error); // directement ValidationErrors
```

`buildAsync()` est l'alias de `BuildAsync()` avec exactement le même cycle.
Le résultat contient l'instance de `User`, avec son prototype et ses méthodes.
Il n'est ni cloné ni automatiquement gelé.

### Règles d'exécution

1. Vérifier tous les paramètres obligatoires du constructeur et retourner leurs
   erreurs dans `memberNames` s'il en manque, avant toute instanciation.
2. Appeler le constructeur en conservant les types et les valeurs par défaut.
3. Exécuter les validateurs de `HasBuilder`, puis ceux de `withValidation`, dans
   l'ordre d'enregistrement. Chaque règle reçoit la même instance et le signal
   d'annulation initial. Toutes les erreurs `Result.Ts` sont accumulées.
4. Retourner `success(instance)` ou `validationFailure(errors)` ; conserver
   uniquement les succès en cache.

Un argument obligatoire de type `string | undefined` doit être fourni, par
exemple par `withValue(undefined)`. Un paramètre facultatif ou avec une valeur
par défaut peut rester absent ; le builder transmet alors `undefined` au
constructeur. Les objets passés en argument sont conservés par identité.

Une exception du constructeur ou d'un validateur rejette la promesse sans être
transformée en erreur de validation. Les validateurs portent sur l'instance déjà
construite ; leur échec n'annule pas les effets du constructeur. Les appels
concurrents partagent une tentative, les setters sont verrouillés pendant cette
tentative et après un succès, et une nouvelle tentative explicite reste possible
après un échec. `BuildAsync({ signal })` suit les règles d'annulation décrites
plus bas : le signal initial contrôle la tentative, un signal concurrent
n'annule que l'attente de son appel.

### Raccorder un projet au build

Créer un `sourcegen.config.mjs` dans le projet consommateur :

```javascript
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@frenchexdev2/ts-codegen-pipeline';
import { BuilderGenerator } from '@frenchexdev2/builder/generator';

export default defineConfig({
  consumerPackageRoot: fileURLToPath(new URL('.', import.meta.url)),
  tsconfigPath: './tsconfig.json',
  outDir: 'src/generated',
  generators: [new BuilderGenerator()],
});
```

Le `tsconfig.json` doit inclure `src/**/*.ts`, avec `rootDir: "src"` et la
compilation ESM NodeNext. Les fichiers générés sont inclus dans cette compilation.
Ajouter les scripts suivants au `package.json` du consommateur :

```json
{
  "scripts": {
    "generate": "node node_modules/@frenchexdev2/ts-codegen-pipeline/dist/bin/sourcegen.js run --config sourcegen.config.mjs",
    "generate:check": "node node_modules/@frenchexdev2/ts-codegen-pipeline/dist/bin/sourcegen.js verify --config sourcegen.config.mjs",
    "build": "pnpm run generate && tsc -p tsconfig.json"
  }
}
```

Le CLI compilé évite de dépendre d'un lanceur TypeScript pour le fichier de
configuration. Le cycle est `sourcegen run → tsc → tests`. `generate:check`
ne réécrit rien et échoue si les fichiers générés sont absents, différents ou
modifiés manuellement. La génération est déterministe, avec les bannières et
diagnostics du moteur existant. Réserver `outDir` aux sorties de cette configuration :
le moteur supprime ses anciens fichiers générés qui ne sont plus émis.

Dans ce package, `pnpm run build` compile d'abord la bibliothèque et son générateur,
puis génère et compile [l'exemple complet](examples/generated-user/src/user.ts).
`pnpm run generate:check` vérifie ses sorties. Le fichier de configuration livré
est [examples/sourcegen.config.mjs](examples/sourcegen.config.mjs).

### Formes prises en charge et diagnostics

Les classes doivent être nommées, directement exportées, concrètes et non
génériques, avec un constructeur public unique à paramètres nommés. Une classe
sans constructeur explicite fonctionne avec zéro argument, sauf si elle hérite
d'un constructeur. Les propriétés hors constructeur ne génèrent pas de setters.

Les imports nommés avec alias et les imports de namespace sont reconnus à partir
de leur liaison à `@frenchexdev2/builder`. Le générateur n'exécute pas les modules
du modèle. Les options du décorateur doivent être un objet littéral et le nom
du builder une chaîne littérale ; les fonctions de validation peuvent être des
références ou des expressions, conservées par le décorateur au runtime.

- `BG001` : classe abstraite, générique, non exportée directement, export par
  défaut ou déclaration ambiante.
- `BG002` : constructeur privé/protégé, surchargé, avec paramètres rest ou
  déstructurés, ou constructeur hérité sans déclaration explicite.
- `BG003` : options non prises en charge, nom invalide ou annotation répétée.
- `BG004` : collision de setters, de nom avec `withValidation`, ou de chemins générés.

Une erreur de génération empêche l'écriture des compagnons de la configuration.

## Construction manuelle avec références

```typescript
import { Builder } from '@frenchexdev2/builder';

const input = { name: 'Stéphane', email: 'stephane@example.com' };

const builder = Builder.create(async () => Object.freeze({ ...input }))
  .withValidation(validation => {
    if (!input.name.trim()) validation.addError('Nom obligatoire', ['name']);
  })
  .withValidation(async validation => {
    if (!input.email.includes('@')) validation.addError('Email invalide', ['email']);
  });

const result = await builder.buildAsync();
if (result.isSuccess) {
  const user = result.value.resolved();
  console.log(user.name);
} else {
  for (const error of result.error.errors) {
    console.error(error.memberNames, error.errorMessage);
  }
}
```

Toutes les règles s'exécutent dans l'ordre d'enregistrement, même lorsqu'une
précédente règle a ajouté une erreur. Une validation invalide empêche
l'instanciation. Une exception inattendue interrompt l'opération et rejette la
promesse sans être transformée en erreur métier.

## Builder métier et erreurs typées

[examples/user.ts](examples/user.ts) contient un `UserBuilder` complet avec
`withName(...)`, `withEmail(...)` et un produit immuable :

```typescript
const result = await new UserBuilder()
  .withName('Stéphane')
  .withEmail('stephane@example.com')
  .buildAsync();

const user = result.valueOrThrow().resolved();
```

Pour une API métier, hériter de `AbstractBuilder<T, E>` et implémenter :

- `validateAsync(validation, signal)` : ajouter chaque problème à l'accumulateur ;
- `instantiateAsync(context, signal)` : renvoyer un `Result<T, E>`, directement ou
  dans une promesse ;
- `buildException(validation)` : convertir les problèmes accumulés en `E extends Error`.

Le second paramètre générique vaut `BuildError` par défaut. `success(product)` et
`failure(domainError)` viennent de `@frenchexdev2/result`. Un échec d'instanciation
conserve l'identité de son erreur. Les setters des sous-classes doivent appeler
`this.ensureConfigurable()` avant de modifier leur état, comme dans l'exemple.

## Cache et concurrence

```typescript
const [a, b] = await Promise.all([builder.buildAsync(), builder.buildAsync()]);
// a et b sont le même Result ; validation et factory ne s'exécutent qu'une fois.
```

Un succès est conservé pour toute la vie du builder. La configuration fluide est
verrouillée pendant une tentative et après un succès. Pour produire un nouvel
objet, créer un nouveau builder. Après un échec ou une exception, un nouvel appel
explicite peut reconstruire ; aucune relance automatique n'a lieu.

Le package conserve le produit par identité. Il ne copie ni ne fige le produit,
les objets capturés par les callbacks ou les services externes : leur immuabilité
reste la responsabilité de la factory. Le partage des promesses coordonne les
appels dans un même environnement JavaScript ; il ne synchronise pas des workers.

## Graphes et références circulaires

```typescript
import { Builder, type ReadonlyReference } from '@frenchexdev2/builder';

interface Parent { readonly child: Child }
interface Child { readonly parent: ReadonlyReference<Parent> }

let parent!: Builder<Parent>;
const child = Builder.create<Child>(async context => ({
  parent: (await parent.buildAsync({ context })).valueOrThrow(),
}));
parent = Builder.create<Parent>(async context => ({
  child: (await child.buildAsync({ context })).valueOrThrow().resolved(),
}));

const product = (await parent.buildAsync()).valueOrThrow().resolved();
console.log(product.child.parent.resolved() === product); // true
```

Passer le `BuildContext` reçu sur chaque appel récursif. Un retour vers un ancêtre
renvoie immédiatement sa référence différée ; son `resolved()` ne peut être lu
qu'après construction de cet ancêtre. `tryResolved()` renvoie `undefined` avant
résolution. La référence d'un builder est exposée par une interface TypeScript
en lecture seule. `Reference<T>` est également exportée pour des usages autonomes.

Démarrer chaque graphe cyclique par une seule racine. Des racines cycliques
indépendantes lancées en parallèle peuvent s'attendre mutuellement ; ce cas n'est
pas pris en charge. Un graphe n'est pas transactionnel : un enfant construit avec
succès garde son cache même si son parent échoue ensuite.

## Annulation

`buildAsync({ signal })` rejette avec `signal.reason` en cas d'annulation.
Le signal du premier appel est transmis aux hooks et contrôle la tentative
partagée. Un appel concurrent peut annuler sa propre attente sans annuler le
premier appel. Même un produit en cache n'est pas renvoyé à un signal déjà annulé.

Les hooks doivent transmettre ce signal aux opérations d'entrée/sortie. Le moteur
vérifie aussi l'annulation entre les phases et avant de résoudre la référence.
Il ne peut pas arrêter de force une factory qui ignore le signal ; tant qu'elle
ne se termine pas, la tentative reste active. L'annulation n'annule pas les effets
externes déjà réalisés par les hooks.

## Validation du package

Les tests, leurs assertions de typage et leurs configurations sont dans le projet frère [Builder.Tests.ts](../Builder.Tests.ts/README.md). Cette bibliothèque ne dépend pas de sa spécification ni de ses tests.

Depuis la racine du monorepo :

```powershell
./packages/Builder.Tests.ts/scripts/Invoke-Validation.ps1 -Phase Build
./packages/Builder.Tests.ts/scripts/Invoke-Validation.ps1 -Phase Tests
./packages/Builder.Tests.ts/scripts/Invoke-Validation.ps1 -Phase Mutation
./packages/Builder.Tests.ts/scripts/Invoke-Validation.ps1 -Phase Distribution
./packages/Builder.Tests.ts/scripts/Invoke-Validation.ps1 -Phase Linux
```

Chaque validation conserve ses diagnostics et son bilan sous `packages/Builder.Tests.ts/test-results/<runId>/`. Le lanceur ouvre une fenêtre PowerShell visible, adaptative et sans clignotement, puis la ferme après sauvegarde du résultat terminal. Il retourne aussi la commande de réouverture.

Les tests couvrent les exports ESM distribués, les exemples, les validations, les erreurs typées, le cache, la concurrence, l’annulation et les graphes cycliques. Les assertions de typage conservent les cas négatifs du contrat initial. La conformité rapproche les AC de chaque résultat individuel et vérifie les empreintes des entrées.

La campagne Stryker mute le runtime et le générateur. Le barrel de réexports et les déclarations ne contiennent pas de comportement à muter. Les mutants statiques sont inclus, la reprise incrémentale est désactivée et le seuil existant de 100 % est conservé. Le score global et l’attribution par AC sont présentés séparément ; une attribution absente n’est pas une réussite.

Les validations de distribution installent des archives npm locales. Linux utilise l’image locale `node:alpine3.24`, sans pull automatique, puis exécute les tests sans réseau avec des dépendances Linux dédiées. Les journaux conservent l’identité du conteneur et de l’image.

## Licence

[FrenchExDev Educational License v1.0](LICENSE), identique au package compagnon.
