import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';

@Injectable()
export class QrCodeService {
  private readonly logger = new Logger(QrCodeService.name);

  async generateQrBuffer(payload: string): Promise<Buffer> {
    try {
      return await QRCode.toBuffer(payload, {
        type: 'png',
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'H',
      });
    } catch (err: any) {
      this.logger.error(`Failed to generate QR buffer: ${err.message}`);
      throw err;
    }
  }

  async generateQrDataUrl(payload: string): Promise<string> {
    try {
      return await QRCode.toDataURL(payload, {
        type: 'image/png',
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'H',
      });
    } catch (err: any) {
      this.logger.error(`Failed to generate QR Data URL: ${err.message}`);
      throw err;
    }
  }
}
