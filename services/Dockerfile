FROM node:16-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install pm2@latest -g

RUN npm install

RUN npm install -D ts-node
RUN npm install -D typescript
RUN pm2 install typescript

COPY . .

RUN npm run compile

CMD [ "pm2-runtime", "ecosystem.config.js" ]
