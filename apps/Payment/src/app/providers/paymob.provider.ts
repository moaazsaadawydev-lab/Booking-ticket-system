import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as CryptoJS from 'crypto-js';

export interface PaymobBillingData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  apartment?: string;
  floor?: string;
  street?: string;
  building?: string;
  shipping_method?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  state?: string;
}

export interface PaymobOrderRegistrationParams {
  amount: number; // in EGP (e.g. 150.00)
  merchantOrderId: string;
  currency?: string;
  items?: any[];
}

export interface PaymobPaymentKeyParams {
  amount: number; // in EGP
  orderId: number | string;
  integrationId: number | string;
  billingData: PaymobBillingData;
  currency?: string;
  expirationSeconds?: number;
}

@Injectable()
export class PaymobProvider {
  private readonly logger = new Logger(PaymobProvider.name);
  private readonly baseUrl = 'https://accept.paymob.com/api';
  private readonly client: AxiosInstance;

  private readonly apiKey: string;
  private readonly hmacSecret: string;
  private readonly cardIntegrationId: number;
  private readonly walletIntegrationId: number;
  private readonly iframeId: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('PAYMOB_API_KEY') || '';
    this.hmacSecret = this.configService.get<string>('PAYMOB_HMAC_SECRET') || '';
    this.cardIntegrationId = Number(
      this.configService.get<string>('PAYMOB_CARD_INTEGRATION_ID') || 0,
    );
    this.walletIntegrationId = Number(
      this.configService.get<string>('PAYMOB_WALLET_INTEGRATION_ID') || 0,
    );
    this.iframeId = Number(
      this.configService.get<string>('PAYMOB_IFRAME_ID') || 0,
    );

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  getCardIntegrationId(): number {
    return this.cardIntegrationId;
  }

  getWalletIntegrationId(): number {
    return this.walletIntegrationId;
  }

  getIframeId(): number {
    return this.iframeId;
  }

  /**
   * Step 1: Authentication Token
   * Calls POST https://accept.paymob.com/api/auth/tokens with api_key
   */
  async getAuthenticationToken(): Promise<string> {
    try {
      this.logger.debug('Requesting Paymob Authentication Token...');
      const response = await this.client.post('/auth/tokens', {
        api_key: this.apiKey,
      });

      const token = response.data?.token;
      if (!token) {
        throw new Error('Paymob authentication response missing token');
      }

      return token;
    } catch (error: any) {
      this.logger.error(
        `Failed to authenticate with Paymob: ${error.response?.data?.message || error.message}`,
      );
      throw error;
    }
  }

  /**
   * Step 2: Order Registration
   * Calls POST https://accept.paymob.com/api/ecommerce/orders
   */
  async registerOrder(
    authToken: string,
    params: PaymobOrderRegistrationParams,
  ): Promise<any> {
    try {
      const amountCents = Math.round(params.amount * 100);

      this.logger.debug(
        `Registering Paymob Order for merchantOrderId: ${params.merchantOrderId}, amountCents: ${amountCents}`,
      );

      const response = await this.client.post('/ecommerce/orders', {
        auth_token: authToken,
        delivery_needed: 'false',
        amount_cents: amountCents.toString(),
        currency: params.currency || 'EGP',
        merchant_order_id: params.merchantOrderId,
        items: params.items || [],
      });

      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to register Paymob order: ${JSON.stringify(error.response?.data) || error.message}`,
      );
      throw error;
    }
  }

  /**
   * Step 3: Payment Key Generation
   * Calls POST https://accept.paymob.com/api/acceptance/payment_keys
   */
  async generatePaymentKey(
    authToken: string,
    params: PaymobPaymentKeyParams,
  ): Promise<string> {
    try {
      const amountCents = Math.round(params.amount * 100);
      const billing = {
        apartment: params.billingData.apartment || 'NA',
        email: params.billingData.email,
        floor: params.billingData.floor || 'NA',
        first_name: params.billingData.first_name || 'Customer',
        street: params.billingData.street || 'NA',
        building: params.billingData.building || 'NA',
        phone_number: params.billingData.phone_number || '+201000000000',
        shipping_method: params.billingData.shipping_method || 'NA',
        postal_code: params.billingData.postal_code || 'NA',
        city: params.billingData.city || 'Cairo',
        country: params.billingData.country || 'EG',
        last_name: params.billingData.last_name || 'Customer',
        state: params.billingData.state || 'NA',
      };

      this.logger.debug(
        `Requesting Paymob Payment Key for orderId: ${params.orderId}, integrationId: ${params.integrationId}`,
      );

      const response = await this.client.post('/acceptance/payment_keys', {
        auth_token: authToken,
        amount_cents: amountCents.toString(),
        expiration: params.expirationSeconds || 3600,
        order_id: params.orderId.toString(),
        billing_data: billing,
        currency: params.currency || 'EGP',
        integration_id: Number(params.integrationId),
        lock_order_when_paid: 'true',
      });

      const paymentToken = response.data?.token;
      if (!paymentToken) {
        throw new Error('Paymob payment key response missing token');
      }

      return paymentToken;
    } catch (error: any) {
      this.logger.error(
        `Failed to generate Paymob payment key: ${JSON.stringify(error.response?.data) || error.message}`,
      );
      throw error;
    }
  }

  /**
   * Full 3-Step Checkout Flow Convenience Method
   */
  async initiatePayment(
    amount: number,
    merchantOrderId: string,
    integrationId: number | string,
    billingData: PaymobBillingData,
  ): Promise<{ orderId: number; paymentToken: string; iframeUrl?: string }> {
    const authToken = await this.getAuthenticationToken();
    const orderData = await this.registerOrder(authToken, {
      amount,
      merchantOrderId,
      currency: 'EGP',
    });

    const paymentToken = await this.generatePaymentKey(authToken, {
      amount,
      orderId: orderData.id,
      integrationId,
      billingData,
      currency: 'EGP',
    });

    const iframeUrl = this.iframeId
      ? `https://accept.paymob.com/api/acceptance/iframes/${this.iframeId}?payment_token=${paymentToken}`
      : undefined;

    return {
      orderId: orderData.id,
      paymentToken,
      iframeUrl,
    };
  }

  /**
   * Step 4: HMAC Verification
   * Verifies Paymob Webhook HMAC-SHA512 signature
   */
  verifyHmac(payload: any, receivedHmac: string): boolean {
    if (!receivedHmac || !this.hmacSecret) {
      this.logger.warn('HMAC verification skipped: missing signature or secret');
      return false;
    }

    try {
      // Paymob Transaction Webhook concatenation order:
      const obj = payload?.obj || payload;

      const concatenated = [
        obj.amount_cents ?? '',
        obj.created_at ?? '',
        obj.currency ?? '',
        obj.error_occured ?? '',
        obj.has_parent_transaction ?? '',
        obj.id ?? '',
        obj.integration_id ?? '',
        obj.is_3d_secure ?? '',
        obj.is_auth ?? '',
        obj.is_capture ?? '',
        obj.is_refunded ?? '',
        obj.is_standalone_payment ?? '',
        obj.is_voided ?? '',
        obj.order?.id ?? obj.order ?? '',
        obj.owner ?? '',
        obj.pending ?? '',
        obj.source_data?.pan ?? '',
        obj.source_data?.sub_type ?? '',
        obj.source_data?.type ?? '',
        obj.success ?? '',
      ].join('');

      const computedHmac = CryptoJS.HmacSHA512(
        concatenated,
        this.hmacSecret,
      ).toString(CryptoJS.enc.Hex);

      const isValid =
        computedHmac.toLowerCase() === receivedHmac.toLowerCase().trim();

      if (!isValid) {
        this.logger.warn(
          `HMAC mismatch! Computed: ${computedHmac.slice(0, 10)}... vs Received: ${receivedHmac.slice(0, 10)}...`,
        );
      }

      return isValid;
    } catch (err: any) {
      this.logger.error(`HMAC verification error: ${err.message}`);
      return false;
    }
  }
}
