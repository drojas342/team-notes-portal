# Team Notes Portal

## Descripción

Portal web de equipo con un tablero compartido de notas, autenticación por
roles (ADMIN/USER), administración de usuarios y dashboard de métricas
calculadas mediante AWS Lambda.

## Funcionalidades

- **Autenticación y autorización**: login con JWT, middleware de autenticación
  que revalida usuario activo en BD, restricción por rol y cierre de sesión.
- **Administración de usuarios**: solo ADMIN; crear, editar, activar/desactivar
  desde el frontend, conservando siempre al menos un ADMIN activo.
- **Tablero colaborativo**: notas compartidas sin propietario; crear, editar,
  eliminar y mover con drag & drop con persistencia automática de posición.
- **Dashboard**: total de notas y distribución por estado (PENDING, IN_PROGRESS,
  DONE), calculados por la Lambda.
- **Persistencia**: MySQL en volumen Docker nombrado (`mysql_data`).
  `docker compose down` conserva el volumen y los datos;
  `docker compose down -v` elimina los volúmenes y debe evitarse cuando se
  quieran conservar los datos.
- **AWS**: infraestructura como código con SAM/CloudFormation (EC2, S3,
  CloudFront, Lambda, API Gateway).

## Roles

- **ADMIN**: todo lo de USER más administración de usuarios (crear, editar,
  activar/desactivar). Solo ADMIN ve la sección de administración.
- **USER**: autenticarse, ver/crear/editar/mover/eliminar notas del tablero
  compartido y ver el dashboard. Sin acceso a administración (403).

## Tecnologías

- **Backend**: Node.js 22, Express 5, Sequelize 6, JWT (`jsonwebtoken`),
  hash con `bcryptjs`, CORS configurable por entorno.
- **Frontend**: HTML + CSS + JavaScript vanilla, Bootstrap 5 por CDN
  (sin frameworks SPA).
- **Base de datos**: MySQL 8.
- **Dashboard/Lambda**: Node.js 22, sin dependencias, testeable con
  `node --test`.
- **Contenedores**: Docker + Docker Compose (imágenes Debian `node:22-slim`
  y `nginx:stable`).
- **AWS/IaC**: SAM/CloudFormation (`aws/template.yaml`), S3 + CloudFront
  con OAC, EC2 + EBS, API Gateway.

## Arquitectura

Local:

```text
Frontend (:8080 / :5500) → Express API (:3000) → MySQL (:3306)
```

Dashboard (las métricas siempre las calcula la Lambda):

```text
Frontend → Express GET /api/dashboard/metrics → Lambda POST /metrics
→ métricas → Express → Frontend
```

AWS (IaC con SAM/CloudFormation):

```text
CloudFront → S3 (frontend, bucket privado con OAC)
CloudFront /api/* → EC2:3000 (backend + MySQL en Docker)
Backend → API Gateway → Lambda (métricas)
```

## Requisitos previos

- Docker y Docker Compose (entorno principal).
- Node.js 22 solo si se ejecuta el backend o la Lambda fuera de Docker.
- AWS CLI y SAM CLI solo para la Lambda local (`sam local`) o el
  despliegue AWS.

## Ejecución local con Docker

```powershell
git clone https://github.com/drojas342/team-notes-portal.git
cd team-notes-portal
Copy-Item .env.example .env
# Editar .env con valores propios (ver .env.example; no usar secretos reales
# de otros entornos)
docker compose up -d --build
docker compose exec backend npm run seed
```

- Frontend: http://localhost:8080
- Backend: http://localhost:3000/api/health
- MySQL (solo inspección): localhost:3308
- Detener conservando datos: `docker compose down` (nunca `down -v` en uso normal)

## Usuarios demo

Cuentas **deliberadas de demostración** creadas por
`backend/seeders/demo-users.js` (idempotente; contraseñas con hash
`bcryptjs`). **No corresponden a secretos de producción.**

| Rol   | Email            | Contraseña |
|-------|------------------|------------|
| ADMIN | `admin@demo.com` | `Admin123!`  |
| USER  | `user@demo.com`  | `User123!`   |

## Lambda local

```powershell
cd lambda/dashboard
npm test                                   # pruebas unitarias (5 casos)
sam local start-api --port 3001            # POST http://127.0.0.1:3001/metrics
```

El backend la consume vía `LAMBDA_METRICS_URL`
(`http://host.docker.internal:3001/metrics` en Docker,
`http://127.0.0.1:3001/metrics` en ejecución directa).

## Estructura del proyecto

```text
backend/           # API Express (src/, Dockerfile, seeders/)
frontend/          # HTML/CSS/JS vanilla (Nginx en Docker)
lambda/dashboard/  # Función de métricas + tests + template SAM
aws/               # IaC: template.yaml, parameters/, scripts/, README.md
docker-compose.yml # mysql + backend + frontend + volumen mysql_data
```

## AWS

Infraestructura desplegable con SAM/CloudFormation: EC2 (backend + MySQL
en Docker, EBS persistente), S3 privado + CloudFront con OAC (origen S3 y
origen EC2 con behavior `/api/*`), Lambda + API Gateway, IAM mínimo y
Security Group (22 + 3000). Detalles de despliegue, post-despliegue y
teardown en `aws/README.md`. Sin secretos en el repo.

## Reglas y decisiones importantes

- Los usuarios inactivos (`is_active = false`) no pueden autenticarse ni
  usar rutas protegidas, aunque su JWT siga vigente.
- Siempre debe existir al menos un ADMIN activo (bloquea desactivar o
  degradar al último).
- Las notas son compartidas: sin propietario, cualquier usuario activo
  opera sobre todas.
- La posición de cada nota se guarda automáticamente al soltarla (y se
  normaliza al cargar/editar para que nunca quede fuera del tablero).
- Las métricas del dashboard las calcula exclusivamente la Lambda.
- Los datos de MySQL persisten mediante el volumen Docker `mysql_data`;
  en AWS, este volumen se encuentra sobre el EBS de la instancia.

## Alcance (fuera del proyecto)

- Tiempo real / WebSockets.
- Múltiples tableros.
- Columnas Kanban.
- Filtros.
- Registro público de usuarios (el alta la hace un ADMIN; el acceso
  inicial es vía seed demo).

## Decisiones de infraestructura actuales

- Sin RDS: MySQL corre en Docker sobre EC2 con volumen EBS.
- Sin ECS/Kubernetes: un `docker-compose.yml` por entorno.
- Sin frameworks frontend: HTML/CSS/JS vanilla + Bootstrap por CDN.
