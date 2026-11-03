import { getRecommendations } from './recommendations.js';

const app = document.querySelector('#app');
let questions, rules, prices;
let current = 0;
let answers = {};

// JSON content is always inserted as text, never interpreted as markup.
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, className, onClick) {
  const node = element('button', text, className);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function externalLink(text, url, className) {
  const link = element('a', text, className);
  const destination = new URL(url);
  if (destination.protocol !== 'https:') throw new Error('Provider links must use HTTPS');
  link.href = destination.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function resetCard(results = false) {
  app.replaceChildren();
  app.removeAttribute('aria-busy');
  document.querySelector('#stage-survey').toggleAttribute('aria-current', !results);
  document.querySelector('#stage-results').toggleAttribute('aria-current', results);
  document.querySelector(results ? '#stage-results' : '#stage-survey').setAttribute('aria-current', 'step');
}

function focusHeading(heading) {
  heading.tabIndex = -1;
  heading.focus({preventScroll: true});
  if (app.getBoundingClientRect().top < 0) app.scrollIntoView({block: 'start'});
}

function showQuestion(focus = true) {
  resetCard();
  const question = questions[current];
  const progressHeading = element('div', undefined, 'progress-heading');
  progressHeading.append(element('strong', question.category), element('span', `${current + 1} of ${questions.length}`));
  const progress = element('progress');
  progress.max = questions.length;
  progress.value = current;
  progress.setAttribute('aria-label', `${current} of ${questions.length} questions completed`);
  const form = element('form');
  const fieldset = element('fieldset');
  const legend = element('legend');
  const heading = element('h2', question.title);
  legend.append(heading);
  const description = element('p', question.description, 'helper');
  description.id = 'question-description';
  fieldset.setAttribute('aria-describedby', description.id);
  const options = element('div', undefined, 'options');
  const selected = Array.isArray(answers[question.id]) ? answers[question.id] : [answers[question.id]];
  question.options.forEach(option => {
    const label = element('label', undefined, 'option');
    const input = element('input');
    input.type = question.type === 'multiple' ? 'checkbox' : 'radio';
    input.name = question.id;
    input.value = option.value;
    input.checked = selected.includes(option.value);
    input.addEventListener('change', () => {
      if (question.type === 'multiple' && input.checked) {
        options.querySelectorAll('input').forEach(other => {
          if (other !== input && (option.exclusive || question.options.find(item => item.value === other.value).exclusive)) other.checked = false;
        });
      }
      const values = [...options.querySelectorAll('input:checked')].map(item => item.value);
      answers[question.id] = question.type === 'multiple' ? values : values[0];
      error.textContent = '';
    });
    label.append(input, element('span', option.label));
    options.append(label);
  });
  const error = element('p', '', 'error');
  error.id = 'question-error';
  error.setAttribute('role', 'alert');
  const actions = element('div', undefined, 'actions');
  const back = button('← Back', 'back', () => { current -= 1; showQuestion(); });
  back.disabled = current === 0;
  const next = element('button', current === questions.length - 1 ? 'Explore my results' : 'Continue', 'primary');
  next.type = 'submit';
  next.append(element('span', '→'));
  actions.append(back, next);
  fieldset.append(legend, description, options, error);
  form.append(fieldset, actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const answer = answers[question.id];
    if (!answer || (Array.isArray(answer) && !answer.length)) {
      error.textContent = question.type === 'multiple' ? 'Please choose at least one answer to continue.' : 'Please choose an answer to continue.';
      options.querySelector('input').focus();
      return;
    }
    if (current < questions.length - 1) { current += 1; showQuestion(); }
    else showResults();
  });
  app.append(progressHeading, progress, form);
  if (focus) focusHeading(heading);
}

function showResults() {
  resetCard(true);
  const result = getRecommendations(answers, rules, prices);
  const heading = element('h2', result.products.length ? 'Your life insurance shortlist.' : 'Let’s look at your next step.');
  app.append(element('span', 'Your results', 'result-label'), heading);
  if (result.products.length) {
    app.append(element('p', `${result.products.length} potential matches, ordered by fit with your stated needs and preferences. Equal matches share a rank.`, 'helper'));
    const method = element('details', undefined, 'ranking-method');
    method.append(element('summary', 'How we order your options'), element('p',
      'We first exclude unsupported coverage periods and known age mismatches. A matching protection period receives 10 points, each relevant goal 2, and each supported feature preference 3. When your period is undecided, at least one relevant goal must match. Ties are listed alphabetically. These are comparison rules, not insurer ratings or approval probabilities. Price and affordability are not scored because personalized quotes are not connected.', 'helper'));
    app.append(method);
    app.append(element('p', 'Personalized prices are obtained on the insurer’s website or through its agent. This tool does not retrieve quotes or send your answers to insurers.', 'quote-notice'));
  } else app.append(element('p', result.message, 'next-step'));
  result.products.forEach(product => {
    const card = element('article', undefined, 'recommendation');
    const rankLabel = `${product.tied ? 'Tied ' : ''}#${product.rank} · ${product.rank === 1 ? 'Strongest match in this shortlist' : 'Another potential match'}`;
    card.append(element('span', rankLabel, 'match-rank'), element('p', product.insurer, 'insurer'), element('h3', product.title), element('p', product.description));
    const highlights = element('ul', undefined, 'product-highlights');
    product.highlights.forEach(highlight => highlights.append(element('li', highlight)));
    const reasons = element('ul');
    product.reasons.forEach(reason => reasons.append(element('li', reason)));
    card.append(highlights, element('h4', 'Why it appears'), reasons);
    const considerations = element('details', undefined, 'considerations');
    const cautionList = element('ul');
    product.cautions.forEach(caution => cautionList.append(element('li', caution)));
    considerations.append(element('summary', 'What to confirm'), cautionList);
    card.append(considerations, element('p', 'Personalized premium', 'price-label'), element('p', product.price, 'price'));
    const quoteActions = element('div', undefined, 'quote-actions');
    quoteActions.append(externalLink(`${product.quoteLabel} ↗`, product.quoteUrl, 'primary'), externalLink('Official product details ↗', product.sourceUrl, 'source-link'));
    card.append(quoteActions, element('p', `Product information checked ${product.checkedOn}. Links open in a new tab.`, 'source-date'));
    app.append(card);
  });
  if (result.notes.length) {
    const notes = element('ul', undefined, 'result-notes');
    result.notes.forEach(note => notes.append(element('li', note)));
    app.append(notes);
  }
  if (result.products.length) app.append(element('p', 'Compare insurer quotes for the same coverage amount, coverage period, and payment frequency. Ask the insurer to confirm California availability and eligibility.', 'next-step'));
  const review = element('details', undefined, 'answer-review');
  const list = element('dl');
  questions.forEach(question => {
    const answer = Array.isArray(answers[question.id]) ? answers[question.id] : [answers[question.id]];
    list.append(element('dt', question.title), element('dd', question.options.filter(option => answer.includes(option.value)).map(option => option.label).join(', ')));
  });
  review.append(element('summary', 'Review your answers'), list);
  const actions = element('div', undefined, 'actions');
  actions.append(button('Edit my answers', 'secondary', () => { current = 0; showQuestion(); }),
    button('Start over ↻', 'back', () => { answers = {}; current = 0; showQuestion(); }));
  app.append(review, actions, element('p', result.disclaimer, 'privacy-note'));
  focusHeading(heading);
}

async function loadData() {
  app.setAttribute('aria-busy', 'true');
  app.replaceChildren(element('p', 'Getting your questions ready…'));
  try {
    [questions, rules, prices] = await Promise.all(['questions', 'rules', 'prices'].map(async name => {
      const response = await fetch(new URL(`../data/${name}.json`, import.meta.url));
      if (!response.ok) throw new Error(`Unable to load ${name}`);
      return response.json();
    }));
    if (!Array.isArray(questions) || !questions.length) throw new Error('Questions are missing');
    showQuestion(false);
  } catch (error) {
    app.removeAttribute('aria-busy');
    app.replaceChildren(element('h2', 'We couldn’t load the survey.'),
      element('p', 'Please try again. If you’re running the project locally, open it through a local web server rather than opening index.html directly.', 'helper'),
      button('Try again', 'primary', loadData));
    console.error('Survey initialization failed:', error);
  }
}

loadData();
