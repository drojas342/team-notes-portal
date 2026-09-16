# Despliega la app (backend + MySQL) en la EC2 ya creada por el stack.
# Metodo reproducible sin credenciales inventadas:
#   1. Copia por SCP los archivos necesarios (usa tu Key Pair existente).
#   2. Escribe el .env de Compose EN la instancia (los secretos se piden por
#      teclado con Read-Host -AsSecureString y nunca se guardan en disco local).
#   3. Levanta los servicios con docker compose up -d --build.
# Requiere: OpenSSH (ssh/scp de Windows 10+) y la instancia accesible por SSH (puerto 22).

param(
    [Parameter(Mandatory = $true)][string]$Ec2Host,
    [Parameter(Mandatory = $true)][string]$KeyFile,
    [string]$User = 'ec2-user',
    [string]$RemoteDir = '/opt/team-notes',
    [Parameter(Mandatory = $true)][string]$MetricsApiUrl,
    [string]$CloudFrontUrl = '',
    [int]$ApiPort = 3000
)

$ErrorActionPreference = 'Stop'

function Read-Secret([string]$prompt) {
    $sec = Read-Host $prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

# Elimina CR/LF y espacios de borde de un valor (los pegados desde terminal
# suelen traer saltos residuales que partirían las líneas del .env).
# Solo toca el valor; los nombres de clave se fijan aparte. Sin escapes
# de PowerShell: '\r|\n' lo interpreta el motor regex de .NET.
function Sanitize-EnvValue([string]$value) {
    if ($null -eq $value) { return '' }
    return (($value -replace '\r|\n', '').Trim())
}

# --- comprobaciones locales (solo lectura) ---
if (-not (Test-Path -LiteralPath $KeyFile)) { Write-Error "No existe KeyFile: $KeyFile" }
foreach ($cmd in @('ssh', 'scp')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Write-Error "$cmd no encontrado." }
}
$RepoRoot = Join-Path $PSScriptRoot '..\..' | Resolve-Path
foreach ($rel in @('docker-compose.yml', 'backend\Dockerfile', 'backend\package.json', 'backend\package-lock.json', 'backend\src', 'backend\seeders')) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $rel))) { Write-Error "Falta en el repo: $rel" }
}

$SshBase = @('-i', $KeyFile, '-o', 'StrictHostKeyChecking=accept-new', "$User@$Ec2Host")
# scp NO acepta "usuario@host" suelto como hace ssh: sin "host:ruta" lo
# interpreta como ruta local. Por eso scp usa solo flags + destinos remotos
# explícitos construidos como variables separadas.
$ScpOpts = @('-i', $KeyFile, '-o', 'StrictHostKeyChecking=accept-new')
$remoteComposeFile = "${User}@${Ec2Host}:${RemoteDir}/docker-compose.yml"
$remoteBackendDir = "${User}@${Ec2Host}:${RemoteDir}/backend/"

Write-Host "Destino:    $User@$Ec2Host`:$RemoteDir"
Write-Host 'Esto copiara archivos y reiniciara los contenedores del backend.'
$confirm = Read-Host 'Escribe DESPLEGAR para continuar'
if ($confirm -ne 'DESPLEGAR') { Write-Host 'Cancelado.'; exit 0 }

# --- secretos (solo memoria, nunca disco local) ---
Write-Host 'Introduce los secretos (no se muestran ni se guardan localmente):'
$mysqlRoot = Read-Secret 'MYSQL_ROOT_PASSWORD'
$mysqlPass = Read-Secret 'MYSQL_PASSWORD'
$jwtSecret = Read-Secret 'JWT_SECRET'

# --- 1. copiar archivos (lista explicita: node_modules y .env locales quedan fuera) ---
Write-Host 'Copiando archivos...'
# /opt pertenece a root: se crea con sudo y se entrega a ec2-user para que
# el resto del script (scp, .env, docker compose) funcione sin sudo.
& ssh @SshBase "sudo mkdir -p $RemoteDir/backend $RemoteDir/backend/src $RemoteDir/backend/seeders && sudo chown -R ${User}:${User} $RemoteDir"
if ($LASTEXITCODE -ne 0) { Write-Error 'SSH fallo. Revisa KeyFile, SG (puerto 22) y que la instancia este lista.' }

Push-Location $RepoRoot
try {
    # Copia recursiva por directorio (sin globs: robusto en SCP de Windows).
    & scp @ScpOpts docker-compose.yml $remoteComposeFile
    if ($LASTEXITCODE -ne 0) { Write-Error 'SCP de docker-compose.yml fallo.' }
    & scp @ScpOpts backend/Dockerfile backend/package.json backend/package-lock.json $remoteBackendDir
    if ($LASTEXITCODE -ne 0) { Write-Error 'SCP de archivos backend fallo.' }
    & scp -r @ScpOpts backend/src $remoteBackendDir
    if ($LASTEXITCODE -ne 0) { Write-Error 'SCP de backend/src fallo.' }
    & scp -r @ScpOpts backend/seeders $remoteBackendDir
    if ($LASTEXITCODE -ne 0) { Write-Error 'SCP de backend/seeders fallo.' }
} finally {
    Pop-Location
}

# --- 2. escribir .env en la instancia vía scp (el pipe a stdin de ssh perdía contenido) ---
Write-Host 'Escribiendo .env en la instancia...'
# OJO: cada elemento va entre paréntesis propios. En PowerShell la coma
# une antes que el '+', así que 'A=' + $x, 'B=' se evaluaría como
# 'A=' + @($x, 'B=') (un solo string con espacios). Con paréntesis hay 8 líneas.
$envLines = @(
    ('MYSQL_ROOT_PASSWORD=' + (Sanitize-EnvValue $mysqlRoot)),
    ('MYSQL_DATABASE=' + (Sanitize-EnvValue 'team_notes')),
    ('MYSQL_USER=' + (Sanitize-EnvValue 'teamnotes')),
    ('MYSQL_PASSWORD=' + (Sanitize-EnvValue $mysqlPass)),
    ('JWT_SECRET=' + (Sanitize-EnvValue $jwtSecret)),
    ('JWT_EXPIRES_IN=' + (Sanitize-EnvValue '1h')),
    ('LAMBDA_METRICS_URL=' + (Sanitize-EnvValue $MetricsApiUrl)),
    ('CORS_ORIGINS=' + (Sanitize-EnvValue $CloudFrontUrl))
)
if ($envLines.Count -ne 8) { Write-Error 'Construcción del .env inválida: no hay 8 líneas independientes.' }
$mysqlRoot = $null; $mysqlPass = $null; $jwtSecret = $null
# Secretos obligatorios no vacíos (se nombran claves, nunca valores).
foreach ($required in @('MYSQL_ROOT_PASSWORD', 'MYSQL_PASSWORD', 'JWT_SECRET')) {
    $found = $envLines | Where-Object { $_ -like "$required=*" } | Select-Object -First 1
    if ([string]::IsNullOrEmpty(($found -split '=', 2)[1])) {
        Write-Error "La variable $required no puede estar vacía."
    }
}
$remoteEnvFile = "${User}@${Ec2Host}:${RemoteDir}/.env"
# Temporal local fuera del repo, sin BOM y con LF para Linux. Se borra en finally.
$tempEnv = Join-Path $env:TEMP ('team-notes-env-' + [Guid]::NewGuid().ToString('N') + '.tmp')
try {
    # LF explícito vía [char]10 (sin secuencias de escape): cada variable en su línea.
    $lf = [string][char]10
    [IO.File]::WriteAllText($tempEnv, (($envLines -join $lf) + $lf), [Text.UTF8Encoding]::new($false))
    $mysqlRoot = $null; $mysqlPass = $null; $jwtSecret = $null
    # Puerta local: no transferir si el temporal no tiene exactamente 8 líneas "CLAVE=".
    # El mensaje solo incluye conteos y números de línea, nunca contenido.
    $tempLines = [IO.File]::ReadAllLines($tempEnv)
    $tempValid = ($tempLines.Count -eq 8)
    $badLines = @()
    for ($i = 0; $i -lt $tempLines.Count; $i++) {
        if ($tempLines[$i] -notmatch '^[^=]+=') {
            $tempValid = $false
            $badLines += ($i + 1)
        }
    }
    if (-not $tempValid) {
        Write-Error ("El .env temporal no tiene 8 líneas CLAVE=valor (leídas: $($tempLines.Count); malformadas: $($badLines -join ',')). Abortando antes de transferir.")
    }
    & scp @ScpOpts $tempEnv $remoteEnvFile
    if ($LASTEXITCODE -ne 0) { Write-Error 'SCP del .env fallo.' }
    & ssh @SshBase "chmod 600 $RemoteDir/.env"
    if ($LASTEXITCODE -ne 0) { Write-Error 'chmod del .env remoto fallo.' }

    # Verificación remota: existe, no vacío y contiene las 8 claves.
    # Solo se comprueban NOMBRES de claves; los valores nunca salen de la instancia.
    $envCheckCmd = @'
test -s {0}/.env || {{ echo ENV_MISSING_OR_EMPTY; exit 1; }}
n=$(grep -cE '^({1})=' {0}/.env)
if [ "$n" = '8' ]; then echo ENV_KEYS_OK; else echo ENV_KEYS_MISSING; exit 1; fi
'@ -f $RemoteDir, 'MYSQL_ROOT_PASSWORD|MYSQL_DATABASE|MYSQL_USER|MYSQL_PASSWORD|JWT_SECRET|JWT_EXPIRES_IN|LAMBDA_METRICS_URL|CORS_ORIGINS'
    $envCheckOut = & ssh @SshBase $envCheckCmd
    if ($LASTEXITCODE -ne 0 -or (($envCheckOut -join '') -notmatch 'ENV_KEYS_OK')) {
        Write-Error 'Verificación del .env remoto fallida: archivo ausente, vacío o con claves faltantes.'
    }
    Write-Host '.env remoto verificado (8 claves presentes).'
} finally {
    Remove-Item -LiteralPath $tempEnv -ErrorAction SilentlyContinue
}

# --- 2b. validar interpolación de Compose ANTES del up ---
# 'docker compose config' avisa por stderr ("variable is not set", solo nombres)
# pero sale con código 0; por eso se inspecciona el stderr sin imprimirlo nunca
# (el stdout, que sí contendría secretos, se descarta en la instancia).
Write-Host 'Validando configuración de Compose...'
$composeCheckCmd = @'
cd {0} || {{ echo COMPOSE_DIR_MISSING; exit 1; }}
warns=$(docker compose config 2>&1 >/dev/null) || {{ echo COMPOSE_CONFIG_ERROR; exit 1; }}
if printf '%s' "$warns" | grep -qi 'variable is not set'; then echo COMPOSE_VARS_MISSING; exit 1; fi
echo COMPOSE_CONFIG_OK
'@ -f $RemoteDir
$composeCheckOut = & ssh @SshBase $composeCheckCmd
if ($LASTEXITCODE -ne 0 -or (($composeCheckOut -join '') -notmatch 'COMPOSE_CONFIG_OK')) {
    Write-Error 'Validación de Docker Compose fallida: hay variables sin resolver en el .env remoto.'
}

# --- 3. levantar servicios (solo mysql + backend; el frontend va a S3+CloudFront) ---
Write-Host 'Levantando backend + MySQL...'
& ssh @SshBase "cd $RemoteDir && docker compose up -d --build mysql backend"
if ($LASTEXITCODE -ne 0) { Write-Error 'docker compose up fallo en la instancia.' }

& ssh @SshBase "cd $RemoteDir && docker compose ps"
Write-Host ''
Write-Host 'Despliegue de app completado.'
Write-Host "Backend: http://${Ec2Host}:${ApiPort}/api/health"
Write-Host 'Opcional (usuarios demo):'
Write-Host "  ssh -i $KeyFile $User@$Ec2Host 'cd $RemoteDir && docker compose exec -T backend npm run seed'"
