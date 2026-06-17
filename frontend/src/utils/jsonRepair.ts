/**
 * Utility to repair truncated JSON strings produced by LLMs.
 * Closes open quotes, brackets, and braces to produce syntactically valid JSON.
 */
export function repairTruncatedJson(jsonStr: string): string {
  try {
    JSON.parse(jsonStr);
    return jsonStr;
  } catch (e) {}

  let repaired = jsonStr.trim();
  
  // Strip markdown code block fences if present
  if (repaired.startsWith('```json')) {
    repaired = repaired.slice(7).trim();
  } else if (repaired.startsWith('```')) {
    repaired = repaired.slice(3).trim();
  }
  if (repaired.endsWith('```')) {
    repaired = repaired.slice(0, -3).trim();
  }

  // Handle trailing commas and colons at the end of the structure
  if (repaired.endsWith(',')) {
    repaired = repaired.slice(0, -1).trim();
  } else if (repaired.endsWith(':')) {
    repaired += ' null';
  }

  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char === '{' ? '}' : ']');
      } else if (char === '}' || char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }
  }

  if (inString) {
    repaired += '"';
  }

  while (stack.length > 0) {
    const closingChar = stack.pop();
    repaired += closingChar;
  }

  return repaired;
}
