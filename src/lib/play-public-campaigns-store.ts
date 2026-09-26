import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '@/config';
import {
  normalizePlayPublicCampaign,
  type PlayPublicCampaignRecord,
} from '@/lib/play-public-campaigns';

const LOCAL_DIR = path.join(process.cwd(), '.data', 'play-public-campaigns');
const TOKEN_PREFIX = 'pc:t:';
const ORDER_PREFIX = 'pc:o:';

function preferLocalCampaignFiles(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.PLAY_CAMPAIGNS_LOCAL === '1';
}

function tokenObjectPath(token: string): string {
  return `tokens/${token}.json`;
}

function orderObjectPath(orderId: string): string {
  return `orders/${orderId}.json`;
}

function tokenRowId(token: string): string {
  return `${TOKEN_PREFIX}${token}`;
}

function orderRowId(orderId: string): string {
  return `${ORDER_PREFIX}${orderId}`;
}

async function localPath(name: string): Promise<string> {
  const full = path.join(LOCAL_DIR, name);
  await mkdir(path.dirname(full), { recursive: true });
  return full;
}

async function readLocalJson<T>(name: string): Promise<T | null> {
  try {
    const text = await readFile(await localPath(name), 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeLocalJson(name: string, value: unknown) {
  await writeFile(await localPath(name), JSON.stringify(value), 'utf8');
}

function tableClient(): SupabaseClient {
  return createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function readCommentJson<T>(rowOrderId: string): Promise<T | null> {
  const { data, error } = await tableClient()
    .from('comments')
    .select('text')
    .eq('order_id', rowOrderId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.text) return null;
  try {
    return JSON.parse(String(data.text)) as T;
  } catch {
    return null;
  }
}

async function writeCommentJson(rowOrderId: string, value: unknown) {
  const client = tableClient();
  const text = JSON.stringify(value);
  const now = new Date().toISOString();
  const { data: existing, error: readError } = await client
    .from('comments')
    .select('id')
    .eq('order_id', rowOrderId)
    .limit(1)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing?.id) {
    const { error } = await client
      .from('comments')
      .update({ text, updated_at: now })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await client.from('comments').insert({
    order_id: rowOrderId,
    text,
    visibility: 'internal',
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
}

async function readStoredJson<T>(
  localName: string,
  rowOrderId: string
): Promise<T | null> {
  if (preferLocalCampaignFiles()) return readLocalJson<T>(localName);
  return readCommentJson<T>(rowOrderId);
}

async function writeStoredJson(localName: string, rowOrderId: string, value: unknown) {
  if (preferLocalCampaignFiles()) return writeLocalJson(localName, value);
  return writeCommentJson(rowOrderId, value);
}

export async function savePlayPublicCampaign(
  record: PlayPublicCampaignRecord
): Promise<PlayPublicCampaignRecord> {
  const next = normalizePlayPublicCampaign({
    ...record,
    updatedAt: new Date().toISOString(),
  });
  if (!next) throw new Error('Netinkama kampanijos nuoroda');
  await writeStoredJson(tokenObjectPath(next.token), tokenRowId(next.token), next);
  await writeStoredJson(orderObjectPath(next.orderId), orderRowId(next.orderId), {
    token: next.token,
    orderId: next.orderId,
  });
  return next;
}

export async function getPlayPublicCampaign(
  token: string
): Promise<PlayPublicCampaignRecord | null> {
  const raw =
    (await readStoredJson<unknown>(tokenObjectPath(token), tokenRowId(token))) ||
    (await readLocalJson<unknown>(`${token}.json`));
  return normalizePlayPublicCampaign(raw);
}

export async function getPlayPublicCampaignByOrderId(
  orderId: string
): Promise<PlayPublicCampaignRecord | null> {
  const id = String(orderId || '').trim();
  if (!id) return null;
  const pointer = await readStoredJson<{ token?: string }>(orderObjectPath(id), orderRowId(id));
  const token = String(pointer?.token || '').trim();
  if (token) return getPlayPublicCampaign(token);
  const legacy = await readLocalJson<Record<string, string>>('_index.json');
  const legacyToken = String(legacy?.[id] || '').trim();
  if (!legacyToken) return null;
  return getPlayPublicCampaign(legacyToken);
}
