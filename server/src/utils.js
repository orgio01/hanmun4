export function json(res, status, data) {
  res.status(status).json(data);
}

export function badRequest(res, message, details) {
  return json(res, 400, { error: { message, details } });
}

export function notFound(res, message = "Not found") {
  return json(res, 404, { error: { message } });
}

export function ok(res, data) {
  return json(res, 200, data);
}

export function pick(obj, keys) {
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

export function makeId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function makeOrderNumber() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `UB-${t}-${r}`;
}

