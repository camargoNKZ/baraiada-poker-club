import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type BlindLevel, clockAt, purchaseBlockedReason } from '@/lib/blinds';

const lvl = (id: string, minutes = 20): BlindLevel => ({ id, kind: 'level', smallBlind: 100, bigBlind: 200, ante: 0, durationMinutes: minutes });
const brk = (id: string, minutes = 10): BlindLevel => ({ id, kind: 'break', smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: minutes });
const structure = [lvl('1'), lvl('2'), brk('b1'), lvl('3'), brk('b2'), lvl('4')];
const START = 1_000_000;
const at = (minutes: number, levels = structure) => clockAt({ blindLevels: levels, currentLevel: 0, timerStartedAt: START, timerPausedSeconds: levels[0].durationMinutes * 60, smallBlind: 0, bigBlind: 0, ante: 0, levelMinutes: 20 }, START + minutes * 60_000);

test('o relógio avança sozinho de nível', () => {
  assert.equal(at(5).index, 0);
  assert.equal(at(25).index, 1);
  assert.equal(at(25).remaining, 15 * 60);
  assert.equal(at(45).level.kind, 'break');
  assert.equal(at(55).index, 3);
  assert.equal(at(55).levelNumber, 3); // intervalo não conta como nível
});

test('relógio pausado não anda', () => {
  const c = clockAt({ blindLevels: structure, currentLevel: 1, timerStartedAt: null, timerPausedSeconds: 300, smallBlind: 0, bigBlind: 0, ante: 0, levelMinutes: 20 }, START + 99 * 3600_000);
  assert.equal(c.index, 1); assert.equal(c.remaining, 300); assert.equal(c.running, false);
});

test('entrada e rebuy abertos até o fim do 1º intervalo', () => {
  for (const m of [0, 30, 45]) { assert.ok(at(m).entryOpen, `entrada aos ${m} min`); assert.ok(at(m).rebuyOpen, `rebuy aos ${m} min`); }
  assert.equal(at(51).entryOpen, false);
  assert.equal(at(51).rebuyOpen, false);
});

test('add-on só durante o 1º intervalo', () => {
  assert.equal(at(30).addonOpen, false);
  assert.equal(at(45).addonOpen, true);
  assert.equal(at(51).addonOpen, false);
  assert.equal(at(75).addonOpen, false); // 2º intervalo não reabre
});

test('mensagens de bloqueio de compra', () => {
  assert.equal(purchaseBlockedReason(at(30), 'reentry'), null);
  assert.ok(purchaseBlockedReason(at(30), 'addon'));
  assert.ok(purchaseBlockedReason(at(51), 'entry'));
  assert.ok(purchaseBlockedReason(at(51), 'reentry'));
  assert.equal(purchaseBlockedReason(at(45), 'addon'), null);
});

test('estrutura sem intervalo não trava compras', () => {
  const noBreak = [lvl('1'), lvl('2')];
  const c = at(30, noBreak);
  assert.ok(c.entryOpen && c.rebuyOpen && c.addonOpen);
});

test('tempo até o intervalo', () => {
  assert.equal(at(10).secondsToBreak, 30 * 60);
  assert.equal(at(45).secondsToBreak, null);
});

import { PRESETS, suggestStructure } from '@/lib/blind-suggest';

test('sugestão por duração cabe no tempo e sobe sempre', () => {
  for (const { hours } of PRESETS) {
    for (const players of [6, 12, 30]) {
      const s = suggestStructure({ hours, players, stack: 20000 });
      const planned: typeof s.levels = [];
      let count = 0;
      for (const l of s.levels) { if (l.kind === 'level') count += 1; if (count > s.plannedLevels) break; planned.push(l); }
      const minutes = planned.reduce((sum, l) => sum + l.durationMinutes, 0);
      assert.ok(minutes <= hours * 60, `${hours}h/${players}: ${minutes} min`);
      assert.ok(minutes >= hours * 60 * 0.75, `${hours}h/${players}: só ${minutes} min`);
      const bigs = s.levels.filter((l) => l.kind === 'level').map((l) => l.bigBlind);
      for (let i = 1; i < bigs.length; i += 1) assert.ok(bigs[i] > bigs[i - 1]);
      assert.ok(s.levels.some((l) => l.kind === 'break'), 'tem intervalo');
      const first = s.levels.find((l) => l.kind === 'level')!;
      assert.equal(first.smallBlind * 2, first.bigBlind);
    }
  }
});

import { chipDistribution, recommendedDepth } from '@/lib/blind-suggest';

test('stack inicial dentro da faixa recomendada e fichas somando o stack', () => {
  for (const hours of [2, 3, 4, 5, 6]) {
    for (const stack of [10000, 20000, 25000, 30000]) {
      const s = suggestStructure({ hours, players: 12, stack });
      const range = recommendedDepth(hours);
      assert.ok(s.depthBB >= range.min * 0.8 && s.depthBB <= range.max * 1.35, `${hours}h ${stack}: ${s.depthBB} BB`);
      assert.equal(s.chips.reduce((sum, c) => sum + c.value * c.count, 0), stack, `${hours}h ${stack}`);
      assert.ok(s.chips.length >= 2 && s.chips.length <= 4);
    }
  }
  assert.deepEqual(chipDistribution(20000, 100, 200).map((c) => c.value), [100, 500, 1000, 5000]);
});
