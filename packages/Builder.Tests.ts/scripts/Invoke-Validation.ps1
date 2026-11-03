# Objectif : Valider Builder, sa spécification et la traçabilité avec une fenêtre de suivi dédiée.
<# .SYNOPSIS Lance une validation surveillée et conserve ses résultats. .PARAMETER Phase Périmètre à vérifier. .PARAMETER RunDirectory Dossier de preuves. .PARAMETER Worker Processus de fond interne. #>
[CmdletBinding()]
param([ValidateSet('Build','Tests','Mutation','Linux','VSCode','Distribution','All')][string]$Phase='Tests',[string]$RunDirectory,[switch]$Worker)
$ErrorActionPreference='Stop'
$utf8=[Text.UTF8Encoding]::new($false)
[Console]::InputEncoding=$utf8
[Console]::OutputEncoding=$utf8
$OutputEncoding=$utf8
$project=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$packagesRoot=Split-Path $project -Parent
$nodeRoot=Split-Path $packagesRoot -Parent
$workspace=[IO.Path]::GetFullPath((Join-Path $nodeRoot '../../..'))
if(!$RunDirectory){$RunDirectory=Join-Path $project ('test-results/'+$Phase.ToLowerInvariant()+'-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))}
$null=New-Item -ItemType Directory -Path $RunDirectory -Force
if(!$Worker){
 $shell=(Get-Process -Id $PID).Path
 $job=Start-Process $shell -WindowStyle Hidden -PassThru -ArgumentList @('-NoProfile','-File',('"'+$PSCommandPath+'"'),'-Worker','-Phase',$Phase,'-RunDirectory',('"'+$RunDirectory+'"'))
 $watcher=Join-Path $project 'test/Watch-Quality.ps1'
 $monitor=Start-Process $shell -WindowStyle Normal -PassThru -ArgumentList @('-NoProfile','-File',('"'+$watcher+'"'),'-RunDirectory',('"'+$RunDirectory+'"'),'-WorkerId',$job.Id)
 [pscustomobject]@{WorkerId=$job.Id;MonitorId=$monitor.Id;RunDirectory=$RunDirectory;Reopen="pwsh -NoProfile -File `"$watcher`" -RunDirectory `"$RunDirectory`" -WorkerId $($job.Id)"}
 return
}
$state=@{Project=$project;Workspace=$workspace;Targets=@('Builder.ts','Builder.SharedKernel.ts','Builder.Requirements.ts','Builder.Tests.ts');WorkerId=$PID;State='Running';Runs=@();Saved=$false;Scope=$Phase}
function Save-ValidationState {
 <# .SYNOPSIS Sauvegarde un instantané UTF-8 atomique du suivi. #>
 $file=Join-Path $RunDirectory 'quality.json'
 $null=[IO.File]::WriteAllTextAsync(($file+'.new'),($state|ConvertTo-Json -Depth 15),$utf8).GetAwaiter().GetResult()
 Move-Item -LiteralPath ($file+'.new') -Destination $file -Force
}
function Invoke-ValidationStep {
 <# .SYNOPSIS Exécute une phase via QuietCli et relève son résultat terminal. .PARAMETER Name Nom visible. .PARAMETER Arguments Arguments Node documentés. .PARAMETER Directory Répertoire choisi. .PARAMETER Timeout Délai maximal. .PARAMETER Executable Exécutable explicite. #>
 param([string]$Name,[string[]]$Arguments,[string]$Directory=$project,[int]$Timeout=600,[string]$Executable='node')
 $entry=@{Name=$Name;Platform='Windows';State='Running';Started=[DateTimeOffset]::UtcNow.ToString('O');Duration=$null;Identity="worker:$PID";Passed=$null;Failed=$null;Lines=0}
 if($Phase -eq 'Linux'){$entry.Platform='Linux';$entry.Identity="container:builder-validation-$PID"}
 $state.Runs+=,$entry;Save-ValidationState
 $stream=[IO.StreamWriter]::new((Join-Path $RunDirectory ($Name+'.log')),$false,$utf8)
 try{
  $progress=@{Entry=$entry;Stream=$stream;Last=[DateTimeOffset]::MinValue;Errors=[Collections.Generic.List[string]]::new()}
  # Objectif : Exécuter cette commande documentée et ne livrer que ses diagnostics bornés.
  $result=pump -AsObject -WorkingDirectory $Directory -TimeoutSeconds $Timeout -State $progress -OnOutput {
   param($record,$p)
   $p.Entry.Lines++
   $null=$p.Stream.WriteLineAsync($record.Text).GetAwaiter().GetResult()
   $null=$p.Stream.FlushAsync().GetAwaiter().GetResult()
   if($p.Errors.Count -lt 20){$p.Errors.Add($record.Text)}
   if(([DateTimeOffset]::UtcNow-$p.Last).TotalSeconds -ge 1){
    if($p.Entry.Platform -eq 'Windows'){$child=Get-CimInstance Win32_Process -Filter "ParentProcessId=$PID" -ErrorAction SilentlyContinue|Where-Object Name -match 'node|docker'|Select-Object -First 1;if($child){$p.Entry.Identity="$($child.Name):$($child.ProcessId)"}}
    Save-ValidationState;$p.Last=[DateTimeOffset]::UtcNow
   }
  } -Complete {param($p,$capture)@{Diagnostics=@($p.Errors);Lines=$p.Entry.Lines}} $Executable @Arguments
  $entry.ExitCode=$result.Execution.ExitCode
  $entry.State=if($result.Outcome -eq 'Success' -and $result.Completeness.Source -and $result.Completeness.Analysis){'Success'}elseif($result.Error.Code -match 'Timeout'){'Timeout'}else{'Failed'}
  $entry.Duration=([DateTimeOffset]::UtcNow-[DateTimeOffset]::Parse($entry.Started)).TotalSeconds
  $json=$result|ConvertTo-QuietJson -MaxOutputBytes 6000
  $null=[IO.File]::WriteAllTextAsync((Join-Path $RunDirectory ($Name+'.result.json')),$json,$utf8).GetAwaiter().GetResult()
  $testJson=Join-Path $RunDirectory 'tests.json'
  if($Name -eq 'Tests' -and (Test-Path $testJson)){$report=Get-Content $testJson -Raw -Encoding utf8|ConvertFrom-Json;$entry.Passed=$report.numPassedTests;$entry.Failed=$report.numFailedTests;if(!$report.success){$entry.State='Failed'}}
  if($Name -eq 'Mutation' -and (Test-Path (Join-Path $RunDirectory 'mutation/mutation-report.json'))){$report=Get-Content (Join-Path $RunDirectory 'mutation/mutation-report.json') -Raw -Encoding utf8|ConvertFrom-Json;$mutants=@($report.files.PSObject.Properties|ForEach-Object {$_.Value.mutants});$entry.Mutants=$mutants.Count;foreach($status in @('Killed','Survived','NoCoverage','Timeout','Ignored','CompileError','RuntimeError')){$entry[$status]=@($mutants|Where-Object status -eq $status).Count}}
  Save-ValidationState
  if($entry.State -ne 'Success'){throw "$Name : $($entry.State). Voir $Name.log"}
 }finally{$stream.DisposeAsync().AsTask().GetAwaiter().GetResult()|Out-Null}
}
try{
 Save-ValidationState
 Import-Module (Join-Path $workspace 'PoSh/FrenchExDev/QuietCliEcosystem/FrenchExDev.QuietCli.PoSh/FrenchExDev.QuietCli.PoSh.psd1') -DisableNameChecking
 $tsc=Join-Path $project 'node_modules/typescript/bin/tsc'
 if($Phase -in @('Build','All')){
  foreach($target in @('../Requirements.ts/packages/requirements-shared-kernel','packages/Builder.SharedKernel.ts','packages/Builder.Requirements.ts','packages/Builder.ts','../Requirements.ts/packages/requirements-trace')){Invoke-ValidationStep -Name ($target.Split('/')[-1]) -Arguments @($tsc,'-p','tsconfig.json') -Directory (Join-Path $nodeRoot $target)}
  Invoke-ValidationStep -Name 'Specification' -Arguments @((Join-Path $packagesRoot 'Builder.Requirements.ts/scripts/write-specification.mjs'))
  $library=Join-Path $packagesRoot 'Builder.ts'
  $sourcegen=Join-Path $library 'node_modules/@frenchexdev2/ts-codegen-pipeline/dist/bin/sourcegen.js'
  Invoke-ValidationStep -Name 'Generate' -Arguments @($sourcegen,'run','--config','examples/sourcegen.config.mjs') -Directory $library
  Invoke-ValidationStep -Name 'Verify' -Arguments @($sourcegen,'verify','--config','examples/sourcegen.config.mjs') -Directory $library
  Invoke-ValidationStep -Name 'Examples' -Arguments @($tsc,'-p','examples/generated-user/tsconfig.json') -Directory $library
 }
 if($Phase -in @('Tests','All')){
  $env:TEST_RUN_ID=Split-Path $RunDirectory -Leaf
  Invoke-ValidationStep -Name 'Compatibility' -Arguments @((Join-Path $PSScriptRoot 'run.mjs'),'--check')
  Invoke-ValidationStep -Name 'Boundaries' -Arguments @((Join-Path $nodeRoot 'scripts/check-boundaries.mjs')) -Directory $nodeRoot
  Invoke-ValidationStep -Name 'MonitorUI' -Executable ((Get-Process -Id $PID).Path) -Arguments @('-NoProfile','-File',(Join-Path $project 'test/Test-QualityRendering.ps1'))
  Invoke-ValidationStep -Name 'FrameUI' -Executable ((Get-Process -Id $PID).Path) -Arguments @('-NoProfile','-File',(Join-Path $project 'test/Test-MonitorRendering.ps1'))
  Invoke-ValidationStep -Name 'Types' -Arguments @((Join-Path $PSScriptRoot 'typecheck.mjs'))
  Invoke-ValidationStep -Name 'Snapshot' -Arguments @((Join-Path $PSScriptRoot 'snapshot.mjs'),$RunDirectory)
  Invoke-ValidationStep -Name 'Tests' -Arguments @((Join-Path $project 'node_modules/vitest/vitest.mjs'),'run','--coverage','--reporter=default','--reporter=json',('--outputFile='+(Join-Path $RunDirectory 'tests.json')),('--coverage.reportsDirectory='+(Join-Path $RunDirectory 'coverage')))
  Invoke-ValidationStep -Name 'Evidence' -Arguments @((Join-Path $PSScriptRoot 'evidence.mjs'),$RunDirectory)
 }
 if($Phase -in @('Mutation','All')){
  $env:STRYKER_REPORT_DIR=(Join-Path $RunDirectory 'mutation').Replace('\','/')
  Invoke-ValidationStep -Name 'Snapshot' -Arguments @((Join-Path $PSScriptRoot 'snapshot.mjs'),$RunDirectory)
  try{Invoke-ValidationStep -Name 'Mutation' -Arguments @((Join-Path $project 'node_modules/@stryker-mutator/core/bin/stryker.js'),'run','packages/Builder.Tests.ts/stryker.conf.cjs') -Directory $nodeRoot -Timeout 10800}
  finally{if(Test-Path (Join-Path $RunDirectory 'mutation/mutation-report.json')){Invoke-ValidationStep -Name 'Attribution' -Arguments @((Join-Path $PSScriptRoot 'mutation-evidence.mjs'),$RunDirectory)}}
 }
 if($Phase -eq 'Linux'){$env:BUILDER_CONTAINER_NAME="builder-validation-$PID";Invoke-ValidationStep -Name 'Linux' -Executable ((Get-Process -Id $PID).Path) -Arguments @('-NoProfile','-File',(Join-Path $PSScriptRoot 'Invoke-Linux.ps1'),'-RunDirectory',$RunDirectory) -Timeout 1800}
 if($Phase -eq 'Distribution'){Invoke-ValidationStep -Name 'Consumer' -Executable ((Get-Process -Id $PID).Path) -Arguments @('-NoProfile','-File',(Join-Path $PSScriptRoot 'Invoke-Isolated.ps1'),'-RunDirectory',$RunDirectory) -Timeout 1200}
 if($Phase -eq 'VSCode'){
  $extension=Join-Path $workspace 'VsCode/FrenchExDev/Requirements.VsCode'
  Invoke-ValidationStep -Name 'HostFixture' -Arguments @((Join-Path $extension 'test/run-integration.mjs'),$RunDirectory) -Directory $extension
  $editor=Join-Path $workspace 'VsCode/FrenchExDev/FrenchExDev.PoSh.WatchDog.PoSh/.vscode-test/vscode-win32-x64-archive-1.144.0/Code.exe'
  if(!(Test-Path $editor)){throw 'Définir un Extension Development Host local avant la qualification.'}
  $env:RAC_INTEGRATION_REPORT=Join-Path $RunDirectory 'extension-tests.json'
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  Invoke-ValidationStep -Name 'VSCode' -Executable $editor -Arguments @((Join-Path $RunDirectory 'workspace'),'--new-window','--disable-extensions','--disable-workspace-trust','--skip-welcome','--skip-release-notes',('--user-data-dir='+(Join-Path $RunDirectory 'user-data')),('--extensions-dir='+(Join-Path $RunDirectory 'extensions')),('--extensionDevelopmentPath='+$extension),('--extensionTestsPath='+(Join-Path $extension 'test/suite.cjs'))) -Directory $extension -Timeout 240
 }
 $state.State='Success'
}catch{
 $state.State='Failed';$state.Error=$_.Exception.Message
 foreach($run in $state.Runs){if($run.State -eq 'Running'){$run.State='Crash';$run.Duration=([DateTimeOffset]::UtcNow-[DateTimeOffset]::Parse($run.Started)).TotalSeconds}}
}finally{
 $state.Saved=$true;Save-ValidationState
 $summary=($state|ConvertTo-Json -Depth 15)
 $null=[IO.File]::WriteAllTextAsync((Join-Path $RunDirectory 'summary.json'),$summary,$utf8).GetAwaiter().GetResult()
}
if($state.State -ne 'Success'){exit 1}
