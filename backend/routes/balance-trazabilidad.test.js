import { describe, it, expect, vi } from 'vitest';
import balanceTrazabilidadRoutes from './balance-trazabilidad.mjs';
import express from 'express';
import request from 'supertest';

describe('balance-trazabilidad router', () => {
  it('GET /balance-trazabilidad debe responder con éxito y estructura correcta', async () => {
    const mockQuery = vi.fn().mockResolvedValue({
      rows: [
        {
          partida: '0559204',
          artigo: 'ART-TEST',
          fecha_matriz: '2026-07-05',
          fecha_str: '05/07/2026',
          metros_tecelagem: '1000,00',
          metros_tecelagem_encolh: '850,00',
          metros_acabamento_integrada: '840,00',
          metros_calidad_revisados: '835,00'
        }
      ]
    });

    const app = express();
    app.use(express.json());
    app.use('/api/produccion', balanceTrazabilidadRoutes(mockQuery));

    const res = await request(app)
      .get('/api/produccion/balance-trazabilidad')
      .query({
        fecha_inicio: '2026-07-01',
        fecha_fin: '2026-07-10',
        sector_matriz: 'INTEGRADA'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sectorMatriz).toBe('INTEGRADA');
    expect(res.body.total).toBe(1);
    expect(res.body.kpis.total_partidas).toBe(1);
    expect(res.body.kpis.total_metros_tecelagem).toBe(1000);
    expect(res.body.kpis.total_metros_acabamento_integrada).toBe(840);
    expect(res.body.data[0].rend_telar_integrada_pct).toBe(98.82);

    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('GET /balance-trazabilidad debe manejar errores de BD devolviendo 500', async () => {
    const mockQuery = vi.fn().mockRejectedValue(new Error('Connection failure'));

    const app = express();
    app.use(express.json());
    app.use('/api/produccion', balanceTrazabilidadRoutes(mockQuery));

    const res = await request(app)
      .get('/api/produccion/balance-trazabilidad');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Connection failure');
  });
});
