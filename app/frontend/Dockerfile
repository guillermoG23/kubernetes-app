#### Stage 1: Build the react application
FROM node:12.4.0-alpine as build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install @elastic/apm-rum --save
RUN npm install
COPY . ./
RUN npm run build

#### Stage 2: Serve the React application from Nginx 
FROM nginx:1.17.0-alpine
ARG PORT=80
COPY --from=build /app/build /var/www
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
ENTRYPOINT ["nginx","-g","daemon off;"]
