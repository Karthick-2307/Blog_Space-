/**
 * A tiny stand-in for the Supabase client used by route handlers.
 * Each query is recorded; `respond` decides what it returns.
 */
export type Call = {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  payload?: unknown;
  filters: [string, string, unknown][];
};

export type Responder = (call: Call) => { data?: unknown; error?: unknown; count?: number } | undefined;

export function fakeSupabase(userId: string | null, respond: Responder) {
  const calls: Call[] = [];

  function builder(table: string) {
    const call: Call = { table, op: "select", filters: [] };
    let opSet = false;
    const setOp = (op: Call["op"], payload?: unknown) => {
      if (!opSet) {
        call.op = op;
        call.payload = payload;
        opSet = true;
        calls.push(call);
      }
      return chain;
    };
    const chain: Record<string, unknown> = {
      select: () => (opSet ? chain : setOp("select")),
      insert: (p: unknown) => setOp("insert", p),
      update: (p: unknown) => setOp("update", p),
      delete: () => setOp("delete"),
      upsert: (p: unknown) => setOp("upsert", p),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
        try {
          const res = respond(call) ?? {};
          return Promise.resolve({ data: res.data ?? null, error: res.error ?? null, count: res.count ?? null }).then(resolve, reject);
        } catch (e) {
          return Promise.reject(e).then(resolve, reject);
        }
      },
    };
    for (const m of ["eq", "neq", "gt", "in", "order", "range", "limit", "textSearch", "maybeSingle", "single"]) {
      chain[m] = (col?: string, val?: unknown) => {
        if (["eq", "neq", "gt", "in"].includes(m)) call.filters.push([m, String(col), val]);
        return chain;
      };
    }
    return chain;
  }

  const client = {
    auth: {
      getClaims: async () => ({ data: userId ? { claims: { sub: userId } } : null, error: null }),
    },
    from: (table: string) => builder(table),
    storage: {
      from: () => ({
        upload: async () => ({ data: { path: "x" }, error: null }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/media/${path}` } }),
      }),
    },
  };
  return { client, calls };
}

export function filterValue(call: Call, col: string) {
  return call.filters.find(([, c]) => c === col)?.[2];
}
