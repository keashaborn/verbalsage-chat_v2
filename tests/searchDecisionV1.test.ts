import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types test runner loads the TypeScript file directly.
import {
  decideSearchV1,
  recordSearchDecisionShadowV1,
  SEARCH_DECISION_POLICY_VERSION,
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

test("server routes record shadow decisions after Supabase authorization", async () => {
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

  assert.match(chat, /getSupabaseAuthContextFromRequest/);
  assert.match(chat, /observedRoute: "normal_chat"/);
  assert.match(chat, /if \(!noStore\)/);
  assert.match(health, /requireFreshCapability/);
  assert.match(health, /observedRoute: "trusted_health"/);
  assert.match(news, /requireFreshCapability/);
  assert.match(news, /observedRoute: "current_news"/);
  for (const route of [chat, health, news]) {
    assert.match(route, /recordSearchDecisionShadowV1/);
  }
});
