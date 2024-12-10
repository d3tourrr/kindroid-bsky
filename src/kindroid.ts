import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

interface KindroidConfig {
  apiKey: string;
  baseURL?: string;
}

interface MessageContent {
  ai_id: string;
  message: string;
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
    try {
      const response: AxiosResponse = await this.client.post('/send-message', message);
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
  return api.sendMessageInternal(message); // Changed to public method
}

// Example usage:
// import { sendMessage } from './kindroid';
//
// const config = { apiKey: 'your_api_key_here' };
// const messageContent = {
//   aiId: 'some-ai-id',
//   content: 'Hello, AI!'
// };
//
// sendMessage(config, messageContent).then(response => {
//   console.log('Message sent successfully:', response);
// }).catch(error => {
//   console.error('Failed to send message:', error.message);
// });
