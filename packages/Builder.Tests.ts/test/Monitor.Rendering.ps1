# Objectif : Construire des cadres de suivi alignés et effacer les anciens caractères à chaque rafraîchissement.

function Format-MonitorDuration {
    <#
    .SYNOPSIS
    Présente une durée avec les unités compactes du workspace.
    .PARAMETER Seconds
    Durée observée en secondes ; null désigne une durée inconnue.
    #>
    param([AllowNull()][object]$Seconds)
    if ($null -eq $Seconds) { return '-' }
    $whole = [Math]::Floor([double]$Seconds)
    if ($whole -lt 60) { return "${whole}s" }
    $minutes = [Math]::Floor($whole / 60)
    $remainder = $whole % 60
    if ($minutes -lt 60) { return "${minutes}m${remainder}s" }
    $hours = [Math]::Floor($minutes / 60)
    $remainingMinutes = $minutes % 60
    return "${hours}h${remainingMinutes}m"
}

function Format-MonitorTable {
    <#
    .SYNOPSIS
    Construit bordures et cellules à partir des mêmes largeurs, sans séparateur résiduel.
    .PARAMETER Rows
    Lignes métier possédant Phase, Platform, State, Duration, Process, Pass, Fail et Lines.
    #>
    param([object[]]$Rows = @())
    $columns = @('Phase', 'Platform', 'State', 'Duration', 'Process', 'Pass', 'Fail', 'Lines')
    $widths = @(5, 8, 9, 8, 10, 4, 4, 5)
    $segments = @(foreach ($width in $widths) { '─' * ($width + 2) })
    $output = [Collections.Generic.List[string]]::new()
    $output.Add('┌' + ($segments -join '┬') + '┐')
    $allRows = @([pscustomobject]@{
        Phase = 'Phase'; Platform = 'Platform'; State = 'State'; Duration = 'Duration'
        Process = 'Process'; Pass = 'Pass'; Fail = 'Fail'; Lines = 'Lines'
    }) + @($Rows)
    for ($rowIndex = 0; $rowIndex -lt $allRows.Count; $rowIndex++) {
        $cells = for ($columnIndex = 0; $columnIndex -lt $columns.Count; $columnIndex++) {
            $value = $allRows[$rowIndex].($columns[$columnIndex])
            $text = if ($null -eq $value) { '-' } else { [string]$value }
            $width = $widths[$columnIndex]
            if ($text.Length -gt $width) { $text = $text.Substring(0, $width - 1) + '…' }
            if ($columnIndex -ge 5 -or $columnIndex -eq 3) { ' ' + $text.PadLeft($width) + ' ' }
            else { ' ' + $text.PadRight($width) + ' ' }
        }
        $output.Add('|' + ($cells -join '|') + '|')
        if ($rowIndex -eq 0) { $output.Add('├' + ($segments -join '┼') + '┤') }
    }
    $output.Add('└' + ($segments -join '┴') + '┘')
    return $output.ToArray()
}

function ConvertTo-MonitorTerminalFrame {
    <#
    .SYNOPSIS
    Produit un cadre VT qui efface chaque ligne et les anciennes lignes restantes.
    .PARAMETER Lines
    Contenu complet du cadre ; le premier élément identifie le projet et la tâche.
    .PARAMETER Width
    Largeur maximale avant retour explicite, inférieure à la largeur du terminal.
    #>
    param([Parameter(Mandatory)][string[]]$Lines, [int]$Width = 79)
    if ($Width -lt 1) { throw 'La largeur du cadre doit être positive.' }
    $escape = [char]27
    $builder = [Text.StringBuilder]::new()
    $null = $builder.Append("${escape}[H")
    foreach ($line in $Lines) {
        # Les chemins restent complets mais ne provoquent pas de retour automatique.
        $parts = [Math]::Max(1, [Math]::Ceiling($line.Length / [double]$Width))
        for ($index = 0; $index -lt $parts; $index++) {
            $offset = $index * $Width
            $length = [Math]::Min($Width, $line.Length - $offset)
            $null = $builder.Append("${escape}[2K`r").Append($line.Substring($offset, $length)).Append("`r`n")
        }
    }
    $null = $builder.Append("${escape}[J")
    return $builder.ToString()
}
