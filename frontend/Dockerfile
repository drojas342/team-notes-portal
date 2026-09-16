# Team Notes Portal - frontend estático servido con Nginx.
# Variante Debian: las imágenes Alpine no ejecutan en este Docker Desktop.
FROM nginx:stable

COPY index.html dashboard.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
