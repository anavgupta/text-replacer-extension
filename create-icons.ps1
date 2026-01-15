# Create placeholder icons for the extension
Add-Type -AssemblyName System.Drawing

$sizes = @(16, 48, 128)

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    
    # Draw blue circle background
    $g.FillEllipse([System.Drawing.Brushes]::Blue, 2, 2, $size - 4, $size - 4)
    
    # Draw white "T" letter
    $fontSize = [int]($size * 0.5)
    $font = New-Object System.Drawing.Font('Arial', $fontSize, [System.Drawing.FontStyle]::Bold)
    $brush = [System.Drawing.Brushes]::White
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = 'Center'
    $format.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
    $g.DrawString('T', $font, $brush, $rect, $format)
    
    # Save the icon
    $filename = "icon$size.png"
    $bmp.Save($filename, [System.Drawing.Imaging.ImageFormat]::Png)
    
    Write-Host "Created $filename"
    
    # Cleanup
    $font.Dispose()
    $g.Dispose()
    $bmp.Dispose()
}

Write-Host "All icons created successfully!"
