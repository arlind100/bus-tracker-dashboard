// Issue reports data layer — triage passenger-submitted reports.
//
// Passengers CREATE these (rules allow anyone to create); admins read/update/
// delete. "Open" = status ∈ {new, open, pending, reviewing}; a missing status is
// treated as open. Reports optionally reference a route/bus/stop.

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { COLLECTIONS } from '@/firebase/collections';
import { toDoc, fetchNameMap } from '@/lib/firestore';
import type { IssueReport, IssueStatus } from '@/types';

export const OPEN_ISSUE_STATUSES: ReadonlySet<string> = new Set([
  'new',
  'open',
  'pending',
  'reviewing',
]);

export function isOpen(report: Pick<IssueReport, 'status'>): boolean {
  return !report.status || OPEN_ISSUE_STATUSES.has(report.status);
}

export interface IssuesResult {
  reports: IssueReport[];
  /** routeId → human-readable route name, for display alongside the raw id. */
  routeNames: Record<string, string>;
}

export interface IssueUpdate {
  status?: IssueStatus;
  assignedTo?: string;
  resolutionNote?: string;
  updatedBy?: string;
}

export const issuesService = {
  /** All reports, newest first, plus a routeId → name map. */
  async list(): Promise<IssuesResult> {
    const [issuesSnap, routeNames] = await Promise.all([
      getDocs(query(collection(db, COLLECTIONS.issueReports), orderBy('createdAt', 'desc'))),
      fetchNameMap(COLLECTIONS.routes),
    ]);
    return { reports: issuesSnap.docs.map(d => toDoc<IssueReport>(d)), routeNames };
  },

  /** Update a report's triage fields (status / assignee / resolution note). */
  async update(id: string, patch: IssueUpdate): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.issueReports, id), {
      ...patch,
      updatedAt: Date.now(),
    });
  },

  async setStatus(id: string, status: IssueStatus, updatedBy?: string): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.issueReports, id), {
      status,
      ...(updatedBy ? { updatedBy } : {}),
      updatedAt: Date.now(),
    });
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.issueReports, id));
  },
};
