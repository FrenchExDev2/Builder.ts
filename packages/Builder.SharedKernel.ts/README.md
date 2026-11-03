<p align="center">
  <img src="../../icons/logo.png" alt="QuietCli logo" width="150px" />
</p>

# @frenchexdev2/builder-shared-kernel

Identités métier stables de Builder : `BuilderFeatures`. Ce package réexporte `ParticipatesIn`, `getParticipation` et `FeatureReference` depuis le point d’entrée neutre `requirements-shared-kernel/participation`, sans charger les analyseurs ou les services RaC.

Il ne contient ni AC, ni tests, ni justifications détaillées. Le décorateur standard conserve la classe ou méthode d’origine et enregistre seulement des références immuables. Les références déclarées ne sont pas des preuves de conformité.

Voir le [monorepo](../../README.md) pour le build et la préparation des archives npm.
