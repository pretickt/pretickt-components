import { expect, it } from 'vitest';
import { TYPOLOGY_IDS } from './ids';
import { TYPOLOGY_SCHEMAS } from './schemas';

it('the schema-free id list is the registry, in order', () => expect([...TYPOLOGY_IDS]).toEqual(Object.keys(TYPOLOGY_SCHEMAS)));
