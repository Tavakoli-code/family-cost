import { Injectable, NotFoundException } from '@nestjs/common';
import { RecordStatus } from '@prisma/client';
import { validationExceptionFactory } from '../../common/pipes/validation-exception.factory';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { toPublicUser } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, status: RecordStatus.ACTIVE },
    });

    if (!user) throw new NotFoundException('User not found');

    return toPublicUser(user);
  }

  async updateMe(id: string, { fullName, language }: UpdateMeDto) {
    if (fullName === undefined && language === undefined) {
      throw validationExceptionFactory([
        {
          property: 'body',
          constraints: { required: 'Provide fullName or language' },
        },
      ]);
    }

    const user = await this.prisma.user.update({
      where: { id, status: RecordStatus.ACTIVE },
      data: { fullName, language },
    });

    return toPublicUser(user);
  }
}
