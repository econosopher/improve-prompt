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
  const state = { text: 'fix quoted commas in the CSV parser. do not deploy', model: 'claude-fable-5-2', calls: 0, fills: 0, accept: true, invalidations: 0 };
  let resolve, reject;
  const request = new Promise((a, b) => { resolve = a; reject = b; });
  const previous = { type: 'OtherMod' };
  const $ = {
    plugin: { name: 'improve-prompt', root: new URL('../../skills/improve-prompt', import.meta.url).pathname },
    fs: { read: path => readFile(path, 'utf8') },
    model: { complete: async input => { state.calls++; state.request = input; return { isAnswered: true, text: await request }; } },
    session: { model: async () => state.model },
    prompt: {
      read: async () => ({ text: state.text, cursor: state.text.length }),
      fill: async ({ text }) => { state.fills++; if (state.accept) state.text = text; return { isFilled: state.accept, text: state.text }; },
      submit: () => { throw new Error('Must never submit the draft'); },
    },
    ui: { invalidate() { state.invalidations++; }, toast() {}, resolve: () => Object.fromEntries(['Box', 'Text', 'Button'].map(type => [type, props => ({ type, ...props })])) },
  };
  const render = async (props = {}) => hooks.get('ui.render')($, { props }, async () => previous);
  const find = (tree, key) => tree.key === key ? tree : tree.children?.map(child => find(child, key)).find(Boolean);
  // Improve's onPress returns at once (the rewrite runs on); wait for the band to show
  // Improve again, which is when the rewrite has settled.
  const idle = async () => {
    for (let i = 0; i < 400; i++) {
      if (find(await render(), 'improve-draft')) return;
      await new Promise(r => setTimeout(r, 5));
    }
    assert.fail('rewrite did not settle');
  };
  const press = async key => {
    const button = find(await render(), key);
    assert.ok(button, `button ${key} present`);
    const result = button.onPress();
    if (key !== 'improve-draft') return result;
    assert.equal(result, undefined, 'Improve press returns at once');
    return idle();
  };
  // The engine's own step: prompt.edit applies the splice to the draft and answers the box.
  const core = async e => {
    if (!Number.isInteger(e.start)) return {};
    state.text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end);
    return { text: state.text, cursor: e.start + e.inputText.length };
  };
  const event = async (name, e = {}, next = core) => hooks.has(name) ? hooks.get(name)($, e, next) : next(e);
  const edit = (start, end, inputText) => event('prompt.edit', { origin: { kind: 'composer' }, text: state.text, cursor: start, start, end, inputText });
  const started = async () => { for (let i = 0; i < 100 && !state.calls; i++) await new Promise(r => setTimeout(r, 5)); assert.equal(state.calls, 1); };
  return { state, $, render, press, event, edit, started, idle, resolve, reject, previous, find };
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
    if (reason === 'edit-and-restore') { await h.edit(0, 0, 'a'); await h.edit(0, 1, ''); }
    if (reason === 'other-fill') { h.state.text = 'new draft'; await h.event('prompt.change', { text: 'new draft', cursor: 9, origin: { kind: 'plugin', name: 'other-mod' } }); }
    if (reason === 'submit') { h.state.text = ''; await h.event('prompt.change', { text: '', cursor: 0, origin: { kind: 'clear' } }); }
    if (reason === 'cancel') await h.press('cancel-improve');
    if (reason === 'model') h.state.model = 'different-model';
    const expected = h.state.text;
    h.resolve(JSON.stringify({ prompt: 'late rewrite', issue: '' }));
    await done;
    assert.equal(h.state.text, expected);
    assert.equal(h.state.fills, 0);
  });
});

test('a real insertion or deletion still cancels a late rewrite', async () => {
  for (const [start, end, text] of [[3, 3, 'a'], [3, 4, '']]) {
    const g = await host();
    const late = g.press('improve-draft');
    await g.started();
    await g.edit(start, end, text);
    g.resolve(JSON.stringify({ prompt: 'late rewrite', issue: '' }));
    await late;
    assert.equal(g.state.fills, 0);
  }
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
  button.onPress();
  button.onPress();
  await h.started();
  h.resolve(JSON.stringify({ prompt: 'New draft', issue: '' }));
  await h.idle();
  const rendered = await h.render();
  const undo = rendered.children[1].children.find(x => x.key === 'undo-improve');
  await h.edit(9, 9, ' plus user edits');
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

test('the band holds still: typing with nothing to clear does not redraw, and Improve stays live mid-turn', async () => {
  const h = await host();
  await h.render();
  for (let i = 0; i < 5; i++) await h.edit(0, 0, 'x');
  await h.event('prompt.change', { text: '', cursor: 0, origin: { kind: 'clear' } });
  assert.equal(h.state.invalidations, 0);
  const working = await h.render({ isWorking: true });
  const idle = await h.render({ isWorking: false });
  assert.equal(JSON.stringify(working), JSON.stringify(idle));
  assert.ok(!h.find(working, 'improve-draft').disabled);
});

test('a late Cancel press and a failing Undo keep the draft and never throw', async () => {
  const h = await host();
  const tree = await h.render();
  h.press('improve-draft');
  await h.started();
  const cancel = h.find(await h.render(), 'cancel-improve');
  h.resolve(JSON.stringify({ prompt: 'New draft', issue: '' }));
  await h.idle();
  assert.doesNotThrow(() => cancel.onPress());
  const undo = h.find(await h.render(), 'undo-improve');
  h.$.prompt.read = async () => { throw new Error('composer gone'); };
  await undo.onPress();
  assert.ok(JSON.stringify(await h.render()).includes('Could not restore the draft.'));
  assert.ok(tree);
});

test('nothing that leaves the draft text alone cancels a rewrite or drops Undo', async t => {
  const same = h => [
    ['cursor move', () => h.edit(3, 3, '')],
    ['selection retyped as itself', () => h.edit(0, 3, h.state.text.slice(0, 3))],
    ['whole draft resynced', () => h.edit(0, h.state.text.length, h.state.text)],
    ['key consumed by another mod', () => h.event('prompt.edit', { text: h.state.text, cursor: 0, start: 0, end: 0, inputText: 'z' },
      async e => ({ text: e.text, cursor: e.cursor }))],
    ['task notification, trigger or peer message', () => h.event('prompt.submit', { text: 'background', origin: { kind: 'task-notification' } })],
    ['this mod\'s own fill landing', () => h.event('prompt.change', { text: h.state.text, cursor: 0, origin: { kind: 'plugin', name: 'improve-prompt' } })],
  ];
  for (const [name] of same({})) await t.test(name, async () => {
    const h = await host();
    const run = same(h).find(([n]) => n === name)[1];
    const done = h.press('improve-draft');
    await h.started();
    await run();
    h.resolve(JSON.stringify({ prompt: 'Fix CSV parsing for quoted commas. Do not deploy.', issue: '' }));
    await done;
    assert.equal(h.state.text, 'Fix CSV parsing for quoted commas. Do not deploy.');
    await run();
    const band = JSON.stringify(await h.render());
    assert.ok(!band.includes('Draft changed'), band);
    assert.ok(band.includes('undo-improve'));
  });
});

test('an edit still in the prompt.edit chain when the rewrite lands keeps the draft', async () => {
  const h = await host();
  const done = h.press('improve-draft');
  await h.started();
  let release;
  const gate = new Promise(r => { release = r; });
  const edit = h.event('prompt.edit', { text: h.state.text, cursor: 0, start: 0, end: 0, inputText: 'a' },
    async e => { await gate; h.state.text = 'a' + e.text; return { text: h.state.text, cursor: 1 }; });
  h.resolve(JSON.stringify({ prompt: 'late rewrite', issue: '' }));
  await new Promise(r => setTimeout(r, 30));
  release();
  await edit;
  await done;
  assert.equal(h.state.fills, 0);
  assert.ok(h.state.text.startsWith('a'));
});

test('this mod\'s own fill is recognised by its text when the engine names it otherwise', async () => {
  const h = await host();
  const done = h.press('improve-draft');
  await h.started();
  h.resolve(JSON.stringify({ prompt: 'Fix CSV parsing for quoted commas. Do not deploy.', issue: '' }));
  await done;
  await h.event('prompt.change', { text: h.state.text, cursor: 0, origin: { kind: 'plugin', name: 'improve-prompt@improve-prompt' } });
  assert.ok(JSON.stringify(await h.render()).includes('undo-improve'));
});

test('a prompt.change that repeats the draft text is a resync, not an edit', async () => {
  const h = await host();
  const done = h.press('improve-draft');
  await h.started();
  await h.event('prompt.change', { text: h.state.text, cursor: 0, origin: { kind: 'composer' } });
  h.resolve(JSON.stringify({ prompt: 'Fix CSV parsing for quoted commas. Do not deploy.', issue: '' }));
  await done;
  assert.equal(h.state.text, 'Fix CSV parsing for quoted commas. Do not deploy.');
  await h.event('prompt.change', { text: h.state.text, cursor: 0, origin: { kind: 'sync' } });
  const band = JSON.stringify(await h.render());
  assert.ok(band.includes('undo-improve') && !band.includes('Draft changed'), band);
});

test('this mod\'s own fill keeps Undo whatever origin kind the engine reports', async t => {
  for (const origin of [undefined, { kind: 'composer' }, { kind: 'fill' }]) await t.test(String(origin?.kind), async () => {
    const h = await host();
    const done = h.press('improve-draft');
    await h.started();
    h.resolve(JSON.stringify({ prompt: 'Fix CSV parsing for quoted commas. Do not deploy.', issue: '' }));
    await done;
    await h.event('prompt.change', { text: h.state.text, cursor: 0, origin });
    assert.ok(JSON.stringify(await h.render()).includes('undo-improve'));
  });
});

test('a fenced or prefaced JSON reply is still applied', async t => {
  for (const wrap of [s => '```json\n' + s + '\n```', s => 'Here it is:\n' + s]) await t.test(wrap('x').slice(0, 8), async () => {
    const h = await host();
    const done = h.press('improve-draft');
    await h.started();
    h.resolve(wrap(JSON.stringify({ prompt: 'Fenced result.', issue: '' })));
    await done;
    assert.equal(h.state.text, 'Fenced result.');
  });
});

test('diagnostics: off without the folder; with it, outcome codes only and no draft or reply text', async t => {
  const home = await mkdtemp(join(tmpdir(), 'ip-home-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const { existsSync, readdirSync, readFileSync } = await import('node:fs');
  const wire = h => {
    h.$.env = { get: async k => (k === 'HOME' ? home : undefined) };
    h.$.fs.exists = async p => existsSync(p);
    h.$.fs.write = (p, s) => writeFile(p, s);
  };
  const off = await host(); wire(off);
  const d0 = off.press('improve-draft'); await off.started();
  off.resolve(JSON.stringify({ prompt: 'SECRET REWRITE', issue: '' })); await d0;
  assert.ok(!existsSync(join(home, 'Library/Logs/improve-prompt')));
  await mkdir(join(home, 'Library/Logs/improve-prompt'), { recursive: true });
  const h = await host(); wire(h);
  for (let i = 0; i < 3; i++) await h.edit(0, 0, 'x');
  await new Promise(r => setTimeout(r, 30));
  assert.equal(readdirSync(join(home, 'Library/Logs/improve-prompt')).length, 0, 'plain typing writes nothing');
  const d1 = h.press('improve-draft'); await h.started();
  h.resolve('not json SECRET REPLY'); await d1;
  await new Promise(r => setTimeout(r, 30));
  const files = readdirSync(join(home, 'Library/Logs/improve-prompt'));
  assert.equal(files.length, 1);
  const body = readFileSync(join(home, 'Library/Logs/improve-prompt', files[0]), 'utf8');
  assert.ok(body.includes('"press"') && body.includes('"invalid-reply"'), body);
  assert.ok(!body.includes('SECRET') && !body.includes('quoted commas'), body);
});

test('whitespace-only drift with no edit event still applies the rewrite', async () => {
  const h = await host();
  const done = h.press('improve-draft');
  await h.started();
  h.state.text = h.state.text + '\n';
  h.resolve(JSON.stringify({ prompt: 'Rewritten.', issue: '' }));
  await done;
  assert.equal(h.state.text, 'Rewritten.');
  assert.ok(JSON.stringify(await h.render()).includes('undo-improve'));
});


const waitFor = async (cond, ms = 6000) => { for (let i = 0; i < ms / 20 && !await cond(); i++) await new Promise(r => setTimeout(r, 20)); };

test('box reads empty mid-rewrite (another chat): the rewrite lands by itself when the draft is back, with Undo', async () => {
  const h = await host(), original = h.state.text;
  const done = h.press('improve-draft');
  await h.started();
  const read = h.$.prompt.read;
  h.$.prompt.read = async () => ({ text: '', cursor: 0 });
  h.resolve(JSON.stringify({ prompt: 'Rewritten.', issue: '' }));
  await done;
  assert.equal(h.state.text, original);
  const band = JSON.stringify(await h.render());
  assert.ok(!band.includes('replace-anyway') && !band.includes('changed'), band);
  h.$.prompt.read = read;
  await h.render();
  await waitFor(() => h.state.text === 'Rewritten.');
  assert.equal(h.state.text, 'Rewritten.');
  await h.press('undo-improve');
  assert.equal(h.state.text, original);
});

test('a held rewrite is dropped quietly if the draft came back different or was sent', async t => {
  for (const kind of ['different', 'sent']) await t.test(kind, async () => {
    const h = await host();
    const done = h.press('improve-draft');
    await h.started();
    const read = h.$.prompt.read;
    h.$.prompt.read = async () => ({ text: '', cursor: 0 });
    h.resolve(JSON.stringify({ prompt: 'Rewritten.', issue: '' }));
    await done;
    h.$.prompt.read = read;
    if (kind === 'different') { h.state.text = 'something else'; await h.render(); await new Promise(r => setTimeout(r, 100)); }
    else { h.state.text = ''; await h.event('prompt.change', { text: '', cursor: 0, origin: { kind: 'clear' } }); h.state.text = 'next prompt'; await h.render(); await new Promise(r => setTimeout(r, 100)); }
    assert.equal(h.state.fills, 0);
    assert.ok(!JSON.stringify(await h.render()).includes('undo-improve'));
  });
});

test('text that changed unreported while rewriting keeps your text, no extra button', async () => {
  const h = await host();
  const done = h.press('improve-draft');
  await h.started();
  h.state.text = 'something else entirely';
  h.resolve(JSON.stringify({ prompt: 'Rewritten.', issue: '' }));
  await done;
  assert.equal(h.state.text, 'something else entirely');
  assert.ok(!JSON.stringify(await h.render()).includes('replace-anyway'));
});
