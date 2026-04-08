const MemoryGraph = {
  dbName: 'RealityLayerMemory',
  dbVersion: 1,
  db: null,
  
  async initialize() {
    await this.openDB();
    await this.loadStoredMemory();
  },
  
  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        
        if (!db.objectStoreNames.contains('entities')) {
          const store = db.createObjectStore('entities', { keyPath: 'id', autoIncrement: true });
          store.createIndex('url', 'url', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('relationships')) {
          const relStore = db.createObjectStore('relationships', { keyPath: 'id', autoIncrement: true });
          relStore.createIndex('from', 'from', { unique: false });
          relStore.createIndex('to', 'to', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  },
  
  async addEntity(data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('entities', 'readwrite');
      const store = tx.objectStore('entities');
      
      const entity = {
        ...data,
        createdAt: Date.now(),
        accessedAt: Date.now()
      };
      
      const request = store.add(entity);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  async getEntitiesByUrl(url) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('entities', 'readonly');
      const store = tx.objectStore('entities');
      const index = store.index('url');
      const request = index.getAll(url);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  async getEntitiesByType(type) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('entities', 'readonly');
      const store = tx.objectStore('entities');
      const index = store.index('type');
      const request = index.getAll(type);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  async addRelationship(from, to, type) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('relationships', 'readwrite');
      const store = tx.objectStore('relationships');
      
      const relationship = {
        from,
        to,
        type,
        createdAt: Date.now()
      };
      
      const request = store.add(relationship);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  async findRelatedEntities(entityId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('relationships', 'readonly');
      const store = tx.objectStore('relationships');
      const index = store.index('from');
      const request = index.getAll(entityId);
      
      request.onsuccess = () => {
        const rels = request.result;
        const relatedIds = rels.map(r => r.to);
        
        const entityTx = this.db.transaction('entities', 'readonly');
        const entityStore = entityTx.objectStore('entities');
        
        const entities = [];
        relatedIds.forEach(id => {
          const req = entityStore.get(id);
          req.onsuccess = () => entities.push(req.result);
        });
        
        resolve(entities);
      };
      
      request.onerror = () => reject(request.error);
    });
  },
  
  async saveResearch(data) {
    const entity = await this.addEntity({
      type: 'research',
      url: window.location.href,
      title: document.title,
      content: data.content,
      highlights: data.highlights || [],
      notes: data.notes || [],
      tags: data.tags || []
    });
    
    const existingResearch = await this.getEntitiesByType('research');
    const previousOnTopic = existingResearch.filter(r => 
      r.url !== window.location.href && 
      this.isRelatedTopic(r.content, data.content)
    );
    
    for (const prev of previousOnTopic) {
      await this.addRelationship(entity.id, prev.id, 'related');
    }
    
    return entity;
  },
  
  isRelatedTopic(content1, content2) {
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = [...words1].filter(w => words2.has(w) && w.length > 3);
    return intersection.length >= 3;
  },
  
  async findContradictions(topic) {
    const research = await this.getEntitiesByType('research');
    
    const contradictions = [];
    for (const r of research) {
      if (this.isRelatedTopic(r.content, topic)) {
        const related = await this.findRelatedEntities(r.id);
        for (const rel of related) {
          if (rel.claims && this.hasContradictingClaims(r.content, rel.content)) {
            contradictions.push({
              entity1: r,
              entity2: rel
            });
          }
        }
      }
    }
    
    return contradictions;
  },
  
  hasContradictingClaims(content1, content2) {
    const contradictionIndicators = [
      ['increase', 'decrease'],
      ['better', 'worse'],
      ['higher', 'lower'],
      ['positive', 'negative'],
      ['true', 'false'],
      ['yes', 'no']
    ];
    
    for (const [pos, neg] of contradictionIndicators) {
      if ((content1.includes(pos) && content2.includes(neg)) ||
          (content1.includes(neg) && content2.includes(pos))) {
        return true;
      }
    }
    
    return false;
  },
  
  async getSimilarUrls(url) {
    const baseUrl = new URL(url).hostname;
    const allResearch = await this.getEntitiesByType('research');
    
    return allResearch.filter(r => {
      try {
        const entityUrl = new URL(r.url).hostname;
        return entityUrl === baseUrl;
      } catch {
        return false;
      }
    });
  },
  
  async getContext(url) {
    const similar = await this.getSimilarUrls(url);
    
    const context = [];
    similar.forEach(entity => {
      if (entity.content) {
        context.push({
          url: entity.url,
          summary: this.summarize(entity.content),
          timestamp: entity.createdAt
        });
      }
    });
    
    return context.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  },
  
  summarize(content, maxLength = 200) {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  },
  
  async exportGraph() {
    const entities = await new Promise((resolve, reject) => {
      const tx = this.db.transaction('entities', 'readonly');
      const store = tx.objectStore('entities');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    const relationships = await new Promise((resolve, reject) => {
      const tx = this.db.transaction('relationships', 'readonly');
      const store = tx.objectStore('relationships');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    return { entities, relationships };
  },
  
  async loadStoredMemory() {
    try {
      const result = await chrome.storage.local.get(['memoryGraph']);
      if (result.memoryGraph) {
        console.log('[MemoryGraph] Loaded stored memory');
      }
    } catch (e) {
      console.error('[MemoryGraph] Failed to load stored memory:', e);
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MemoryGraph.initialize());
} else {
  MemoryGraph.initialize();
}

window.MemoryGraph = MemoryGraph;