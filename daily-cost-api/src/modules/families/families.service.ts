import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FamilyRole, MemberStatus, Prisma, RecordStatus } from '@prisma/client';
import { DEFAULT_CATEGORIES } from '../../common/constants/default-categories';
import { validationExceptionFactory } from '../../common/pipes/validation-exception.factory';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';

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

  async list(userId: string) {
    const memberships = await this.prisma.member.findMany({
      where: this.activeMembership(userId),
      select: { family: true, role: true },
      orderBy: [{ family: { createdAt: 'desc' } }, { familyId: 'asc' }],
    });

    return memberships.map(({ family, role }) => ({ ...family, role }));
  }

  async get(userId: string, familyId: string) {
    const membership = await this.prisma.member.findFirst({
      where: { ...this.activeMembership(userId), familyId },
      select: { family: true, role: true },
    });

    if (!membership) throw new NotFoundException('Family not found');

    return { ...membership.family, role: membership.role };
  }

  update(
    userId: string,
    familyId: string,
    { name, currency, calendar }: UpdateFamilyDto,
  ) {
    if (
      name === undefined &&
      currency === undefined &&
      calendar === undefined
    ) {
      throw validationExceptionFactory([
        {
          property: 'body',
          constraints: { required: 'Provide name, currency, or calendar' },
        },
      ]);
    }

    return this.updateOwnedFamily(userId, familyId, {
      name,
      currency,
      calendar,
    });
  }

  async archive(userId: string, familyId: string) {
    await this.updateOwnedFamily(userId, familyId, {
      status: RecordStatus.INACTIVE,
    });
    return { success: true };
  }

  private activeMembership(userId: string) {
    return {
      userId,
      status: MemberStatus.ACTIVE,
      family: { status: RecordStatus.ACTIVE },
    };
  }

  private async updateOwnedFamily(
    userId: string,
    familyId: string,
    data: Prisma.FamilyUpdateManyMutationInput,
  ) {
    // Apply the ownership and active-status predicates in the write itself.
    const [family] = await this.prisma.family.updateManyAndReturn({
      where: {
        id: familyId,
        status: RecordStatus.ACTIVE,
        members: {
          some: { userId, status: MemberStatus.ACTIVE, role: FamilyRole.OWNER },
        },
      },
      data,
    });
    if (family) return { ...family, role: FamilyRole.OWNER };

    const visibleFamily = await this.get(userId, familyId);
    if (visibleFamily.role !== FamilyRole.OWNER) {
      throw new ForbiddenException('Only family owners can modify the family');
    }
    throw new NotFoundException('Family not found');
  }
}
