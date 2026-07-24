import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Vérifie les identifiants et retourne un JWT signé. */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('Identifiants invalides.');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Identifiants invalides.');
    }
    return this.sign(user.id, user.email, user.role, user.fullName);
  }

  /** Crée un nouvel utilisateur (réservé à l'ADMIN via le contrôleur). */
  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (exists) {
      throw new ConflictException('Un compte existe déjà avec cet email.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        fullName: dto.fullName,
        passwordHash,
        role: dto.role,
      },
    });
    return this.sign(user.id, user.email, user.role, user.fullName);
  }

  private sign(id: string, email: string, role: string, fullName: string) {
    const accessToken = this.jwt.sign({ sub: id, email, role });
    return {
      accessToken,
      user: { id, email, role, fullName },
    };
  }
}
