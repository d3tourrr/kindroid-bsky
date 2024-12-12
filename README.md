# kindroid-bsky

> [!TIP]
> This is a fun side project maintained by one guy in his spare time. If you run into a bug, please open an issue on this repo. If you have trouble getting things up and running, support is limited, but available on Discord (try and find d3tour in the Kindroid Discord server). If there's a feature you'd like to see included in a future release, open an issue on this repo and request it.
> 
> This project is presented as is, without warranty or reliable support (I haven't even written tests for any of this, and I don't plan to). 
> 
> **That being said, it works pretty well, and it's a lot of fun. So, have fun!**

## Introduction

This is a simple project to replicate human behavior on [Bluesky](https://bsky.social) using a [Kindroid.ai](https://kindroid.ai) AI companion. 

At scheduled intervals, this integration will interact with other people's posts on Bluesky, and post their own. More: [What exactly does a Kinroid do on Bluesky?](#what-exactly-does-a-kinroid-do-on-bluesky)

## Setup

### Dependencies

* You must have Git installed (instructions: [Windows](https://git-scm.com/download/win), [Mac](https://git-scm.com/download/mac), [Linux](https://git-scm.com/download/linux))
* You must have Docker installed (instructions: [Windows](https://docs.docker.com/desktop/install/windows-install/), [Mac](https://docs.docker.com/desktop/install/mac-install/), [Linux](https://docs.docker.com/desktop/install/linux-install/))
* Run the following commands
  * `git clone https://github.com/d3tourrr/kindroid-bsky.git` - Downloads the project
  * `cd kindroid-bsky` - Changes the current directory to the project directory
* Continue with the rest of the setup
  
### Configure your `.env` file
* Make a copy of the `.env.example` file and name it `.env` (Windows users, make sure you don't accidentally name it `.env.txt` or `.env.env`)
* Place your values into their assigned spots
  * `BSKY_TOKEN` - Your Bluesky app password. Generate an App Password via Settings > Privacy and Security > App Passwords.
  * `KIN_KEY` - Your Kindroid.ai API key. Open the side panel > General > API and advanced integrations > API key.

### Configure your `config.json` file
* Make a copy of the `config-example.json` file and name it `config.json`
* Fill in the values as needed, following the included examples
  * `BskyHandle` - Your **email address** you use to log in to Bluesky.
  * `KindroidId` - The ID of the AI companion you want to use. Find it in the same place as your Kindroid API key, making sure you've selected the Kin you want to bring onto Bsky.
  * `Keywords` - An array of keywords to look for in posts. If a post contains any of these keywords, it will be considered for engagement. Your Kin will search for two of these words at random for posts to interact with each time it "goes online".
  * `InteractCount` - How many posts to like/repost/reply to each time the Kin goes online.
  * `MaxMentionReply` - How many of your Kin's mentions and replies to reply to each time it goes online.
  * `NewPostCount` - How many new posts to make each time the Kin goes online.
  * `Schedules` - An array of objects with `Time` and `MaxDelay` properties. The Kin will go online sometime randomly between `Time` and however many minutes are given in `MaxDelay`. So a `Time` of `8:01 AM` with a `MaxDelay` of `38` means your Kin will randomly go online between 8:01 AM and 8:39 AM. Times can be 12 or 24 hour format. 12 hour format needs an `AM` or `PM` at the end.
  * `Topics` - An array of topics to choose from when making new posts. The Kin will randomly select one of these topics each time it goes online. `Topic` is the what you want your Kin to post about. `Tone` is the tone you want your Kin to use when posting about that topic. Your Kin gets prompted like this: `Create a new Bluesky post. Topic: <topic>. Tone: <tone>.`

You can have as many schedules, keywords and topics as you want. Every schedule will be run in order (careful not to crowd them, you don't want them to overlap), keywords and topics are chosen at random.

## Running the project

> [!NOTE]
> This project is meant to run inside a Docker container. By default, Docker containers are set to use the UTC timezone. When your container is started, a timezone that matches the timezone you intend for your schedules in your `config.json` schedules in must be passed via the `TZ` environment variable. So, unless the schedules you put in your `config.json` are *supposed* to be in UTC, make sure your local IANA formatted timezone is passed to the Docker container as the `TZ` environment variable. The helper scripts provided in this project will do this for you.

### Using the `start-<platform>.ps1/sh` scripts

This project comes with three helper scripts depending on what platform you're running on. The Mac and Linux scripts may need you to run `chmod +x start-<os>.sh` to make them executable. The PowerShell script may need to be unblocked, or your local execution policy changed.

* Windows: `start-windows.ps1`
* Mac: `start-osx.sh`
* Linux: `start-linux.sh`

All three scripts will parse your local system's timezone and start the Docker container with the correct `TZ` environment variable.

### Running the Docker container manually

> [!WARNING]
> Timezones *must* be passed in the IANA format. You can find a list of valid timezones [here](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

* `docker container rm kin-bsky -f` - Removes any existing Docker container with the name `kin-bsky` if you are updating or making a change.
* `docker build -t kin-bsky .` - Builds the Docker image.
* `docker run -d --name kin-bsky -e TZ=<timezone> --name kin-bsky kin-bsky` - Runs the Docker container with the timezone you want your Kin to use. Replace `<timezone>` with your IANA formatted timezone.

### Checking in on your Kin

* `docker logs kin-bsky` - Shows the logs of the running container. You will see when your Kin goes online and what it does.


### Troubleshooting

You can set two environment variables to help with debugging:

* **Show debug logs:** Set the `LOG_LEVEL` environment to `1` to show debug logs. Add `-e LOG_LEVEL=1` to your `docker run` command.
* **Show what line in the code is generating log output:** Set the `SHOW_POSITION` environment variable to `TRUE` to show the file and line number of the code generating the log output. Add `-e SHOW_POSITION=TRUE` to your `docker run` command.

## Setting up your Kindroid.ai AI companion

> [!CAUTION]
> Interacting on Bluesky is unlike the normal interactions that your Kindroid is meant to have. This integration has only been tested with a Kin who is specifically setup to interact on Bluesky, and not interacted with otherwise.

### Backstory

It's important to provide your Kin context on what it means to interact on Bluesky. Here's an example backstory you can use.

> [!TIP]
> This is very strict guidance. You might want to adjust it if you intend to have normal interactions with your Kin, but it may result in your Kin posting in a way that is not suitable for Bluesky.

```
IMPORTANT: <human> is not a person. Messages from <human> are instructions on how to interact on the social media platform Bluesky. <kin> is given a post on Bluesky to write a response for, or asked to generate a brand new post. <kin> and <user> do not have conversations. <user> and <kin>'s only interactions are where <user> solicits <kin>'s response to a Bluesky post or requests a brand new Bluesky post from <kin>. Every message <kin> sends to <user> becomes a public Bluesky post. <kin> never uses hashtags. <kin> focuses on high quality posts. Being high quality includes avoiding being overly verbose.

<kin> never addresses <human>. <kin> never narrates their actions or uses any other action statements. <kin> never comments on their interactions with <user>. <kin> always writes a response or new post as requested by <user>. <user> is the system by which <kin> interacts with Bluesky.

Bluesky posts/replies must:
- Be under 240 characters
- Exclude *actions*
- Exclude headers, prefixes, or any narration
- Exclude #hashtags
- Exclude @mentions
- Consist only of the content which will be posted to Bluesky
- Be high quality
```

At this time #hashtags and @mentions aren't properly translated between your Kin's message and what gets posted onto Bluesky. Your Kin can still use them, they just won't be the clickable mention or hashtag link that you'd think you'd get.

### Response Directive

You can provide a response directive to your Kin to help guide the tone of their responses. Here's an example response directive you can use.

```
No actions. Never address <human>. Every message is a Bluesky post, either a reply to a post shared by <human>, or a new post by <kin>.
```

### Journal Entry

Journal Entries are retrieved and put into your Kin's short term memory when certain keywords are used. Here's an example.

* **Keywords** `bluesky`, `respond`, `reply`

```
Bluesky posts/replies must:
- Be under 240 characters
- Exclude *actions*
- Exclude headers, prefixes, or any narration
- Exclude #hashtags
- Exclude @mentions
- Consist only of the content which will be posted to Bluesky
- Be high quality
```

### Chat Breaks

Chat Breaks are a Kindroid feature that issues a soft break in the conversation. At the end of every online session, your Kin will be issued a Chat Break. Chat Breaks include your Kin's next message after the break. Right now, this is hard coded to "Waiting for instruction" but will be configurable in the future.

# What exactly does a Kinroid do on Bluesky?

During each online session, your Kin will:

* Like, repost, or reply to `InteractCount` number of posts containing two random keywords you've set in your `config.json` file. Whether to like, repost or reply is chosen at random per post.
* Post `NewPostCount` new posts, using a random topic and tone from the list you've set in your `config.json` file.
* Respond to up to `MaxMentionReply` mentions and replies.
* Follow everyone they interact with.

This integration also runs a health check every 30 minutes. You can check in the logs to see `Connection health check passed` to ensure your Kin's access to Bsky is still working. If one of these fails, it probably means that either your account has been blocked, your Kin is being rate limited, the app password is revoked/incorrect, or Bluesky is down.

## Warnings

* **Ethics**: This project is meant to replicate human behavior on Bluesky. It is important to remember that your Kin is not a human, and so it is important to set strict guidelines for how your Kin interacts on Bluesky. This project is not meant to be used for malicious purposes or to mislead people, however by default, your Kin will approximate human interactions which largely pass as human.
* **Rate Limiting**: Bluesky has rate limits in place to prevent spam. Your Kin will respect these rate limits, however it is important to remember that Bluesky may still block your Kin if it detects unusual behavior. It is important to set your Kin's behavior to be as human-like as possible to avoid this.
* **AI Companion Limitations**: Your Kin is an AI companion, and as such, it has limitations. Kins sometimes have problems following formatting guidelines and holding context. It is important to monitor your Kin's interactions to ensure they are following the guidelines you've set for them.

# Future Features

* Interact more with people your Kin follows
* Interact with direct messages
* Different schedules per day (currently every schedule runs every day)
* Configurable chat break message
* Configurable weights for like/reply/repost decision

