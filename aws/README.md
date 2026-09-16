# Team Notes Portal — Infraestructura AWS (desplegada y validada)

## Arquitectura

```
Navegador ──HTTPS──> CloudFront ──(OAC)──> S3 (frontend estático privado)
Navegador ──HTTPS──> CloudFront ──/api/*──> EC2:3000 (backend Express + MySQL en Docker, EBS 20 GiB)
EC2 backend ──HTTPS──> API Gateway ──> Lambda dashboard-metrics (Node.js 22)
```

- **EC2**: Amazon Linux 2023 (`t3.micro`), Docker + Compose vía UserData. Se reutiliza `docker-compose.yml` (servicios `mysql` + `backend`); la persistencia vive en el volumen EBS raíz a través del volumen Docker `mysql_data`. Sin RDS, a propósito.
- **Lambda**: reutiliza `lambda/dashboard` (`CodeUri: ../lambda/dashboard`), misma lógica local. Expuesta con `POST /metrics` en API Gateway. El backend la invoca por HTTP igual que con SAM Local.
- **Frontend**: S3 privado + CloudFront con Origin Access Control (el bucket nunca es público). Las peticiones a `/api/*` las dirige CloudFront al backend EC2 (behavior dedicado), evitando mixed-content.
- **IAM**: rol mínimo para EC2 solo con `AmazonSSMManagedInstanceCore` (Session Manager). La Lambda usa el rol básico que crea SAM (solo logs).

## Recursos creados (template.yaml)

EC2 (`BackendInstance`), Security Group (22 + 3000), IAM Role + Instance Profile, S3 (`FrontendBucket`), OAC, CloudFront (origen S3 + origen EC2 con behavior `/api/*`), BucketPolicy, Lambda (`DashboardMetricsFunction`) + API Gateway, Outputs (CloudFrontURL, MetricsApiUrl, EC2PublicIp/Dns, BackendApiUrl).

## Prerrequisitos

- AWS CLI y SAM CLI instalados y credenciales configuradas (`aws configure`).
- Un EC2 Key Pair existente en la región (ver `KeyPairName`).
- No se requiere nada del entorno local salvo los archivos del repo.

## Parámetros (`parameters/dev.json`)

| Parámetro     | Ejemplo           | Notas                                  |
|---------------|-------------------|----------------------------------------|
| ProjectName   | team-notes-dev    | Prefijo de recursos                    |
| InstanceType  | t3.micro          | Suficiente para la prueba              |
| KeyPairName   | CHANGEME          | Debe existir en la región              |
| SSHLocation   | 0.0.0.0/0         | Recomendado: tu IP `/32`               |
| ApiPort       | 3000              | Debe coincidir con el backend          |
| VolumeSize    | 20                | GiB del EBS raíz                       |
| LatestAmiId   | (SSM público)     | Sin hardcodear AMI ID                  |

Secretos (`MYSQL_*`, `JWT_SECRET`, `.env`): **nunca** van en el template ni en el repo; se crean directamente en la instancia (ver despliegue).

## Validación / despliegue / eliminación

El stack `team-notes-dev` fue desplegado en `us-east-1` con estos scripts (siguen siendo válidos para reproducir el despliegue). El teardown **no** se ha ejecutado: la infraestructura sigue desplegada.

```powershell
cd aws
.\scripts\validate.ps1
.\scripts\deploy.ps1 -StackName team-notes-dev -Region us-east-1
.\scripts\teardown.ps1 -StackName team-notes-dev -Region us-east-1
```

`deploy` y `teardown` piden confirmación escrita (`DESPLEGAR` / `ELIMINAR`); `deploy` además deja la confirmación del changeset de SAM.

## Post-despliegue (aplicado)

Código en EC2: el UserData solo instala Docker/Compose y crea `/opt/team-notes`. El código se entregó con `deploy-app-ec2.ps1` (SCP con el Key Pair, secretos pedidos por teclado sin guardarse en disco local, `.env` escrito en la instancia con `LAMBDA_METRICS_URL` = API Gateway y `CORS_ORIGINS` = URL CloudFront). El script levanta los servicios necesarios de Docker Compose (`mysql` y `backend`; el frontend va a S3).

```powershell
cd aws
.\scripts\deploy-app-ec2.ps1 -Ec2Host <DNS sin puerto> `
  -KeyFile <tu-key>.pem `
  -MetricsApiUrl <output MetricsApiUrl del stack> `
  -CloudFrontUrl https://<xxx>.cloudfront.net
```

Backend y MySQL se ejecutan mediante Docker Compose en EC2. La persistencia de MySQL (volumen Docker `mysql_data` sobre EBS) fue comprobada después de reiniciar los contenedores: los datos se conservan.

Frontend en S3 (sin editar nada a mano):

```powershell
aws s3 sync ..\frontend\ s3://<FrontendBucketName> --delete
```

`frontend/js/config.js` detecta el entorno automáticamente: en `localhost` / `127.0.0.1` / `::1` / `file://` usa `http://localhost:3000/api`; servido desde cualquier otro host (incluido CloudFront) usa `/api` relativo. Por tanto se sube tal cual. `/api` lo resuelve CloudFront hacia el backend EC2 con el behavior `/api/*` (sin caché, reenviando `Authorization`).

No poner secretos en `config.js`. CORS en AWS: el navegador envía `Origin: https://<CloudFront>`, cubierto por `CORS_ORIGINS`; el soporte local (`5500`, `8080`, vacío) no cambia.

## Decisiones de red (fase actual)

- Puerto 3000 abierto en el SG: CloudFront lo necesita como origen y el diagnóstico directo también. No se restringe a IPs de CloudFront en esta fase (requeriría lista gestionada de prefijos); documentado en el template.
- SSH 22 limitado por `SSHLocation` (estrechar a tu IP `/32`).
- MySQL NO expuesto: solo vive en la red interna de Docker. El mapeo `3308:3306` del compose publica el puerto en el host, pero el SG no lo abre, así que desde internet es inalcanzable.

## Cambios aplicados (compatibles con local)

- **Frontend**: `frontend/js/config.js` con detección automática de entorno (`window.APP_CONFIG.API_BASE_URL`): localhost/127.0.0.1/::1/file:// → `http://localhost:3000/api`; cualquier otro host → `'/api'` relativo. `api.js` utiliza `window.APP_CONFIG.API_BASE_URL` y conserva un fallback local. `index.html` y `dashboard.html` cargan `config.js` antes que `api.js`.
- **Backend CORS**: `app.js` acepta `CORS_ORIGINS` (lista separada por comas); vacío = orígenes locales de siempre. Sin `*` (hay autenticación Bearer).
- Sin cambios en Lambda, modelos, rutas, autenticación ni lógica del tablero.

## Estado de validación

Comprobado contra el despliegue AWS:

- Frontend servido por CloudFront.
- Login con usuarios demo.
- Creación y persistencia de notas.
- Movimiento de notas y persistencia de posición.
- Administración de usuarios.
- Roles ADMIN/USER.
- Activación/desactivación de usuarios.
- Dashboard y métricas.
- Flujo del Dashboard mediante Lambda.
- Persistencia de MySQL después de reiniciar Docker en EC2.

## Costos del despliegue actual

- EC2 `t3.micro` + EBS gp3 20 GiB: costo por hora/GB-mes (principal, activo mientras el stack exista).
- S3 + CloudFront: centavos para esta escala (hay capa gratuita el primer año).
- Lambda + API Gateway: dentro de capa gratuita para este uso.
- `teardown.ps1` elimina todo cuando se decida; vaciar el bucket es requisito previo.

## Compatibilidad local

El entorno local sigue funcionando igual: `docker compose`, SAM Local y ejecución directa no se ven afectados por el despliegue AWS. Los cambios de esta fase (`config.js` con detección automática, `CORS_ORIGINS` opcional) mantienen el comportamiento local por defecto.
