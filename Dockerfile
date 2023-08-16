FROM node:16.20.2

WORKDIR /app

COPY server/ /app
COPY package.json /app

RUN npm install

EXPOSE 3001

ENTRYPOINT [ "node", "app.js" ]