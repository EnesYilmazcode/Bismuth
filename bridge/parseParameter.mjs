// Port of supabase/functions/_shared/parseParameter.ts to plain JS so the
// bridge can produce parametric artifacts without spinning up Deno.

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function convertType(rawValue) {
  if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
    return { value: parseFloat(rawValue), type: 'number' };
  } else if (rawValue === 'true' || rawValue === 'false') {
    return { value: rawValue === 'true', type: 'boolean' };
  } else if (/^".*"$/.test(rawValue)) {
    return { value: rawValue.replace(/^"(.*)"$/, '$1'), type: 'string' };
  } else if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
    const arr = rawValue
      .slice(1, -1)
      .split(',')
      .map((x) => x.trim());
    if (arr.length > 0 && arr.every((x) => /^\d+(\.\d+)?$/.test(x))) {
      return { value: arr.map(parseFloat), type: 'number[]' };
    }
    if (arr.length > 0 && arr.every((x) => /^".*"$/.test(x))) {
      return { value: arr.map((x) => x.slice(1, -1)), type: 'string[]' };
    }
    if (arr.length > 0 && arr.every((x) => x === 'true' || x === 'false')) {
      return { value: arr.map((x) => x === 'true'), type: 'boolean[]' };
    }
    throw new Error('invalid array');
  }
  throw new Error('unknown value');
}

export default function parseParameters(scriptIn) {
  const script = scriptIn.split(/^(module |function )/m)[0];
  const params = {};
  const paramRegex =
    /^([a-z0-9A-Z_$]+)\s*=\s*([^;]+);[\t\f\cK ]*(\/\/[^\n]*)?/gm;
  const groupRegex = /^\/\*\s*\[([^\]]+)\]\s*\*\//gm;

  const groups = [{ id: '', group: '', code: script }];
  let g;
  while ((g = groupRegex.exec(script))) {
    groups.push({ id: g[0], group: g[1].trim(), code: '' });
  }
  groups.forEach((grp, i) => {
    const next = groups[i + 1];
    const start = script.indexOf(grp.id);
    const end = next ? script.indexOf(next.id) : script.length;
    grp.code = script.substring(start, end);
  });
  if (groups.length > 1) {
    groups[0].code = script.substring(0, script.indexOf(groups[1].id));
  }

  for (const section of groups) {
    let m;
    while ((m = paramRegex.exec(section.code)) !== null) {
      const name = m[1];
      const rawValue = m[2];
      let tv;
      try {
        tv = convertType(rawValue);
      } catch {
        continue;
      }
      if (!tv) continue;
      if (
        rawValue !== 'true' &&
        rawValue !== 'false' &&
        (rawValue.match(/^[a-zA-Z_]/) || rawValue.split('\n').length > 1)
      ) {
        continue;
      }

      let description;
      let options = [];
      let range = {};
      if (m[3]) {
        const raw = m[3].replace(/^\/\/\s*/, '').trim();
        const cleaned = raw.replace(/^\[+|\]+$/g, '');
        if (!isNaN(Number(raw))) {
          if (tv.type === 'string') range = { max: parseFloat(cleaned) };
          else range = { step: parseFloat(cleaned) };
        } else if (raw.startsWith('[') && cleaned.includes(',')) {
          options = cleaned.split(',').map((opt) => {
            const parts = opt.trim().split(':');
            let v = parts[0];
            if (tv.type === 'number') v = parseFloat(v);
            return { value: v, label: parts[1] };
          });
        } else if (cleaned.match(/([0-9]+:?)+/)) {
          const [min, mid, max] = cleaned.split(':');
          if (min && (mid || max)) range = { min: parseFloat(min) };
          if (max || mid || min)
            range = { ...range, max: parseFloat(max || mid || min) };
          if (max && mid) range = { ...range, step: parseFloat(mid) };
        }
      }

      let above = script.split(new RegExp(`^${escapeRegExp(m[0])}`, 'gm'))[0];
      if (above.endsWith('\n')) above = above.slice(0, -1);
      const lastLine = above.split('\n').reverse()[0];
      if (lastLine && lastLine.trim().startsWith('//')) {
        const d = lastLine.replace(/^\/\/\/*\s*/, '');
        if (d.length) description = d;
      }

      let displayName = name
        .replace(/_/g, ' ')
        .split(' ')
        .map((w) => (w[0] || '').toUpperCase() + w.slice(1))
        .join(' ');
      if (name === '$fn') displayName = 'Resolution';

      params[name] = {
        description,
        group: section.group,
        name,
        displayName,
        defaultValue: tv.value,
        range,
        options,
        ...tv,
      };
    }
  }
  return Object.values(params);
}
