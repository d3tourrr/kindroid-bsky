import { AtpAgent } from '@atproto/api';
import * as dotenv from 'dotenv';
import { randomInt } from 'crypto';
import { Logger } from 'tslog';
import * as fs from 'fs/promises';
import { sendMessage, sendChatBreak } from './kindroid';

// Constants
const agent = new AtpAgent({ service: 'https://bsky.social' });
const keywords = ["ai", "machine learning", "data science", "blockchain", "crypto", "nft", "web3", "decentralized", "metaverse", "virtual reality", "bsky"];
const maxresults = 5;
const log = new Logger();

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
  await agent.login({ identifier: getEnvVar("BSKY_HANDLE"), password: getEnvVar("BSKY_TOKEN") });
}

async function searchAndAnalyze(keywords: string[]) {
  await authenticate();
  await new Promise(resolve => setTimeout(resolve, randomInt(1000, 5000))); // Humans don't interact instantly

  const analyzedPosts = await searchPostsWithMultipleKeywords(keywords);

  const posts = analyzedPosts.map(post => ({
    post: post,
    text: post.record?.text || 'No text content',
    value: analyzePostInteractionValue(post),
    author: post.author.handle,
    uri: post.uri,
    cid: post.cid,
    url: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`
  })).sort((a, b) => b.value - a.value);

  return posts.slice(0, maxresults);
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
    const response = await agent.api.app.bsky.feed.searchPosts({ q: keyword, limit: limit, since: since});
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
      log.info('Liking:', post.url);
      log.info('Engagement Score:', post.value);
      log.info('Text:', post.text);
      await agent.like(post.uri, post.cid);
      await followUser(post.author, agent).catch(log.error);
      break;
    case 'repost':
      log.info('Reposting:', post.url);
      log.info('Engagement Score:', post.value);
      log.info('Text:', post.text);
      await agent.repost(post.uri, post.cid);
      await followUser(post.author, agent).catch(log.error);
      break;
    case 'reply':
      log.info('Replying:', post.url);
      log.info('Engagement Score:', post.value);
      log.info('Text:', post.text);

      try {
        const replyObject = {
          root: {uri: post.uri, cid: post.cid},
          parent: {uri: post.uri, cid: post.cid},
        };
        var reply = await getKindroidMessage("Reply to this post from " + post.author + "\n\n" + post.text);
        log.info('Reply:', reply);
        await agent.post({
          text: reply,
          reply: replyObject
        });
        log.info('Replied to post:', post.url);
        await followUser(post.author, agent).catch(log.error);
      } catch (error) {
        log.error('Failed to reply to post:', error);
      }
      break;
  }
}

async function simulateHumanInteractions(index: number) {
  log.info("Searching for posts with keywords:", keywords.slice(index * 2, (index * 2) + 2));
  const topPosts = await searchAndAnalyze(keywords.slice(index * 2, (index * 2) + 2));

  log.info("Interacting with top posts...");
  for (let i = 0; i < topPosts.length; i++) {
    const post = topPosts[i];
    await new Promise(resolve => setTimeout(resolve, randomInt(15000, 35000))); // Humans don't interact instantly
    await interactWithPost(post);
  }

  log.info("Posting an original message...");
  var topics = await parseTopicToneJSON('../topics.json');
  var randomTopic = topics[Math.floor(Math.random() * topics.length)];
  log.info(`Random Topic: ${randomTopic.Topic}, Tone: ${randomTopic.Tone}`);
  const newPostContent = await getKindroidMessage(`Create a new Bluesky post. Topic: ${randomTopic.Topic}. Tone: ${randomTopic.Tone}.`);
  await agent.post({ text: newPostContent });
  log.info('Posted:', newPostContent);

  log.info("Replying to mentions...");
  await replyToMentions(agent);

  log.info("Initiating Kindroid chat break...");
  await initiateKindroidChatBreak();
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

    log.info(`Followed: ${handle}`);
  } catch (error) {
    log.error(`Failed to follow ${handle}:`, error);
    throw error;
  }
}

async function getMentions(agent: AtpAgent): Promise<any[]> {
  try {
    const mentions = await searchPostsWithMultipleKeywords([`mentions:${agent.session.handle}`], 5);
    if (mentions.length > 0) {
    } else {
      log.info(`No mentions found for ${agent.session.handle}`);
    }
    return mentions;
  } catch (error) {
    log.error(`Failed to get mentions for ${agent.session.handle}:`, error);
  }

  return []
}

async function replyToMentions(agent: AtpAgent) {
  const posts = await getMentions(agent);

  for (const post of posts) {
    await new Promise(resolve => setTimeout(resolve, randomInt(5000, 15000)));
    try {
      const replyObject = {
        root: {uri: post.uri, cid: post.cid},
        parent: {uri: post.uri, cid: post.cid},
      };
      var reply = await getKindroidMessage("Reply to this post from " + post.author + " who @mentioned you directly.\n\n" + post.text);
      log.info('Reply:', reply);
      await agent.post({
        text: reply,
        reply: replyObject
      });
      log.info('Replied to post:', post.url);
      await followUser(post.author, agent).catch(log.error);
    } catch (error) {
      log.error('Failed to reply to post:', error);
    }
  }
}

// Kindroid interactions
async function getKindroidMessage(prompt: string): Promise<string> {
  const config = { apiKey: getEnvVar('KIN_KEY') };
  const messageContent = {
    ai_id: getEnvVar('KIN_ID'),
    message: prompt
  };

  return sendMessage(config, messageContent).then(response => response).catch(error => {
    log.error('Failed to send message:', error.message);
  });
}

async function initiateKindroidChatBreak() {
  const config = { apiKey: getEnvVar('KIN_KEY') };
  const chatBreakContent = {
    ai_id: getEnvVar('KIN_ID'),
    greeting: 'Waiting for instruction'
  };

  return sendChatBreak(config, chatBreakContent).then(response => response).catch(error => {
    log.error('Failed to send chat break:', error.message);
  });
}

// Topics to discuss
interface Topic {
  Topic: string;
  Tone: string;
}

async function parseTopicToneJSON(filePath: string): Promise<Topic[]> {
  try {
    const jsonData = await fs.readFile(filePath, 'utf-8');
    const dataArray = JSON.parse(jsonData) as { topic: string; tone: string }[];
    const result: Topic[] = dataArray.map(item => ({
      Topic: item.topic,
      Tone: item.tone
    }));

    return result;
  } catch (error) {
    log.error('Failed to parse JSON file:', error);
    throw error;
  }
}

// Main online time
async function main() {
  dotenv.config();

  try {
    await simulateHumanInteractions(randomInt(0, Math.floor(keywords.length / 2)));
  } catch (error) {
    log.error('Failed to fetch or analyze posts:', error);
  }
}

main().catch(log.error);

