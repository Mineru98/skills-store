# Localbase Guide

Complete API reference and patterns for localbase (IndexedDB wrapper).

## Overview

**Localbase** is a Firebase-style client-side database built on IndexedDB.

- Repository: https://github.com/samuk190/localbase
- Version: 0.7.7+
- Built on: LocalForage

## Installation

```bash
npm install localbase --save
```

```javascript
import Localbase from 'localbase'
const db = new Localbase('my-database')
db.config.debug = false // Disable console logs
```

## CRUD Operations

### Create (Add)

```javascript
// Add with auto-generated key
await db.collection('users').add({
  id: 1,
  name: 'Bill',
  email: 'bill@example.com',
  age: 47
})

// Add with custom key
await db.collection('users').add({
  id: 1,
  name: 'Bill'
}, 'custom-key-123')
```

### Read (Get)

```javascript
// Get all documents
const users = await db.collection('users').get()
// → [{ id: 1, name: 'Bill' }, { id: 2, name: 'Paul' }]

// Get single document by criteria
const user = await db.collection('users').doc({ id: 1 }).get()
// → { id: 1, name: 'Bill' }

// Get by custom key
const user = await db.collection('users').doc('custom-key-123').get()
```

### Update

```javascript
// Partial update (merge)
await db.collection('users').doc({ id: 1 }).update({
  name: 'William'
})
// Result: { id: 1, name: 'William', email: 'bill@example.com', age: 47 }

// Full replace (set)
await db.collection('users').doc({ id: 1 }).set({
  id: 1,
  name: 'William',
  email: 'william@example.com'
})
// Result: { id: 1, name: 'William', email: 'william@example.com' }
```

### Delete

```javascript
// Delete single document
await db.collection('users').doc({ id: 1 }).delete()

// Delete by key
await db.collection('users').doc('custom-key-123').delete()

// Delete entire collection
await db.collection('users').delete()

// Delete entire database
await db.delete()
```

## Query Operations

### Order By

```javascript
// Ascending (default)
const users = await db.collection('users').orderBy('age').get()

// Descending
const users = await db.collection('users').orderBy('name', 'desc').get()
```

### Limit

```javascript
const users = await db.collection('users')
  .orderBy('age', 'asc')
  .limit(5)
  .get()
```

### Get with Keys

```javascript
const users = await db.collection('users').get({ keys: true })
// → [{ key: 'abc123', data: { id: 1, name: 'Bill' } }]
```

### Filtering (Client-Side)

Localbase has no `.where()` - filter after retrieval:

```javascript
const users = await db.collection('users').get()
const adults = users.filter(u => u.age >= 18)
const byEmail = users.find(u => u.email === 'bill@example.com')
```

## File Storage Patterns

### Store Blob

```javascript
async function storeImage(file) {
  const blob = new Blob([file], { type: file.type })
  
  await db.collection('images').add({
    name: file.name,
    type: file.type,
    size: file.size,
    blob: blob,
    uploadedAt: new Date().toISOString()
  }, file.name) // Use filename as key
}

async function getImage(name) {
  const record = await db.collection('images').doc(name).get()
  if (record) {
    return URL.createObjectURL(record.blob)
  }
  return null
}
```

### Store Base64

```javascript
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
  })
}

async function saveFileAsBase64(file) {
  const base64 = await fileToBase64(file)
  
  await db.collection('files').add({
    name: file.name,
    type: file.type,
    data: base64,
    createdAt: new Date().toISOString()
  })
}
```

## Repository Pattern

### Generic Base Repository

```typescript
interface Entity {
  id?: number | string
}

class BaseRepository<T extends Entity> {
  protected db: Localbase
  protected collectionName: string

  constructor(collectionName: string, dbName: string = 'app-db') {
    this.db = new Localbase(dbName)
    this.collectionName = collectionName
    this.db.config.debug = false
  }

  async getAll(): Promise<T[]> {
    return await this.db.collection(this.collectionName).get() || []
  }

  async getById(id: number | string): Promise<T | null> {
    return await this.db.collection(this.collectionName).doc({ id }).get()
  }

  async create(entity: T): Promise<T> {
    await this.db.collection(this.collectionName).add(entity)
    return entity
  }

  async update(id: number | string, updates: Partial<T>): Promise<void> {
    await this.db.collection(this.collectionName).doc({ id }).update(updates)
  }

  async delete(id: number | string): Promise<void> {
    await this.db.collection(this.collectionName).doc({ id }).delete()
  }

  async find(predicate: (item: T) => boolean): Promise<T[]> {
    const all = await this.getAll()
    return all.filter(predicate)
  }

  async findOne(predicate: (item: T) => boolean): Promise<T | null> {
    const all = await this.getAll()
    return all.find(predicate) || null
  }

  async clear(): Promise<void> {
    await this.db.collection(this.collectionName).delete()
  }
}
```

### Concrete Repository Example

```typescript
interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'user'
  createdAt: string
}

class UserRepository extends BaseRepository<User> {
  constructor() {
    super('users')
  }

  async getByEmail(email: string): Promise<User | null> {
    return await this.findOne(u => u.email === email)
  }

  async getByRole(role: 'admin' | 'user'): Promise<User[]> {
    return await this.find(u => u.role === role)
  }

  async getAdmins(): Promise<User[]> {
    return await this.getByRole('admin')
  }

  async getSorted(field: keyof User, order: 'asc' | 'desc' = 'asc'): Promise<User[]> {
    return await this.db.collection(this.collectionName)
      .orderBy(field as string, order)
      .get()
  }
}

// Usage
const userRepo = new UserRepository()

// Create
await userRepo.create({
  id: 1,
  name: 'John',
  email: 'john@example.com',
  role: 'admin',
  createdAt: new Date().toISOString()
})

// Read
const admins = await userRepo.getAdmins()
const john = await userRepo.getByEmail('john@example.com')

// Update
await userRepo.update(1, { name: 'John Doe' })

// Delete
await userRepo.delete(1)
```

### Vanilla JavaScript Repository

```javascript
class TaskRepository {
  constructor() {
    this.db = new Localbase('todo-app')
    this.collection = 'tasks'
    this.db.config.debug = false
  }

  async getAll() {
    return await this.db.collection(this.collection).get() || []
  }

  async getById(id) {
    return await this.db.collection(this.collection).doc({ id }).get()
  }

  async create(task) {
    const newTask = {
      ...task,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      completed: false
    }
    await this.db.collection(this.collection).add(newTask)
    return newTask
  }

  async update(id, updates) {
    await this.db.collection(this.collection).doc({ id }).update(updates)
  }

  async delete(id) {
    await this.db.collection(this.collection).doc({ id }).delete()
  }

  async toggleComplete(id) {
    const task = await this.getById(id)
    if (task) {
      await this.update(id, { completed: !task.completed })
    }
  }

  async getCompleted() {
    const tasks = await this.getAll()
    return tasks.filter(t => t.completed)
  }

  async getPending() {
    const tasks = await this.getAll()
    return tasks.filter(t => !t.completed)
  }
}
```

## Hybrid Storage Pattern

Use LocalStorage for settings, localbase for data:

```javascript
class AppStorage {
  constructor() {
    this.db = new Localbase('app')
    this.db.config.debug = false
  }

  // Settings (LocalStorage)
  getSettings() {
    const settings = localStorage.getItem('app-settings')
    return settings ? JSON.parse(settings) : {
      theme: 'light',
      language: 'en',
      notifications: true
    }
  }

  saveSettings(settings) {
    localStorage.setItem('app-settings', JSON.stringify(settings))
  }

  updateSetting(key, value) {
    const settings = this.getSettings()
    settings[key] = value
    this.saveSettings(settings)
  }

  // Data (localbase/IndexedDB)
  async getData(collection) {
    return await this.db.collection(collection).get() || []
  }

  async addData(collection, item) {
    await this.db.collection(collection).add(item)
  }

  async clearData(collection) {
    await this.db.collection(collection).delete()
  }
}
```

## Best Practices

### Error Handling

```javascript
async function safeOperation() {
  try {
    const data = await db.collection('items').get()
    return { success: true, data }
  } catch (error) {
    console.error('Database error:', error)
    return { success: false, error: error.message }
  }
}
```

### Batch Operations

```javascript
async function batchAdd(items, batchSize = 100) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    for (const item of batch) {
      await db.collection('items').add(item)
    }
    // Allow event loop to process
    await new Promise(r => setTimeout(r, 0))
  }
}
```

### ID Generation

```javascript
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Usage
const newItem = {
  id: generateId(),
  name: 'Item',
  createdAt: new Date().toISOString()
}
```

## Limitations

1. **No `.where()` clause** - Use client-side filtering
2. **No auto-increment** - Generate IDs manually
3. **No complex queries** - Limited to orderBy + limit
4. **No transactions** - Handle consistency manually
5. **Browser storage limits** - ~50MB typical limit
