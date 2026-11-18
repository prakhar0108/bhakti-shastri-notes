// Exam Q&A, other-session and Chaitanya Charan Das pages, e.g. /docs/exam-prep-*,
// /docs/en/other-sessions, /docs/chaitanya-charan-das-*.
const PRIVATE_PATH =
  /^\/docs\/(?:(?:en|hi)\/)?(?:exam-prep|other-sessions|chaitanya-charan-das)(?:[-/]|$)/;

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH.test(pathname);
}
