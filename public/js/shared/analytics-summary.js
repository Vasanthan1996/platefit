// Builds the admin analytics report from raw Analytics rows. Shared by server and demo.

const DAY = 86400000;
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const weekKey = (d) => {
  const t = new Date(d); t.setUTCHours(0, 0, 0, 0);
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); // Monday
  return dayKey(t);
};
const monthKey = (d) => new Date(d).toISOString().slice(0, 7);

function top(map, n = 10) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));
}
function bump(map, key, by = 1) { if (key === undefined || key === null || key === '') return; map.set(key, (map.get(key) || 0) + by); }

export function summarize({ events = [], users = [], logs = [], feedback = [], contact = [], recipeNames = {}, planNames = {} }, { days = 30, now = Date.now() } = {}) {
  const since = now - days * DAY;
  const inRange = events.filter((e) => Date.parse(e.timestamp) >= since);

  const daily = new Map();
  for (let i = days - 1; i >= 0; i--) daily.set(dayKey(now - i * DAY), { date: dayKey(now - i * DAY), pageViews: 0, recipeViews: 0, searches: 0, visitors: new Set(), signups: 0 });

  const recipeViews = new Map(), searches = new Map(), zeroSearches = new Map(), plans = new Map(), pages = new Map(), devices = new Map(), referrers = new Map();
  const visitors = new Set(), returning = new Set(), sessions = new Set();
  let pageViews = 0, recipeViewCount = 0, searchCount = 0, cookModes = 0, favouritesAdded = 0;

  for (const e of inRange) {
    const d = daily.get(dayKey(e.timestamp));
    const who = e.visitorId || e.userId || e.sessionId;
    if (who) visitors.add(who);
    if (e.returning && who) returning.add(who);
    if (e.sessionId) sessions.add(e.sessionId);
    if (d && who) d.visitors.add(who);
    switch (e.event) {
      case 'page_view': pageViews++; if (d) d.pageViews++; bump(pages, e.path); bump(devices, e.device || 'unknown'); if (e.referrer) bump(referrers, e.referrer); break;
      case 'recipe_view': recipeViewCount++; if (d) d.recipeViews++; bump(recipeViews, e.recipeId); break;
      case 'search': searchCount++; if (d) d.searches++; bump(searches, (e.query || '').toLowerCase().trim()); if (Number(e.results) === 0) bump(zeroSearches, (e.query || '').toLowerCase().trim()); break;
      case 'plan_view': bump(plans, e.planId); break;
      case 'plan_save': bump(plans, e.planId, 3); break;
      case 'cook_mode_start': cookModes++; break;
      case 'favourite_add': favouritesAdded++; break;
      default: break;
    }
  }
  for (const u of users) { const d = daily.get(dayKey(u.createdAt || 0)); if (d) d.signups++; }

  // Weekly and monthly page-view trends over a longer window
  const weekly = new Map(), monthly = new Map();
  for (let i = 11; i >= 0; i--) weekly.set(weekKey(now - i * 7 * DAY), 0);
  for (let i = 11; i >= 0; i--) { const t = new Date(now); t.setUTCDate(1); t.setUTCMonth(t.getUTCMonth() - i); monthly.set(monthKey(t), 0); }
  for (const e of events) {
    if (e.event !== 'page_view') continue;
    const w = weekKey(e.timestamp); if (weekly.has(w)) weekly.set(w, weekly.get(w) + 1);
    const m = monthKey(e.timestamp); if (monthly.has(m)) monthly.set(m, monthly.get(m) + 1);
  }

  const active = (ms) => new Set(events.filter((e) => Date.parse(e.timestamp) >= now - ms).map((e) => e.visitorId || e.userId || e.sessionId).filter(Boolean)).size;

  return {
    rangeDays: days,
    generatedAt: new Date(now).toISOString(),
    totals: {
      users: users.length,
      newUsers: users.filter((u) => Date.parse(u.createdAt) >= since).length,
      pageViews,
      recipeViews: recipeViewCount,
      searches: searchCount,
      visitors: visitors.size,
      sessions: sessions.size,
      returningVisitors: returning.size,
      returningRate: visitors.size ? Math.round((returning.size / visitors.size) * 100) : 0,
      cookModes,
      favouritesAdded,
      mealLogs: logs.filter((l) => Date.parse(l.createdAt) >= since).length,
      newFeedback: feedback.filter((f) => f.status === 'new').length,
      newContacts: contact.filter((c) => c.status === 'new').length,
      dau: active(DAY), wau: active(7 * DAY), mau: active(30 * DAY),
    },
    daily: [...daily.values()].map((d) => ({ ...d, visitors: d.visitors.size })),
    weekly: [...weekly.entries()].map(([week, views]) => ({ week, views })),
    monthly: [...monthly.entries()].map(([month, views]) => ({ month, views })),
    topRecipes: top(recipeViews).map((r) => ({ ...r, name: recipeNames[r.key] || r.key })),
    topSearches: top(searches),
    zeroResultSearches: top(zeroSearches, 5),
    popularPlans: top(plans, 5).map((p) => ({ ...p, name: planNames[p.key] || p.key })),
    topPages: top(pages),
    devices: top(devices, 5),
    referrers: top(referrers, 5),
  };
}
