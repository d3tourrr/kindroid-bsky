import { AtpAgent } from '@atproto/api';
import * as dotenv from 'dotenv';
import { randomInt } from 'crypto';
import { Logger } from 'tslog';
import { sendMessage } from './kindroid';

const agent = new AtpAgent({ service: 'https://bsky.social' });

const keywords = ["ai", "machine learning", "data science", "blockchain", "crypto", "nft", "web3", "decentralized", "metaverse", "virtual reality", "bsky"];
const maxresults = 5;
const log = new Logger();

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

async function authenticate() {
  await agent.login({ identifier: getEnvVar("BSKY_HANDLE"), password: getEnvVar("BSKY_TOKEN") });
}

async function searchAndAnalyze(keywords: string[]) {
  await authenticate();
  await new Promise(resolve => setTimeout(resolve, randomInt(1000, 5000))); // Simulate human interaction

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

async function searchPostsWithMultipleKeywords(keywords: string[]): Promise<any[]> {
  let allPosts = [];

  for (const keyword of keywords) {
    const response = await agent.api.app.bsky.feed.searchPosts({ q: keyword, limit: 50 });
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
      log.info('Liking post:', post.url);
      log.info('Text:', post.text);
      await agent.like(post.uri, post.cid);
      break;
    case 'repost':
      log.info('Reposting:', post.url);
      log.info('Text:', post.text);
      await agent.repost(post.uri, post.cid);
      break;
    case 'reply':
      log.info('Replying to post:', post.url);
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
      } catch (error) {
        log.error('Failed to reply to post:', error);
      }
      break;
  }
}

async function simulateHumanSearch(index: number) {
  log.info("Searching for posts with keywords:", keywords.slice(index * 2, (index * 2) + 2));
  const topPosts = await searchAndAnalyze(keywords.slice(index * 2, (index * 2) + 2));

  for (let i = 0; i < topPosts.length; i++) {
    const post = topPosts[i];
    await new Promise(resolve => setTimeout(resolve, randomInt(15000, 35000))); // Simulate human interaction
    await interactWithPost(post);
  }

  const newPostContent = await getKindroidMessage('Create a new Bluesky post. Topic: Coffee culture. Tone: Cheerful.');
  await agent.post({ text: newPostContent });
  log.info('Posted:', newPostContent);
}

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

async function main() {
  dotenv.config();

  try {
    await simulateHumanSearch(randomInt(0, Math.floor(keywords.length / 2)));
  } catch (error) {
    log.error('Failed to fetch or analyze posts:', error);
  }
}

main().catch(log.error);

