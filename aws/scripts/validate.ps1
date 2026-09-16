# Valida la plantilla SAM/CloudFormation sin desplegar nada.
# Requiere: AWS SAM CLI instalado (no requiere credenciales para --lint).

$ErrorActionPreference = 'Stop'

$TemplateFile = Join-Path $PSScriptRoot '..\template.yaml' | Resolve-Path

if (-not (Get-Command sam -ErrorAction SilentlyContinue)) {
    Write-Error 'SAM CLI no encontrado. Instalalo desde https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html'
}

Write-Host "Validando $TemplateFile ..."
& sam validate --lint --template-file $TemplateFile
if ($LASTEXITCODE -ne 0) {
    Write-Error 'La validacion fallo. Revisa los errores de arriba.'
}

Write-Host 'Plantilla valida.'
