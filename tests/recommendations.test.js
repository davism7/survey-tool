import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getRecommendations } from '../js/recommendations.js';

const read = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const questions = read('questions'), rules = read('rules'), prices = read('prices');
const base = {age:'30_39', duration:'11_20', goals:['income'], priorities:['unsure']};
const recommend = (changes = {}) => getRecommendations({...base, ...changes}, rules, prices);

test('catalog, question IDs, answer references, and provider links are consistent', () => {
  assert.equal(new Set(questions.map(q => q.id)).size, questions.length);
  for (const question of questions) {
    assert.ok(['single', 'multiple'].includes(question.type));
    assert.equal(new Set(question.options.map(option => option.value)).size, question.options.length);
  }
  const values = id => questions.find(q => q.id === id).options.map(o => o.value);
  for (const key of Object.keys(rules.ageBands)) assert.ok(values('age').includes(key));
  for (const key of Object.keys(rules.durationYears)) assert.ok(values('duration').includes(key));
  for (const goals of Object.values(rules.typeGoals)) for (const goal of goals) assert.ok(values('goals').includes(goal));
  for (const rule of rules.notes) {
    for (const value of rule.when.values) assert.ok(values(rule.when.question).includes(value));
  }
  for (const [id, product] of Object.entries(rules.products)) {
    assert.ok(prices.products[id]);
    for (const feature of product.features) {
      assert.ok(values('priorities').includes(feature));
      assert.ok(rules.featureReasons[feature]);
    }
    for (const key of ['sourceUrl', 'quoteUrl']) {
      const url = new URL(product[key]);
      assert.equal(url.protocol, 'https:');
      assert.ok(['www.protective.com', 'www.statefarm.com', 'www.newyorklife.com'].includes(url.hostname));
    }
  }
});

test('only matching coverage types appear, and known term/age conflicts are excluded', () => {
  for (const duration of ['up_to_10', '11_20', 'over_20', 'over_30']) {
    const products = recommend({duration}).products;
    assert.ok(products.length > 0);
    assert.ok(products.every(p => p.type === 'term'));
    assert.ok(products.every(p => p.availableTerms.includes(rules.durationYears[duration])));
  }
  assert.deepEqual(recommend({duration:'over_30'}).products.map(p => p.id), ['protective_classic']);
  assert.deepEqual(recommend({duration:'over_20', age:'50_59'}).products.map(p => p.id), ['protective_classic']);
  assert.equal(recommend({duration:'over_20', age:'60_plus'}).products.length, 0);
  assert.equal(recommend({duration:'over_30', age:'50_59'}).products.length, 0);
  const lifetime = recommend({duration:'lifetime'}).products;
  assert.equal(lifetime.length, 2);
  assert.ok(lifetime.every(p => p.type === 'whole'));
});

test('preferences change ordering while preserving lower-ranked compatible choices', () => {
  const local = recommend({priorities:['local_agent']}).products;
  assert.equal(local.length, 2);
  assert.equal(local[0].id, 'state_farm_select');
  assert.ok(local[0].score > local[1].score);
  assert.deepEqual(local.map(p => p.rank), [1, 2]);
  assert.ok(local[0].reasons.some(reason => reason.includes('local agent')));
  const flexible = recommend({priorities:['flexible_terms']}).products;
  assert.equal(flexible[0].id, 'protective_classic');
  assert.ok(flexible[0].score > flexible[1].score);
  const limited = recommend({duration:'lifetime', priorities:['limited_pay']}).products;
  assert.equal(limited[0].id, 'state_farm_limited_pay');
  assert.ok(limited[0].score > limited[1].score);
});

test('equal matches remain tied; alphabetical order does not pretend better fit', () => {
  const products = recommend().products;
  assert.equal(products.length, 2);
  assert.ok(products.every(p => p.tied && p.rank === 1));
  assert.equal(products[0].insurer, 'Protective');
});

test('under-18 users receive guidance instead of product recommendations', () => {
  const result = recommend({age:'under18'});
  assert.deepEqual(result.products, []);
  assert.ok(result.message);
});

test('uncertain goals and duration do not force a match or let feature points bypass fit', () => {
  const result = recommend({duration:'unsure', goals:['unsure'], priorities:['online', 'local_agent', 'flexible_terms', 'limited_pay']});
  assert.deepEqual(result.products, []);
  assert.match(result.message, /No supported match/);
  assert.ok(recommend({duration:'unsure', goals:['income']}).products.every(p => p.type === 'term'));
  const combined = recommend({duration:'unsure', goals:['income', 'legacy']});
  assert.equal(combined.products.length, 4);
});

test('edited answers remove stale reasons and notes', () => {
  const initial = recommend({coverage:'both', priorities:['local_agent']});
  assert.ok(initial.notes.some(note => note.includes('workplace')));
  const updated = recommend({coverage:'none', priorities:['flexible_terms']});
  assert.ok(!updated.notes.some(note => note.includes('workplace')));
  assert.ok(updated.products.every(p => !p.reasons.some(reason => reason.includes('local agent'))));
});

test('budget and static catalog amounts never masquerade as personalized prices', () => {
  const fakePrices = structuredClone(prices);
  fakePrices.products.protective_classic.monthly = 19.99;
  const result = getRecommendations(base, rules, fakePrices);
  assert.ok(result.products.every(p => !p.price.includes('19.99')));
  assert.ok(result.products.every(p => p.price.includes('not available')));
  assert.deepEqual(recommend({budget:'under_25'}).products.map(p => [p.id, p.score]), recommend({budget:'over_100'}).products.map(p => [p.id, p.score]));
});
