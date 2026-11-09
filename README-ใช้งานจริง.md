# ระบบรายรับ–รายจ่าย แผนก IT โรงพยาบาลอากาศอำนวย

รุ่นนี้เป็นเว็บแอปแบบหลายผู้ใช้ แยกโค้ดตาม Clean Architecture โดยใช้ Node.js และ PostgreSQL ข้อมูลอยู่ในฐานข้อมูลของเซิร์ฟเวอร์ ไม่ได้เก็บในเบราว์เซอร์ ผู้ใช้เข้าผ่านเครือข่ายโรงพยาบาลได้เมื่อผู้ดูแลติดตั้งระบบและตั้งค่า HTTPS แล้ว

## สถานะ

ไฟล์ในโฟลเดอร์นี้เป็นชุดติดตั้งสำหรับนำขึ้นเซิร์ฟเวอร์ ยังไม่ได้ติดตั้งหรือเปิดให้บริการจริง เพราะขณะจัดทำยังไม่มีเซิร์ฟเวอร์ปลายทาง บัญชีผู้ใช้จริง หรือโดเมน HTTPS ของโรงพยาบาล ห้ามบันทึกยอดเงินจริงจนกว่าผู้ดูแลระบบจะติดตั้ง ทดสอบการสำรอง/กู้คืน และอนุมัติให้ใช้งาน

## สถาปัตยกรรมและข้อมูล

- เว็บแอป: Node.js 24 LTS ขึ้นไป
- ฐานข้อมูลกลาง: PostgreSQL 16 ใน Docker Compose
- ข้อมูลรายการ ผู้ใช้ session และประวัติการเปลี่ยนแปลงอยู่ใน Docker volume `postgres_data`
- รหัสผ่านเก็บเป็น hash ด้วย scrypt; session ใช้ cookie HttpOnly และ SameSite Strict; การเปลี่ยนข้อมูลตรวจ CSRF token
- รายการที่ยกเลิกจะไม่ถูกลบ แต่เปลี่ยนสถานะเป็น VOID พร้อมเหตุผลและผู้ยกเลิก ยอดสรุปนับเฉพาะรายการ ACTIVE
- role: ADMIN (บันทึก ยกเลิก และดู audit), EDITOR (บันทึก/ยกเลิกรายการ), VIEWER (ดูอย่างเดียว)
- แอปเปิดพอร์ต 3000 เฉพาะ loopback ของเซิร์ฟเวอร์ ต้องวาง reverse proxy ที่รองรับ HTTPS ไว้ด้านหน้า และห้ามเปิดพอร์ต PostgreSQL ออกเครือข่ายผู้ใช้

## โฟลเดอร์และไฟล์แต่ละส่วน

```text
Sanit Akkhara/
├── public/                  หน้าเว็บ JavaScript, CSS และโลโก้
├── deploy/                  ตัวอย่างการตั้งค่า Nginx/HTTPS
├── backups/                 โฟลเดอร์เก็บไฟล์สำรอง (สคริปต์สร้างเมื่อสั่งสำรอง)
├── src/
│   ├── domain/               กฎหลักของรายการบัญชี ไม่ผูกกับเว็บหรือ PostgreSQL
│   ├── application/          use cases: login, บันทึก/ยกเลิกรายการ, ดูแลผู้ใช้, นำเข้าข้อมูล
│   ├── infrastructure/       adapters เช่น PostgreSQL, scrypt และ session storage
│   └── interfaces/           ทางเข้า/ออกของ HTTP API และ CLI
├── server.js                composition root ประกอบ services/repositories แล้วเริ่มระบบ
├── compose.yaml             เปิดแอปและฐานข้อมูลด้วย Docker Compose
├── Dockerfile               วิธีประกอบ image ของเว็บแอป
├── package.json             รายการ package JavaScript
├── .env.example             ตัวอย่างค่าตั้งต้น; คัดลอกเป็น .env แล้วใส่ค่าจริง
├── .dockerignore            ไฟล์ที่ไม่ส่งเข้า Docker image
├── .gitignore               ไฟล์ลับ/ผลลัพธ์ที่ไม่ควรเก็บใน Git
├── backup.sh                สำรองฐานข้อมูลบน Linux
├── backup.ps1               สำรองฐานข้อมูลบน Windows PowerShell
├── README-ใช้งานจริง.md     คู่มือนี้
└── archive/legacy-browser-demo/  เว็บตัวอย่างเก่า เก็บข้อมูลในเบราว์เซอร์
    ├── it.html
    ├── it-ledger-v2.html
    └── it-ledger.js
```

ใน `public/` มี `index.html` (โครงหน้า), `app.js` (เรียก API และแสดงข้อมูล), `styles.css` (รูปแบบหน้าจอ) และ `akat-amnuai-logo.png` (โลโก้)

ภายใน `src/` แบ่งเป็น 4 ชั้น: `domain/` กำหนดกฎข้อมูล, `application/` ประสาน use cases, `infrastructure/` เชื่อม PostgreSQL/การ hash รหัสผ่าน, และ `interfaces/` รับ HTTP request หรือคำสั่ง CLI แล้วส่งต่อเข้า application การพึ่งพาควรไหลเข้าหา domain; ชั้นกฎหลักไม่ควร import โค้ดจาก PostgreSQL หรือ HTTP

รายละเอียดโฟลเดอร์ย่อย:

- `src/domain/ledger/entry.js` — ตรวจรูปแบบวันที่ จำนวนเงิน รายละเอียด และประเภทบัญชี
- `src/application/` — use cases สำหรับ login, session, รายการ, audit, บัญชีผู้ใช้ และการนำเข้าข้อมูลเก่า
- `src/infrastructure/postgres/` — schema, repositories และ transaction unit of work
- `src/infrastructure/security/` — adapter สำหรับ hash และตรวจรหัสผ่าน
- `src/interfaces/http/` — controller, request/response และการส่งไฟล์หน้าเว็บ
- `src/interfaces/cli/` — คำสั่งเพิ่ม/ปิดผู้ใช้ รีเซ็ตรหัสผ่าน และนำเข้าข้อมูล

หน้าเว็บแยกอยู่ที่ `public/` โดย `app.js` เรียก API; ข้อมูลไม่ได้อยู่ใน JavaScript ฝั่งหน้าเว็บ

ระบบส่วนกลางรุ่น Clean Architecture เริ่มที่ `server.js` แล้วใช้ `src/` และ `public/`; ไฟล์ตัวอย่างเก่าถูกย้ายไว้ใน `archive/legacy-browser-demo/` และยังเก็บข้อมูลเฉพาะเบราว์เซอร์

ข้อมูลจริงอยู่ใน Docker volume `postgres_data` ซึ่ง Docker จัดการเอง ไม่ใช่โฟลเดอร์ในโครงการ `backups/` เก็บสำเนาฐานข้อมูลที่สร้างโดยสคริปต์ ห้ามแชร์ไฟล์ `.env` หรือไฟล์ backup และอย่ารัน `docker compose down -v` เพราะ `-v` จะลบ volume ฐานข้อมูลด้วย

## ข้อกำหนดเซิร์ฟเวอร์ที่แนะนำ

ใช้ Linux VM/เซิร์ฟเวอร์ภายในโรงพยาบาลที่ฝ่าย IT ดูแล อย่างน้อย 2 vCPU, RAM 4 GB, SSD 50 GB พร้อมการเข้ารหัสดิสก์, Docker Engine + Docker Compose, DNS ภายใน และ reverse proxy พร้อมใบรับรอง TLS ที่เครื่องผู้ใช้เชื่อถือได้ สำหรับผู้ใช้พร้อมกัน 1–5 คน ขนาดนี้เป็นจุดเริ่มต้น ควรเฝ้าดูทรัพยากรและพื้นที่จริง

## ติดตั้งครั้งแรก

1. ติดตั้ง Docker Engine/Compose และตั้ง DNS/HTTPS ภายในองค์กรก่อน
2. คัดลอกโฟลเดอร์นี้ไปเซิร์ฟเวอร์ เช่น `/opt/it-ledger`; คำสั่งขั้นตอนถัดไปให้รันจากโฟลเดอร์นี้ โดยเริ่มด้วย `cd /opt/it-ledger` แล้วคัดลอก `.env.example` เป็น `.env` และจำกัดสิทธิ์ด้วย `chmod 600 .env`
3. สร้างรหัสผ่านฐานข้อมูลแบบสุ่ม 64 ตัวอักษร hex (เช่น `openssl rand -hex 32`) และรหัสผ่าน ADMIN ที่ไม่ซ้ำอย่างน้อย 16 ตัวอักษร (เช่น `openssl rand -hex 24`) จากนั้นกรอกใน `.env` ด้วย editor บนเซิร์ฟเวอร์ ตั้ง `APP_ORIGIN` ให้ตรงกับ URL HTTPS แบบไม่มี `/` ต่อท้าย เช่น `https://it-ledger.intra.example.go.th` เปลี่ยนค่าทุกตัวอย่าง `REPLACE...`/`CHANGE_ME...` ก่อน start
4. วางตัวอย่าง Nginx ที่ `deploy/nginx-it-ledger.conf.example` ใน config directory ของ Nginx (Debian/Ubuntu ใช้ `/etc/nginx/sites-available/it-ledger`) แก้ `server_name`, certificate/key และสร้าง symlink ใน `sites-enabled` ตามนโยบายเครื่อง จากนั้นรัน `sudo nginx -t` และ `sudo systemctl reload nginx` ตัวอย่างนี้กำหนดให้ Nginx ทำงานบน host เดียวกับแอป
   ตัวอย่างคำสั่งบน Debian/Ubuntu (ก่อนสั่ง reload ให้แก้ชื่อโดเมนและ certificate/key ในไฟล์ที่คัดลอกแล้ว):

   ```sh
   sudo cp deploy/nginx-it-ledger.conf.example /etc/nginx/sites-available/it-ledger
   sudo nano /etc/nginx/sites-available/it-ledger
   sudo ln -s /etc/nginx/sites-available/it-ledger /etc/nginx/sites-enabled/it-ledger
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. สตาร์ตฐานข้อมูลและแอป:

   ```sh
   docker compose up -d --build
   docker compose logs --tail 100 app
   docker compose ps
   ```

6. เปิด URL HTTPS ผ่าน reverse proxy แล้วเข้าสู่ระบบด้วย `INITIAL_ADMIN_USERNAME` และ `INITIAL_ADMIN_PASSWORD` ตรวจว่าหน้าเว็บและโลโก้แสดง และ `/api/health` ตอบสถานะ `ok`
7. เมื่อยืนยันว่าเข้า ADMIN ได้แล้ว ให้ลบ `INITIAL_ADMIN_PASSWORD` ออกจาก `.env` และ restart ด้วย `docker compose up -d`; บัญชีที่สร้างแล้วอยู่ในฐานข้อมูล
8. เพิ่มบัญชีให้เจ้าหน้าที่แต่ละคนแยกกัน ไม่ใช้บัญชีร่วม:

   ```sh
   docker compose exec -it app node server.js create-user ชื่อผู้ใช้ EDITOR
   docker compose exec -it app node server.js create-user ชื่อผู้ใช้ VIEWER
   docker compose exec -it app node server.js disable-user ชื่อผู้ใช้
   docker compose exec -it app node server.js reset-password ชื่อผู้ใช้
   ```

   ระบบรับรหัสผ่านแบบปิดการแสดงตัวอักษรใน terminal

## สำรองและกู้คืน

บน Linux ให้รันในโฟลเดอร์โครงการ:

```sh
bash ./backup.sh
```

บน Windows PowerShell:

```powershell
.\backup.ps1
```

ไฟล์ dump จะอยู่ในโฟลเดอร์ `backups` บนเครื่องเซิร์ฟเวอร์ ไฟล์นี้ยังไม่ใช่แผนสำรองที่เพียงพอ ต้องตั้งงานสำรองอัตโนมัติไปยังพื้นที่จัดเก็บอีกชุดที่โรงพยาบาลควบคุม จำกัดสิทธิ์ และเข้ารหัส จากนั้นทดสอบกู้คืนเป็นระยะก่อนเปิดใช้จริง

ตั้ง cron/Task Scheduler ให้รัน backup ตามระยะที่ฝ่าย IT อนุมัติ และส่งสำเนาเข้าพื้นที่สำรองแยกเครื่องซึ่งเข้ารหัส การกู้คืนจะเขียนทับข้อมูลในฐานข้อมูล ให้ทดลองกับ staging และสำรองข้อมูลปัจจุบันก่อนทุกครั้ง

ตัวอย่างกู้คืนจาก custom dump (คำสั่งนี้เขียนทับข้อมูลปลายทาง ให้ DBA ทำในช่วง maintenance หลังสำรองข้อมูลปัจจุบันและตรวจไฟล์แล้วเท่านั้น):

```sh
docker compose cp ./backups/it-ledger-YYYYMMDD-HHMMSS.dump db:/tmp/restore.dump
docker compose exec -T db pg_restore -U ledger_app -d it_ledger --clean --if-exists /tmp/restore.dump
docker compose exec -T db rm -f /tmp/restore.dump
```

## วิธีใช้งานประจำวัน

1. เข้า URL HTTPS จากเครือข่ายโรงพยาบาล และล็อกอินด้วยบัญชีส่วนตัว
2. เลือกประเภทรายการ ระบุวันที่ รายละเอียด หมวดหมู่ และจำนวนเงิน แล้วบันทึก
3. ใช้ช่องค้นหา/ตัวกรอง ตรวจยอดรวม และส่งออก CSV เมื่อต้องการเปิดด้วย Excel
4. หากลงรายการผิด ให้กด “ยกเลิก” และใส่เหตุผล ระบบจะคงรายการและประวัติไว้ แต่ไม่นำรายการที่ยกเลิกไปคิดในยอดรวม
5. ADMIN ใช้ปุ่ม “ประวัติการเปลี่ยนแปลง” เพื่อตรวจการเพิ่มและยกเลิกรายการ
6. ออกจากระบบเมื่อเลิกใช้เครื่องร่วมกัน และอย่ากรอกข้อมูลผู้ป่วย/สุขภาพในรายละเอียด

## ย้ายข้อมูลจากรุ่นเดิม

ข้อมูลใน `archive/legacy-browser-demo/it-ledger-v2.html` เดิมอยู่ใน localStorage ของเบราว์เซอร์ และไม่ถูกส่งขึ้นมาเอง ก่อนเลิกใช้เครื่องเดิมให้เปิดหน้าเดิมในเบราว์เซอร์โปรไฟล์เดิม แล้วกด **สำรองข้อมูล (JSON)** จากนั้นตรวจทานยอดกับเอกสารการเงิน

คัดลอก JSON ไปยังเซิร์ฟเวอร์ แล้วสั่ง:

```sh
docker compose cp ./สำรองข้อมูลรายรับรายจ่าย_IT.json app:/tmp/legacy.json
docker compose exec -it app node server.js import-json /tmp/legacy.json
```

ตรวจยอดและรายการในระบบใหม่เทียบกับเอกสารต้นฉบับก่อนอนุมัติใช้งาน การนำเข้าเก็บประวัติไว้และข้ามรหัสรายการที่เคยนำเข้าแล้ว

## ข้อจำกัดที่ต้องจัดการก่อนรับเงินจริง

- ให้ฝ่าย IT/ความมั่นคงปลอดภัยของโรงพยาบาลทบทวน reverse proxy, TLS, firewall, สิทธิ์เข้าถึงเซิร์ฟเวอร์, การเข้ารหัสดิสก์และสำรองข้อมูล
- ให้ผู้รับผิดชอบการเงินกำหนดหมวดงบประมาณ รูปแบบรายงาน/งวดบัญชี และขั้นตอนตรวจสอบยอดก่อนใช้งาน
- ระบบยังไม่มี workflow อนุมัติรายการ, การผูกใบสำคัญ/เลขที่เอกสาร, รายงานตามแบบราชการ หรือเชื่อมระบบการเงินเดิม
- ยังไม่ได้ทดสอบบนเซิร์ฟเวอร์/เครือข่ายของโรงพยาบาล; ต้องตรวจการทำงาน การกู้คืน backup และการยอมรับจากหน่วยงานก่อนเปิดใช้
- ห้ามกรอกข้อมูลผู้ป่วยหรือข้อมูลสุขภาพในรายละเอียดรายการ
