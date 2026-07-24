// Shared Firestore helpers for the dashboard service layer.
//
// Mirrors patterns proven in the mobile app's admin.service.ts:
//   - a document-read timeout so a hung network never blocks the UI forever
//   - id → name maps for client-side denormalization (no server joins)
//   - a single audit-log writer so every mutating action leaves an adminUpdates
//     entry (matching the canonical AdminUpdate shape: adminUid + action + detail)

import {
  collection,
  addDoc,
  getDocs,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { COLLECTIONS } from '@/firebase/collections';

export const FETCH_TIMEOUT_MS = 8000;

/** A sentinel returned when a promise loses the race against the timeout. */
export const TIMEOUT = Symbol('timeout');

/**
 * Races a promise against FETCH_TIMEOUT_MS. Resolves to the value, or the
 * TIMEOUT sentinel — callers decide how to degrade. Never rejects on timeout.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = FETCH_TIMEOUT_MS,
): Promise<T | typeof TIMEOUT> {
  return Promise.race([
    promise,
    new Promise<typeof TIMEOUT>(resolve => setTimeout(() => resolve(TIMEOUT), ms)),
  ]);
}

/** Maps a snapshot doc to a typed object that includes its Firestore id. */
export function toDoc<T>(snap: QueryDocumentSnapshot<DocumentData>): T {
  return { id: snap.id, ...snap.data() } as T;
}

/** Builds an id → `name` map from a set of snapshot docs (best-effort labels). */
export function buildNameMap(
  docs: QueryDocumentSnapshot<DocumentData>[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const d of docs) {
    const name = (d.data() as { name?: string }).name;
    map[d.id] = typeof name === 'string' ? name : d.id;
  }
  return map;
}

/** Fetches a whole collection and returns an id → name map (best-effort). */
export async function fetchNameMap(
  collectionName: string,
): Promise<Record<string, string>> {
  try {
    const snap = await getDocs(collection(db, collectionName));
    return buildNameMap(snap.docs);
  } catch {
    return {};
  }
}

/**
 * Appends an entry to the adminUpdates audit log. Best-effort: an audit-write
 * failure must never fail the primary mutation, so this swallows errors.
 * Writes `adminUid` (the canonical AdminUpdate field) — not `adminName`.
 */
export async function logAdminUpdate(input: {
  adminUid: string;
  action: string;
  detail: string;
  targetId?: string;
}): Promise<void> {
  try {
    await addDoc(collection(db, COLLECTIONS.adminUpdates), {
      adminUid: input.adminUid,
      action: input.action,
      detail: input.detail,
      ...(input.targetId ? { targetId: input.targetId } : {}),
      createdAt: Date.now(),
    });
  } catch (err) {
    console.warn('[audit] failed to write adminUpdates entry:', err);
  }
}
