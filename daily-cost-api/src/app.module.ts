import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { FamiliesModule } from './modules/families/families.module';
import { MembersModule } from './modules/members/members.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, UsersModule, FamiliesModule, MembersModule, InvitationsModule, WalletsModule, CategoriesModule, TransactionsModule, ReportsModule, NotificationsModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
