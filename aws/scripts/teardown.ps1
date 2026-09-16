# Elimina el stack y sus recursos. ACCION DESTRUCTIVA: pide doble confirmacion.
# Nota: el bucket S3 debe estar vacio; el script ofrece vaciarlo (tambien destructivo).

param(
    [string]$StackName = 'team-notes-dev',
    [string]$Region = 'us-east-1',
    [string]$Profile = ''
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command sam -ErrorAction SilentlyContinue)) {
    Write-Error 'SAM CLI no encontrado. Instalalo antes de continuar.'
}

$profileArgs = @()
if ($Profile -ne '') { $profileArgs = @('--profile', $Profile) }

Write-Host "Se eliminara el stack '$StackName' en $Region (EC2, EBS, S3, CloudFront, Lambda...)."
$confirm = Read-Host 'Escribe ELIMINAR para continuar'
if ($confirm -ne 'ELIMINAR') {
    Write-Host 'Eliminacion cancelada.'
    exit 0
}

# El stack no se puede eliminar con objetos en el bucket: ofrecer vaciado previo.
$bucket = & aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" `
    --output text `
    @profileArgs

if ($bucket -and $bucket -ne 'None') {
    Write-Host "Bucket del frontend: $bucket"
    $empty = Read-Host 'Vaciar el bucket antes de eliminar (escribe VACIAR para hacerlo)'
    if ($empty -eq 'VACIAR') {
        & aws s3 rm "s3://$bucket" --recursive --region $Region @profileArgs
        if ($LASTEXITCODE -ne 0) { Write-Error 'No se pudo vaciar el bucket.' }
    } else {
        Write-Host 'Sin vaciar el bucket la eliminacion del stack fallara. Continuando de todos modos...'
    }
}

Write-Host 'Eliminando stack (SAM pedira confirmacion)...'
& sam delete --stack-name $StackName --region $Region @profileArgs
