import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import {
  CategoryType,
  FamilyRole,
  MemberStatus,
  RecordStatus,
} from '@prisma/client';
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

describeWithPostgres('Family endpoints (PostgreSQL)', () => {
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

  describe('family access and changes', () => {
    const readerId = randomUUID();
    const jwt = new JwtService({ secret });
    const readerAuthorization = `Bearer ${jwt.sign({ sub: readerId })}`;
    const memberRoles = [
      FamilyRole.ADMIN,
      FamilyRole.MEMBER,
      FamilyRole.VIEWER,
    ];
    const memberFamilies = new Map<FamilyRole, string>();
    let readerFamilyId: string;
    let privateFamilyId: string;
    let removedFamilyId: string;
    let archivedFamilyId: string;

    const http = () => request(app.getHttpServer());

    beforeAll(async () => {
      await prisma.user.create({
        data: {
          id: readerId,
          fullName: 'Reader',
          email: `${readerId}@example.com`,
          passwordHash: 'unused',
        },
      });
      readerFamilyId = (await service.create(readerId, { name: 'Reader owns' }))
        .id;
      privateFamilyId = (await service.create(userId, { name: 'Private' })).id;
      for (const role of memberRoles) {
        const family = await service.create(userId, {
          name: `Reader is ${role}`,
        });
        memberFamilies.set(role, family.id);
        await prisma.member.create({
          data: { familyId: family.id, userId: readerId, role },
        });
      }
      removedFamilyId = (
        await service.create(userId, { name: 'Former membership' })
      ).id;
      await prisma.member.create({
        data: {
          familyId: removedFamilyId,
          userId: readerId,
          status: MemberStatus.REMOVED,
        },
      });
      archivedFamilyId = (
        await service.create(readerId, { name: 'Already archived' })
      ).id;
      await prisma.family.update({
        where: { id: archivedFamilyId },
        data: { status: RecordStatus.INACTIVE },
      });
    });

    afterAll(async () => {
      if (!readerFamilyId) return;
      await prisma.transaction.deleteMany({
        where: { family: { ownerId: readerId } },
      });
      await prisma.family.deleteMany({ where: { ownerId: readerId } });
      await prisma.user.deleteMany({ where: { id: readerId } });
    });

    it('requires a JWT for the list, detail, update, and archive endpoints', async () => {
      await http().get(path).expect(401);
      await http().get(`${path}/${readerFamilyId}`).expect(401);
      await http()
        .patch(`${path}/${readerFamilyId}`)
        .send({ name: 'Changed' })
        .expect(401);
      await http().delete(`${path}/${readerFamilyId}`).expect(401);
    });

    it('lists only active memberships in active families and includes each role', async () => {
      const { body } = await http()
        .get(path)
        .set('Authorization', readerAuthorization)
        .expect(200);
      expect(body.meta).toEqual({ path });
      const entries = body.data as { id: string; role: FamilyRole }[];
      expect(entries.map(({ id, role }) => ({ id, role }))).toEqual(
        expect.arrayContaining([
          { id: readerFamilyId, role: FamilyRole.OWNER },
          ...memberRoles.map((role) => ({
            id: memberFamilies.get(role),
            role,
          })),
        ]),
      );
      expect(body.data).toHaveLength(4);
    });

    it.each(memberRoles)(
      'allows %s to read details but forbids update and archive',
      async (role) => {
        const familyId = memberFamilies.get(role);
        const url = `${path}/${familyId}`;
        const { body } = await http()
          .get(url)
          .set('Authorization', readerAuthorization)
          .expect(200);
        expect(body).toEqual({
          data: expect.objectContaining({ id: familyId, role }),
          meta: { path: url },
        });
        await http()
          .patch(url)
          .set('Authorization', readerAuthorization)
          .send({ name: 'Denied' })
          .expect(403);
        await http()
          .delete(url)
          .set('Authorization', readerAuthorization)
          .expect(403);
      },
    );

    it('reuses the verified membership for details and a successful update', async () => {
      const lookup = jest.spyOn(prisma.member, 'findUnique');
      const fallback = jest.spyOn(prisma.member, 'findFirst');
      try {
        const url = `${path}/${readerFamilyId}`;
        await http()
          .get(url)
          .set('Authorization', readerAuthorization)
          .expect(200);
        expect(lookup).toHaveBeenCalledTimes(1);
        expect(fallback).not.toHaveBeenCalled();

        lookup.mockClear();
        await http()
          .patch(url)
          .set('Authorization', readerAuthorization)
          .send({ name: 'Verified owner' })
          .expect(200);
        expect(lookup).toHaveBeenCalledTimes(1);
        expect(fallback).not.toHaveBeenCalled();
      } finally {
        lookup.mockRestore();
        fallback.mockRestore();
      }
    });

    it('hides private, removed, archived, and missing families for all detail operations', async () => {
      for (const id of [
        privateFamilyId,
        removedFamilyId,
        archivedFamilyId,
        randomUUID(),
      ]) {
        const url = `${path}/${id}`;
        await http()
          .get(url)
          .set('Authorization', readerAuthorization)
          .expect(404);
        await http()
          .patch(url)
          .set('Authorization', readerAuthorization)
          .send({ name: 'Hidden' })
          .expect(404);
        await http()
          .delete(url)
          .set('Authorization', readerAuthorization)
          .expect(404);
      }
      await http()
        .get(`${path}/invalid-id`)
        .set('Authorization', readerAuthorization)
        .expect(400);
    });

    it('updates an owned family and preserves omitted values', async () => {
      const url = `${path}/${readerFamilyId}`;
      const { body } = await http()
        .patch(url)
        .set('Authorization', readerAuthorization)
        .send({
          name: '  Updated Family  ',
          currency: 'USD',
          calendar: 'GREGORIAN',
        })
        .expect(200);
      expect(body).toEqual({
        data: expect.objectContaining({
          id: readerFamilyId,
          name: 'Updated Family',
          currency: 'USD',
          calendar: 'GREGORIAN',
          ownerId: readerId,
          role: FamilyRole.OWNER,
        }),
        meta: { path: url },
      });

      await http()
        .patch(url)
        .set('Authorization', readerAuthorization)
        .send({ name: 'Renamed' })
        .expect(200);
      await expect(
        prisma.family.findUnique({ where: { id: readerFamilyId } }),
      ).resolves.toMatchObject({
        name: 'Renamed',
        currency: 'USD',
        calendar: 'GREGORIAN',
        ownerId: readerId,
      });
    });

    it.each([
      {},
      { name: null },
      { name: '  ' },
      { currency: 'ZZZ' },
      { calendar: 'INVALID' },
      { ownerId: userId, name: 'Valid' },
      { id: userId },
      { status: 'INACTIVE' },
      { createdAt: '2026-01-01' },
    ])('rejects an invalid update %j', async (input) => {
      await http()
        .patch(`${path}/${readerFamilyId}`)
        .set('Authorization', readerAuthorization)
        .send(input)
        .expect(400);
    });

    it('archives exactly once and preserves membership and financial records', async () => {
      const { id: familyId } = await service.create(readerId, {
        name: 'Archive target',
      });
      const wallet = await prisma.wallet.create({
        data: { familyId, createdBy: readerId, name: 'Cash' },
      });
      const category = await prisma.category.findFirstOrThrow({
        where: { familyId, type: CategoryType.EXPENSE },
      });
      const transaction = await prisma.transaction.create({
        data: {
          familyId,
          walletId: wallet.id,
          categoryId: category.id,
          type: 'EXPENSE',
          amountMinor: 100,
          createdBy: readerId,
          occurredAt: new Date(),
        },
      });
      const url = `${path}/${familyId}`;
      const results = await Promise.all([
        http().delete(url).set('Authorization', readerAuthorization),
        http().delete(url).set('Authorization', readerAuthorization),
      ]);
      expect(results.map(({ status }) => status).sort()).toEqual([200, 404]);
      expect(results.find(({ status }) => status === 200)?.body).toEqual({
        data: { success: true },
        meta: { path: url },
      });

      await expect(
        prisma.family.findUnique({ where: { id: familyId } }),
      ).resolves.toMatchObject({ status: RecordStatus.INACTIVE });
      await expect(
        prisma.member.count({
          where: { familyId, status: MemberStatus.ACTIVE },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.category.count({ where: { familyId } }),
      ).resolves.toBe(18);
      await expect(
        prisma.wallet.findUnique({ where: { id: wallet.id } }),
      ).resolves.toEqual(wallet);
      await expect(
        prisma.transaction.findUnique({ where: { id: transaction.id } }),
      ).resolves.toEqual(transaction);
      const list = await http()
        .get(path)
        .set('Authorization', readerAuthorization)
        .expect(200);
      expect(list.body.data).not.toContainEqual(
        expect.objectContaining({ id: familyId }),
      );
      await http()
        .get(url)
        .set('Authorization', readerAuthorization)
        .expect(404);
      await http()
        .patch(url)
        .set('Authorization', readerAuthorization)
        .send({ name: 'Denied' })
        .expect(404);
    });
  });
});
