# Validation du monorepo Builder — 3 novembre 2026

Les quatre packages sont sous `packages/`, dans un workspace pnpm unique avec le sélecteur `packages/*`, un catalogue d’outils et un verrou à la racine. Les dépendances internes utilisent `workspace:*` ; les manifestes des archives npm contiennent des versions résolues.

Résultats observés après le déplacement :

- [Compilation et exemples](packages/Builder.Tests.ts/test-results/build-20261103-044351-292/summary.json) : réussis, génération et vérification des compagnons incluses.
- [Windows](packages/Builder.Tests.ts/test-results/tests-20261103-044539-933/summary.json) : 129 tests réussis, aucun échec ; typage et rendu des moniteurs vérifiés.
- [Linux](packages/Builder.Tests.ts/test-results/linux-20261103-044656-314/linux-tests.json) : 129 tests réussis, aucun échec, depuis les sources extraites sous `/work/packages/`, avec le réseau désactivé pendant les tests. Image `node:alpine3.24`, empreinte `sha256:2a64b2ab50887cac66e725706e3ef337551a9682f5a93eb896a4474dcbb932b6`.
- [Frontières de dépendances](packages/Builder.Tests.ts/test-results/tests-20261103-044539-933/Boundaries.log) : quatre projets, aucun cycle ni import interdit ; 65 enregistrements de tests d’origine conservés, avec leurs cas paramétrés.
- [Traçabilité](packages/Builder.Tests.ts/test-results/tests-20261103-044539-933/trace.html) : 119 liaisons entre exécutions et AC, preuve complète, aucune entrée modifiée pendant la campagne. Le CLI retrouve les nouvelles positions et l’origine des fichiers générés.
- [Couverture](packages/Builder.Tests.ts/test-results/tests-20261103-044539-933/coverage/index.html) : 246 lignes, 308 instructions, 73 fonctions et 141 branches couvertes à 100 %. Ce périmètre comprend le runtime et le générateur ; le barrel de réexports est exclu. Ce résultat ne définit pas un seuil pour les autres artefacts.
- [Mutation Windows](packages/Builder.Tests.ts/test-results/mutation-20261103-044714-944/mutation/index.html) : campagne complète, générateur inclus, sans reprise incrémentale ; 513 mutants détectés, aucun survivant, aucun mutant sans couverture, score de 100 %.
- [Consommateur npm isolé](packages/Builder.Tests.ts/test-results/distribution-20261103-044540-166/consumer/consumer-summary.json) : les quatre archives s’installent ; la fixture extérieure consomme les exports compilés et vérifie notamment le partage d’une construction concurrente.
- [Extension Development Host](packages/Builder.Tests.ts/test-results/vscode-20261103-044656-613/extension-tests.json) : cinq vérifications réussies, dont survol, CodeLens, document non enregistré, diagnostic, annulation et explication navigable.

La découverte des tests, l’instrumentation de couverture et les mutations restent hors de `node_modules`. La consommation d’un package installé utilise ses exports publics ; elle n’instrumente pas ses dépendances. Les moniteurs visibles se sont fermés après sauvegarde de chaque bilan terminal.

L’[attribution des mutations](packages/Builder.Tests.ts/test-results/mutation-20261103-044714-944/mutation-evidence.json) conserve ses limites : 59 AC ont des observations de mutation, sept n’ont aucun mutant attribué et quatre mutants détectés restent sans attribution exploitable à un AC. Le score global de 100 % ne constitue donc pas une preuve de mutation pour chacun des AC. Les requirements rétroconçus restent `Draft`.

Les quatre archives qualifiées et leurs SHA-256 se trouvent dans [.artifacts/release](.artifacts/release/packages.json). Le [VSIX](../../../VsCode/FrenchExDev/Requirements.VsCode/dist/requirements-trace-0.1.0.vsix) est prêt ; son SHA-256 est `93d9acd1bd90ace19423d41218601a8ddd87301f639d69f4e6dc63f0d1a43c0c`. Le [bilan JSON](.artifacts/release/qualification.json) référence les campagnes.

Les résultats et archives sont des artefacts locaux ignorés par Git. Les scripts de validation documentés dans le [README](README.md) permettent de les régénérer. Aucune publication npm ou Marketplace n’a été effectuée.
