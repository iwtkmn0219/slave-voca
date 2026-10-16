import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addUser, USER } from '../helpers/users';
import { createDb, type Db } from '@/server/db/client';
import { alertLog } from '@/server/db/schema';
import { notify, resetThrottleForTest, shouldSendThrottled, webhookBody } from '@/server/alerts/notify';
import { reportUsageLimit, reserveMeaningUsage, UsageLimitError } from '@/server/services/meaning-usage';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetThrottleForTest();
});

describe('webhookBody', () => {
  it('uses Discord content and Slack text, and refuses anything else', () => {
    expect(webhookBody('https://discord.com/api/webhooks/1/abc', 'hi')).toEqual({ content: 'hi' });
    expect(webhookBody('https://discordapp.com/api/webhooks/1/abc', 'hi')).toEqual({ content: 'hi' });
    expect(webhookBody('https://hooks.slack.com/services/T/B/x', 'hi')).toEqual({ text: 'hi' });
    expect(webhookBody('https://example.com/hook', 'hi')).toBeNull();
    expect(webhookBody('http://discord.com/api/webhooks/1/abc', 'hi')).toBeNull();
    expect(webhookBody('not a url', 'hi')).toBeNull();
  });
});

describe('notify', () => {
  it('posts JSON to the webhook', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    await notify('가입 신청', { ALERT_WEBHOOK_URL: 'https://hooks.slack.com/services/T/B/x' }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://hooks.slack.com/services/T/B/x');
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(init.body as string)).toEqual({ text: '가입 신청' });
  });

  it('only logs when there is no webhook, and never throws when sending fails', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await notify('a', {}, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(notify('b', { ALERT_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/x' }, fetcher)).resolves.toBeUndefined();
  });
});

describe('shouldSendThrottled', () => {
  it('sends the same key once per window', () => {
    expect(shouldSendThrottled('k', 0, 1000)).toBe(true);
    expect(shouldSendThrottled('k', 999, 1000)).toBe(false);
    expect(shouldSendThrottled('other', 999, 1000)).toBe(true);
    expect(shouldSendThrottled('k', 1000, 1000)).toBe(true);
  });
});

describe('usage alerts', () => {
  let db: Db;
  const NOW = new Date('2026-10-17T03:00:00Z');
  let sent: string[];
  beforeEach(() => {
    db = createDb(':memory:');
    addUser(db);
    sent = [];
    vi.stubEnv('ALERT_WEBHOOK_URL', 'https://discord.com/api/webhooks/1/x');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push((JSON.parse(init.body as string) as { content: string }).content);
        return new Response(null, { status: 204 });
      }),
    );
  });
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('alerts once per month at 80% and 100% of the budget', async () => {
    const limits = { monthlyWords: 1_000_000, monthlyBudgetUsd: 1 };
    const spend = (outputTokens: number) => {
      const m = reserveMeaningUsage(db, USER, 'save', 1, { now: NOW, limits });
      m.onUsage({ inputTokens: 0, outputTokens });
      m.finish();
    };
    spend(320_000); // $0.80
    spend(1); // 이미 보낸 80%는 다시 보내지 않는다
    spend(80_000); // $1.00
    await flush();
    expect(sent).toEqual([
      'Gemini 이번 달 비용이 상한의 80%에 닿았습니다: $0.80 / $1.00',
      'Gemini 이번 달 비용이 상한의 100%에 닿았습니다: $1.00 / $1.00',
    ]);
    expect(db.select({ key: alertLog.key }).from(alertLog).all().map((r) => r.key).sort()).toEqual(['budget-100:2026-10', 'budget-80:2026-10']);
  });

  it('alerts once per user per month when the personal limit is hit', async () => {
    const err = new UsageLimitError('user-limit', '11월 1일');
    reportUsageLimit(db, USER, err, { now: NOW, limits: { monthlyWords: 4000, monthlyBudgetUsd: 5 } });
    reportUsageLimit(db, USER, err, { now: NOW, limits: { monthlyWords: 4000, monthlyBudgetUsd: 5 } });
    await flush();
    expect(sent).toEqual(['user-a (user-a@example.com) 님이 이번 달 한도(4000단어)에 닿았습니다.']);
  });
});
