$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconDirectory = Join-Path $PSScriptRoot '../public/icons'
foreach ($size in @(180, 192, 512)) {
    $scale = 4
    $bitmap = New-Object System.Drawing.Bitmap ($size * $scale), ($size * $scale)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.ScaleTransform(($size * $scale / 56.0), ($size * $scale / 56.0))
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#194E40'))
    $border = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#87A99B')), 0.7
    $outline = New-Object System.Drawing.Drawing2D.GraphicsPath
    $outline.AddArc(0.5,0.5,32,32,180,90)
    $outline.AddArc(23.5,0.5,32,32,270,90)
    $outline.AddArc(23.5,23.5,32,32,0,90)
    $outline.AddArc(0.5,23.5,32,32,90,90)
    $outline.CloseFigure()
    $graphics.DrawPath($border,$outline)
    $font = New-Object System.Drawing.Font 'Georgia',40,([System.Drawing.FontStyle]::Regular),([System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#F3E9CE'))
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString('S',$font,$brush,([System.Drawing.RectangleF]::new(0,-1,56,56)),$format)
    $output = New-Object System.Drawing.Bitmap $size,$size
    $resizer = [System.Drawing.Graphics]::FromImage($output)
    $resizer.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $resizer.DrawImage($bitmap,0,0,$size,$size)
    $name = if ($size -eq 180) { 'apple-touch-icon.png' } else { "icon-${size}x${size}.png" }
    $output.Save((Join-Path $iconDirectory $name),[System.Drawing.Imaging.ImageFormat]::Png)
    $resizer.Dispose(); $output.Dispose(); $format.Dispose(); $brush.Dispose(); $font.Dispose(); $outline.Dispose(); $border.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../public/sunsilk-mark.svg') -Destination (Join-Path $PSScriptRoot '../public/favicon.svg') -Force
