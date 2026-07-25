import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types test runner loads the TypeScript file directly.
import {
  automaticSearchRouteUsesExternalWebV1,
  decideSearchV1,
  isSearchExplicitlyProhibitedV1,
  recordSearchDecisionShadowV1,
  recordSearchRoutingEnforcedV1,
  SEARCH_DECISION_POLICY_VERSION,
  selectAutomaticSearchRouteV1,
} from "../lib/searchDecisionV1.ts";

const cases = [
  {
    input: "What is the capital of France?",
    decision: "no_search",
    reason: "stable_knowledge_default",
  },
  {
    input: "Rewrite the following text so it is concise.",
    decision: "no_search",
    reason: "user_content_transform",
  },
  {
    input: "What did I say about my training plan?",
    decision: "no_search",
    reason: "internal_context_sufficient",
  },
  {
    input: "Do not search the web. Explain relational monism.",
    decision: "no_search",
    reason: "search_prohibited_by_user",
  },
  {
    input: "What just happened with OpenAI?",
    decision: "live",
    reason: "freshness_required",
    policyPack: "software_security",
  },
  {
    input: "What happened with OpenAI today?",
    decision: "live",
    reason: "freshness_required",
    policyPack: "software_security",
  },
  {
    input:
      "What if you check the web for that information about open eye and Hugging Face?",
    decision: "live",
    reason: "explicit_web_request",
    policyPack: "software_security",
  },
  {
    input: "What is the latest Next.js security release?",
    decision: "live",
    reason: "freshness_required",
    policyPack: "software_security",
  },
  {
    input: "Search the web for the history of monism.",
    decision: "indexed",
    reason: "explicit_web_request",
  },
  {
    input: "Is creatine safe with kidney disease? Cite studies.",
    decision: "indexed",
    reason: "evidence_requested",
    policyPack: "health",
  },
  {
    input: "Deep research the long-term evidence for creatine.",
    decision: "research",
    reason: "explicit_research",
    policyPack: "health",
  },
  {
    input: "Summarize https://openai.com/research/example",
    decision: "live",
    reason: "specific_source_requested",
    policyPack: "software_security",
  },
] as const;

for (const example of cases) {
  test(`classifies: ${example.input}`, () => {
    const decision = decideSearchV1(example.input);
    assert.equal(decision.policy_version, SEARCH_DECISION_POLICY_VERSION);
    assert.equal(decision.decision, example.decision);
    assert.ok(decision.reason_codes.includes(example.reason));
    if ("policyPack" in example) {
      assert.equal(decision.policy_pack, example.policyPack);
    }
    assert.equal(decision.query_context, "current_message_only");
    assert.equal(
      decision.external_web_access,
      decision.decision === "live" || decision.decision === "research",
    );
  });
}

test("explicit no-search instruction overrides freshness and named entities", () => {
  const input = "Do not search the web. What is the latest OpenAI news?";
  assert.equal(isSearchExplicitlyProhibitedV1(input), true);
  assert.deepEqual(decideSearchV1(input), {
    policy_version: SEARCH_DECISION_POLICY_VERSION,
    decision: "no_search",
    reason_codes: ["search_prohibited_by_user"],
    policy_pack: "none",
    query_context: "current_message_only",
    external_web_access: false,
    confidence: "high",
    budget: { max_searches: 0, max_sources: 0 },
  });
});

test("recognizes enterprise no-search phrasing before any routing intent", () => {
  const prompts = [
    "No web access. What is the latest OpenAI news?",
    "Offline only: what happened today?",
    "Do not access external sources. Check current interest rates.",
    "Answer only from your existing knowledge. What is today's weather?",
    "Rely on your internal knowledge only. Find recent Supabase updates.",
  ];
  for (const input of prompts) {
    const decision = decideSearchV1(input);
    assert.equal(decision.decision, "no_search");
    assert.deepEqual(decision.reason_codes, ["search_prohibited_by_user"]);
    assert.equal(selectAutomaticSearchRouteV1(decision), "normal_chat");
  }
});

test("uses bounded budgets for every decision class", () => {
  assert.deepEqual(decideSearchV1("What is gravity?").budget, {
    max_searches: 0,
    max_sources: 0,
  });
  assert.deepEqual(decideSearchV1("Search the web for gravity.").budget, {
    max_searches: 2,
    max_sources: 5,
  });
  assert.deepEqual(decideSearchV1("What is the latest OpenAI news?").budget, {
    max_searches: 4,
    max_sources: 10,
  });
  assert.deepEqual(decideSearchV1("Deep research OpenAI safety.").budget, {
    max_searches: 12,
    max_sources: 30,
  });
});

test("routes trusted current-news entities for fresh or explicit web requests", () => {
  const prompts = [
    "What happened with OpenAI today?",
    "Check the web for that information about open eye and Hugging Face.",
    "Search the web for OpenAI documentation.",
  ];
  for (const input of prompts) {
    const decision = decideSearchV1(input);
    assert.equal(decision.decision, "live");
    assert.ok(
      decision.reason_codes.includes("trusted_current_news_scope"),
      input,
    );
    assert.equal(selectAutomaticSearchRouteV1(decision), "current_news");
  }
});

test("selects only server-supported automatic search routes", () => {
  const cases = [
    ["What is the capital of France?", "normal_chat"],
    ["What just happened with OpenAI?", "current_news"],
    ["Search the web for OpenAI documentation.", "current_news"],
    ["Search the web for the history of monism.", "normal_chat"],
    ["Is creatine safe with kidney disease? Cite studies.", "trusted_health"],
    ["Deep research the long-term evidence for creatine.", "normal_chat"],
    ["Deep research OpenAI safety.", "normal_chat"],
    ["What is today's weather?", "normal_chat"],
    ["Summarize https://openai.com/research/example", "normal_chat"],
    ["Cite sources for this OpenAI security claim.", "normal_chat"],
  ] as const;
  for (const [input, expectedRoute] of cases) {
    const route = selectAutomaticSearchRouteV1(decideSearchV1(input));
    assert.equal(route, expectedRoute);
    assert.equal(
      automaticSearchRouteUsesExternalWebV1(route),
      route !== "normal_chat",
    );
  }
});

test("enforced routing audit is server-owned and excludes prompt text", () => {
  const originalInfo = console.info;
  const originalAuditFlag = process.env.SEARCH_DECISION_AUDIT_ENABLED;
  const originalShadowFlag = process.env.SEARCH_DECISION_SHADOW_ENABLED;
  const logged: string[] = [];
  console.info = (...values: unknown[]) => {
    logged.push(values.map(String).join(" "));
  };
  process.env.SEARCH_DECISION_AUDIT_ENABLED = "1";
  delete process.env.SEARCH_DECISION_SHADOW_ENABLED;
  const secretPrompt =
    "What just happened with unique-enforced-routing-secret OpenAI?";

  try {
    const decision = decideSearchV1(secretPrompt);
    recordSearchRoutingEnforcedV1({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      requestId: "request-enforced-1",
      selectedRoute: "current_news",
      input: secretPrompt,
      decision,
    });
  } finally {
    console.info = originalInfo;
    if (originalAuditFlag === undefined) {
      delete process.env.SEARCH_DECISION_AUDIT_ENABLED;
    } else {
      process.env.SEARCH_DECISION_AUDIT_ENABLED = originalAuditFlag;
    }
    if (originalShadowFlag === undefined) {
      delete process.env.SEARCH_DECISION_SHADOW_ENABLED;
    } else {
      process.env.SEARCH_DECISION_SHADOW_ENABLED = originalShadowFlag;
    }
  }

  assert.equal(logged.length, 1);
  const event = JSON.parse(logged[0]);
  assert.equal(event.event, "search_routing_enforced_v1");
  assert.equal(event.authority, "server");
  assert.equal(event.selected_route, "current_news");
  assert.equal(event.executed_external_web_access, true);
  assert.equal(event.decision, "live");
  assert.equal(event.input_chars_bucket, "1-80");
  assert.doesNotMatch(logged[0], /unique-enforced-routing-secret/);
});

test("shadow record contains verified actor metadata but never prompt text", () => {
  const originalInfo = console.info;
  const originalFlag = process.env.SEARCH_DECISION_SHADOW_ENABLED;
  const logged: string[] = [];
  console.info = (...values: unknown[]) => {
    logged.push(values.map(String).join(" "));
  };
  process.env.SEARCH_DECISION_SHADOW_ENABLED = "1";
  const secretPrompt =
    "What just happened with unique-shadow-secret-phrase OpenAI?";

  try {
    recordSearchDecisionShadowV1({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      requestId: "request-shadow-1",
      observedRoute: "current_news",
      input: secretPrompt,
    });
  } finally {
    console.info = originalInfo;
    if (originalFlag === undefined) {
      delete process.env.SEARCH_DECISION_SHADOW_ENABLED;
    } else {
      process.env.SEARCH_DECISION_SHADOW_ENABLED = originalFlag;
    }
  }

  assert.equal(logged.length, 1);
  const event = JSON.parse(logged[0]);
  assert.equal(event.event, "search_decision_shadow_v1");
  assert.equal(event.actor_user_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(event.request_id, "request-shadow-1");
  assert.equal(event.observed_route, "current_news");
  assert.equal(event.decision, "live");
  assert.equal(event.input_chars_bucket, "1-80");
  assert.doesNotMatch(logged[0], /unique-shadow-secret-phrase/);
});

test("shadow logging requires explicit enablement", () => {
  const originalInfo = console.info;
  const originalFlag = process.env.SEARCH_DECISION_SHADOW_ENABLED;
  const logged: string[] = [];
  console.info = (...values: unknown[]) => {
    logged.push(values.map(String).join(" "));
  };
  delete process.env.SEARCH_DECISION_SHADOW_ENABLED;

  try {
    const decision = recordSearchDecisionShadowV1({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      requestId: "request-shadow-disabled",
      observedRoute: "normal_chat",
      input: "What is the capital of France?",
    });
    assert.equal(decision.decision, "no_search");
  } finally {
    console.info = originalInfo;
    if (originalFlag === undefined) {
      delete process.env.SEARCH_DECISION_SHADOW_ENABLED;
    } else {
      process.env.SEARCH_DECISION_SHADOW_ENABLED = originalFlag;
    }
  }

  assert.equal(logged.length, 0);
});

test("server routes enforced decisions after fresh Supabase authorization", async () => {
  const { readFile } = await import("node:fs/promises");
  const chat = await readFile(
    new URL("../app/api/chat/route.ts", import.meta.url),
    "utf8",
  );
  const health = await readFile(
    new URL("../app/api/trusted-web/route.ts", import.meta.url),
    "utf8",
  );
  const news = await readFile(
    new URL("../app/api/current-news/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(chat, /getFreshSupabaseAuthContextFromRequest/);
  assert.match(chat, /resolveServerSearchControlV1/);
  assert.match(chat, /serverSearchExecutionRequest/);
  assert.match(chat, /\/search\/execute/);
  assert.match(
    chat,
    /"x-vs-web-search-authorization": "supabase_fresh_web_search_v1"/,
  );
  assert.match(
    chat,
    /capabilityAllowsRole\("web_search\.use", permissionRole\)/,
  );
  assert.match(chat, /runServerSearchPlan/);
  assert.match(chat, /recordSearchRoutingEnforcedV1/);
  assert.doesNotMatch(chat, /selectAutomaticSearchRouteV1/);
  assert.doesNotMatch(chat, /postCurrentNews/);
  assert.doesNotMatch(chat, /postTrustedWeb/);
  assert.match(chat, /SERVER_SEARCH_AUTHORITY_VERSION/);
  assert.match(chat, /"X-VS-Search-Route": "normal_chat"/);
  assert.match(chat, /manualOverride/);
  assert.match(health, /requireFreshCapability/);
  assert.match(health, /observedRoute: "trusted_health"/);
  assert.match(news, /requireFreshCapability/);
  assert.match(news, /observedRoute: "current_news"/);
  for (const route of [health, news]) {
    assert.match(route, /recordSearchDecisionShadowV1/);
  }
  const authIndex = chat.indexOf(
    "const auth = await getFreshSupabaseAuthContextFromRequest(req)",
  );
  const threadIndex = chat.indexOf('new Response("thread_id required"');
  const dispatchIndex = chat.indexOf(
    "const searchResult = await runServerSearchPlan",
  );
  assert.ok(authIndex >= 0 && authIndex < threadIndex);
  assert.ok(threadIndex < dispatchIndex);
  for (const route of [health, news]) {
    const authIndex = route.indexOf(
      "const actorAuthorization = getSupabaseBearerAuthorizationFromRequest",
    );
    const decisionIndex = route.indexOf(
      "const searchDecision = recordSearchDecisionShadowV1",
    );
    const upstreamIndex = route.indexOf("const upstream = await fetch");
    assert.ok(authIndex >= 0 && authIndex < decisionIndex);
    assert.ok(decisionIndex < upstreamIndex);
    assert.match(route, /search_prohibited_by_user/);
    assert.match(route, /"X-VS-Search-Decision": "no_search"/);
  }
});
