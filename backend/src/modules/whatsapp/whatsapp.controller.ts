import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('whatsapp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Get('status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'État de la session du bot WhatsApp.' })
  status() {
    return this.whatsapp.getStatus();
  }

  @Public()
  @Get('qr')
  @ApiOperation({
    summary: 'QR Code de connexion (image PNG). À scanner depuis WhatsApp.',
  })
  async qr(@Res() res: Response) {
    const dataUrl = this.whatsapp.getQrDataUrl();
    if (!dataUrl) {
      res.status(404).json({
        success: false,
        message:
          'Aucun QR disponible (bot déjà connecté ou en cours de démarrage).',
      });
      return;
    }
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const img = Buffer.from(base64, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.send(img);
  }

  @Post('simulate-message')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Simuler un message entrant (tests du flux conversationnel sans WhatsApp).',
  })
  simulate(@Body() body: { phone: string; text: string }) {
    return this.whatsapp
      .processIncoming(body.phone, body.text)
      .then((reply) => ({ reply }));
  }
}
