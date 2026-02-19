import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { LocationData } from './locationService';

const QUEUE_STORAGE_KEY = '@PFSLive:locationQueue';
const MAX_QUEUE_SIZE = 500; // Max locations to store offline

export interface QueuedLocation extends LocationData {
  participantId: string;
  eventId: string;
  queuedAt: string;
  retryCount: number;
}

export const locationQueueService = {
  /**
   * Check if device has network connection
   */
  async hasNetwork(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected === true && state.isInternetReachable === true;
    } catch (error) {
      console.error('❌ Error checking network:', error);
      return false;
    }
  },

  /**
   * Add location to queue (for offline storage)
   */
  async addToQueue(location: QueuedLocation): Promise<void> {
    try {
      const queue = await this.getQueue();
      
      // Prevent queue from growing too large (battery optimization)
      if (queue.length >= MAX_QUEUE_SIZE) {
        console.warn('⚠️ Queue is full, removing oldest location');
        queue.shift(); // Remove oldest
      }

      queue.push(location);
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      
      console.log(`📦 Location queued (${queue.length} in queue)`);
    } catch (error) {
      console.error('❌ Error adding to queue:', error);
    }
  },

  /**
   * Get all queued locations
   */
  async getQueue(): Promise<QueuedLocation[]> {
    try {
      const queueData = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      return queueData ? JSON.parse(queueData) : [];
    } catch (error) {
      console.error('❌ Error getting queue:', error);
      return [];
    }
  },

  /**
   * Remove locations from queue
   */
  async removeFromQueue(count: number): Promise<void> {
    try {
      const queue = await this.getQueue();
      queue.splice(0, count);
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      console.log(`✅ Removed ${count} locations from queue (${queue.length} remaining)`);
    } catch (error) {
      console.error('❌ Error removing from queue:', error);
    }
  },

  /**
   * Clear entire queue
   */
  async clearQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
      console.log('✅ Queue cleared');
    } catch (error) {
      console.error('❌ Error clearing queue:', error);
    }
  },

  /**
   * Get queue size
   */
  async getQueueSize(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  },
};