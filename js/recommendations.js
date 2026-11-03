function matches(condition, answers) {
  const answer = answers[condition.question];
  const values = Array.isArray(answer) ? answer : [answer];
  return condition.values.some(value => values.includes(value));
}

export function getRecommendations(answers, rules, prices) {
  const result = {products: [], notes: [], disclaimer: rules.disclaimer, message: ''};
  const ageBand = rules.ageBands[answers.age];
  if (!ageBand || ageBand[0] < 18) {
    result.message = 'This comparison is for adults. A parent or guardian and a licensed insurance professional can help you explore appropriate options.';
    return result;
  }
  const goals = Array.isArray(answers.goals) ? answers.goals : [];
  const priorities = Array.isArray(answers.priorities) ? answers.priorities : [];
  const years = rules.durationYears[answers.duration];
  const lifetime = answers.duration === 'lifetime';
  const undecided = answers.duration === 'unsure';

  for (const [id, product] of Object.entries(rules.products)) {
    if (!product.states.includes(rules.state)) continue;
    if (lifetime && product.type !== 'whole') continue;
    if (years && product.type !== 'term') continue;
    if (!years && !lifetime && !undecided) continue;

    // A broad age range can rule out a known mismatch, but cannot establish eligibility.
    const availableTerms = Object.entries(product.termAges)
      .filter(([term, maximumAge]) => (!years || Number(term) === years) && ageBand[0] <= maximumAge)
      .map(([term]) => Number(term));
    if (product.type === 'term' && !availableTerms.length) continue;

    const matchedGoals = goals.filter(goal => rules.typeGoals[product.type].includes(goal));
    // Feature preferences alone must never cause an otherwise unrelated product to appear.
    if (undecided && !matchedGoals.length) continue;
    let score = (years || lifetime ? rules.scoring.duration : 0) + matchedGoals.length * rules.scoring.goal;
    const reasons = [];
    if (years) reasons.push(`A ${years}-year term covers the upper end of your selected protection period.`);
    if (lifetime) reasons.push('You selected lifetime protection; this is a whole life policy.');
    if (matchedGoals.length) reasons.push(product.type === 'term'
      ? 'Your goals include income, debts, or children’s expenses that can be discussed over a defined period.'
      : 'Your goals include leaving money to loved ones or covering final expenses.');
    for (const feature of priorities) {
      if (!product.features.includes(feature)) continue;
      score += rules.scoring.feature;
      reasons.push(rules.featureReasons[feature]);
    }
    if (score < rules.scoring.minimum) continue;
    const cautions = [...product.cautions];
    cautions.push('Your age range alone cannot confirm eligibility. Exact age, underwriting, and coverage details still need review.');
    // Static catalog amounts are never personalized quotes. Do not display them as such.
    result.products.push({
      ...product, id, score, reasons, cautions, availableTerms,
      price: prices.message || 'Request a personalized quote from the insurer.'
    });
  }

  result.products.sort((a, b) => b.score - a.score || `${a.insurer} ${a.title}`.localeCompare(`${b.insurer} ${b.title}`, 'en'));
  let rank = 0;
  result.products.forEach((product, index, products) => {
    if (index === 0 || product.score !== products[index - 1].score) rank = index + 1;
    product.rank = rank;
    product.tied = products.filter(other => other.score === product.score).length > 1;
  });
  result.notes = rules.notes.filter(rule => matches(rule.when, answers)).map(rule => rule.text);
  if (!result.products.length) result.message = 'No supported match in this shortlist. Review your protection period and goals, or discuss other options with a licensed professional. This does not mean you cannot get insurance.';
  return result;
}
