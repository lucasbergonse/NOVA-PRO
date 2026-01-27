
import { Transcription, ChatContext, PersonaKey } from '../types';

const DB_NAME = 'NovaPro_NeuralMem_v1';
const STORE_CONTEXTS = 'contexts';
const STORE_MESSAGES = 'messages';

class MemoryDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_CONTEXTS)) {
          db.createObjectStore(STORE_CONTEXTS, { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          const msgStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
          msgStore.createIndex('contextId', 'contextId', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        console.error("MemoryDB Init Error:", event);
        reject(event);
      };
    });
  }

  async saveContext(context: ChatContext): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_CONTEXTS, 'readwrite');
      const store = tx.objectStore(STORE_CONTEXTS);
      store.put(context);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getContexts(): Promise<ChatContext[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_CONTEXTS, 'readonly');
      const store = tx.objectStore(STORE_CONTEXTS);
      const request = store.getAll();
      request.onsuccess = () => {
         // Sort by last modified desc
         const res = request.result as ChatContext[];
         res.sort((a, b) => b.lastModified - a.lastModified);
         resolve(res);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteContext(id: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_CONTEXTS, STORE_MESSAGES], 'readwrite');
      
      // Delete context
      tx.objectStore(STORE_CONTEXTS).delete(id);
      
      // Delete associated messages (This is a naive implementation, ideally use index cursor deletion)
      const msgStore = tx.objectStore(STORE_MESSAGES);
      const index = msgStore.index('contextId');
      const req = index.openCursor(IDBKeyRange.only(id));
      
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveMessages(contextId: string, messages: Transcription[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_MESSAGES, 'readwrite');
      const store = tx.objectStore(STORE_MESSAGES);
      
      messages.forEach(msg => {
        store.put({ ...msg, contextId });
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMessages(contextId: string): Promise<Transcription[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_MESSAGES, 'readonly');
      const store = tx.objectStore(STORE_MESSAGES);
      const index = store.index('contextId');
      const request = index.getAll(IDBKeyRange.only(contextId));
      
      request.onsuccess = () => {
        const msgs = request.result as (Transcription & { contextId: string })[];
        // Convert timestamp strings back to Date objects if IndexedDB serialized them differently
        const processed = msgs.map(m => ({
            ...m,
            timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp)
        }));
        // Sort by time
        processed.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        resolve(processed);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const memoryDB = new MemoryDB();
