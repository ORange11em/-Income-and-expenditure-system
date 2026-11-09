'use strict';

// จุดประกอบระบบ: สร้าง adapters/services แล้วเริ่ม HTTP server หรือคำสั่ง CLI
const path = require('node:path');
const { Pool } = require('pg');
const { initializeDatabase } = require('./src/infrastructure/postgres/schema');
const { PostgresUnitOfWork } = require('./src/infrastructure/postgres/unitOfWork');
const { PostgresLedgerRepository } = require('./src/infrastructure/postgres/ledgerRepository');
const { PostgresAuditRepository } = require('./src/infrastructure/postgres/auditRepository');
const { PostgresUserRepository } = require('./src/infrastructure/postgres/userRepository');
const { PostgresSessionRepository } = require('./src/infrastructure/postgres/sessionRepository');
const { ScryptPasswordHasher } = require('./src/infrastructure/security/passwordHasher');
const { LoginFailureTracker } = require('./src/application/loginFailureTracker');
const { bootstrapAdmin } = require('./src/application/bootstrapAdmin');
const { createAuthService } = require('./src/application/authService');
const { createLedgerService } = require('./src/application/ledgerService');
const { createUserAdministrationService } = require('./src/application/userAdministrationService');
const { createLegacyImportService } = require('./src/application/importLegacyItems');
const { createHttpServer } = require('./src/interfaces/http/createHttpServer');
const { runCli } = require('./src/interfaces/cli/commands');

const PORT = Number(process.env.PORT || 3000);
const APP_ORIGIN = process.env.APP_ORIGIN;
const COOKIE_SECURE = process.env.COOKIE_SECURE !== 'false';
const PUBLIC_DIRECTORY = path.join(__dirname, 'public');

// Infrastructure adapters: เชื่อม PostgreSQL, hash รหัสผ่าน และเก็บ session ฝั่งเซิร์ฟเวอร์
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});
const unitOfWork = new PostgresUnitOfWork(pool);
const ledgerRepository = new PostgresLedgerRepository(pool);
const auditRepository = new PostgresAuditRepository(pool);
const userRepository = new PostgresUserRepository(pool);
const sessionRepository = new PostgresSessionRepository(pool);
const passwordHasher = new ScryptPasswordHasher();

// Application services รับ repositories ผ่าน dependency injection และไม่เปิด SQL connection เอง
const services = {
  auth: createAuthService({
    userRepository,
    sessionRepository,
    passwordHasher,
    loginFailures: new LoginFailureTracker(),
    sessionDays: 8
  }),
  ledger: createLedgerService({ ledgerRepository, auditRepository, unitOfWork }),
  userAdministration: createUserAdministrationService({
    userRepository, sessionRepository, auditRepository, passwordHasher, unitOfWork
  }),
  legacyImport: createLegacyImportService({ userRepository, ledgerRepository, auditRepository, unitOfWork })
};

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (/CHANGE_ME|REPLACE_WITH/.test(process.env.DATABASE_URL)) throw new Error('Replace the database password placeholder before starting');

  await initializeDatabase(pool);
  await bootstrapAdmin({
    userRepository,
    passwordHasher,
    username: process.env.INITIAL_ADMIN_USERNAME,
    password: process.env.INITIAL_ADMIN_PASSWORD
  });

  // ถ้าเป็นคำสั่งดูแลระบบ/นำเข้าข้อมูล ให้ทำงานแล้วจบโดยไม่เปิดเว็บเซิร์ฟเวอร์
  if (await runCli({
    argv: process.argv,
    userAdministration: services.userAdministration,
    legacyImport: services.legacyImport
  })) {
    await pool.end();
    return;
  }

  if (!APP_ORIGIN) throw new Error('APP_ORIGIN is required and must exactly match the HTTPS browser origin');
  if (process.env.NODE_ENV === 'production' && !COOKIE_SECURE) throw new Error('COOKIE_SECURE must be true in production');
  if (await userRepository.countActiveAdmins() < 1) {
    throw new Error('No active ADMIN account exists. Set initial administrator credentials and restart.');
  }

  const server = createHttpServer({
    services,
    publicDirectory: PUBLIC_DIRECTORY,
    expectedOrigin: APP_ORIGIN,
    secureCookie: COOKIE_SECURE,
    healthCheck: () => pool.query('SELECT 1')
  });
  server.listen(PORT, '0.0.0.0', () => console.log(`IT ledger listening on port ${PORT}`));

  // ลบ session ที่หมดอายุเป็นระยะ ไม่ให้ตารางค้างสะสม
  const sessionCleanup = setInterval(() => {
    sessionRepository.cleanExpired().catch(error => console.error('Session cleanup failed:', error.message));
  }, 60 * 60 * 1000);
  sessionCleanup.unref();

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(async () => {
      clearInterval(sessionCleanup);
      await pool.end();
      process.exit(0);
    }));
  }
}

main().catch(async error => {
  console.error('Startup/CLI failed:', error.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
