# Objectif : Vérifier les archives Builder dans un conteneur Linux sans réutiliser les node_modules Windows.
<# .SYNOPSIS Prépare une fixture issue des archives npm puis exécute les tests Linux. .PARAMETER RunDirectory Dossier de preuves du lancement surveillé. #>
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
$fixture=Join-Path $RunDirectory 'linux-fixture'
$archives=Join-Path $fixture 'archives'
$null=New-Item -ItemType Directory -Path $archives -Force
$null=New-Item -ItemType Directory -Path (Join-Path $fixture 'packages') -Force
function Invoke-LinuxCommand {
 <# .SYNOPSIS Exécute une commande Linux documentée via QuietCli. .PARAMETER Executable Commande native. .PARAMETER Arguments Arguments verbatim. .PARAMETER Directory Répertoire hôte. .PARAMETER Timeout Durée maximale. #>
 param([string]$Executable,[string[]]$Arguments,[string]$Directory=$root,[int]$Timeout=600)
 # Objectif : Exécuter la phase de préparation ou de test et conserver un diagnostic borné.
 $result=pump -AsObject -WorkingDirectory $Directory -TimeoutSeconds $Timeout -State @{Lines=[Collections.Generic.List[string]]::new()} -OnOutput {param($record,$s)$s.Lines.Add($record.Text);if($s.Lines.Count -gt 20){$s.Lines.RemoveAt(0)}} -Complete {param($s,$capture)@{Diagnostics=@($s.Lines)}} $Executable @Arguments
 $result|Out-QuietResult -MaxItems 22 -MaxOutputBytes 5000
 if($result.Outcome -ne 'Success'){throw "Échec Linux : $Executable"}
}
foreach($name in @('Builder.SharedKernel.ts','Builder.ts','Builder.Requirements.ts','Builder.Tests.ts')){
 $dir=Join-Path $packagesRoot $name
 Invoke-LinuxCommand -Executable node -Arguments @($pnpm,'pack','--config.ignore-scripts=true','--pack-destination',$archives) -Directory $dir
 $manifest=Get-Content (Join-Path $dir 'package.json') -Raw -Encoding utf8|ConvertFrom-Json
 $tar=Join-Path $archives ($manifest.name.Replace('@','').Replace('/','-')+'-'+$manifest.version+'.tgz')
 $extract=Join-Path $fixture ('extract-'+$name)
 $null=New-Item -ItemType Directory -Path $extract -Force
 $input=[IO.File]::OpenRead($tar)
 $gzip=[IO.Compression.GZipStream]::new($input,[IO.Compression.CompressionMode]::Decompress)
 try{[System.Formats.Tar.TarFile]::ExtractToDirectoryAsync($gzip,$extract,$false,[Threading.CancellationToken]::None).GetAwaiter().GetResult()|Out-Null}finally{$gzip.DisposeAsync().AsTask().GetAwaiter().GetResult()|Out-Null;$input.DisposeAsync().AsTask().GetAwaiter().GetResult()|Out-Null}
 $target=[IO.Path]::GetFullPath((Join-Path $fixture ('packages/'+$name)));$source=[IO.Path]::GetFullPath((Join-Path $extract 'package'))
 if(!$source.StartsWith([IO.Path]::GetFullPath($fixture)) -or !$target.StartsWith([IO.Path]::GetFullPath($fixture))){throw 'Extraction hors périmètre'}
 Move-Item -LiteralPath $source -Destination $target
}
$overrides=@{}
foreach($line in Get-Content (Join-Path $root 'pnpm-workspace.yaml') -Encoding utf8){if($line -match "^  '(@frenchexdev2/[^']+)': 'file:\./\.artifacts/([^']+)'$"){$name=$Matches[1];$archive=$Matches[2];Copy-Item -LiteralPath (Join-Path $root ('.artifacts/'+$archive)) -Destination $archives;$overrides[$name]='file:/work/archives/'+$archive}}
$overrides['vite']='8.1.6';$overrides['nanoid']='3.3.18'
$manifest=@{name='builder-isolated-linux-validation';private=$true;type='module';workspaces=@('packages/*');overrides=$overrides}
$null=[IO.File]::WriteAllTextAsync((Join-Path $fixture 'package.json'),($manifest|ConvertTo-Json -Depth 15)+"`n",$utf8).GetAwaiter().GetResult()
$volume="builder-validation-$PID"
$container=$env:BUILDER_CONTAINER_NAME ?? "builder-validation-$PID"
$image='node:alpine3.24'
try{
 Invoke-LinuxCommand -Executable docker -Arguments @('image','inspect','--format','{{.Id}}',$image)
 $mounts=@('--rm','--pull','never','--mount',"type=bind,source=$fixture,target=/work",'--mount',"type=volume,source=$volume,target=/work/node_modules",'--mount',"type=bind,source=$RunDirectory,target=/reports")
 Invoke-LinuxCommand -Executable docker -Arguments (@('run')+$mounts+@('--name',$container,'--workdir','/work','--entrypoint','npm',$image,'install','--ignore-scripts','--no-audit','--no-fund')) -Timeout 1200
 Invoke-LinuxCommand -Executable docker -Arguments (@('run')+$mounts+@('--network','none','--name',$container,'--workdir','/work/packages/Builder.Tests.ts','--entrypoint','node',$image,'/work/node_modules/vitest/vitest.mjs','run','--reporter=default','--reporter=json','--outputFile=/reports/linux-tests.json')) -Timeout 600
}finally{
 # Objectif : Supprimer uniquement le volume éphémère créé et nommé par ce lancement.
 $cleanup=pump -AsObject -OnOutput {param($record,$s)$record.Text} docker volume rm $volume
 $cleanup|Out-QuietResult -MaxOutputBytes 1200
}
