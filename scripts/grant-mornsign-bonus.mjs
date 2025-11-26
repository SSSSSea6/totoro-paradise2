import { createClient } from '@supabase/supabase-js';

/**
 * Grant one morning-sign credit to every known user.
 * Sources:
 *  - user_credits table (existing balances)
 *  - morning_sign_tasks table (historical morning sign reservations)
 *  - Tasks table (sun-run queue payloads that include session data)
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/grant-mornsign-bonus.mjs [--dry-run]
 */
const PAGE_SIZE = 1000;
const dryRun = process.argv.includes('--dry-run');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NUXT_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NUXT_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('[grant-bonus] Missing Supabase env (SUPABASE_URL / SUPABASE_SERVICE_KEY).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const normalizeId = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  return str;
};

const userCredits = new Map();
const userIds = new Set();

const paginate = async (table, select, orderBy, onPage) => {
  let from = 0;
  while (true) {
    const query = supabase.from(table).select(select);
    if (orderBy) query.order(orderBy, { ascending: true });
    query.range(from, from + PAGE_SIZE - 1);
    const { data, error } = await query;
    if (error) {
      throw new Error(`[${table}] ${error.message}`);
    }
    if (!data || data.length === 0) break;
    onPage(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
};

const collectUserCredits = async () => {
  await paginate(
    'user_credits',
    'user_id, credits',
    'user_id',
    (rows) => {
      rows.forEach((row) => {
        const id = normalizeId(row.user_id);
        if (!id) return;
        const credits = Number(row.credits) || 0;
        userCredits.set(id, credits);
        userIds.add(id);
      });
    },
  );
};

const collectMorningSignTasks = async () => {
  await paginate(
    'morning_sign_tasks',
    'id, user_id',
    'id',
    (rows) => {
      rows.forEach((row) => {
        const id = normalizeId(row.user_id);
        if (id) userIds.add(id);
      });
    },
  );
};

const collectTaskUsers = async () => {
  await paginate(
    'Tasks',
    'id, user_data',
    'id',
    (rows) => {
      rows.forEach((row) => {
        const payload = row.user_data || {};
        const possibleIds = [
          payload.stuNumber,
          payload.userId,
          payload.user_id,
          payload.session?.stuNumber,
          payload.session?.userId,
        ];
        possibleIds.forEach((maybeId) => {
          const id = normalizeId(maybeId);
          if (id) userIds.add(id);
        });
      });
    },
  );
};

const upsertCredits = async (rows) => {
  const { error } = await supabase
    .from('user_credits')
    .upsert(rows, { onConflict: 'user_id' });
  if (error) {
    throw new Error(`[grant-bonus] upsert failed: ${error.message}`);
  }
};

const run = async () => {
  console.log('[grant-bonus] Collecting users...');
  await collectUserCredits();
  await collectMorningSignTasks();
  await collectTaskUsers();

  const allUserIds = Array.from(userIds);
  const existingCount = allUserIds.filter((id) => userCredits.has(id)).length;
  const newCount = allUserIds.length - existingCount;

  console.log(
    `[grant-bonus] Found ${allUserIds.length} unique users. Existing credit rows: ${existingCount}, new: ${newCount}.`,
  );

  const nowIso = new Date().toISOString();
  const rows = allUserIds.map((userId) => ({
    user_id: userId,
    credits: (userCredits.get(userId) ?? 0) + 1,
    updated_at: nowIso,
  }));

  if (dryRun) {
    console.log('[grant-bonus] Dry-run enabled. No changes were written.');
    console.log(`[grant-bonus] Would upsert ${rows.length} rows with +1 credit each.`);
    return;
  }

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await upsertCredits(chunk);
    console.log(
      `[grant-bonus] Applied bonus to rows ${i + 1}-${Math.min(i + chunkSize, rows.length)}.`,
    );
  }

  console.log('[grant-bonus] Done. All users received +1 credit.');
};

run().catch((error) => {
  console.error('[grant-bonus] Failed:', error);
  process.exit(1);
});
