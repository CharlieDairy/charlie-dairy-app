// The wording of the "are you sure?" box before a delete. The Admin deletes for real; the farm manager only sends a request.
// `what` reads after "delete", e.g. "this sale entry" or "cash entry #12 (Opex Feed)".
export function deleteConfirm(needsApproval: boolean, what: string, extra = ""): string {
  const tail = extra ? ` ${extra}` : "";
  return needsApproval
    ? `Ask the Admin to delete ${what}? Nothing is removed until the Admin approves it.${tail}`
    : `Delete ${what}? This can't be undone.${tail}`;
}
