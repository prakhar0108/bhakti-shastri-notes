// Exam Q&A and other-session pages, e.g. /docs/exam-prep-*, /docs/en/other-sessions.
const PRIVATE_PATH =
  /^\/docs\/(?:(?:en|hi)\/)?(?:exam-prep|other-sessions)(?:[-/]|$)/;

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH.test(pathname);
}
