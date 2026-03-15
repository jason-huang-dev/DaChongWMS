FROM node:24-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL=/api
ARG VITE_ENABLE_TEST_SYSTEM=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_ENABLE_TEST_SYSTEM=$VITE_ENABLE_TEST_SYSTEM

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
