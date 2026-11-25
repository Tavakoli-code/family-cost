import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { CategoryType } from '@prisma/client';
import request from 'supertest';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { createValidationPipe } from '../src/common/pipes/app-validation.pipe';
import { JwtStrategy } from '../src/modules/auth/jwt.strategy';
import { FamiliesModule } from '../src/modules/families/families.module';
import { FamiliesService } from '../src/modules/families/families.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

const databaseUrl = process.env.FAMILIES_TEST_DATABASE_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;
const path = '/api/v1/families';
const secret = 'x'.repeat(40);
const userId = randomUUID();

const expectedKeys = {
  EXPENSE: [
    'food',
    'health',
    'education',
    'fun',
    'transport',
    'internet_phone',
    'housing',
    'utilities',
    'clothing',
    'kids',
    'gifts_guests',
    'charity',
    'other',
  ],
  INCOME: ['salary', 'business', 'remittance', 'gift', 'income_other'],
};

describeWithPostgres('Family creation (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let service: FamiliesService;
  const authorization = `Bearer ${new JwtService({ secret }).sign({ sub: userId })}`;

  beforeAll(async () => {
    // Use a dedicated, migrated test schema with the application tables.
    const testUrl = new URL(databaseUrl!);
    const schema = testUrl.searchParams.get('schema');
    if (!schema?.startsWith('families_test_')) {
      throw new Error(
        'FAMILIES_TEST_DATABASE_URL must target a dedicated families_test_ schema',
      );
    }
    prisma = new PrismaService({ datasourceUrl: testUrl.toString() });
    const moduleRef = await Test.createTestingModule({
      imports: [FamiliesModule, PrismaModule, PassportModule],
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_ACCESS_SECRET: secret }),
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    service = moduleRef.get(FamiliesService);
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    await app.init();
    await prisma.user.create({
      data: {
        id: userId,
        fullName: 'Test Owner',
        email: `${userId}@example.com`,
        passwordHash: 'unused',
      },
    });
  });

  afterAll(async () => {
    try {
      if (app) {
        await prisma.family.deleteMany({ where: { ownerId: userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
      }
    } finally {
      await app?.close();
    }
  });

  it('requires a JWT and rejects client-supplied ownership', async () => {
    await request(app.getHttpServer())
      .post(path)
      .send({ name: 'Family' })
      .expect(401);
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', authorization)
      .send({ name: 'Family', ownerId: randomUUID() })
      .expect(400);
    expect(await prisma.family.count({ where: { ownerId: userId } })).toBe(0);
  });

  it('returns 201 and persists defaults, the active owner, and both category sets', async () => {
    const response = await request(app.getHttpServer())
      .post(path)
      .set('Authorization', authorization)
      .send({ name: '  First Family  ' })
      .expect(201);

    const id = response.body.data.id as string;
    expect(response.body).toEqual({
      data: {
        id: expect.any(String),
        name: 'First Family',
        ownerId: userId,
        currency: 'AFN',
        calendar: 'JALALI',
        status: 'ACTIVE',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
      meta: { path },
    });
    expect(await prisma.member.findMany({ where: { familyId: id } })).toEqual([
      expect.objectContaining({
        familyId: id,
        userId,
        role: 'OWNER',
        status: 'ACTIVE',
      }),
    ]);

    const categories = await prisma.category.findMany({
      where: { family: { ownerId: userId } },
      select: {
        familyId: true,
        type: true,
        name: true,
        nameKey: true,
        status: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
    for (const type of Object.values(CategoryType)) {
      expect(categories.filter((category) => category.type === type)).toEqual(
        expectedKeys[type].map((key, sortOrder) => ({
          familyId: id,
          type,
          name: null,
          nameKey: `category.${key}`,
          status: 'ACTIVE',
          sortOrder,
        })),
      );
    }
  });

  it('persists explicit currency and calendar values', async () => {
    const response = await request(app.getHttpServer())
      .post(path)
      .set('Authorization', authorization)
      .send({ name: 'Second Family', currency: 'USD', calendar: 'GREGORIAN' })
      .expect(201);

    const id = response.body.data.id as string;
    await expect(
      prisma.family.findUnique({ where: { id } }),
    ).resolves.toMatchObject({
      currency: 'USD',
      calendar: 'GREGORIAN',
    });
  });

  it('rolls back the family, membership, and categories when PostgreSQL rejects the commit', async () => {
    // A deferred trigger fails at commit, after all three inserts have succeeded.
    await prisma.$executeRaw`
      CREATE FUNCTION reject_test_family_categories() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'test category commit failure';
      END;
      $$
    `;
    try {
      await prisma.$executeRaw`
        CREATE CONSTRAINT TRIGGER reject_test_family_categories
        AFTER INSERT ON categories DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION reject_test_family_categories()
      `;
      const counts = () =>
        Promise.all([
          prisma.family.count(),
          prisma.member.count(),
          prisma.category.count(),
        ]);
      const before = await counts();

      await expect(
        service.create(userId, { name: 'Rollback Family' }),
      ).rejects.toThrow('test category commit failure');
      expect(await counts()).toEqual(before);
    } finally {
      await prisma.$executeRaw`DROP TRIGGER IF EXISTS reject_test_family_categories ON categories`;
      await prisma.$executeRaw`DROP FUNCTION reject_test_family_categories()`;
    }
  });
});
