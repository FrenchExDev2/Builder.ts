# Objectif : Installer les quatre archives npm puis vérifier leurs exports publics depuis une fixture extérieure à node_modules.
<# .SYNOPSIS Vérifie les archives sans lien vers le checkout. .PARAMETER RunDirectory Dossier de preuves du moniteur. #>
param([Parameter(Mandatory)][string]$RunDirectory)
$ErrorActionPreference='Stop'
$utf8=[Text.UTF8Encoding]::new($false)
[Console]::InputEncoding=$utf8
[Console]::OutputEncoding=$utf8
$OutputEncoding=$utf8
$suite=Split-Path $PSScriptRoot -Parent
$packagesRoot=Split-Path $suite -Parent
$root=Split-Path $packagesRoot -Parent
$workspace=[IO.Path]::GetFullPath((Join-Path $root '../../..'))
Import-Module (Join-Path $workspace 'PoSh/FrenchExDev/QuietCliEcosystem/FrenchExDev.QuietCli.PoSh/FrenchExDev.QuietCli.PoSh.psd1') -DisableNameChecking
$pnpm=Join-Path $env:APPDATA 'npm/node_modules/pnpm/bin/pnpm.mjs'
$fixture=Join-Path $RunDirectory 'consumer'
$archives=Join-Path $fixture 'archives'
$null=New-Item -ItemType Directory -Path $archives -Force
function Invoke-IsolatedCommand {
 <# .SYNOPSIS Exécute une phase native et conserve un diagnostic borné. .PARAMETER Arguments Arguments Node documentés. .PARAMETER Directory Répertoire du projet. .PARAMETER Timeout Délai maximal. #>
 param([string[]]$Arguments,[string]$Directory=$fixture,[int]$Timeout=600)
 # Objectif : Exécuter cette phase de distribution par le contrat explicite de sortie.
 $result=pump -AsObject -WorkingDirectory $Directory -TimeoutSeconds $Timeout -State @{Lines=[Collections.Generic.List[string]]::new()} -OnOutput {param($record,$s)$s.Lines.Add($record.Text);if($s.Lines.Count -gt 18){$s.Lines.RemoveAt(0)}} -Complete {param($s,$capture)@{Diagnostics=@($s.Lines)}} node @Arguments
 $result|Out-QuietResult -MaxItems 20 -MaxOutputBytes 5000
 if($result.Outcome -ne 'Success'){throw 'Validation du consommateur isolé échouée.'}
}
$overrides=[ordered]@{}
foreach($line in Get-Content (Join-Path $root 'pnpm-workspace.yaml') -Encoding utf8){if($line -match "^  '(@frenchexdev2/[^']+)': 'file:\./\.artifacts/([^']+)'$"){$name=$Matches[1];$archive=$Matches[2];Copy-Item -LiteralPath (Join-Path $root ('.artifacts/'+$archive)) -Destination $archives;$overrides[$name]='file:./archives/'+$archive}}
$dependencies=@{}
foreach($name in @('Builder.SharedKernel.ts','Builder.ts','Builder.Requirements.ts','Builder.Tests.ts')){
 $directory=Join-Path $packagesRoot $name
 Invoke-IsolatedCommand -Arguments @($pnpm,'pack','--config.ignore-scripts=true','--pack-destination',$archives) -Directory $directory
 $manifest=Get-Content (Join-Path $directory 'package.json') -Raw -Encoding utf8|ConvertFrom-Json
 $tar=$manifest.name.Replace('@','').Replace('/','-')+'-'+$manifest.version+'.tgz'
 $overrides[$manifest.name]='file:./archives/'+$tar
 $dependencies[$manifest.name]='file:./archives/'+$tar
}
$manifest=@{name='builder-isolated-consumer';packageManager='pnpm@11.20.0';version='0.0.0';private=$true;type='module';dependencies=$dependencies}
$null=[IO.File]::WriteAllTextAsync((Join-Path $fixture 'package.json'),($manifest|ConvertTo-Json -Depth 15)+"`n",$utf8).GetAwaiter().GetResult()
$yaml=@('packages: []','overrides:')
foreach($entry in $overrides.GetEnumerator()){$yaml+="  '$($entry.Key)': '$($entry.Value)'"}
$yaml+=@("  'vite@8': '8.1.6'","  'nanoid@3': '3.3.18'","  'qs@6': '6.16.1'","  'undici@8': '8.12.2'","  'glob@13': '14.0.2'","  'minimatch@10': '11.0.1'")
$null=[IO.File]::WriteAllTextAsync((Join-Path $fixture 'pnpm-workspace.yaml'),($yaml -join "`n")+"`n",$utf8).GetAwaiter().GetResult()
Invoke-IsolatedCommand -Arguments @($pnpm,'install','--offline','--ignore-scripts')
Copy-Item -LiteralPath (Join-Path $suite 'test/distribution/consumer.mjs') -Destination (Join-Path $fixture 'consumer-smoke.mjs')
Invoke-IsolatedCommand -Arguments @((Join-Path $fixture 'consumer-smoke.mjs')) -Timeout 120
