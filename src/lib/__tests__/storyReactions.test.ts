import { addStoryReaction, getStoryViews, recordStoryView, sanitizeViewers } from "../storyViews";

/**
 * Automated test suite for Story Views & Self-Reaction Prevention.
 * Validates Requirement 10:
 * - User 1 viewing their own story does NOT generate a reaction.
 * - User 1 cannot submit a self-reaction.
 * - User 2 can react to User 1's story.
 * - Only the legitimate recipient (User 1) receives the reaction.
 */
export async function runStoryReactionRegressionTests(): Promise<{
  passed: boolean;
  results: { testName: string; passed: boolean; details: string }[];
}> {
  const results: { testName: string; passed: boolean; details: string }[] = [];
  const testStoryId = `test-story-${Date.now()}`;
  const authorUser = {
    id: "user-author-1",
    handle: "ryder",
    display_name: "Ryder",
    avatar_url: null,
  };
  const viewerUser = {
    id: "user-viewer-2",
    handle: "ryan",
    display_name: "Ryan",
    avatar_url: null,
  };

  // Test 1: Author viewing own story does not record self as viewer
  try {
    const afterSelfView = await recordStoryView(testStoryId, authorUser, authorUser.id);
    const hasAuthorInViewers = afterSelfView.viewers.some((v) => v.id === authorUser.id);
    const passed = !hasAuthorInViewers && afterSelfView.totalCount === 0;
    results.push({
      testName: "Author cannot be recorded as a viewer of own story",
      passed,
      details: passed ? "Author correctly excluded from viewers list" : "Failed: Author was found in viewers",
    });
  } catch (err) {
    results.push({
      testName: "Author cannot be recorded as a viewer of own story",
      passed: false,
      details: `Exception: ${(err as Error).message}`,
    });
  }

  // Test 2: Author attempting self-reaction is blocked
  try {
    const initialViews = getStoryViews(testStoryId, authorUser.id);
    const afterSelfReaction = await addStoryReaction(testStoryId, authorUser, "🔥", authorUser.id);
    const selfReacted = afterSelfReaction.viewers.some(
      (v) => v.id === authorUser.id && v.reaction === "🔥"
    );
    const passed = !selfReacted && afterSelfReaction.totalCount === initialViews.totalCount;
    results.push({
      testName: "Author self-reaction is strictly rejected at lib level",
      passed,
      details: passed ? "Self-reaction blocked, no state modified" : "Failed: Author reaction was accepted",
    });
  } catch (err) {
    results.push({
      testName: "Author self-reaction is strictly rejected at lib level",
      passed: false,
      details: `Exception: ${(err as Error).message}`,
    });
  }

  // Test 3: Viewer (User 2) viewing User 1's story is recorded
  try {
    const afterViewerView = await recordStoryView(testStoryId, viewerUser, authorUser.id);
    const hasViewer = afterViewerView.viewers.some((v) => v.id === viewerUser.id);
    const passed = hasViewer && afterViewerView.totalCount === 1;
    results.push({
      testName: "User 2 can legitimately view User 1's story",
      passed,
      details: passed ? "User 2 recorded as viewer with count 1" : "Failed: User 2 not recorded",
    });
  } catch (err) {
    results.push({
      testName: "User 2 can legitimately view User 1's story",
      passed: false,
      details: `Exception: ${(err as Error).message}`,
    });
  }

  // Test 4: Viewer (User 2) reacting to User 1's story is accepted
  try {
    const afterReaction = await addStoryReaction(testStoryId, viewerUser, "⚡", authorUser.id);
    const viewerWithReaction = afterReaction.viewers.find((v) => v.id === viewerUser.id);
    const passed = viewerWithReaction?.reaction === "⚡" && afterReaction.reactions["⚡"] === 1;
    results.push({
      testName: "User 2 can legitimately react to User 1's story",
      passed,
      details: passed ? "Reaction ⚡ successfully assigned to User 2" : "Failed: Reaction missing",
    });
  } catch (err) {
    results.push({
      testName: "User 2 can legitimately react to User 1's story",
      passed: false,
      details: `Exception: ${(err as Error).message}`,
    });
  }

  // Test 5: SanitizeViewers function guarantees no author presence
  try {
    const dirtyList = [
      { id: authorUser.id, handle: "ryder", display_name: "Ryder", avatar_url: null, viewed_at: new Date().toISOString() },
      { id: viewerUser.id, handle: "ryan", display_name: "Ryan", avatar_url: null, viewed_at: new Date().toISOString() },
      { id: "u-seed-99", handle: "seed", display_name: "Seed", avatar_url: null, viewed_at: new Date().toISOString() },
    ];
    const cleaned = sanitizeViewers(dirtyList, authorUser.id);
    const passed = cleaned.length === 1 && cleaned[0].id === viewerUser.id;
    results.push({
      testName: "sanitizeViewers filters out author and seed dummy users",
      passed,
      details: passed ? "Only real non-author viewers preserved" : "Failed: Author or seed user leaked",
    });
  } catch (err) {
    results.push({
      testName: "sanitizeViewers filters out author and seed dummy users",
      passed: false,
      details: `Exception: ${(err as Error).message}`,
    });
  }

  // Cleanup test key
  try {
    localStorage.removeItem(`flick:story_views:${testStoryId}`);
  } catch {}

  const allPassed = results.every((r) => r.passed);
  return { passed: allPassed, results };
}
