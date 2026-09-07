FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci fails here: image ships npm 10, the lockfile was generated with npm 11.
RUN npm install --no-audit --no-fund
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
