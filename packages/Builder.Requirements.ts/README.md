<p align="center">
  <img src="../../icons/logo.png" alt="QuietCli logo" width="150px" />
</p>

# @frenchexdev2/builder-requirements

Requirements et features rétroconçus depuis le README, l’API, les exemples et les assertions préservées de Builder. Les exigences sont `Draft` et leurs sources sont explicites : cette rétro-ingénierie n’invente pas une approbation métier.

Les classes exportées portent les AC sous forme de méthodes abstraites. Le build produit `dist/specification.json` depuis ces mêmes déclarations ; il n’existe pas de second catalogue d’AC à maintenir.

Le kernel métier fournit les identités stables. Ce package n’importe aucune implémentation Builder. Les tests et les preuves vivent dans `@frenchexdev2/builder-tests`.

## Différences à conserver

La construction manuelle valide avant l’instanciation et retourne une référence différée. Les builders générés construisent après vérification des arguments obligatoires, valident l’instance créée et la retournent directement. Ces contrats distincts ne sont pas fusionnés lors de la formalisation.

Une exception inattendue rejette la promesse ; un échec métier explicite reste un résultat. La couverture n’établit pas à elle seule la vérification d’un AC.
