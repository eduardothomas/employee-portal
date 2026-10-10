FROM node:22-alpine AS build
WORKDIR /web
COPY . .
RUN npm ci && npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/apps/employee/dist /usr/share/nginx/employee
COPY --from=build /web/apps/admin/dist /usr/share/nginx/admin
EXPOSE 8080 8081
