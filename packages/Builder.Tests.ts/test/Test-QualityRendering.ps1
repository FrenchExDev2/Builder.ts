# Objectif : Vérifier l’alignement Unicode et les dispositions étroites du suivi de qualité.
$ErrorActionPreference='Stop'
$utf8=[Text.UTF8Encoding]::new($false)
[Console]::InputEncoding=$utf8
[Console]::OutputEncoding=$utf8
$OutputEncoding=$utf8
. (Join-Path $PSScriptRoot 'Quality.Rendering.ps1')
$count=0
foreach($case in @(@('Stéphane',8),@("e$([char]0x301)",1),@('東京',4),@('👩‍💻',2),@("$([char]27)[31mOK$([char]27)[0m",2))){
    if((Get-QualityWidth $case[0]) -ne $case[1]){throw "Largeur Unicode incorrecte : $($case[0])"};$count++
}
$rows=@([pscustomobject]@{Name='Mutants';Platform='Windows';State='Running';Duration='1m';Identity='node:12345';Passed=$null;Failed=$null;Mutants=300;Killed=120;Survived=8})
foreach($width in @(120,100,90,78,66,55,40,20)){
    $table=@(Format-QualityTable -Rows $rows -Width $width)
    foreach($line in $table){if((Get-QualityWidth $line) -gt $width){throw "Débordement à $width cellules."};$count++}
    $lengths=@($table|ForEach-Object{Get-QualityWidth $_}|Select-Object -Unique)
    if($lengths.Count -ne 1){throw "Cadre désaligné à $width cellules."};$count++
}
if((Format-QualityDuration 60) -ne '1m' -or (Format-QualityDuration 3600) -ne '1h'){throw 'Durée non compacte.'}
$count++
Write-Output "Quality monitor: $count assertions passed."
