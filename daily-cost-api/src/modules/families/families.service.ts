import { Injectable } from '@nestjs/common';
import { FamilyRole, MemberStatus } from '@prisma/client';
import { DEFAULT_CATEGORIES } from '../../common/constants/default-categories';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFamilyDto } from './dto/create-family.dto';

@Injectable()
export class FamiliesService {
  constructor(private readonly prisma: PrismaService) {}

  create(ownerId: string, { name, currency, calendar }: CreateFamilyDto) {
    return this.prisma.$transaction(async (tx) => {
      const family = await tx.family.create({
        data: { name, currency, calendar, ownerId },
      });
      await tx.member.create({
        data: {
          familyId: family.id,
          userId: ownerId,
          role: FamilyRole.OWNER,
          status: MemberStatus.ACTIVE,
        },
      });
      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((category) => ({
          ...category,
          familyId: family.id,
        })),
      });
      return family;
    });
  }
}
