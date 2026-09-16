# Team Notes Portal - backend Express (Node.js 22).
# Variante -slim (Debian): las imágenes Alpine no ejecutan en este Docker Desktop.
FROM node:22-slim

WORKDIR /app

# Solo manifiestos primero para aprovechar la caché de capas.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Código de la aplicación (sin devDependencies ni .env).
# Se incluye seeders/ para poder poblar usuarios demo con:
# docker compose exec backend npm run seed
COPY src/ ./src/
COPY seeders/ ./seeders/

EXPOSE 3000

# Usa el script "start" existente: node src/server.js
CMD ["npm", "start"]
