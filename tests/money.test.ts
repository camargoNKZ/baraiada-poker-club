import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultPercentages, netPrizePool, payouts, percentagesTotal, playerAccounting, pointsForPosition, prizePool, rakeAmount, validPercentages, type FinancialTransaction, type Tournament } from '@/lib/tournament';

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const tx = (over: Partial<FinancialTransaction>): FinancialTransaction => ({ id: 1, playerId: 1, kind: 'entry', quantity: 1, unitAmount: 5000, totalAmount: 5000, paymentMethod: '', note: '', createdAt: 1, voidedAt: null, ...over } as FinancialTransaction);

test('prêmios sempre em múltiplos de R$ 5 e somando o total', () => {
  for (const total of [10000, 22500, 31500, 99500, 123000]) {
    for (const places of [1, 2, 3, 4, 5, 7]) {
      const values = payouts(total, { payoutPlaces: places, payoutPercentages: [] });
      assert.equal(values.length, places);
      assert.equal(sum(values), total, `total ${total}, ${places} lugares`);
      for (const v of values) assert.equal(v % 500, 0, `${v} não é múltiplo de R$ 5`);
    }
  }
});

test('total que não é múltiplo de R$ 5: a sobra fica com o 1º lugar', () => {
  const values = payouts(10200, { payoutPlaces: 3, payoutPercentages: [] });
  assert.equal(sum(values), 10200);
  assert.equal(values[0] % 500, 200);
  for (const v of values.slice(1)) assert.equal(v % 500, 0);
});

test('prêmios em ordem decrescente na divisão padrão', () => {
  const values = payouts(50000, { payoutPlaces: 4, payoutPercentages: [] });
  for (let i = 1; i < values.length; i += 1) assert.ok(values[i - 1] >= values[i]);
});

test('percentuais configurados são respeitados', () => {
  assert.deepEqual(payouts(100000, { payoutPlaces: 3, payoutPercentages: [50, 30, 20] }), [50000, 30000, 20000]);
});

test('divisão padrão soma 100% e é válida', () => {
  for (let places = 1; places <= 20; places += 1) {
    const p = defaultPercentages(places);
    assert.equal(percentagesTotal(p), 100);
    assert.ok(validPercentages(p));
  }
  assert.equal(validPercentages([60, 30]), false);
  assert.equal(validPercentages('x'), false);
});

test('rake: desligado não cobra, ligado arredonda para R$ 5', () => {
  assert.equal(rakeAmount(100000, { rakeEnabled: false, rakePercent: 10 }), 0);
  assert.equal(rakeAmount(100000, { rakeEnabled: true, rakePercent: 10 }), 10000);
  assert.equal(rakeAmount(23000, { rakeEnabled: true, rakePercent: 10 }) % 500, 0);
  assert.equal(rakeAmount(23000, { rakeEnabled: true, rakePercent: 10 }), 2500); // R$ 23 → R$ 25
  assert.equal(rakeAmount(0, { rakeEnabled: true, rakePercent: 10 }), 0);
  assert.equal(netPrizePool(100000, { rakeEnabled: true, rakePercent: 10 }), 90000);
  assert.ok(rakeAmount(1000, { rakeEnabled: true, rakePercent: 50 }) <= 1000);
});

test('arrecadado ignora estornos e pagamentos', () => {
  const t = { entryValue: 5000, reentryValue: 5000, addonValue: 3000 } as Tournament;
  const list = [tx({}), tx({ id: 2, kind: 'reentry' }), tx({ id: 3, kind: 'addon', totalAmount: 3000 }), tx({ id: 4, voidedAt: 9 }), tx({ id: 5, kind: 'payment', totalAmount: -13000 })];
  assert.equal(prizePool(t, [], list), 13000);
});

test('saldo do jogador: cobrado − pago, sem estornos', () => {
  const list = [tx({}), tx({ id: 2, kind: 'reentry' }), tx({ id: 3, voidedAt: 5 }), tx({ id: 4, kind: 'payment', totalAmount: -5000 }), tx({ id: 5, playerId: 2 })];
  assert.deepEqual(playerAccounting(1, list), { charged: 10000, paid: 5000, balance: 5000 });
});

test('pontos do ranking por posição', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(pointsForPosition), [10, 7, 5, 3, 1, 0]);
});
