import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

enum KindroidMessageType {
  ChatBreak = 'chat-break',
  SendMessage = 'send-message'
}

interface KindroidConfig {
  apiKey: string;
  baseURL?: string;
}

interface MessageContent {
  ai_id: string;
  message: string;
}

interface ChatBreakContent {
  ai_id: string;
  greeting: string;
}

class KindroidAPI {
  private client: AxiosInstance;

  constructor(config: KindroidConfig) {
    this.client = axios.create({
      baseURL: config.baseURL || 'https://api.kindroid.ai/v1',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`
      }
    });
  }

  public async sendMessageInternal(message: MessageContent): Promise<any> {
    return this.sendKinCallInternal(message, KindroidMessageType.SendMessage);
  }

  public async sendChatBreakInternal(message: ChatBreakContent): Promise<any> {
    this.sendKinCallInternal(message, KindroidMessageType.ChatBreak);
  }

  public async sendKinCallInternal(message: MessageContent | ChatBreakContent, callType: KindroidMessageType): Promise<any> {
    var endpoint = '';
    switch (callType) {
      case KindroidMessageType.ChatBreak:
        endpoint = '/chat-break';
        break;
      case KindroidMessageType.SendMessage:
        endpoint = '/send-message';
        break;
      default:
        throw new Error('Invalid call type.');
    }

    try {
      const response: AxiosResponse = await this.client.post(endpoint, message);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          console.error('API Error:', axiosError.response.data);
        } else {
          console.error('Network or Other Error:', error.message);
          throw new Error('Unable to connect to the server.');
        }
      } else {
        console.error('Unknown Error:', error);
        throw new Error('An unknown error occurred.');
      }
    }
  }
}

let kindroidInstance: KindroidAPI;

function getAPIInstance(config: KindroidConfig): KindroidAPI {
  if (!kindroidInstance) {
    kindroidInstance = new KindroidAPI(config);
  }
  return kindroidInstance;
}

export async function sendMessage(config: KindroidConfig, message: MessageContent): Promise<any> {
  const api = getAPIInstance(config);
  return api.sendMessageInternal(message);
}

export async function sendChatBreak(config: KindroidConfig, message: ChatBreakContent): Promise<any> {
  const api = getAPIInstance(config);
  return api.sendChatBreakInternal(message);
}

