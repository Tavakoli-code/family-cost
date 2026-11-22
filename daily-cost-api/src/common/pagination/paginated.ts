/**
 * Return this from a list endpoint. The response interceptor turns it into
 * { data: items, meta: { path, total, limit, offset } }.
 */
export class Paginated<T> {
  constructor(
    public readonly items: T[],
    public readonly total: number,
    public readonly limit: number,
    public readonly offset: number,
  ) {}
}
