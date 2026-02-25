import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { LocationData } from './locationService';
import { API_CONFIG } from '../constants/config';

const QUEUE_STORAGE_KEY = '@PFSLive:locationQueue';
const MAX_QUEUE_SIZE = 500;

export interface QueuedLocation extends LocationData {
  participantId: string;
  eventId: string;
  queuedAt: string;
  retryCount: number;
}

export const locationQueueService = {
  async hasNetwork(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected === true && state.isInternetReachable === true;
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error checking network:', error);
      }
      return false;
    }
  },

  async addToQueue(location: QueuedLocation): Promise<void> {
    try {
      const queue = await this.getQueue();
      
      if (queue.length >= MAX_QUEUE_SIZE) {
        if (API_CONFIG.DEBUG) {
          console.warn('⚠️ Queue is full, removing oldest location');
        }
        queue.shift();
      }

      queue.push(location);
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      
      if (API_CONFIG.DEBUG) {
        console.log(`📦 Location queued (${queue.length} in queue)`);
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error adding to queue:', error);
      }
    }
  },

  async getQueue(): Promise<QueuedLocation[]> {
    try {
      const queueData = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      return queueData ? JSON.parse(queueData) : [];
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error getting queue:', error);
      }
      return [];
    }
  },

  async removeFromQueue(count: number): Promise<void> {
    try {
      const queue = await this.getQueue();
      queue.splice(0, count);
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      
      if (API_CONFIG.DEBUG) {
        console.log(`✅ Removed ${count} locations from queue (${queue.length} remaining)`);
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error removing from queue:', error);
      }
    }
  },

  async clearQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
      
      if (API_CONFIG.DEBUG) {
        console.log('✅ Queue cleared');
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error clearing queue:', error);
      }
    }
  },

  async getQueueSize(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  },
};