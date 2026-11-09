# ใช้ Node LTS ภายใน container เครื่อง host จึงไม่ต้องติดตั้ง Node เอง
FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
# ติดตั้งเฉพาะ package ที่ใช้รันเซิร์ฟเวอร์
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
# คัดลอกจุดประกอบระบบ ชั้น Clean Architecture และหน้าเว็บเข้า image
COPY server.js ./
COPY src ./src
COPY public ./public
# รันด้วยผู้ใช้สิทธิ์ต่ำ ไม่ใช้ root ภายใน container
USER node
EXPOSE 3000
CMD ["node", "server.js"]
