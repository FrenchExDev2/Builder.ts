<p align="center">
  <img src="../../icons/logo.png" alt="QuietCli logo" width="150px" />
</p>

# @frenchexdev2/builder-tests

Suite de validation indépendante de la bibliothèque. Le portage conserve les enregistrements Vitest d’origine, leurs assertions et leurs jeux de paramètres ; les callbacks sont des méthodes décorées par `@Verifies`. `globals: false` empêche leur double enregistrement automatique par `@FeatureTest`.

```powershell
./scripts/Invoke-Validation.ps1 -Phase Tests
./scripts/Invoke-Validation.ps1 -Phase Mutation
./scripts/Invoke-Validation.ps1 -Phase Linux
./scripts/Invoke-Validation.ps1 -Phase VSCode
```

Les modes `Tests` et `Mutation` restent distincts. La campagne Stryker comprend le générateur, conserve les mutants statiques, désactive la reprise incrémentale et impose le seuil existant de 100 %. La couverture cible le runtime et le générateur ; le barrel de réexports est exclu car il n’ajoute aucun comportement métier. Les métriques sont rapportées sans seuil global de couverture inventé.

Les vérifications de compatibilité lisent les versions installées avant les tests. Les preuves associent chaque résultat individuel à un AC et conservent les versions, configurations et empreintes des sources. Les rapports se trouvent sous `test-results/<runId>/` ; `latest-evidence.json` sert uniquement de pointeur de consultation vers le dernier contenu enregistré.

Les tests unitaires instrumentent les sources ; les tests de distribution utilisent les exports ESM compilés. Les décorateurs RaC historiques sont isolés dans la configuration des tests et ne changent pas le mode de compilation standard de Builder.

Les tests et l’instrumentation ne parcourent jamais `node_modules`. Lancer la suite depuis `packages/Builder.Tests.ts`, ou extraire les archives dans un workspace séparé de même structure. Le runner refuse son exécution depuis `node_modules` ; la phase `Distribution` utilise une fixture extérieure pour consommer les packages installés.
