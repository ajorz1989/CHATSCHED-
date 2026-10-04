import { describe, expect, it } from "vitest";
import {
  fileHasCode, htmlHasMetaCode, isPrivateIp, isValidCode, normalizeDomain, txtHasCode, websiteSnippets,
} from "./websiteOwnership";

const CODE = "CS-7A3B9";

describe("isValidCode", () => {
  it("accepts the generated shape only", () => {
    expect(isValidCode("CS-7A3B9")).toBe(true);
    expect(isValidCode("cs-7a3b9")).toBe(false);
    expect(isValidCode("CS-7A3B")).toBe(false);
    expect(isValidCode("CS-7A3BZ")).toBe(false);
    expect(isValidCode(null)).toBe(false);
  });
});

describe("normalizeDomain", () => {
  it("reduces typed input to a bare host", () => {
    expect(normalizeDomain("https://www.Example.co.za/about?x=1")).toBe("www.example.co.za");
    expect(normalizeDomain("  mysite.co.za ")).toBe("mysite.co.za");
    expect(normalizeDomain("mysite.co.za.")).toBe("mysite.co.za");
  });
  it.each([
    "localhost", "http://localhost:3000", "127.0.0.1", "10.0.0.5", "192.168.1.1", "intranet", "site.local",
    "user:pw@evil.com", "evil.com:8080", "a b.com", "", "-bad.com", "foo.internal", "foo.test",
  ])("rejects %s", (v) => {
    expect(normalizeDomain(v)).toBeNull();
  });
  it("rejects non-strings", () => {
    expect(normalizeDomain(undefined)).toBeNull();
    expect(normalizeDomain(42)).toBeNull();
  });
});

describe("isPrivateIp", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.0.10", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fe80::1", "fd00::1", "::ffff:10.0.0.1"])(
    "%s is private", (ip) => expect(isPrivateIp(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "41.0.0.1", "172.32.0.1", "2606:4700:4700::1111"])("%s is public", (ip) => expect(isPrivateIp(ip)).toBe(false));
  it("treats unknown formats as unsafe", () => expect(isPrivateIp("not-an-ip")).toBe(true));
});

describe("htmlHasMetaCode", () => {
  it("finds the tag in either attribute order and quote style", () => {
    expect(htmlHasMetaCode(`<head><meta name="chatsched-verification" content="${CODE}"></head>`, CODE)).toBe(true);
    expect(htmlHasMetaCode(`<meta content='${CODE}' name='chatsched-verification' />`, CODE)).toBe(true);
    expect(htmlHasMetaCode(`<META NAME=chatsched-verification CONTENT=${CODE}>`, CODE)).toBe(true);
  });
  it("does not match a different code, name or plain text", () => {
    expect(htmlHasMetaCode(`<meta name="chatsched-verification" content="CS-00000">`, CODE)).toBe(false);
    expect(htmlHasMetaCode(`<meta name="description" content="${CODE}">`, CODE)).toBe(false);
    expect(htmlHasMetaCode(`<p>${CODE}</p>`, CODE)).toBe(false);
    expect(htmlHasMetaCode(`<meta name="chatsched-verification" content="${CODE}">`, "bad")).toBe(false);
  });
});

describe("txtHasCode", () => {
  it("accepts quoted and split TXT values", () => {
    expect(txtHasCode([`"chatsched-verification=${CODE}"`], CODE)).toBe(true);
    expect(txtHasCode([`chatsched-verification=${CODE}`], CODE)).toBe(true);
    expect(txtHasCode([`"chatsched-verific" "ation=${CODE}"`], CODE)).toBe(true);
  });
  it("rejects look-alikes", () => {
    expect(txtHasCode([`"v=spf1 include:x ~all"`], CODE)).toBe(false);
    expect(txtHasCode([`"chatsched-verification=CS-00000"`], CODE)).toBe(false);
    expect(txtHasCode([`"xchatsched-verification=${CODE}"`], CODE)).toBe(false);
    expect(txtHasCode([], CODE)).toBe(false);
  });
});

describe("fileHasCode", () => {
  it("accepts the code with whitespace only", () => {
    expect(fileHasCode(`${CODE}\n`, CODE)).toBe(true);
    expect(fileHasCode(`  ${CODE}  `, CODE)).toBe(true);
  });
  it("rejects pages that merely mention it", () => {
    expect(fileHasCode(`<html>${CODE}</html>`, CODE)).toBe(false);
    expect(fileHasCode("", CODE)).toBe(false);
  });
});

describe("websiteSnippets", () => {
  it("builds the three things a publisher copies", () => {
    const s = websiteSnippets(CODE);
    expect(s.metaTag).toBe(`<meta name="chatsched-verification" content="${CODE}">`);
    expect(s.dnsValue).toBe(`chatsched-verification=${CODE}`);
    expect(s.filePath).toBe("/.well-known/chatsched-verification.txt");
  });
});
