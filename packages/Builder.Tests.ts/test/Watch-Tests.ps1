# Objectif : Afficher les progrès et tous les états terminaux du seul lancement Builder.ts sélectionné.
[CmdletBinding()]
param([Parameter(Mandatory)][string]$RunDirectory, [Parameter(Mandatory)][int]$WorkerId)
$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$project = Split-Path $PSScriptRoot -Parent
$workspace = [IO.Path]::GetFullPath((Join-Path $project '../../../../..'))
$Host.UI.RawUI.WindowTitle = 'Builder.ts | Compilation et tests'
$started = [DateTimeOffset]::UtcNow
$last = ''
. (Join-Path $PSScriptRoot 'Monitor.Rendering.ps1')

while ($true) {
    $state = $null
    $statusPath = Join-Path $RunDirectory 'status.json'
    if (Test-Path $statusPath) { try { $state = Get-Content $statusPath -Raw -Encoding utf8 | ConvertFrom-Json } catch {} }
    $alive = $null -ne (Get-Process -Id $WorkerId -ErrorAction SilentlyContinue)
    $lines = [Collections.Generic.List[string]]::new()
    $lines.Add('Projet : Builder.ts (@frenchexdev2/builder) | Tâche : compilation et tests')
    $lines.Add("Workspace : $workspace")
    $lines.Add("Projet : $project")
    $lines.Add("Preuves : $RunDirectory")
    $rows = [Collections.Generic.List[object]]::new()
    if ($null -ne $state) {
        foreach ($run in $state.Runs) {
            $seconds = if ($null -ne $run.Duration) { $run.Duration } else { ([DateTimeOffset]::UtcNow - [DateTimeOffset]::Parse($run.Started)).TotalSeconds }
            $pass = if ($null -eq $run.Passed) { '-' } else { $run.Passed }
            $fail = if ($null -eq $run.Failed) { '-' } else { $run.Failed }
            $runState = if (!$alive -and $run.State -eq 'Running') { 'Crash' } else { $run.State }
            $log = Join-Path $RunDirectory ($run.Name + '.log')
            $lineCount = if (Test-Path $log) { @(Get-Content $log -Encoding utf8).Count } else { 0 }
            $rows.Add([pscustomobject]@{
                Phase = $run.Name; Platform = 'Windows'; State = $runState
                Duration = Format-MonitorDuration $seconds; Process = "pwsh:$WorkerId"
                Pass = $pass; Fail = $fail; Lines = $lineCount
            })
        }
    }
    $lines.AddRange([string[]](Format-MonitorTable -Rows $rows.ToArray()))
    $terminal = $null -ne $state -and $state.State -ne 'Running'
    $summary = if ($terminal) { $state.State } elseif (!$alive) { 'Crash : processus arrêté sans état terminal' } else { 'Running : heartbeat observable toutes les 1 s' }
    $lines.Add("État : $summary | Suivi : $(Format-MonitorDuration (([DateTimeOffset]::UtcNow - $started).TotalSeconds))")
    if ($null -ne $state -and $state.Error) { $lines.Add("Erreur : $($state.Error)") }
    $frame = $lines -join [Environment]::NewLine
    if ($frame -ne $last) {
        # L'effacement VT retire les suffixes d'un ancien cadre plus long.
        $width = try { [Math]::Max(1, [Console]::WindowWidth - 1) } catch { 79 }
        [Console]::Write((ConvertTo-MonitorTerminalFrame -Lines $lines.ToArray() -Width $width))
        $last = $frame
    }
    if ($terminal -or !$alive) { break }
    [Threading.Tasks.Task]::Delay(1000).GetAwaiter().GetResult() | Out-Null
}
