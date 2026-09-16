const failurePattern = /error|fail|reject|declin|unavailable|insufficient|not found|missing|invalid|mismatch|stop|catch|cleanup/i;
export function behaviorCard(detail, curated = false) {
  const decisions = detail.decisions || [];
  return [
    ["Receives", detail.inputs?.length ? detail.inputs : [curated ? "No inputs listed" : "No parameters declared; other inputs may exist"]],
    ["Checks & branches", decisions.length ? decisions : ["No explicit branches mapped"]],
    ["Changes", detail.effects?.length ? detail.effects : ["No side effects mapped; not a guarantee of purity"]],
    ["Returns", detail.outputs?.length ? detail.outputs : ["No explicit return mapped"]],
    ["If it fails", decisions.filter(s => failurePattern.test(s)).length
      ? decisions.filter(s => failurePattern.test(s))
      : ["Failure handling is not established"]],
  ];
}

// Fail closed for obvious source/pseudocode in provider responses or extracted labels.
export function plainBehavior(value) {
  if (typeof value !== "string" || !value.trim()) return "Not established";
  if (/```|`|[{};]|=>|\b(?:const|let|var|function|class|import|export)\s+\w|\w+\s*\([^)]*\)|<\/?\w+[^>]*>/.test(value))
    return "Implementation detail omitted. Ask for a plain-language description.";
  return value.trim();
}

export function parseBehaviorAnswer(content) {
  const value = JSON.parse(content);
  const keys = ["answer", "receives", "checks", "changes", "returns", "failure", "uncertainty"];
  if (!value || Array.isArray(value) || typeof value !== "object" || !keys.some(k => k in value))
    throw new Error("The provider did not return a behavior card. Try again.");
  return keys.filter(k => k in value).map(k => [k === "failure" ? "If it fails" : k, plainBehavior(value[k]).slice(0, 400)]);
}
