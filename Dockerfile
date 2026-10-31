FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

# ติดตั้งเฉพาะ dependencies ที่ใช้ตอนรันก่อน เพื่อให้ cache layer นี้ได้ถ้าโค้ดเปลี่ยนแต่ package ไม่เปลี่ยน
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# เซิร์ฟเวอร์ต้องใช้แค่ 4 โฟลเดอร์นี้ (ดู server/app.js และ server/index.js)
COPY server ./server
COPY shared ./shared
COPY public ./public
COPY data ./data

USER node
ENV PORT=3000
EXPOSE 3000

# รัน node ตรงๆ (ไม่ผ่าน npm) เพื่อให้ SIGTERM จาก `docker stop` ถึงเซิร์ฟเวอร์และปิดได้เรียบร้อย
CMD ["node", "server/index.js"]
