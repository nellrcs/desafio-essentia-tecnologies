# Estágio 1: Build
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Estágio 2: Serve com Nginx
FROM nginx:alpine

# Copia os arquivos estáticos gerados no estágio anterior
# Nota: Ajuste o caminho 'dist/cliente/browser' se necessário baseado no seu angular.json
COPY --from=build /app/dist/cliente/browser /usr/share/nginx/html

# Copia uma configuração customizada para o Nginx se necessário
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
