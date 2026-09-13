import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnprocessableEntityException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  IsDocument,
  IsPhone,
  NormalizeDocument,
  NormalizePhone,
  ParseDocumentPipe,
  ParsePhonePipe,
} from '../src/index.js';

class SignupDto {
  @IsString()
  country!: string;

  @NormalizeDocument({ country: (dto: SignupDto) => dto.country, holder: 'company' })
  @IsDocument({ country: (dto: SignupDto) => dto.country, holder: 'company' })
  taxId!: string;

  @NormalizePhone({ country: (dto: SignupDto) => dto.country })
  @IsPhone({ country: (dto: SignupDto) => dto.country })
  phone!: string;
}

@Controller()
class TestController {
  @Get('companies/:nit')
  byNit(@Param('nit', new ParseDocumentPipe({ country: 'CO', kind: 'nit' })) nit: string) {
    return { nit };
  }

  @Get('documents')
  document(
    @Query('doc', new ParseDocumentPipe({ country: 'BR', output: 'result', optional: true })) doc: unknown,
    @Query('formatted', new ParseDocumentPipe({ country: 'BR', output: 'formatted', optional: true }))
    formatted: unknown,
  ) {
    return { doc: doc ?? null, formatted: formatted ?? null };
  }

  @Get('phones/:phone')
  byPhone(@Param('phone', new ParsePhonePipe({ country: 'MX' })) phone: string) {
    return { phone };
  }

  @Get('phones')
  phoneFormats(
    @Query('intl', new ParsePhonePipe({ output: 'international', optional: true })) intl: unknown,
    @Query('national', new ParsePhonePipe({ output: 'national', optional: true })) national: unknown,
    @Query('result', new ParsePhonePipe({ output: 'result', optional: true })) result: unknown,
    @Query(
      'strict',
      new ParsePhonePipe({
        optional: true,
        exceptionFactory: (message, code) => new UnprocessableEntityException({ code, message }),
      }),
    )
    strict: unknown,
  ) {
    return { intl, national, result, strict };
  }

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return dto;
  }
}

describe('NestJS integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [TestController] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it('ParseDocumentPipe normalizes params', async () => {
    await request(app.getHttpServer()).get('/companies/900.373.115-3').expect(200, { nit: '9003731153' });
    const res = await request(app.getHttpServer()).get('/companies/900.373.115-4').expect(400);
    expect(res.body.message).toBe('nit must be a valid NIT (CO): check digit mismatch');
  });

  it('ParseDocumentPipe supports optional values and output modes', async () => {
    await request(app.getHttpServer()).get('/documents').expect(200, { doc: null, formatted: null });
    const res = await request(app.getHttpServer())
      .get('/documents')
      .query({ doc: '52998224725', formatted: '11222333000181' })
      .expect(200);
    expect(res.body.doc).toMatchObject({ valid: true, kind: 'cpf' });
    expect(res.body.formatted).toBe('11.222.333/0001-81');
  });

  it('ParsePhonePipe normalizes and formats', async () => {
    await request(app.getHttpServer()).get('/phones/55%201234%205678').expect(200, { phone: '+525512345678' });
    await request(app.getHttpServer()).get('/phones/12').expect(400);
    const res = await request(app.getHttpServer())
      .get('/phones')
      .query({ intl: '+573001234567', national: '+573001234567', result: '+573001234567' })
      .expect(200);
    expect(res.body).toMatchObject({ intl: '+57 300 1234567', national: '300 1234567', result: { type: 'MOBILE' } });
  });

  it('ParsePhonePipe uses a custom exception factory', async () => {
    const res = await request(app.getHttpServer()).get('/phones').query({ strict: 'abc' }).expect(422);
    expect(res.body).toEqual({ code: 'not_a_number', message: 'strict must be a phone number' });
  });

  it('ValidationPipe validates and transforms DTOs', async () => {
    await request(app.getHttpServer())
      .post('/signup')
      .send({ country: 'BR', taxId: '11.222.333/0001-81', phone: '(11) 91234-5678' })
      .expect(201, { country: 'BR', taxId: '11222333000181', phone: '+5511912345678' });

    const res = await request(app.getHttpServer())
      .post('/signup')
      .send({ country: 'BR', taxId: '529.982.247-25', phone: '(11) 91234-5678' })
      .expect(400);
    expect(res.body.message).toEqual(['taxId must be a valid CNPJ (BR): invalid length']);
  });
});
