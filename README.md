# ระบบบันทึกรายรับ–รายจ่ายแผนก IT

เว็บแอปสำหรับบันทึกรายรับและรายจ่ายของแผนก IT มีบัญชีผู้ใช้หลายระดับ เก็บข้อมูลไว้ใน PostgreSQL และเปิดใช้งานผ่านเว็บเบราว์เซอร์

> **สถานะ:** ชุดโค้ดนี้ยังไม่ได้ติดตั้งหรืออนุมัติให้ใช้บันทึกยอดเงินจริง ต้องให้ผู้ดูแลระบบตั้งค่า HTTPS และทดสอบการสำรอง/กู้คืนก่อนใช้งานจริง

## ความสามารถ

- บันทึกรายรับและรายจ่าย พร้อมค้นหา กรอง และส่งออก CSV
- บัญชีผู้ใช้แยกตามบทบาท `ADMIN`, `EDITOR` และ `VIEWER`
- ยกเลิกรายการพร้อมเหตุผล โดยเก็บรายการและประวัติการเปลี่ยนแปลงไว้ตรวจสอบ
- นำเข้าข้อมูลจากเว็บรุ่นเดิมที่เก็บไว้ในเบราว์เซอร์
- สำรองฐานข้อมูลด้วยสคริปต์สำหรับ Linux และ Windows PowerShell

## เทคโนโลยี

Node.js 24, PostgreSQL 16, Docker Compose และหน้าเว็บ HTML/CSS/JavaScript แบ่งโค้ดฝั่งเซิร์ฟเวอร์ตาม Clean Architecture

## เริ่มใช้งานด้วย Docker Compose

ต้องมี Docker Engine และ Docker Compose บนเครื่องที่จะรันระบบ

1. ดาวน์โหลดหรือ clone repository นี้ แล้วเข้าโฟลเดอร์โครงการ
2. สร้างไฟล์ `.env` จาก `.env.example` และแก้ค่าตัวอย่างทั้งหมด:

   ```sh
   cp .env.example .env
   ```

   กำหนด `POSTGRES_PASSWORD` เป็นค่าสุ่มที่ยาวและปลอดภัย, ตั้ง `INITIAL_ADMIN_PASSWORD` เป็นรหัสผ่านที่ไม่ซ้ำ และแก้ `APP_ORIGIN` ให้ตรงกับ URL HTTPS จริงแบบไม่มี `/` ต่อท้าย ตัวอย่างสร้างรหัสสุ่มบน Linux: `openssl rand -hex 32`.

3. สร้างและเริ่มแอปกับฐานข้อมูล:

   ```sh
   docker compose up -d --build
   docker compose ps
   docker compose logs --tail 100 app
   ```

4. เปิด URL HTTPS ที่ตั้งไว้ แล้วเข้าสู่ระบบด้วย `INITIAL_ADMIN_USERNAME` และ `INITIAL_ADMIN_PASSWORD` จาก `.env` เมื่อตรวจสอบว่าบัญชีผู้ดูแลใช้ได้แล้ว ให้ลบ `INITIAL_ADMIN_PASSWORD` ออกจาก `.env` และรัน `docker compose up -d` อีกครั้ง

ตัวอย่าง Docker Compose ผูกแอปไว้ที่ `127.0.0.1:3000` จึงต้องตั้ง reverse proxy เช่น Nginx พร้อม HTTPS ไว้ด้านหน้า ตัวอย่างการตั้งค่าและขั้นตอนติดตั้งฉบับเต็มอยู่ใน [คู่มือติดตั้งและดูแลระบบ](<README-ใช้งานจริง.md>)

## จัดการผู้ใช้

สั่งคำสั่งต่อไปนี้จาก container แอป ระบบจะให้ป้อนรหัสผ่านโดยไม่แสดงตัวอักษรใน terminal:

```sh
docker compose exec -it app node server.js create-user ชื่อผู้ใช้ EDITOR
docker compose exec -it app node server.js create-user ชื่อผู้ใช้ VIEWER
docker compose exec -it app node server.js disable-user ชื่อผู้ใช้
docker compose exec -it app node server.js reset-password ชื่อผู้ใช้
```

## สำรองข้อมูล

รันในโฟลเดอร์โครงการบนเครื่องเซิร์ฟเวอร์:

```sh
bash ./backup.sh
```

หรือบน Windows PowerShell:

```powershell
.\backup.ps1
```

เก็บไฟล์สำรองในพื้นที่ที่จำกัดสิทธิ์และเข้ารหัส พร้อมทดสอบกู้คืนเป็นระยะ ข้อมูลฐานข้อมูลอยู่ใน Docker volume `postgres_data`; **อย่าใช้ `docker compose down -v`** เพราะจะลบ volume นี้

## โครงสร้างโครงการ

- `public/` — หน้าเว็บและไฟล์ประกอบ
- `src/domain/` — กฎข้อมูลหลัก
- `src/application/` — กรณีใช้งานและบริการของระบบ
- `src/infrastructure/` — PostgreSQL และระบบรักษาความปลอดภัย
- `src/interfaces/` — HTTP API และคำสั่ง CLI
- `deploy/` — ตัวอย่าง reverse proxy สำหรับ Nginx
- `archive/legacy-browser-demo/` — เว็บตัวอย่างรุ่นเก่าที่เก็บข้อมูลในเบราว์เซอร์ ไม่ใช่ระบบฐานข้อมูลส่วนกลาง

ดูรายละเอียดเพิ่มเติมได้ที่ [คู่มือติดตั้งและดูแลระบบ](<README-ใช้งานจริง.md>) และ [โน้ตโครงสร้างระบบ](<โน้ตโครงสร้างระบบ.md>)

## ความปลอดภัยและข้อมูล

- ห้าม commit หรือแชร์ไฟล์ `.env` และไฟล์สำรองฐานข้อมูล
- ตั้ง HTTPS และจำกัดการเข้าถึงเซิร์ฟเวอร์ตามนโยบายของหน่วยงานก่อนเปิดใช้งาน
- อย่ากรอกข้อมูลผู้ป่วยหรือข้อมูลสุขภาพในรายละเอียดรายการ
- ก่อนใช้กับข้อมูลจริง ให้ผู้ดูแลทบทวนการตั้งค่าและยืนยันว่ากู้คืนข้อมูลสำรองได้
