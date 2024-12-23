import { AtpAgent } from '@atproto/api';
import * as dotenv from 'dotenv';
import { randomInt } from 'crypto';
import { Logger, ILogObj } from 'tslog';
import * as fs from 'fs';
import { CronJob } from 'cron';
import { DateTime } from 'luxon';
import { sendMessage, sendChatBreak } from './kindroid';

const version = 'v0.0.1'

// Timezone
console.log('Current timezone:', process.env.TZ);

// Config
interface Topic {
  Topic: string;
  Tone: string;
}

interface Schedule {
  Time: string;
  MaxDelay: number;
}

interface Config {
  BskyHandle: string;
  KindroidId: string;
  Keywords: string[];
  InteractCount: number;
  MaxMentionReply: number;
  NewPostCount: number;
  Schedules: Schedule[];
  Topics: Topic[];
}

// Logging
const CUSTOM_LEVELS = {
  LIKE: 'LIKE',
  RPST: 'RPST',
  RPLY: 'RPLY',
  MNTN: 'MNTN',
  FLLW: 'FLLW',
  POST: 'POST',
  SCHED: 'SCHED'
};

class CustomLogger<T extends ILogObj> extends Logger<T> {
  constructor() {
    super();
  }

  private customLog(type: keyof typeof CUSTOM_LEVELS, msg: string, ...args: unknown[]): void {
    this.log(7, type, msg, ...args);
  }

  like(msg: string, ...args: unknown[]): void {
    this.customLog("LIKE", msg, ...args);
  }

  repost(msg: string, ...args: unknown[]): void {
    this.customLog("RPST", msg, ...args);
  }

  reply(msg: string, ...args: unknown[]): void {
    this.customLog("RPLY", msg, ...args);
  }

  mention(msg: string, ...args: unknown[]): void {
    this.customLog("MNTN", msg, ...args);
  }

  follow(msg: string, ...args: unknown[]): void {
    this.customLog("FLLW", msg, ...args);
  }

  post(msg: string, ...args: unknown[]): void {
    this.customLog("POST", msg, ...args);
  }

  schedule(msg: string, ...args: unknown[]): void {
    this.customLog("SCHED", msg, ...args);
  }
}

// Constants
const log = new CustomLogger<ILogObj>();
const config: Config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const agent = new AtpAgent({ service: 'https://bsky.social' });

// Setup
function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

// Bsky interactions
async function authenticate() {
  dotenv.config();
  await agent.login({ identifier: config.BskyHandle, password: getEnvVar("BSKY_TOKEN") });
}

async function searchAndAnalyze(keywords: string[]) {
  await new Promise(resolve => setTimeout(resolve, randomInt(1000, 5000))); // Humans don't interact instantly
  const analyzedPosts = await searchPostsWithMultipleKeywords(keywords, config.InteractCount);

  const posts = analyzedPosts.map(post => ({
    post: post,
    text: post.record?.text || 'No text content',
    value: analyzePostInteractionValue(post),
    author: post.author.handle,
    uri: post.uri,
    cid: post.cid,
    url: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`
  })).sort((a, b) => b.value - a.value);

  return posts.slice(0, config.InteractCount);
}

async function searchPostsWithMultipleKeywords(keywords: string[], limit?: number, since?: string): Promise<any[]> {
  if (!limit) {
    limit = 5;
  }

  if (!since) {
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - (4 * 60 * 60 * 1000)); // 4 hours in milliseconds
    since = fourHoursAgo.toISOString();
  }

  let allPosts = [];

  for (const keyword of keywords) {
    const response = await agent.api.app.bsky.feed.searchPosts({ q: keyword, limit: limit, since: since, lang: 'en' });
    allPosts = allPosts.concat(response.data.posts);
  }

  return Array.from(new Set(allPosts.map(p => p.uri))).map(uri => allPosts.find(p => p.uri === uri));
}

function analyzePostInteractionValue(post: any): number {
  const likes = post.likeCount || 0;
  const replies = post.replyCount || 0;
  const reposts = post.repostCount || 0;
  const views = post.viewCount || 1; // Avoid division by zero

  const engagementRate = (likes + replies + reposts) / views;

  const authorFollowers = post.author?.followersCount || 0;
  // Use log to reduce the impact of very large follower counts (bias correction)
  const authorInfluence = Math.log(1 + authorFollowers);

  const now = new Date();
  const postDate = new Date(post.indexedAt);
  const recencyScore = 1 - (now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24 * 30); // Score decreases over 30 days

  return (
    (likes * 2) + 
      replies + 
      (reposts * 1.5) + 
      (engagementRate * 100) +
      authorInfluence + 
      (recencyScore * 100)
  );
}

async function interactWithPost(post: any) {
  const actions = ['like', 'repost', 'reply'];
  const action = actions[randomInt(0, actions.length)];

  switch (action) {
    case 'like':
      log.like('Liking:', post.url);
      log.like('Engagement Score:', post.value);
      log.like('Text:', post.text);
      await agent.like(post.uri, post.cid);
      await followUser(post.author, agent).catch(log.error);
      break;
    case 'repost':
      log.repost('Reposting:', post.url);
      log.repost('Engagement Score:', post.value);
      log.repost('Text:', post.text);
      await agent.repost(post.uri, post.cid);
      await followUser(post.author, agent).catch(log.error);
      break;
    case 'reply':
      log.reply('Replying:', post.url);
      log.reply('Engagement Score:', post.value);
      log.reply('Text:', post.text);

      try {
        const replyObject = {
          root: {uri: post.uri, cid: post.cid},
          parent: {uri: post.uri, cid: post.cid},
        };

        var prompt = "Reply to this post from " + post.author + "\n\n" + post.text || "<no text>";

        if (post.embed) {
          if (post.embed.$type === 'app.bsky.embed.images') {
            prompt += `\n\n${post.author.handle} attached ${post.embed.images.length} images:`;
            post.embed.images.forEach(img => {
              prompt += `\nURL: ${img.image} | Alt Text: ${img.alt || 'No alt text'}`;
            });
          } else if (post.embed.$type === 'app.bsky.embed.external') {
            prompt += `\n\n${post.author.handle} linked to external media, probably a gif. URL: ${post.embed.external.uri} | Title: ${post.embed.external.title} | Description: ${post.embed.external.description}`;
          }
        }

        var reply = await getKindroidMessage(prompt);
        log.reply('Reply:', reply);
        await agent.post({
          text: reply,
          reply: replyObject
        });
        log.reply('Replied to post:', post.url);
        await followUser(post.author, agent).catch(log.error);
      } catch (error) {
        log.error('Failed to reply to post:', error);
      }
      break;
  }
}

async function simulateHumanInteractions(index: number) {
  log.info("Searching for posts with keywords:", config.Keywords.slice(index * 2, (index * 2) + 2));
  const topPosts = await searchAndAnalyze(config.Keywords.slice(index * 2, (index * 2) + 2));

  log.info("Interacting with top posts...");
  for (let i = 0; i < topPosts.length; i++) {
    const post = topPosts[i];
    await new Promise(resolve => setTimeout(resolve, randomInt(25000, 75000))); // Humans don't interact instantly
    await interactWithPost(post);
  }

  log.info(`Posting ${config.NewPostCount} original messages...`);
  for (let i = 0; i < config.NewPostCount; i++) {
    await new Promise(resolve => setTimeout(resolve, randomInt(45000, 95000))); // Humans don't interact instantly

    var randomTopic = config.Topics[randomInt(0, config.Topics.length - 1)];
    log.post(`Random Topic: ${randomTopic.Topic}, Tone: ${randomTopic.Tone}`);
    const newPostContent = await getKindroidMessage(`Create a new Bluesky post. Topic: ${randomTopic.Topic}. Tone: ${randomTopic.Tone}.`);
    await agent.post({ text: newPostContent });
    log.post('Posted:', newPostContent);
  }

  log.info("Replying to mentions...");
  await replyToMentions(agent);

  log.info("Initiating Kindroid chat break...");
  await initiateKindroidChatBreak();

  log.info("All interactions completed.");
}

async function followUser(handle: string, agentSession: AtpAgent): Promise<void> {
  try {
    const resolveResponse = await agentSession.resolveHandle({ handle });
    const did = resolveResponse.data.did;

    await agentSession.api.com.atproto.repo.createRecord({
      collection: 'app.bsky.graph.follow',
      repo: agentSession.session.did, // Your DID
      record: {
        $type: 'app.bsky.graph.follow',
        createdAt: new Date().toISOString(),
        subject: did,
      },
    });

    log.follow(`Followed: ${handle}`);
  } catch (error) {
    log.error(`Failed to follow ${handle}:`, error);
    throw error;
  }
}

async function replyToMentions(agent: AtpAgent) {
  const posts = await getMentionsAndReplies(agent);

  for (const post of posts) {
    await new Promise(resolve => setTimeout(resolve, randomInt(45000, 95000)));
    log.mention('Replying to mention/reply:', post.uri);
    log.mention('Author:', post.author.handle);
    log.mention('Text:', post.record?.text);

    try {
      const replyObject = {
        root: {uri: post.uri, cid: post.cid},
        parent: {uri: post.uri, cid: post.cid},
      };

      var prompt = "Reply to this post from " + post.author.handle + " who @mentioned you directly.\n\n" + post.record?.text || "<no text>";

      if (post.record.embed) {
        if (post.embed.$type === 'app.bsky.embed.images') {
          prompt += `\n\n${post.author.handle} attached ${post.record.embed.images.length} images:`;
          post.record.embed.images.forEach(img => {
            prompt += `\nURL: ${img.image} | Alt Text: ${img.alt || 'No alt text'}`;
          });
        } else if (post.record.embed.$type === 'app.bsky.embed.external') {
            prompt += `\n\n${post.author.handle} linked to external media, probably a gif. URL: ${post.embed.external.uri} | Title: ${post.embed.external.title} | Description: ${post.embed.external.description}`;
        }
      }

      var reply = await getKindroidMessage(prompt);
      log.mention('Reply:', reply);
      await agent.post({
        text: reply,
        reply: replyObject
      });

      log.info('Replied to mention/reply:', post.uri);
      await followUser(post.author.handle, agent).catch(log.error);
    } catch (error) {
      log.error('Failed to reply to post:', error);
    }
  }
}

async function getMentionsAndReplies(agent: AtpAgent): Promise<any[]> {
  try {
    const mentionsResponse = await agent.api.app.bsky.notification.listNotifications();
    const mentions = mentionsResponse.data.notifications.filter(notification => !notification.isRead && (notification.reason.toString().includes('mention') || notification.reason.toString().includes('reply')));
    const mentionsWithText = mentions.filter(m => (m.record as { text?: string }).text !== undefined);

    if (mentionsWithText.length > 0) {
      log.info(`Found ${mentions.length} mentions for ${agent.session.handle}`);
      if (mentionsWithText.length > config.MaxMentionReply) {
        log.info(`Limiting mentions to ${config.MaxMentionReply}`);
        const shuf = [...mentionsWithText];
        shuf.sort(() => Math.random() - 0.5);
        return shuf.slice(0, config.MaxMentionReply);
      }
    } else {
      log.info(`No mentions found for ${agent.session.handle}`);
    }
    return mentionsWithText;
  } catch (error) {
    log.error(`Failed to get mentions for ${agent.session.handle}:`, error);
  }
}

// Kindroid interactions
async function getKindroidMessage(prompt: string): Promise<string> {
  const kinConfig = { apiKey: getEnvVar('KIN_KEY') };
  const messageContent = {
    ai_id: config.KindroidId,
    message: prompt
  };

  return sendMessage(kinConfig, messageContent).then(response => response).catch(error => {
    log.error('Failed to send message:', error.message);
  });
}

async function initiateKindroidChatBreak() {
  const kinConfig = { apiKey: getEnvVar('KIN_KEY') };
  const chatBreakContent = {
    ai_id: config.KindroidId,
    greeting: 'Waiting for instruction'
  };

  return sendChatBreak(kinConfig, chatBreakContent).then(response => response).catch(error => {
    log.error('Failed to send chat break:', error.message);
  });
}

// Main online time
async function main() {
  try {
    await authenticate();
    await simulateHumanInteractions(randomInt(0, Math.floor(config.Keywords.length / 2)));
    log.schedule(`Version: ${version}. Next job to run at: ${getNextJobToRun(jobs).nextRun.toLocaleString()}`);
  } catch (error) {
    log.error('Failed to fetch or analyze posts:', error);
  }
}

async function checkConnectionHealth() {
  try {
    await authenticate();
    await agent.api.app.bsky.actor.getProfile({ actor: 'bsky.app' });
    log.schedule(`Connection health check passed. Version: ${version}. Next job to run at: ${getNextJobToRun(jobs).nextRun.toLocaleString()}`);
    return true;
  } catch (error) {
    log.error('Connection health check failed:', error);
    return false;
  }
}

function checkConn() {
  checkConnectionHealth();
}

// Scheduling
function timeToCron(timeString: string): string {
  const [time, modifier] = timeString.split(' ');
  let [hours, minutes] = time.split(':').map(Number);

  if (modifier === "PM" && hours !== 12) {
    hours += 12;
  } else if (hours === 12 && modifier === "AM") {
    hours = 0;
  }

  return `0 ${minutes} ${hours} * * *`;
}

function calculateNextRun(cronTime: string, timezone: string = 'local'): Date {
  const now = DateTime.local().setZone(timezone);
  const parts = cronTime.split(' ');

  const second = 0;
  const minute = Number(parts[1]);
  const hour = Number(parts[2]);

  let nextRun = now.set({ second, minute, hour });

  if (nextRun <= now) {
    // If the calculated time is in the past or now, move to the next day
    nextRun = nextRun.plus({ days: 1 });
  }

  return nextRun.toJSDate();
}

function getNextJobToRun(jobs: CronJob[]): { job: CronJob; nextRun: Date } {
  let nextJob: { job: CronJob; nextRun: Date } = {
    job: null,
    nextRun: new Date(8640000000000000) // Maximum date value
  };

  jobs.forEach(job => {
    try {
      const cronTime = job.cronTime.source;
      const nextDate = calculateNextRun(cronTime.toString());

      if (nextDate < nextJob.nextRun) {
        nextJob = { job, nextRun: nextDate };
      }
    } catch (error) {
      log.error('Error calculating next run time for job:', error);
    }
  });

  return nextJob;
}

function getRandomDelay(min: number, max: number): number {
  return randomInt(min, max) * 1000;
}

function runMainWithRandomDelay(minDelay: number, maxDelay: number) {
  const delay = getRandomDelay(minDelay, maxDelay);
  log.schedule(`Running main with delay of ${delay / 1000 / 60} minutes`);
  setTimeout(() => main().catch(log.error), delay);
}

// Health check every 30 minutes
(new CronJob('0 */30 * * * *', () => checkConn())).start();

const jobs = []

for (const schedule of config.Schedules) {
  const cronExpression = timeToCron(schedule.Time);
  jobs.push(new CronJob(cronExpression, () => runMainWithRandomDelay(0, schedule.MaxDelay * 60)));
  log.schedule(`Scheduled run at ${schedule.Time} with max delay of ${schedule.MaxDelay} minutes. Next run: ${calculateNextRun(cronExpression).toLocaleString()}`);
}

jobs.forEach(job => {job.start()});
log.debug('Scheduled jobs:', jobs.map(job => job.cronTime.source));
log.schedule('Waiting for scheduled jobs to run...');
checkConn()

