import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server.js';
import { jest } from '@jest/globals';

describe('Test delle API di NapStop', () => {
  let tokenUtente = '';
  const emailTest = `test_${Date.now()}@napstop.com`;
  const passwordTest = 'passwordSicura123';

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('POST /api/signup - Dovrebbe registrare un nuovo utente', async () => {
    const res = await request(app)
      .post('/api/signup')
      .send({
        email: emailTest,
        password: passwordTest
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('messaggio');
  });

  test('POST /api/login - Dovrebbe effettuare il login e restituire un token', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({
        email: emailTest,
        password: passwordTest
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    tokenUtente = res.body.token;
  });

  test('GET /api/viaggi - Dovrebbe bloccare la richiesta senza token (401)', async () => {
    const res = await request(app).get('/api/viaggi');
    expect(res.statusCode).toBe(401);
  });
});