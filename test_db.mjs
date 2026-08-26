import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
console.log('Module loaded successfully!')
console.log('DB path:', __dirname + '/../data/test.db')

const db = new Database(__dirname + '/../data/test.db')
export default db
export const test = 'ok'
