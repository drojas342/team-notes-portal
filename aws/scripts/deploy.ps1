# Despliega la infraestructura con SAM CLI. NO despliega codigo de app (ver README).
# Requiere: AWS SAM CLI + AWS CLI con credenciales configuradas.
# Pide confirmacion escrita antes de crear recursos con costo.

param(
    [string]$StackName = 'team-notes-dev',
    [string]$Region = 'us-east-1',
    [string]$ParameterFile = (Join-Path $PSScriptRoot '..\parameters\dev.json'),
    [string]$Profile = ''
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command sam -ErrorAction SilentlyContinue)) {
    Write-Error 'SAM CLI no encontrado. Instalalo antes de continuar.'
}

$AwsRoot = Join-Path $PSScriptRoot '..' | Resolve-Path
Set-Location $AwsRoot

Write-Host 'Stack:   ' $StackName
Write-Host 'Region:  ' $Region
Write-Host 'Params:  ' $ParameterFile
Write-Host ''
Write-Host 'Esto creara recursos AWS con costo (EC2, EBS, S3, CloudFront, Lambda).'
$confirm = Read-Host "Escribe DESPLEGAR para continuar"
if ($confirm -ne 'DESPLEGAR') {
    Write-Host 'Despliegue cancelado.'
    exit 0
}

# Convierte parameters/dev.json en pares Key=Value para --parameter-overrides.
$params = (Get-Content -Raw $ParameterFile | ConvertFrom-Json).Parameters
$overrides = $params.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }

$profileArgs = @()
if ($Profile -ne '') { $profileArgs = @('--profile', $Profile) }

Write-Host 'Construyendo...'
& sam build --template-file template.yaml
if ($LASTEXITCODE -ne 0) { Write-Error 'sam build fallo.' }

Write-Host 'Desplegando (SAM pedira confirmacion del changeset)...'
& sam deploy `
    --template-file .aws-sam/build/template.yaml `
    --stack-name $StackName `
    --region $Region `
    --resolve-s3 `
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM `
    --parameter-overrides $overrides `
    @profileArgs
if ($LASTEXITCODE -ne 0) { Write-Error 'sam deploy fallo.' }

Write-Host ''
Write-Host '=== Outputs del stack ==='
& aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' `
    --output table `
    @profileArgs
