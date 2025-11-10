import { safeGet, parseUnixTimestamp } from "./helpers.js";

/**
* Parse a raw TikTok search response (from live API or sample JSON)
* and normalize it into a compact, analytics-friendly shape.
*/
export function parseSearchResults(raw, { maxItems = 100 } = {}) {
const items = extractItems(raw);
const limit = Math.min(maxItems, items.length);

const results = [];

for (let i = 0; i < limit; i += 1) {
const item = items[i];
const normalized = normalizeVideoItem(item);
if (normalized) {
results.push(normalized);
}
}

return results;
}

function extractItems(raw) {
if (!raw) return [];

if (Array.isArray(raw)) {
return raw;
}

if (Array.isArray(raw.items)) {
return raw.items;
}

// Some TikTok APIs return { data: { items: [...] } }
const dataItems = safeGet(raw, "data.items");
if (Array.isArray(dataItems)) {
return dataItems;
}

// Fallback: try itemList or similar common shapes
const itemList = safeGet(raw, "itemList");
if (Array.isArray(itemList)) {
return itemList;
}

// Single object case
if (typeof raw === "object") {
return [raw];
}

return [];
}

function normalizeVideoItem(item) {
if (!item || typeof item !== "object") return null;

const id =
String(
item.id ??
item.videoId ??
safeGet(item, "stats.videoId") ??
safeGet(item, "aweme_id") ??
""
) || "";

if (!id) {
// Without a stable ID, the item isn't very useful.
return null;
}

const authorUniqueId =
safeGet(item, "author.uniqueId") ||
safeGet(item, "author.unique_id") ||
safeGet(item, "author.username") ||
safeGet(item, "author.id") ||
safeGet(item, "authorId") ||
"";

const authorNickname =
safeGet(item, "author.nickname") ||
safeGet(item, "author.nickName") ||
safeGet(item, "nickname") ||
null;

const region =
safeGet(item, "locationCreated") ||
safeGet(item, "region") ||
safeGet(item, "author.region") ||
null;

const url =
item.url ||
item.shareUrl ||
(authorUniqueId
? `https://www.tiktok.com/@${authorUniqueId}/video/${id}`
: null);

const createTimeRaw =
item.createTime ||
item.create_time ||
safeGet(item, "video.createTime") ||
null;

const createTimeString =
createTimeRaw != null ? String(createTimeRaw) : null;

const createdAtIso = parseUnixTimestamp(createTimeRaw);

const video = normalizeVideo(item);
const music = normalizeMusic(item);
const stats = normalizeStats(item);
const authorStats = normalizeAuthorStats(item);

const diversificationLabels =
safeGet(item, "diversificationLabels") ||
safeGet(item, "labels") ||
safeGet(item, "classificationLabels") ||
[];

return {
url,
id,
desc: item.desc || item.description || "",
createTime: createTimeString,
createdAt: createdAtIso,
video,
author: authorUniqueId || null,
music,
stats,
authorStats,
locationCreated: region,
diversificationLabels,
nickname: authorNickname
};
}

function normalizeVideo(item) {
const videoObj =
item.video ||
item.videoMeta ||
safeGet(item, "aweme_detail.video") ||
{};

const duration =
videoObj.duration ||
videoObj.durationSecond ||
videoObj.durationMs / 1000 ||
safeGet(item, "duration") ||
null;

const ratio =
videoObj.ratio ||
videoObj.ratioFormat ||
(videoObj.height && videoObj.width
? `${videoObj.height}x${videoObj.width}`
: null);

const bitrate =
videoObj.bitrate ||
videoObj.bitrate_kbps ||
safeGet(videoObj, "bitrateInfo.0.bitrate") ||
null;

const format =
videoObj.format ||
videoObj.codec ||
(videoObj.playAddr && videoObj.playAddr.endsWith(".mp4")
? "mp4"
: null);

return {
duration: duration != null ? Number(duration) : null,
ratio: ratio || null,
bitrate: bitrate != null ? Number(bitrate) : null,
format: format || null
};
}

function normalizeMusic(item) {
const musicObj = item.music || item.musicInfo || {};
return {
title: musicObj.title || musicObj.musicName || null,
playUrl:
musicObj.playUrl ||
musicObj.play_url ||
safeGet(musicObj, "playUrl.urlList.0") ||
null
};
}

function normalizeStats(item) {
const stats = item.stats || item.statistics || {};
const shares =
stats.shareCount ||
stats.share_count ||
stats.forwardCount ||
stats.forward_count ||
null;

const comments =
stats.commentCount ||
stats.comment_count ||
stats.comments ||
null;

const likes =
stats.diggCount ||
stats.digg_count ||
stats.likeCount ||
stats.like_count ||
null;

const views =
stats.playCount ||
stats.play_count ||
stats.viewCount ||
stats.view_count ||
null;

return {
diggCount: likes != null ? Number(likes) : null,
shareCount: shares != null ? Number(shares) : null,
commentCount: comments != null ? Number(comments) : null,
playCount: views != null ? Number(views) : null
};
}

function normalizeAuthorStats(item) {
const authorStats =
item.authorStats ||
item.author_statistics ||
safeGet(item, "author.stats") ||
{};
return {
followerCount:
authorStats.followerCount ||
authorStats.follower_count ||
null,
heartCount:
authorStats.heartCount ||
authorStats.heart_count ||
authorStats.totalLikes ||
null,
videoCount:
authorStats.videoCount ||
authorStats.video_count ||
authorStats.videoTotal ||
null
};
}