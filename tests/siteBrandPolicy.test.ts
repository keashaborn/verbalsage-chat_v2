import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types test runner loads the TypeScript file directly.
import {
  brandForSite,
  classifySiteRequest,
  normalizeSiteHostname,
  resolveSiteHost,
} from "../lib/siteBrand.ts";

test("production hostnames resolve to separate canonical brands", () => {
  assert.deepEqual(resolveSiteHost("verbalsage.com"), {
    hostname: "verbalsage.com",
    siteId: "verbal-sage",
    canonicalHostname: "verbalsage.com",
    recognized: true,
    local: false,
  });
  assert.deepEqual(resolveSiteHost("www.lifeswitch.com"), {
    hostname: "www.lifeswitch.com",
    siteId: "lifeswitch",
    canonicalHostname: "lifeswitch.com",
    recognized: true,
    local: false,
  });
});

test("host parsing is deterministic and unknown hosts fail closed", () => {
  assert.equal(
    normalizeSiteHostname(" VerbalSage.com.:443 "),
    "verbalsage.com",
  );
  assert.equal(resolveSiteHost("localhost:3010").recognized, true);
  assert.equal(resolveSiteHost("[::1]:3010").recognized, true);
  assert.equal(
    resolveSiteHost("verbalsage.localhost:3010").siteId,
    "verbal-sage",
  );
  assert.equal(
    resolveSiteHost("lifeswitch.localhost:3010").siteId,
    "lifeswitch",
  );
  assert.equal(resolveSiteHost("attacker.example").recognized, false);
  assert.equal(
    resolveSiteHost("verbalsage.com.attacker.example").recognized,
    false,
  );
});

test("Verbal Sage permits shared chat but blocks LifeSwitch namespaces", () => {
  assert.equal(classifySiteRequest("verbal-sage", "/", "GET"), "allow");
  assert.equal(
    classifySiteRequest("verbal-sage", "/api/chat", "POST"),
    "allow",
  );
  assert.equal(
    classifySiteRequest("verbal-sage", "/settings/security", "GET"),
    "allow",
  );
  assert.equal(
    classifySiteRequest("verbal-sage", "/lifeswitch/training", "GET"),
    "redirect-to-lifeswitch",
  );
  assert.equal(
    classifySiteRequest("verbal-sage", "/lifeswitch/training", "POST"),
    "not-found",
  );
  assert.equal(
    classifySiteRequest("verbal-sage", "/api/lifeswitch/training", "GET"),
    "not-found",
  );
  assert.equal(
    classifySiteRequest("verbal-sage", "/collect", "GET"),
    "redirect-to-lifeswitch",
  );
  assert.equal(
    classifySiteRequest("verbal-sage", "/developer/forms", "GET"),
    "redirect-to-lifeswitch",
  );
  assert.equal(
    classifySiteRequest("verbal-sage", "/api/forms/entries", "POST"),
    "not-found",
  );
  assert.equal(
    classifySiteRequest("verbal-sage", "/api/catalog/foods/search", "GET"),
    "not-found",
  );
  assert.equal(
    classifySiteRequest("verbal-sage", "/lifeswitching", "GET"),
    "allow",
  );
});

test("LifeSwitch retains every existing route", () => {
  for (const [pathname, method] of [
    ["/", "GET"],
    ["/api/chat", "POST"],
    ["/lifeswitch/training", "GET"],
    ["/api/lifeswitch/training", "POST"],
    ["/invite/lifeswitch/token", "GET"],
  ]) {
    assert.equal(classifySiteRequest("lifeswitch", pathname, method), "allow");
  }
});

test("brand metadata and visual identity are distinct", () => {
  const verbalSage = brandForSite("verbal-sage");
  const lifeSwitch = brandForSite("lifeswitch");

  assert.equal(verbalSage.name, "Verbal Sage");
  assert.equal(lifeSwitch.name, "LifeSwitch");
  assert.notEqual(verbalSage.favicon, lifeSwitch.favicon);
  assert.notEqual(verbalSage.accentColor, lifeSwitch.accentColor);
  assert.notEqual(verbalSage.canonicalHostname, lifeSwitch.canonicalHostname);
  assert.equal(
    verbalSage.appleTouchIcon,
    "/brand/verbal-sage/app-icon-180.png",
  );
  assert.deepEqual(
    verbalSage.manifestIcons.map((icon) => [icon.sizes, icon.purpose]),
    [
      ["192x192", "maskable"],
      ["512x512", "maskable"],
      ["192x192", "any"],
      ["512x512", "any"],
    ],
  );
});
