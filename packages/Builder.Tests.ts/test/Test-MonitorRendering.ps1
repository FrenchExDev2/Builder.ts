# Objectif : Vérifier les séparateurs alignés et le remplacement complet d’un cadre long par un cadre court.
$ErrorActionPreference = 'Stop'
$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
. (Join-Path $PSScriptRoot 'Monitor.Rendering.ps1')
$checks = 0

function Assert-Rendering {
    <# .SYNOPSIS Vérifie une propriété d'affichage et compte les assertions indépendantes. #>
    param([bool]$Condition, [string]$Message)
    if (!$Condition) { throw $Message }
    $script:checks++
}

$rows = @(
    [pscustomobject]@{ Phase='Build'; Platform='Windows'; State='Success'; Duration='1s'; Process='pwsh:10952'; Pass=$null; Fail=$null; Lines=0 },
    [pscustomobject]@{ Phase='Tests'; Platform='Windows'; State='Cancelled'; Duration='1m30s'; Process='pwsh:10952'; Pass=29; Fail=0; Lines=1 }
)
$table = @(Format-MonitorTable -Rows $rows)
Assert-Rendering ($table[0].Length -eq 78) 'La table doit tenir dans une console de 80 colonnes.'
$positions = @([regex]::Matches($table[0], '[┌┬┐]') | ForEach-Object Index)
foreach ($line in $table) {
    Assert-Rendering ($line.Length -eq 78) 'Toutes les lignes doivent avoir la même largeur.'
    $actual = @([regex]::Matches($line, '[|┌┬┐├┼┤└┴┘]') | ForEach-Object Index)
    Assert-Rendering (($actual -join ',') -eq ($positions -join ',')) 'Séparateur manquant, décalé ou en trop.'
}
Assert-Rendering ($table[-2] -match '\|\s+29\s*\|\s+0\s*\|\s+1\s*\|$') 'Compteurs numériques mal alignés.'
Assert-Rendering ($table[3] -match '\|\s+-\s*\|\s+-\s*\|') 'Les compteurs inconnus doivent rester explicites.'
$long = 'État : Running : heartbeat observable toutes les 1 s | Suivi : 8s'
$short = 'État : Success | Suivi : 9s'
$escape = [char]27
$frame = ConvertTo-MonitorTerminalFrame -Lines @('Projet : Builder.ts | Tâche : tests', $short) -Width 79
Assert-Rendering ($frame.StartsWith("${escape}[H${escape}[2K`r")) 'Le cadre doit repositionner et effacer la première ligne.'
Assert-Rendering ($frame.EndsWith("${escape}[J")) 'Le cadre doit effacer les anciennes lignes restantes.'
Assert-Rendering ($frame.Contains("${escape}[2K`r$short`r`n")) 'La ligne courte doit effacer tout suffixe de la ligne longue.'
# Simulation d'une ligne de terminal : 2K supprime le contenu précédent en entier.
$screen = $long
foreach ($part in ($frame -split "`r`n")) {
    if ($part.Contains($short)) { $screen = [regex]::Replace($part, "\x1B\[[0-9;]*[A-Za-z]", '').TrimStart("`r") }
}
Assert-Rendering ($screen -eq $short) 'Le rafraîchissement conserve des caractères résiduels.'
$wrapped = ConvertTo-MonitorTerminalFrame -Lines @('Projet : Builder.ts | Tâche : tests', ('x' * 170)) -Width 79
$visible = [regex]::Replace($wrapped, "\x1B\[[0-9;]*[A-Za-z]", '') -split "`r`n"
Assert-Rendering (@($visible | Where-Object { $_.TrimStart("`r").Length -gt 79 }).Count -eq 0) 'Un chemin long provoque un retour automatique.'
Assert-Rendering ((Format-MonitorDuration 7500) -eq '2h5m') 'Format des heures incorrect.'
Write-Output "Monitor rendering: $checks assertions passed."
