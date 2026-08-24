import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from '@booking-ticket-system/DTOs';
import { JwtAuthGuard } from '@booking-ticket-system/Guards';
import { CurrentUser } from '@booking-ticket-system/Decorators';
import { TransformResponseInterceptor } from '@booking-ticket-system/Common';
import { AuthProvider } from '../../providers';

@Controller(['users/auth', 'auth'])
@UseInterceptors(TransformResponseInterceptor)
export class UsersAuthController {
  constructor(
    private readonly authProvider: AuthProvider,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Headers('user-agent') userAgent: string,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      '';

    return this.authProvider.login(body, userAgent, ip, response);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth redirect via passport-google-oauth20
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('user-agent') userAgent: string,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || '';
    const googleUser = (req as any).user;

    await this.authProvider.googleLogin(googleUser, ipAddress, userAgent, res);

    const redirectUrl =
      this.configService.get<string>('FRONTEND_REDIRECT_URL') ||
      'http://localhost:4200';

    return res.redirect(redirectUrl);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authProvider.logout(user, response);
  }

  @Post(['refresh-token', 'refresh'])
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    return this.authProvider.refresh(refreshToken, response);
  }

  @Post('revoke-all-sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeAllSessions(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authProvider.logout(user, response);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getSessions(@CurrentUser() user: any) {
    return {
      userId: user?.id,
      sessionId: user?.sessionId,
      active: true,
    };
  }
}
