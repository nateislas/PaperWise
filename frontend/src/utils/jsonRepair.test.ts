import { repairTruncatedJson } from './jsonRepair';

describe('repairTruncatedJson', () => {
  it('returns valid JSON untouched', () => {
    const valid = '{"key": "value", "list": [1, 2, 3]}';
    expect(JSON.parse(repairTruncatedJson(valid))).toEqual({
      key: 'value',
      list: [1, 2, 3]
    });
  });

  it('strips markdown code blocks', () => {
    const wrapped = '```json\n{"key": "value"}\n```';
    expect(JSON.parse(repairTruncatedJson(wrapped))).toEqual({
      key: 'value'
    });
  });

  it('repairs truncated string values', () => {
    const truncated = '{"executive_summary": "This is a very long summary that got cut off';
    const repaired = repairTruncatedJson(truncated);
    expect(JSON.parse(repaired)).toEqual({
      executive_summary: 'This is a very long summary that got cut off'
    });
  });

  it('repairs truncated nested objects and arrays', () => {
    const truncated = '{"novelty": {"score": "high", "reasons": ["innovative", "novel';
    const repaired = repairTruncatedJson(truncated);
    expect(JSON.parse(repaired)).toEqual({
      novelty: {
        score: 'high',
        reasons: ['innovative', 'novel']
      }
    });
  });

  it('handles escaped quotes inside truncated strings', () => {
    const truncated = '{"quote": "She said \\"hello and then was cut off';
    const repaired = repairTruncatedJson(truncated);
    expect(JSON.parse(repaired)).toEqual({
      quote: 'She said "hello and then was cut off'
    });
  });

  it('handles truncation right at key-value boundary or structural points', () => {
    const truncated = '{"key":';
    const repaired = repairTruncatedJson(truncated);
    // Since it ends at "key":, it is not a valid JSON value yet, but it closes the object.
    // Let's verify it closes cleanly or behaves defensively.
    expect(() => JSON.parse(repaired)).not.toThrow();
  });
});
