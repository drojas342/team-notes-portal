const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const noteRoutes = require('./routes/note.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

// Orígenes permitidos para el frontend.
// Por defecto: entornos locales. Para otros entornos (p. ej. CloudFront),
// definir CORS_ORIGINS como lista separada por comas:
// CORS_ORIGINS=https://d123abc.cloudfront.net,http://localhost:8080
const defaultOrigins = ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:8080'];
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOrigins = allowedOrigins.length > 0 ? allowedOrigins : defaultOrigins;

app.use(
  cors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  })
);

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API funcionando correctamente',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/dashboard', dashboardRoutes);

module.exports = app;
