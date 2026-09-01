// ---------------------------------------------------------------------------
// Spell-card deck fixture reader.
//
// Every deck spec needs the same thing before it can assert anything: the
// Spellbook page's URL, and the real shape of the content below it — which
// stacks exist, in which order, holding which spells and which references.
// Sourcing that from the Management API rather than hardcoding it is what lets
// the specs assert BEHAVIOUR ("every stack shows its own count") instead of
// CONTENT ("Core shows 16"), so a content edit in the backoffice cannot turn a
// deck spec red without a deck change.
//
// Extracted because two specs had grown identical copies of the walk, the
// three helpers under it, and the two interfaces. A third copy was the trigger.
//
// The walk is BREADTH-PARALLEL: the four document-type lookups resolve
// together, then all stacks together, then each stack's cards together. The
// sequential version issued 40+ round trips before the first test ran and grew
// linearly with the roster, which has no ceiling in the schema.
// ---------------------------------------------------------------------------

import {
  apiFetch,
  collectContentNodesByDocType,
  getDocumentTypeByName,
  tryGetDocumentPath,
} from './_umbracoApi';

export interface SpellCardFacts {
  id: string;
  name: string;
  slug: string;
  isSpell: boolean;
  /** `cardMark` — the sigil key an editor chose. Empty means "fall back to the pack's". */
  mark: string;
  /** `cardWatchFor` — empty on the cards that exercise the omit-an-empty-field rule. */
  watch: string;
}

export interface SpellStackFacts {
  id: string;
  name: string;
  slug: string;
  /** `stackPack` — the identity key, which is NOT always the slug. */
  pack: string;
  spells: SpellCardFacts[];
  references: SpellCardFacts[];
}

export interface SpellDeckFixture {
  spellbookUrl: string;
  stacks: SpellStackFacts[];
  docTypeIds: { spellbook: string; stack: string; spell: string; reference: string };
}

/** Last non-empty path segment of a published URL — the node's slug. */
export function slugOf(url: string): string {
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

/**
 * A flexible dropdown stores a single-element array (`["explore"]`). Flatten it
 * so a test compares against the key an editor actually picked.
 */
export function firstOf(value: any): string {
  if (Array.isArray(value)) return value.length ? String(value[0]) : '';
  return value == null ? '' : String(value);
}

export async function treeChildren(parentId: string): Promise<any[]> {
  const resp = await apiFetch('GET', `/tree/document/children?parentId=${parentId}&skip=0&take=100`);
  if (!resp.ok) throw new Error(`GET children of ${parentId} failed: ${resp.status}`);
  return ((await resp.json()) as any).items ?? [];
}

/** Read one document's stored property values as a flat alias → value map. */
export async function documentValues(id: string): Promise<Record<string, any>> {
  const resp = await apiFetch('GET', `/document/${id}`);
  if (!resp.ok) throw new Error(`GET /document/${id} failed: ${resp.status}`);
  const doc = (await resp.json()) as any;
  const map: Record<string, any> = {};
  for (const v of doc.values ?? []) map[v.alias] = v.value;
  return map;
}

/**
 * A named card from a stack, falling back to its first spell. Specs want a
 * recognisable card in their assertion messages, but must not BREAK when an
 * editor renames or reorders content — the fallback is what keeps a content
 * edit from turning a behaviour spec red.
 */
export function pickSpell(stack: SpellStackFacts, preferredSlug: string): SpellCardFacts {
  return stack.spells.find((c) => c.slug === preferredSlug) ?? stack.spells[0];
}

/**
 * Read the whole deck's content shape. Throws with a step-specific message when
 * a prerequisite increment has not shipped, so a missing schema or missing
 * content reads as that rather than as a puzzling assertion failure later.
 */
export async function readSpellDeck(): Promise<SpellDeckFixture> {
  const [spellbookDt, stackDt, spellDt, referenceDt] = await Promise.all([
    getDocumentTypeByName('Spellbook'),
    getDocumentTypeByName('Spell Card Stack'),
    getDocumentTypeByName('Spell'),
    getDocumentTypeByName('Reference'),
  ]);
  if (!spellbookDt || !stackDt || !spellDt || !referenceDt) {
    throw new Error('Spell-card document types not found — Step 2 must be shipped.');
  }

  const spellbookNodes = await collectContentNodesByDocType(spellbookDt.id);
  if (spellbookNodes.length === 0) {
    throw new Error('No published Spellbook page — Step 3 must be shipped.');
  }

  const [spellbookUrl, stackItems] = await Promise.all([
    tryGetDocumentPath(spellbookNodes[0].id),
    treeChildren(spellbookNodes[0].id),
  ]);
  if (!spellbookUrl) throw new Error('Spellbook page has no published URL.');

  const stacks = await Promise.all(
    stackItems
      .filter((item) => item.documentType?.id === stackDt.id)
      .map(async (stackItem): Promise<SpellStackFacts> => {
        const stackName = stackItem.variants?.[0]?.name ?? '';
        const [stackUrl, stackValues, cardItems] = await Promise.all([
          tryGetDocumentPath(stackItem.id),
          documentValues(stackItem.id),
          treeChildren(stackItem.id),
        ]);
        if (!stackUrl) throw new Error(`Stack "${stackName}" has no published URL.`);

        const cards = await Promise.all(
          cardItems
            .filter(
              (c) => c.documentType?.id === spellDt.id || c.documentType?.id === referenceDt.id
            )
            .map(async (cardItem) => {
              const [cardUrl, values] = await Promise.all([
                tryGetDocumentPath(cardItem.id),
                documentValues(cardItem.id),
              ]);
              if (!cardUrl) return null;
              return {
                id: cardItem.id,
                name: cardItem.variants?.[0]?.name ?? '',
                slug: slugOf(cardUrl),
                isSpell: cardItem.documentType?.id === spellDt.id,
                mark: firstOf(values.cardMark),
                watch: String(values.cardWatchFor ?? ''),
              } as SpellCardFacts;
            })
        );

        const present = cards.filter((c): c is SpellCardFacts => c !== null);
        return {
          id: stackItem.id,
          name: stackName,
          slug: slugOf(stackUrl),
          pack: String(stackValues.stackPack ?? ''),
          // Tree order within a kind is the editor's arrangement, and the view
          // preserves it — so keep it here rather than sorting.
          spells: present.filter((c) => c.isSpell),
          references: present.filter((c) => !c.isSpell),
        };
      })
  );

  return {
    spellbookUrl,
    stacks,
    docTypeIds: {
      spellbook: spellbookDt.id,
      stack: stackDt.id,
      spell: spellDt.id,
      reference: referenceDt.id,
    },
  };
}
