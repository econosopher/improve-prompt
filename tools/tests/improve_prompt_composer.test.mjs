import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let instance = 0;
async function host(options = {}) {
  const { register } = await import(`../../skills/improve-prompt/hooks/register.mjs?test=${++instance}`);
  const hooks = new Map();
  register((name, matcher, fn) => {
    hooks.set(name, fn ?? matcher);
    return { catch() {} };
  }, options);
  const state = { text: 'fix quoted commas in the CSV parser. do not deploy', model: 'claude-fable-5-2', calls: 0, fills: 0, accept: true };
  let resolve, reject;
  const request = new Promise((a, b) => { resolve = a; reject = b; });
  const previous = { type: 'OtherMod' };
  const $ = {
    plugin: { root: new URL('../../skills/improve-prompt', import.meta.url).pathname },
    fs: { read: path => readFile(path, 'utf8') },
    model: { complete: async input => { state.calls++; state.request = input; return { isAnswered: true, text: await request }; } },
    session: { model: async () => state.model },
    prompt: {
      read: async () => ({ text: state.text, cursor: state.text.length }),
      fill: async ({ text }) => { state.fills++; if (state.accept) state.text = text; return { isFilled: state.accept, text: state.text }; },
      submit: () => { throw new Error('Must never submit the draft'); },
    },
    ui: { invalidate() {}, toast() {}, resolve: () => Object.fromEntries(['Box', 'Text', 'Button'].map(type => [type, props => ({ type, ...props })])) },
  };
  const render = async (props = {}) => hooks.get('ui.render')($, { props }, async () => previous);
  const find = (tree, key) => tree.key === key ? tree : tree.children?.map(child => find(child, key)).find(Boolean);
  const press = async key => {
    const button = find(await render(), key);
    assert.ok(button, `button ${key} present`);
    return button.onPress();
  };
  const event = async name => hooks.get(name)($, {}, async () => ({}));
  const started = async () => { for (let i = 0; i < 100 && !state.calls; i++) await new Promise(r => setTimeout(r, 5)); assert.equal(state.calls, 1); };
  return { state, render, press, event, started, resolve, reject, previous };
}

test('button replaces draft without submitting; Undo restores exact original; other mods remain visible', async () => {
  const h = await host(), original = h.state.text;
  assert.equal((await h.render()).children[0], h.previous);
  assert.equal(await h.render({ hasSurvey: true }), h.previous);
  const done = h.press('improve-draft');
  await h.started();
  assert.equal(h.state.request.model, 'claude-fable-5-2');
  assert.equal(JSON.parse(h.state.request.prompt).draft, original);
  h.resolve(JSON.stringify({ prompt: 'Fix CSV parsing for quoted commas. Do not deploy.', issue: '' }));
  await done;
  assert.equal(h.state.text, 'Fix CSV parsing for quoted commas. Do not deploy.');
  await h.press('undo-improve');
  assert.equal(h.state.text, original);
  assert.ok(!JSON.stringify(await h.render()).includes('Original draft restored'));
});

test('late completions cannot overwrite edits, submitted drafts, cancellation, or model changes', async t => {
  for (const reason of ['edit-and-restore', 'other-fill', 'submit', 'cancel', 'model']) await t.test(reason, async () => {
    const h = await host(), original = h.state.text;
    const done = h.press('improve-draft');
    await h.started();
    if (reason === 'edit-and-restore') await h.event('prompt.edit');
    if (reason === 'other-fill') { h.state.text = 'new draft'; await h.event('prompt.fill'); }
    if (reason === 'submit') { h.state.text = ''; await h.event('prompt.submit'); }
    if (reason === 'cancel') await h.press('cancel-improve');
    if (reason === 'model') h.state.model = 'different-model';
    const expected = h.state.text;
    h.resolve(JSON.stringify({ prompt: 'late rewrite', issue: '' }));
    await done;
    assert.equal(h.state.text, expected);
    assert.equal(h.state.fills, 0);
  });
});

test('invalid, ambiguous, failed and rejected results preserve the draft', async t => {
  for (const kind of ['invalid-json', 'wrong-schema', 'issue', 'empty', 'provider-error', 'fill-refused']) await t.test(kind, async () => {
    const h = await host(), original = h.state.text;
    const done = h.press('improve-draft');
    await h.started();
    if (kind === 'provider-error') h.reject(new Error('private provider payload'));
    else {
      if (kind === 'fill-refused') h.state.accept = false;
      h.resolve(kind === 'invalid-json' ? 'not JSON' : JSON.stringify(
        kind === 'wrong-schema' ? { prompt: 12 } :
        kind === 'issue' ? { prompt: '', issue: 'Which format?' } :
        { prompt: kind === 'empty' ? '' : 'New draft', issue: '' }));
    }
    await done;
    assert.equal(h.state.text, original);
    assert.ok(!JSON.stringify(await h.render()).includes('private provider payload'));
  });
});

test('Undo cannot overwrite intervening edits; duplicate clicks start one request', async () => {
  const h = await host();
  const tree = await h.render();
  const button = tree.children[1].children[0];
  const done = button.onPress();
  await button.onPress();
  await h.started();
  h.resolve(JSON.stringify({ prompt: 'New draft', issue: '' }));
  await done;
  const rendered = await h.render();
  const undo = rendered.children[1].children.find(x => x.key === 'undo-improve');
  h.state.text = 'New draft plus user edits';
  await h.event('prompt.edit');
  await undo.onPress();
  assert.equal(h.state.text, 'New draft plus user edits');
  assert.equal(h.state.calls, 1);
});

test('configured shared guidance follows refreshed exact-model routing on every click', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'composer-guidance-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await mkdir(join(folder, 'references'));
  await writeFile(join(folder, 'SKILL.md'), '| `future-model-1`, Future model | `references/future.md` |\n');
  await writeFile(join(folder, 'references/future.md'), 'FIRST PROFILE MARKER');
  const h = await host({ guidanceDirectory: folder });
  h.state.model = 'future-model-1';
  const done = h.press('improve-draft');
  await h.started();
  assert.ok(h.state.request.system.includes('FIRST PROFILE MARKER'));
  h.resolve(JSON.stringify({ prompt: h.state.text, issue: '' }));
  await done;
  await writeFile(join(folder, 'references/future.md'), 'REFRESHED PROFILE MARKER');
  await h.press('improve-draft');
  assert.ok(h.state.request.system.includes('REFRESHED PROFILE MARKER'));
  assert.ok(!h.state.request.system.includes('FIRST PROFILE MARKER'));
  h.state.model = 'future-model-2';
  await h.press('improve-draft');
  assert.ok(!h.state.request.system.includes('REFRESHED PROFILE MARKER'));
});
