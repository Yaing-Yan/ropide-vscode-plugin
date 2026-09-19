<#
  RopIDE for VS Code — 终端界面库 / terminal UI helpers (PowerShell)
  ---------------------------------------------------------------------------
  与 scripts/ui.sh 视觉一致：标题胶囊反色、居中偏上；下方固定 4 行日志区，
  由下往上逐行变暗；底部一行状态 / 结果。

  用法 / usage:
      . "$PSScriptRoot\scripts\ui.ps1"
      Initialize-Ui -Title "标题" -Subtitle "副标题" -Hint "提示行"
      Set-UiMenu @("  [1] 安装", "  [2] 卸载")
      Start-Ui
      Invoke-UiStep -FilePath npm -Arguments @('install')    # 输出实时滚动进日志区
      Set-UiStatus "完成" -Kind ok
      Stop-Ui

  非交互（输出被重定向）、设置了 NO_COLOR、终端过小时自动退化为普通逐行输出。
  注意：本文件必须保存为「UTF-8 with BOM」，否则 Windows PowerShell 5.1
  会按系统 ANSI 代码页解析，中文会变成乱码。
#>

$script:UiLogLines = 4

$script:UiTty      = $false
$script:UiVt       = $false
$script:UiReady    = $false
$script:UiRows     = 24
$script:UiCols     = 80

$script:UiTitle    = ''
$script:UiSubtitle = ''
$script:UiHint     = ''
$script:UiMenu     = @()
$script:UiLines    = @('', '', '', '')
$script:UiStatus   = ''
$script:UiKind     = 'busy'

$script:UiPanelX   = 1
$script:UiPanelW   = 68
$script:UiRowLog   = 0
$script:UiRowStatus = 0
$script:UiRowEnd   = 0

$script:UiEsc = [string][char]27

# ---------------------------------------------------------------- 宽度计算
function Test-UiWide {
    param([int]$CodePoint)
    if ($CodePoint -ge 0x1100 -and (
        ($CodePoint -ge 0x1100 -and $CodePoint -le 0x115F) -or
        ($CodePoint -ge 0x2E80 -and $CodePoint -le 0x303E) -or
        ($CodePoint -ge 0x3041 -and $CodePoint -le 0x33FF) -or
        ($CodePoint -ge 0x3400 -and $CodePoint -le 0x4DBF) -or
        ($CodePoint -ge 0x4E00 -and $CodePoint -le 0x9FFF) -or
        ($CodePoint -ge 0xA000 -and $CodePoint -le 0xA4CF) -or
        ($CodePoint -ge 0xAC00 -and $CodePoint -le 0xD7A3) -or
        ($CodePoint -ge 0xF900 -and $CodePoint -le 0xFAFF) -or
        ($CodePoint -ge 0xFE30 -and $CodePoint -le 0xFE6F) -or
        ($CodePoint -ge 0xFF00 -and $CodePoint -le 0xFF60) -or
        ($CodePoint -ge 0xFFE0 -and $CodePoint -le 0xFFE6) -or
        ($CodePoint -ge 0x1F300 -and $CodePoint -le 0x1FAFF) -or
        ($CodePoint -ge 0x20000 -and $CodePoint -le 0x3FFFD))) {
        return $true
    }
    return $false
}

function Get-UiWidth {
    param([string]$Text)
    if ([string]::IsNullOrEmpty($Text)) { return 0 }
    $w = 0
    $i = 0
    while ($i -lt $Text.Length) {
        $cp = [char]::ConvertToUtf32($Text, $i)
        if ([char]::IsHighSurrogate($Text[$i])) { $i += 2 } else { $i += 1 }
        if (Test-UiWide $cp) { $w += 2 } else { $w += 1 }
    }
    return $w
}

function Format-UiFit {
    param([string]$Text, [int]$Max)
    if ([string]::IsNullOrEmpty($Text)) { return '' }
    $Text = $Text -replace "`r", '' -replace "`t", '    '
    if ($Max -le 0) { return '' }
    $w = 0
    $i = 0
    $sb = New-Object System.Text.StringBuilder
    while ($i -lt $Text.Length) {
        $cp = [char]::ConvertToUtf32($Text, $i)
        $len = 1
        if ([char]::IsHighSurrogate($Text[$i])) { $len = 2 }
        $cw = 1
        if (Test-UiWide $cp) { $cw = 2 }
        # 预留 1 列给省略号，保证结果宽度不超过 $Max
        if (($w + $cw) -gt ($Max - 1)) {
            if ($Max -ge 1) { [void]$sb.Append([char]0x2026) }
            return $sb.ToString()
        }
        [void]$sb.Append($Text.Substring($i, $len))
        $w += $cw
        $i += $len
    }
    return $sb.ToString()
}

# ---------------------------------------------------------------- 终端探测
function Get-UiSize {
    $w = 80
    $h = 24
    try { $w = [int]$Host.UI.RawUI.WindowSize.Width } catch { $w = 80 }
    try { $h = [int]$Host.UI.RawUI.WindowSize.Height } catch { $h = 24 }
    if ($w -le 0) { $w = 80 }
    if ($h -le 0) { $h = 24 }
    $script:UiCols = $w
    $script:UiRows = $h
}

function Test-UiSupport {
    $script:UiTty = $false
    $script:UiVt = $false
    try {
        if ([Console]::IsOutputRedirected) { return $false }
    } catch {
        return $false
    }
    if ($env:NO_COLOR) { return $false }
    Get-UiSize
    if ($script:UiRows -lt 20 -or $script:UiCols -lt 46) { return $false }
    # Windows Terminal / VS Code 终端 / PowerShell 7 都支持 ANSI 256 色
    if ($env:WT_SESSION -or $env:TERM -or $env:TERM_PROGRAM -or $PSVersionTable.PSVersion.Major -ge 6) {
        $script:UiVt = $true
    }
    $script:UiTty = $true
    return $true
}

# ---------------------------------------------------------------- 输出原语
function Write-UiColor {
    param([string]$Text, [string]$Color)
    if ([string]::IsNullOrEmpty($Color)) {
        Write-Host -NoNewline -Object $Text
        return
    }
    if ($Color -match '^[0-9;]+$') {
        Write-Host -NoNewline -Object ($script:UiEsc + '[' + $Color + 'm' + $Text + $script:UiEsc + '[0m')
    } else {
        Write-Host -NoNewline -ForegroundColor $Color -Object $Text
    }
}

function Write-UiAt {
    param([int]$Row, [int]$Col, [string]$Text, [string]$Color = '')
    if (-not $script:UiTty) { return }
    try { [Console]::SetCursorPosition($Col - 1, $Row - 1) } catch { return }
    Write-UiColor $Text $Color
}

function Get-UiLineColor {
    param([int]$Index)
    if ($script:UiVt) {
        switch ($Index) {
            0 { return '38;5;240' }
            1 { return '38;5;245' }
            2 { return '38;5;251' }
            default { return '1;38;5;231' }
        }
    }
    switch ($Index) {
        0 { return 'DarkGray' }
        1 { return 'Gray' }
        2 { return 'White' }
        default { return 'White' }
    }
}

function Get-UiAccent { if ($script:UiVt) { return '38;5;68' } else { return 'DarkCyan' } }
function Get-UiHint   { if ($script:UiVt) { return '38;5;244' } else { return 'DarkGray' } }
function Get-UiSub    { if ($script:UiVt) { return '38;5;250' } else { return 'Gray' } }
function Get-UiOk     { if ($script:UiVt) { return '1;38;5;42' } else { return 'Green' } }
function Get-UiErr    { if ($script:UiVt) { return '1;38;5;203' } else { return 'Red' } }
function Get-UiBusy   { if ($script:UiVt) { return '38;5;222' } else { return 'Yellow' } }

function Get-UiPanel {
    $w = $script:UiCols - 6
    if ($w -gt 68) { $w = 68 }
    if ($w -lt 24) { $w = 24 }
    $script:UiPanelW = $w
    $script:UiPanelX = [int](($script:UiCols - $w) / 2) + 1
    if ($script:UiPanelX -lt 1) { $script:UiPanelX = 1 }
}

function Write-UiCentered {
    param([int]$Row, [string]$Text, [string]$Color)
    $t = Format-UiFit $Text ($script:UiCols - 4)
    $pad = [int](($script:UiCols - (Get-UiWidth $t)) / 2)
    if ($pad -lt 0) { $pad = 0 }
    Write-UiAt $Row 1 (' ' * $pad + $t) $Color
}

function Write-UiRule {
    param([int]$Row)
    $line = [string]::new([char]0x2500, $script:UiPanelW)
    Write-UiAt $Row $script:UiPanelX $line (Get-UiAccent)
}

# 反色标题胶囊。VT 可用时用 ANSI 反显（不会污染后续行的背景色），
# 否则退化为亮色标题。
function Write-UiPill {
    param([int]$Row)
    $title = Format-UiFit $script:UiTitle ($script:UiCols - 10)
    $pad = [int](($script:UiCols - ((Get-UiWidth $title) + 6)) / 2)
    if ($pad -lt 0) { $pad = 0 }
    if ($script:UiVt) {
        Write-UiAt $Row 1 (' ' * $pad) ''
        Write-UiColor ('   ' + $title + '   ') '1;7'
    } else {
        Write-UiAt $Row 1 (' ' * $pad + $title) 'White'
    }
}

function Write-UiLogLine {
    param([int]$Row, [string]$Text, [string]$Color)
    $w = $script:UiPanelW - 4
    $body = Format-UiFit $Text $w
    # 补足到整个面板宽度，避免上一帧更长的内容留下残影
    $pad = ($script:UiPanelW - 3) - (Get-UiWidth $body)
    if ($pad -lt 0) { $pad = 0 }
    Write-UiAt $Row $script:UiPanelX (' ' + [char]0x2502 + ' ' + $body + (' ' * $pad)) $Color
}

# ---------------------------------------------------------------- 绘制
function Redraw-Ui {
    if (-not $script:UiTty) { return }
    Get-UiSize
    Get-UiPanel

    $menu = @($script:UiMenu | Where-Object { $_ -ne '' -and $null -ne $_ })
    $block = 11 + $menu.Count
    $top = [int]($script:UiRows * 28 / 100)
    if ($top -lt 1) { $top = 1 }
    if (($top + $block) -gt ($script:UiRows - 1)) {
        $top = $script:UiRows - 1 - $block
        if ($top -lt 1) { $top = 1 }
    }

    try { [Console]::Clear() } catch { return }

    $y = $top
    Write-UiPill $y
    $y += 1

    $y += 1
    if ($script:UiSubtitle) { Write-UiCentered $y $script:UiSubtitle (Get-UiSub) }
    $y += 1
    if ($script:UiHint) { Write-UiCentered $y $script:UiHint (Get-UiHint) }
    $y += 1
    foreach ($m in $menu) {
        Write-UiCentered $y $m (Get-UiSub)
        $y += 1
    }

    $y += 1
    Write-UiRule $y
    $script:UiRowLog = $y + 1
    Write-UiRule ($script:UiRowLog + $script:UiLogLines)
    $script:UiRowStatus = $script:UiRowLog + $script:UiLogLines + 1
    $script:UiRowEnd = $script:UiRowStatus

    Redraw-UiLog
    Redraw-UiStatus
}

function Redraw-UiLog {
    if (-not ($script:UiTty -and $script:UiReady)) { return }
    for ($i = 0; $i -lt $script:UiLogLines; $i++) {
        Write-UiLogLine ($script:UiRowLog + $i) $script:UiLines[$i] (Get-UiLineColor $i)
    }
    try { [Console]::SetCursorPosition($script:UiPanelX - 1, $script:UiRowStatus - 1) } catch { }
}

function Redraw-UiStatus {
    if (-not ($script:UiTty -and $script:UiReady)) { return }
    $color = Get-UiBusy
    switch ($script:UiKind) {
        'ok'  { $color = Get-UiOk }
        'err' { $color = Get-UiErr }
    }
    $text = Format-UiFit $script:UiStatus ($script:UiPanelW - 4)
    $pad = ($script:UiPanelW - 3) - (Get-UiWidth $text)
    if ($pad -lt 0) { $pad = 0 }
    Write-UiAt $script:UiRowStatus $script:UiPanelX (' ' + [char]0x2502 + ' ' + $text + (' ' * $pad)) $color
}

# ---------------------------------------------------------------- 对外 API
function Initialize-Ui {
    param([string]$Title = '', [string]$Subtitle = '', [string]$Hint = '')
    $script:UiTitle = $Title
    $script:UiSubtitle = $Subtitle
    $script:UiHint = $Hint
}

function Set-UiMenu {
    param([string[]]$Lines = @())
    $script:UiMenu = @($Lines)
    if ($script:UiReady) { Redraw-Ui }
}

function Set-UiHeader {
    param([string]$Title = '', [string]$Subtitle = '', [string]$Hint = '')
    if ($Title) { $script:UiTitle = $Title }
    $script:UiSubtitle = $Subtitle
    $script:UiHint = $Hint
    if ($script:UiReady) { Redraw-Ui }
}

function Start-Ui {
    if (Test-UiSupport) {
        $script:UiReady = $true
        try { $Host.UI.RawUI.WindowPosition = New-Object System.Management.Automation.Host.Coordinates 0, 0 } catch { }
        try { [Console]::CursorVisible = $false } catch { }
        Redraw-Ui
    } else {
        $script:UiReady = $true
        Write-Host $script:UiTitle
        if ($script:UiSubtitle) { Write-Host $script:UiSubtitle }
        if ($script:UiHint) { Write-Host $script:UiHint }
        Write-Host ''
    }
}

function Write-UiLog {
    param([string]$Text = '')
    if (-not ($script:UiTty -and $script:UiReady)) {
        Write-Host $Text
        return
    }
    $script:UiLines[0] = $script:UiLines[1]
    $script:UiLines[1] = $script:UiLines[2]
    $script:UiLines[2] = $script:UiLines[3]
    $script:UiLines[3] = Format-UiFit $Text ($script:UiPanelW - 4)
    Redraw-UiLog
}

function Set-UiStatus {
    param([string]$Text = '', [string]$Kind = 'busy')
    $script:UiStatus = $Text
    $script:UiKind = $Kind
    if ($script:UiTty -and $script:UiReady) {
        Redraw-UiStatus
    } else {
        Write-Host $Text
    }
}

function Show-UiPrompt {
    param([string]$Text = '')
    $script:UiStatus = $Text
    $script:UiKind = 'busy'
    if ($script:UiTty -and $script:UiReady) {
        Redraw-UiStatus
    } else {
        Write-Host -NoNewline $Text
    }
}

function Stop-Ui {
    if (-not ($script:UiTty -and $script:UiReady)) { $script:UiReady = $false; return }
    $script:UiReady = $false
    try { [Console]::CursorVisible = $true } catch { }
    try { [Console]::SetCursorPosition(0, $script:UiRowEnd) } catch { }
    Write-Host ''
}

# 执行外部命令：输出实时进入日志区，返回退出码
function Invoke-UiStep {
    param([string]$FilePath, [string[]]$Arguments = @())
    $shown = $FilePath + ' ' + ($Arguments -join ' ')
    Write-UiLog ('$ ' + $shown.Trim())
    $env:NO_COLOR = '1'
    $env:FORCE_COLOR = '0'
    $env:CLICOLOR = '0'
    # PS 5.1 下把原生命令的 stderr 重定向到 2>&1 会产生 ErrorRecord，
    # 若 ErrorActionPreference=Stop 会误抛异常，这里临时放宽。
    $oldPref = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $FilePath @Arguments 2>&1 | ForEach-Object { Write-UiLog ([string]$_) }
    } finally {
        $ErrorActionPreference = $oldPref
    }
    $code = 0
    if ($null -ne $LASTEXITCODE) { $code = [int]$LASTEXITCODE }
    return $code
}
