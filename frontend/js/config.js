// Configuración del frontend (sin secretos).
//
// Selección automática, sin editar el archivo por entorno:
// - Servido desde localhost / 127.0.0.1 (Live Server, :5500) o desde
//   Docker local (:8080)  ->  http://localhost:3000/api
//   (el navegador llama directo al backend publicado en el host).
// - Servido desde cualquier otro host (CloudFront/AWS)  ->  '/api'
//   URL relativa al mismo dominio: el navegador llama a
//   https://<dominio>/api/* y CloudFront lo dirige al backend EC2.
//   Así no se hardcodea ningún dominio ni IP de AWS y se evita mixed-content.
// - file:// (sin hostname) se trata como local.

(function () {
  var hostname = (window.location && window.location.hostname) || '';
  var isLocal =
    hostname === '' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]';

  window.APP_CONFIG = {
    API_BASE_URL: isLocal ? 'http://localhost:3000/api' : '/api',
  };
})();
