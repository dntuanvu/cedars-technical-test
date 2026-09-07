FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci fails here: image ships npm 10, the lockfile was generated with npm 11.
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main.js"]
