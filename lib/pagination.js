export const DEFAULT_POST_LIMIT = 50;
export const MAX_API_POST_LIMIT = 100;
export const MAX_INTERNAL_POST_LIMIT = 200;
export const MAX_POST_OFFSET = 10_000;

export class PaginationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PaginationError';
  }
}

function parseIntegerParam(raw, { name, fallback, min, max }) {
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) throw new PaginationError(`${name} 必须是整数`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new PaginationError(`${name} 必须在 ${min}-${max} 之间`);
  }
  return value;
}

export function parsePostPagination(searchParams) {
  return {
    limit: parseIntegerParam(searchParams.get('limit'), {
      name: 'limit',
      fallback: DEFAULT_POST_LIMIT,
      min: 1,
      max: MAX_API_POST_LIMIT,
    }),
    offset: parseIntegerParam(searchParams.get('offset'), {
      name: 'offset',
      fallback: 0,
      min: 0,
      max: MAX_POST_OFFSET,
    }),
  };
}

export function normalizePostPagination({
  limit = DEFAULT_POST_LIMIT,
  offset = 0,
} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_INTERNAL_POST_LIMIT) {
    throw new PaginationError(`limit 必须在 1-${MAX_INTERNAL_POST_LIMIT} 之间`);
  }
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_POST_OFFSET) {
    throw new PaginationError(`offset 必须在 0-${MAX_POST_OFFSET} 之间`);
  }
  return { limit, offset };
}
