import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSignaturePayload,
  hashPayload,
} from '../src/sourceSignature.js';

const baseElementType = {
  alias: 'alertBanner',
  name: 'Alert Banner',
  properties: [
    { alias: 'alertContent', name: 'Alert Content', dataTypeAlias: 'Richtext editor' },
    { alias: 'alertLevel', name: 'Alert Level', dataTypeAlias: 'Dropdown' },
    { alias: 'iconOverride', name: 'Icon Override', dataTypeAlias: 'Textstring' },
  ],
};

const basePartial = '@inherits UmbracoViewPage<BlockListItem>\n@* alertBanner *@';

describe('buildSignaturePayload', () => {
  it('produces a deterministic JSON shape', () => {
    const payload = buildSignaturePayload({
      partialPath: 'src/UmbracoProject/Views/Partials/blocks/Components/alertBanner.cshtml',
      partialContent: basePartial,
      elementType: baseElementType,
      agentSystemPromptHash: 'abc123',
    });

    assert.equal(payload.partial, 'src/UmbracoProject/Views/Partials/blocks/Components/alertBanner.cshtml');
    assert.equal(payload.partialContent, basePartial);
    assert.equal(payload.schemaVersion, 1);
    assert.equal(payload.agentSystemPromptHash, 'abc123');
    assert.equal(payload.elementType.alias, 'alertBanner');
    assert.equal(payload.elementType.properties.length, 3);
    // Properties sorted by alias
    assert.deepEqual(
      payload.elementType.properties.map((p) => p.alias),
      ['alertContent', 'alertLevel', 'iconOverride'],
    );
  });

  it('sorts element type properties by alias regardless of input order', () => {
    const shuffled = {
      ...baseElementType,
      properties: [
        baseElementType.properties[2],
        baseElementType.properties[0],
        baseElementType.properties[1],
      ],
    };
    const payload = buildSignaturePayload({
      partialPath: 'a.cshtml',
      partialContent: 'x',
      elementType: shuffled,
      agentSystemPromptHash: '',
    });

    assert.deepEqual(
      payload.elementType.properties.map((p) => p.alias),
      ['alertContent', 'alertLevel', 'iconOverride'],
    );
  });

  it('only includes alias/name/dataTypeAlias on properties (drops extras)', () => {
    const withExtras = {
      ...baseElementType,
      properties: [
        {
          alias: 'alertContent',
          name: 'Alert Content',
          dataTypeAlias: 'Richtext editor',
          // these should not be retained in the signature payload
          id: 'should-not-leak',
          sortOrder: 999,
          description: 'noise',
        },
      ],
    };
    const payload = buildSignaturePayload({
      partialPath: 'a.cshtml',
      partialContent: 'x',
      elementType: withExtras as unknown as typeof baseElementType,
      agentSystemPromptHash: '',
    });

    const prop = payload.elementType.properties[0];
    assert.deepEqual(Object.keys(prop).sort(), ['alias', 'dataTypeAlias', 'name']);
  });
});

describe('hashPayload', () => {
  it('returns the same SHA-256 hex digest for the same payload', () => {
    const payload = buildSignaturePayload({
      partialPath: 'x.cshtml',
      partialContent: basePartial,
      elementType: baseElementType,
      agentSystemPromptHash: '',
    });

    const a = hashPayload(payload);
    const b = hashPayload(payload);
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it('returns the same digest regardless of property input order', () => {
    const a = hashPayload(buildSignaturePayload({
      partialPath: 'x.cshtml',
      partialContent: basePartial,
      elementType: baseElementType,
      agentSystemPromptHash: '',
    }));

    const shuffled = {
      ...baseElementType,
      properties: [...baseElementType.properties].reverse(),
    };
    const b = hashPayload(buildSignaturePayload({
      partialPath: 'x.cshtml',
      partialContent: basePartial,
      elementType: shuffled,
      agentSystemPromptHash: '',
    }));

    assert.equal(a, b);
  });

  it('changes when partial content changes', () => {
    const a = hashPayload(buildSignaturePayload({
      partialPath: 'x.cshtml',
      partialContent: basePartial,
      elementType: baseElementType,
      agentSystemPromptHash: '',
    }));
    const b = hashPayload(buildSignaturePayload({
      partialPath: 'x.cshtml',
      partialContent: basePartial + '\n@* edited *@',
      elementType: baseElementType,
      agentSystemPromptHash: '',
    }));
    assert.notEqual(a, b);
  });

  it('changes when element type properties change', () => {
    const a = hashPayload(buildSignaturePayload({
      partialPath: 'x.cshtml',
      partialContent: basePartial,
      elementType: baseElementType,
      agentSystemPromptHash: '',
    }));
    const withNewProp = {
      ...baseElementType,
      properties: [
        ...baseElementType.properties,
        { alias: 'newProp', name: 'New', dataTypeAlias: 'Textstring' },
      ],
    };
    const b = hashPayload(buildSignaturePayload({
      partialPath: 'x.cshtml',
      partialContent: basePartial,
      elementType: withNewProp,
      agentSystemPromptHash: '',
    }));
    assert.notEqual(a, b);
  });

  it('changes when the agent system prompt hash changes', () => {
    const a = hashPayload(buildSignaturePayload({
      partialPath: 'x.cshtml',
      partialContent: basePartial,
      elementType: baseElementType,
      agentSystemPromptHash: 'v1',
    }));
    const b = hashPayload(buildSignaturePayload({
      partialPath: 'x.cshtml',
      partialContent: basePartial,
      elementType: baseElementType,
      agentSystemPromptHash: 'v2',
    }));
    assert.notEqual(a, b);
  });
});
