import { Controller, Get, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Health stays unversioned while every product route lives under /v1.
  @Version(VERSION_NEUTRAL)
  @Get('health')
  getHealth(): { status: string } {
    return this.appService.getHealth();
  }
}
