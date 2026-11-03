# Objectif : Exécuter la qualification Builder portée avec son suivi visible.
param([ValidateSet('Unit','All','Regression','Linux')][string]$Mode='All')
$phase=switch($Mode){'Linux'{'Linux'}'All'{'All'}default{'Tests'}}
& (Join-Path $PSScriptRoot '../scripts/Invoke-Validation.ps1') -Phase $phase