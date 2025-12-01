import Dexie, { Table } from 'dexie';

export interface DBAsset {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  createdAt: number;
}

class BrowserNLEDatabase extends Dexie {
  assets!: Table<DBAsset>;

  constructor() {
    super('BrowserNLE');
    (this as any).version(1).stores({
      assets: 'id, name, type, createdAt'
    });
  }
}

export const db = new BrowserNLEDatabase();